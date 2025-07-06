import fetch from 'node-fetch';
import { Parser } from 'icecast-parser';

export interface IcecastMetadata {
  hasMetadata: boolean;
  nowPlaying?: string;
  stationName?: string;
  metaint?: number;
  error?: string;
}

// Test if a stream supports Icecast/Shoutcast metadata
export async function testIcecastMetadata(streamUrl: string): Promise<IcecastMetadata> {
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

// Extract current track from Icecast stream
async function extractCurrentTrack(streamUrl: string): Promise<string | undefined> {
  return new Promise((resolve) => {
    console.log(`🎵 Extracting current track from: ${streamUrl}`);
    
    let resolved = false;
    const safeResolve = (value: string | undefined) => {
      if (!resolved) {
        resolved = true;
        resolve(value);
      }
    };
    
    try {
      const radioStation = new Parser({ 
        url: streamUrl,
        autoUpdate: false
      });
      
      // Set up timeout
      const timeoutId = setTimeout(() => {
        console.log('🎵 Track extraction timeout');
        try {
          radioStation.quitParsing();
        } catch (e) {
          // Ignore cleanup errors
        }
        safeResolve(undefined);
      }, 8000);
      
      // Listen for metadata
      radioStation.on('metadata', (metadata) => {
        clearTimeout(timeoutId);
        const streamTitle = metadata.get('StreamTitle');
        
        if (streamTitle && streamTitle.trim().length > 0) {
          console.log(`🎵 Found track: ${streamTitle}`);
          try {
            radioStation.quitParsing();
          } catch (e) {
            // Ignore cleanup errors
          }
          safeResolve(streamTitle.trim());
        } else {
          console.log('🎵 No current track (likely between songs)');
          try {
            radioStation.quitParsing();
          } catch (e) {
            // Ignore cleanup errors
          }
          safeResolve(undefined);
        }
      });
      
      // Handle errors
      radioStation.on('error', (error) => {
        clearTimeout(timeoutId);
        console.log('🎵 Parser error:', error.message);
        try {
          radioStation.quitParsing();
        } catch (e) {
          // Ignore cleanup errors
        }
        safeResolve(undefined);
      });
      
    } catch (error) {
      console.log('🎵 Failed to create parser:', error instanceof Error ? error.message : 'Unknown error');
      safeResolve(undefined);
    }
  });
}