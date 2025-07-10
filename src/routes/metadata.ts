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
    
    // Use existing Icecast metadata detection
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