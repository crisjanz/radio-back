import { Router, Request, Response } from 'express';
import { detectStreamMetadata } from '../services/metadata';
import { parseTrackTitle, decodeHtmlEntities } from '../services/metadata/utils';
import { PrismaClient } from '@prisma/client';
import { findStationByEitherId, parseStationIdParam } from '../utils/station-lookup';
import { handleError, handleNotFound, handleValidationError } from '../types/express';

const router = Router();
const prisma = new PrismaClient();

// Frontend metadata endpoint - GET /metadata?stream=...
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const { stream } = req.query;
  
  if (!stream || typeof stream !== 'string') {
    handleValidationError(res, 'Stream URL required');
    return;
  }
  
  try {
    console.log(`🎵 Frontend requesting metadata for: ${stream}`);
    
    const result = await detectStreamMetadata(stream);
    
    if (result.success && result.hasMetadata) {
      if (result.nowPlaying) {
        // Parse artist and title if available
        const parsed = parseTrackTitle(result.nowPlaying);
        
        const data = {
          success: true,
          song: result.nowPlaying,
          title: parsed.title || result.nowPlaying,
          artist: parsed.artist,
          message: result.message
        };
        res.json(data);
        return;
      } else {
        // Stream supports metadata but no current track
        const data = {
          success: true,
          hasMetadataSupport: true,
          message: 'Stream supports metadata but no current track'
        };
        res.json(data);
        return;
      }
    } else {
      // No metadata support
      const data = {
        success: false,
        message: result.error || 'No metadata support detected'
      };
      res.json(data);
      return;
    }
    
  } catch (error) {
    handleError(res, error, 'Failed to fetch metadata');
  }
});

// Station ID-based metadata endpoint - GET /metadata/:stationId
router.get('/:stationId', async (req: Request, res: Response): Promise<void> => {
  const { stationId } = req.params;
  
  if (!stationId) {
    handleValidationError(res, 'Station ID required');
    return;
  }
  
  try {
    console.log(`🎵 Frontend requesting metadata for station: ${stationId}`);
    
    // Get station details from database using dual ID lookup
    const station = await findStationByEitherId(stationId, {
      select: { streamUrl: true, name: true, nanoid: true, id: true }
    });
    
    if (!station || !station.streamUrl) {
      const data = {
        success: false,
        message: `Station ${stationId} not found or missing stream URL`
      };
      res.json(data);
      return;
    }
    
    console.log(`🔍 Found station "${station.name}" (${station.nanoid || station.id}) with stream URL: ${station.streamUrl}`);
    
    // Try local metadata server first if configured
    // Auto-detect environment and use appropriate URL
    let localMetadataUrl = process.env.LOCAL_METADATA_URL;
    
    // If running locally (development), use localhost
    if (process.env.NODE_ENV === 'development' || process.env.RENDER !== 'true') {
      localMetadataUrl = 'http://localhost:3002';
      console.log(`🏠 Detected local environment, using localhost metadata server`);
    } else {
      console.log(`☁️ Detected production environment, using DDNS metadata server: ${localMetadataUrl}`);
    }
    if (localMetadataUrl) {
      try {
        // Use NanoID if available, otherwise use numeric ID
        const metadataStationId = station.nanoid || station.id;
        console.log(`🏠 Trying local metadata server: ${localMetadataUrl}/metadata/${metadataStationId}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
        
        const localResponse = await fetch(`${localMetadataUrl}/metadata/${metadataStationId}`, {
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
            const rawSongInfo = localData.song || `${localData.artist} - ${localData.title}`;
            const songInfo = decodeHtmlEntities(rawSongInfo);
            console.log(`✅ Local server provided metadata: ${songInfo}`);
            
            // Parse artist and title if available
            const parsed = parseTrackTitle(songInfo);
            
            const data = {
              success: true,
              song: songInfo,
              title: decodeHtmlEntities(localData.title || '') || parsed.title || songInfo,
              artist: decodeHtmlEntities(localData.artist || '') || parsed.artist,
              source: 'local',
              message: localData.message || 'Enhanced metadata from local server',
              // Pass through any additional local server fields
              ...(localData.artwork && { artwork: localData.artwork }),
              ...(localData.album && { album: localData.album }),
              ...(localData.rogersData && { rogersData: localData.rogersData })
            };
            res.json(data);
            return;
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
        
        const data = {
          success: true,
          song: result.nowPlaying,
          title: parsed.title || result.nowPlaying,
          artist: parsed.artist,
          source: 'icecast',
          message: result.message
        };
        res.json(data);
        return;
      } else {
        // Stream supports metadata but no current track
        const data = {
          success: true,
          hasMetadataSupport: true,
          source: 'icecast',
          message: 'Stream supports metadata but no current track'
        };
        res.json(data);
        return;
      }
    } else {
      // No metadata support
      const data = {
        success: false,
        source: 'icecast',
        message: result.error || 'No metadata support detected'
      };
      res.json(data);
      return;
    }
    
  } catch (error) {
    handleError(res, error, `Failed to fetch metadata for station ${stationId}`);
  }
});

// Admin metadata testing endpoint - POST /metadata/test
router.post('/test', async (req: Request, res: Response): Promise<void> => {
  const { streamUrl } = req.body;
  
  if (!streamUrl) {
    handleValidationError(res, 'Stream URL is required');
    return;
  }
  
  try {
    console.log(`🔍 Admin testing metadata for: ${streamUrl}`);
    
    const result = await detectStreamMetadata(streamUrl);
    
    res.json(result);
    
  } catch (error) {
    handleError(res, error, 'Failed to test metadata');
  }
});

export default router;