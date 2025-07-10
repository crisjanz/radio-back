import { Router, Request, Response } from 'express';
import { detectStreamMetadata } from '../services/metadata';
import { parseTrackTitle } from '../services/metadata/utils';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Frontend metadata endpoint - GET /metadata?stream=...
router.get('/', async (req: Request, res: Response) => {
  const { stream } = req.query;
  
  if (!stream || typeof stream !== 'string') {
    return res.status(400).json({ error: 'Stream URL required' });
  }
  
  try {
    console.log(`🎵 Frontend requesting metadata for: ${stream}`);
    
    const result = await detectStreamMetadata(stream);
    
    if (result.success && result.hasMetadata) {
      if (result.nowPlaying) {
        // Parse artist and title if available
        const parsed = parseTrackTitle(result.nowPlaying);
        
        return res.json({
          success: true,
          song: result.nowPlaying,
          title: parsed.title || result.nowPlaying,
          artist: parsed.artist,
          message: result.message
        });
      } else {
        // Stream supports metadata but no current track
        return res.json({
          success: true,
          hasMetadataSupport: true,
          message: 'Stream supports metadata but no current track'
        });
      }
    } else {
      // No metadata support
      return res.json({
        success: false,
        message: result.error || 'No metadata support detected'
      });
    }
    
  } catch (error) {
    console.error('Frontend metadata error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch metadata'
    });
  }
});

// Station ID-based metadata endpoint - GET /metadata/:stationId
router.get('/:stationId', async (req: Request, res: Response) => {
  const { stationId } = req.params;
  
  if (!stationId) {
    return res.status(400).json({ error: 'Station ID required' });
  }
  
  try {
    console.log(`🎵 Frontend requesting metadata for station: ${stationId}`);
    
    // Get station details from database to extract stream URL
    const station = await prisma.station.findUnique({
      where: { id: parseInt(stationId) },
      select: { streamUrl: true, name: true }
    });
    
    if (!station || !station.streamUrl) {
      return res.json({
        success: false,
        message: `Station ${stationId} not found or missing stream URL`
      });
    }
    
    console.log(`🔍 Found station "${station.name}" with stream URL: ${station.streamUrl}`);
    
    // Try local metadata server first if configured
    const localMetadataUrl = process.env.LOCAL_METADATA_URL;
    if (localMetadataUrl) {
      try {
        console.log(`🏠 Trying local metadata server: ${localMetadataUrl}/metadata/${stationId}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const localResponse = await fetch(`${localMetadataUrl}/metadata/${stationId}`, {
          signal: controller.signal,
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'Streemr-Backend/1.0'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (localResponse.ok) {
          const localData = await localResponse.json();
          
          // Handle your local server's response format
          if (localData.song || (localData.title && localData.artist)) {
            const songInfo = localData.song || `${localData.artist} - ${localData.title}`;
            console.log(`✅ Local server provided metadata: ${songInfo}`);
            
            // Parse artist and title if available
            const parsed = parseTrackTitle(songInfo);
            
            return res.json({
              success: true,
              song: songInfo,
              title: localData.title || parsed.title || songInfo,
              artist: localData.artist || parsed.artist,
              source: 'local',
              message: localData.message || 'Enhanced metadata from local server',
              // Pass through any additional local server fields
              ...(localData.artwork && { artwork: localData.artwork }),
              ...(localData.album && { album: localData.album }),
              ...(localData.rogersData && { rogersData: localData.rogersData })
            });
          } else {
            console.log(`⚠️ Local server returned no metadata, falling back to Icecast`);
          }
        } else {
          console.log(`⚠️ Local server responded with ${localResponse.status}, falling back to Icecast`);
        }
      } catch (error) {
        if (error.name === 'AbortError') {
          console.log(`⏰ Local server timeout, falling back to Icecast`);
        } else {
          console.log(`⚠️ Local server error: ${error.message}, falling back to Icecast`);
        }
      }
    }
    
    // Fallback to Icecast metadata detection
    console.log(`🔄 Falling back to Icecast metadata detection`);
    const result = await detectStreamMetadata(station.streamUrl);
    
    if (result.success && result.hasMetadata) {
      if (result.nowPlaying) {
        // Parse artist and title if available
        const parsed = parseTrackTitle(result.nowPlaying);
        
        return res.json({
          success: true,
          song: result.nowPlaying,
          title: parsed.title || result.nowPlaying,
          artist: parsed.artist,
          source: 'icecast',
          message: result.message
        });
      } else {
        // Stream supports metadata but no current track
        return res.json({
          success: true,
          hasMetadataSupport: true,
          source: 'icecast',
          message: 'Stream supports metadata but no current track'
        });
      }
    } else {
      // No metadata support
      return res.json({
        success: false,
        source: 'icecast',
        message: result.error || 'No metadata support detected'
      });
    }
    
  } catch (error) {
    console.error(`Metadata error for station ${stationId}:`, error);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch metadata'
    });
  }
});

// Admin metadata testing endpoint - POST /metadata/test
router.post('/test', async (req: Request, res: Response) => {
  const { streamUrl } = req.body;
  
  if (!streamUrl) {
    return res.status(400).json({ error: 'Stream URL is required' });
  }
  
  try {
    console.log(`🔍 Admin testing metadata for: ${streamUrl}`);
    
    const result = await detectStreamMetadata(streamUrl);
    
    return res.json(result);
    
  } catch (error) {
    console.error('Admin metadata test error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to test metadata'
    });
  }
});

export default router;