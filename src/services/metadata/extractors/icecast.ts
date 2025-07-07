import fetch from 'node-fetch';
import { Parser } from 'icecast-parser';

export interface IcecastMetadata {
  hasMetadata: boolean;
  nowPlaying?: string;
  stationName?: string;
  metaint?: number;
  error?: string;
}

// Request deduplication - track in-progress requests AND cache results
const activeRequests = new Map<string, Promise<IcecastMetadata>>();
const metadataCache = new Map<string, { data: IcecastMetadata; timestamp: number }>();
const REQUEST_CACHE_DURATION = 45000; // 45 seconds for active requests
const METADATA_CACHE_DURATION = 30000; // 30 seconds for cached results - more real-time updates

// Export cleanup function for emergency memory management
export function clearActiveRequests() {
  console.log(`🧹 Clearing ${activeRequests.size} active requests and ${metadataCache.size} cached entries`);
  activeRequests.clear();
  metadataCache.clear();
}

// Test if a stream supports Icecast/Shoutcast metadata
export async function testIcecastMetadata(streamUrl: string): Promise<IcecastMetadata> {
  // Check if we have cached metadata first
  const cached = metadataCache.get(streamUrl);
  if (cached && (Date.now() - cached.timestamp) < METADATA_CACHE_DURATION) {
    console.log('💾 Using cached metadata for:', streamUrl.slice(-20));
    return cached.data;
  }
  
  // Check if we already have an active request for this stream
  const existingRequest = activeRequests.get(streamUrl);
  if (existingRequest) {
    console.log('🔄 Reusing active metadata request for:', streamUrl.slice(-20));
    return existingRequest;
  }
  
  // Create new request and track it
  const requestPromise = performMetadataRequest(streamUrl);
  activeRequests.set(streamUrl, requestPromise);
  
  // Clean up tracking and cache result after completion
  requestPromise.then((result) => {
    // Cache the result for 90 seconds
    metadataCache.set(streamUrl, {
      data: result,
      timestamp: Date.now()
    });
    
    // Clean up old cache entries
    if (metadataCache.size > 100) {
      const entries = Array.from(metadataCache.entries());
      const oldEntries = entries.filter(([, data]) => 
        (Date.now() - data.timestamp) > METADATA_CACHE_DURATION
      );
      oldEntries.forEach(([key]) => metadataCache.delete(key));
    }
    
    return result;
  }).finally(() => {
    setTimeout(() => {
      activeRequests.delete(streamUrl);
    }, REQUEST_CACHE_DURATION);
  });
  
  return requestPromise;
}

// Actual metadata request implementation
async function performMetadataRequest(streamUrl: string): Promise<IcecastMetadata> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(streamUrl, {
      method: 'GET',
      headers: {
        'Icy-Metadata': '1',
        'User-Agent': 'Streemr/1.0 (Metadata Detector)'
      },
      signal: controller.signal
    });
    
    clearTimeout(timeoutId);
    
    const headers = response.headers;
    const metaint = headers.get('icy-metaint') || headers.get('ice-metaint');
    const stationName = headers.get('icy-name') || headers.get('ice-name');
    
    if (!metaint) {
      return {
        hasMetadata: false,
        error: 'No Icecast metadata headers found'
      };
    }
    
    console.log(`✅ Icecast metadata found - MetaInt: ${metaint}, Station: ${stationName}`);
    
    // Try to get current track
    const nowPlaying = await extractCurrentTrack(streamUrl);
    
    return {
      hasMetadata: true,
      nowPlaying,
      stationName: stationName || undefined,
      metaint: parseInt(metaint)
    };
    
  } catch (error) {
    return {
      hasMetadata: false,
      error: error instanceof Error ? error.message : 'Connection failed'
    };
  }
}

// Extract current track from Icecast stream with improved cleanup
async function extractCurrentTrack(streamUrl: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    console.log(`🎵 Extracting current track from: ${streamUrl}`);
    
    let resolved = false;
    let radioStation: Parser | null = null;
    let timeoutId: NodeJS.Timeout | null = null;
    
    const safeResolve = (value: string | undefined) => {
      if (!resolved) {
        resolved = true;
        
        // Clean up timeout
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        
        // Clean up parser with better error handling
        if (radioStation) {
          try {
            radioStation.removeAllListeners();
            if (typeof radioStation.quitParsing === 'function') {
              radioStation.quitParsing();
            }
          } catch (e) {
            console.log('🎵 Parser cleanup warning:', e instanceof Error ? e.message : 'Unknown error');
          } finally {
            radioStation = null;
          }
        }
        
        resolve(value);
      }
    };
    
    try {
      radioStation = new Parser({ 
        url: streamUrl,
        autoUpdate: false
      });
      
      // Set up timeout with better cleanup
      timeoutId = setTimeout(() => {
        console.log('🎵 Track extraction timeout');
        safeResolve(undefined);
      }, 6000); // Reduced from 8000ms
      
      // Listen for metadata
      radioStation.on('metadata', (metadata) => {
        const streamTitle = metadata.get('StreamTitle');
        
        if (streamTitle && streamTitle.trim().length > 0) {
          console.log(`🎵 Found track: ${streamTitle}`);
          safeResolve(streamTitle.trim());
        } else {
          console.log('🎵 No current track (likely between songs)');
          safeResolve(undefined);
        }
      });
      
      // Handle errors
      radioStation.on('error', (error) => {
        console.log('🎵 Parser error:', error.message);
        safeResolve(undefined);
      });
      
      // Handle connection close
      radioStation.on('close', () => {
        console.log('🎵 Parser connection closed');
        if (!resolved) {
          safeResolve(undefined);
        }
      });
      
    } catch (error) {
      console.log('🎵 Failed to create parser:', error instanceof Error ? error.message : 'Unknown error');
      safeResolve(undefined);
    }
  });
}