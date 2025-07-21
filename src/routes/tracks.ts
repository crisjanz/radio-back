import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { parseStationIdParam } from '../utils/station-lookup';

const router = Router();
const prisma = new PrismaClient();

// Get recent tracks for a station (today only - fast PostgreSQL query) - supports both numeric and nanoid
router.get('/stations/:id/recent-tracks', async (req: any, res: any) => {
  const limit = parseInt(req.query.limit as string) || 50;
  
  try {
    const { stationIdParam, idType } = parseStationIdParam(req);
    
    if (idType === 'invalid') {
      return res.status(400).json({ error: 'Invalid station ID format' });
    }

    // Query today's tracks from PostgreSQL
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Build where clause based on station identifier type
    let whereClause: any = {
      playedAt: { gte: today }
    };

    if (idType === 'nanoid') {
      whereClause.stationNanoid = stationIdParam;
    } else {
      whereClause.stationId = parseInt(stationIdParam);
    }

    const tracks = await prisma.stationPlayHistory.findMany({
      where: whereClause,
      include: {
        track: true
      },
      orderBy: { playedAt: 'desc' },
      take: limit
    });

    const formattedTracks = tracks.map(play => ({
      id: play.id,
      playedAt: play.playedAt,
      source: play.source,
      showName: play.showName,
      djName: play.djName,
      track: {
        id: play.track.id,
        title: play.track.title,
        artist: play.track.artist,
        album: play.track.album,
        artwork: play.track.artwork,
        duration: play.track.duration
      }
    }));

    res.json(formattedTracks);

  } catch (error) {
    console.error(`Error getting recent tracks for station ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get recent tracks' });
  }
});

// Get available past days for a station (for navigation)
router.get('/stations/:id/available-days', async (req: any, res: any) => {
  try {
    const { stationIdParam, idType } = parseStationIdParam(req);
    
    if (idType === 'invalid') {
      return res.status(400).json({ error: 'Invalid station ID format' });
    }

    // Fetch available dates from metadata server
    const metadataServerUrl = process.env.METADATA_SERVER_URL || 'https://streemr.ddns.net:3002';
    const exportsUrl = `${metadataServerUrl}/exports`;
    
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(exportsUrl);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      
      const data = await response.json();
      const dates = data.exports
        .filter((filename: string) => filename.endsWith('.json'))
        .map((filename: string) => filename.replace('.json', ''))
        .sort()
        .reverse(); // Most recent first
      
      res.json(dates);
    } catch (fetchError) {
      console.error('❌ Error fetching available dates:', fetchError);
      res.json([]); // Return empty array if service unavailable
    }

  } catch (error) {
    console.error(`Error getting available days for station ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get available days' });
  }
});

// Get tracks for a specific past day (will load from JSON files via metadata server)
router.get('/stations/:id/tracks/:date', async (req: any, res: any) => {
  const { date } = req.params;
  
  try {
    const { stationIdParam, idType } = parseStationIdParam(req);
    
    if (idType === 'invalid') {
      return res.status(400).json({ error: 'Invalid station ID format' });
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ error: 'Invalid date format. Use YYYY-MM-DD' });
    }

    // Check if it's today's date (should use recent-tracks endpoint instead)
    const requestedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (requestedDate.getTime() === today.getTime()) {
      return res.status(400).json({ 
        error: 'Use /recent-tracks endpoint for today\'s tracks',
        redirect: `/tracks/stations/${stationIdParam}/recent-tracks`
      });
    }

    // Fetch from metadata server JSON exports
    const metadataServerUrl = process.env.METADATA_SERVER_URL || 'https://streemr.ddns.net:3002';
    const exportUrl = `${metadataServerUrl}/exports/${date}.json`;
    
    try {
      const fetch = (await import('node-fetch')).default;
      const response = await fetch(exportUrl);
      
      if (!response.ok) {
        if (response.status === 404) {
          return res.status(404).json({ error: 'No track data available for this date' });
        }
        throw new Error(`HTTP ${response.status}`);
      }
      
      const exportData = await response.json();
      const stationTracks = exportData.stations[stationIdParam] || [];
      
      res.json(stationTracks);
    } catch (fetchError) {
      console.error(`❌ Error fetching historical data for ${date}:`, fetchError);
      res.status(503).json({ error: 'Historical data service unavailable' });
    }

  } catch (error) {
    console.error(`Error getting tracks for station ${req.params.id} on ${date}:`, error);
    res.status(500).json({ error: 'Failed to get tracks for date' });
  }
});

// Get track collection statistics
router.get('/stats', async (req: any, res: any) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalTracks, totalPlays, todayPlays] = await Promise.all([
      prisma.track.count(),
      prisma.stationPlayHistory.count(),
      prisma.stationPlayHistory.count({
        where: { playedAt: { gte: today } }
      })
    ]);

    res.json({ totalTracks, totalPlays, todayPlays });

  } catch (error) {
    console.error('Error getting track stats:', error);
    res.status(500).json({ error: 'Failed to get track stats' });
  }
});

// Get top tracks for today
router.get('/top', async (req: any, res: any) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get most played tracks today
    const topTracks = await prisma.stationPlayHistory.groupBy({
      by: ['trackId'],
      where: {
        playedAt: { gte: today }
      },
      _count: {
        trackId: true
      },
      orderBy: {
        _count: {
          trackId: 'desc'
        }
      },
      take: limit
    });

    // Get track details
    const trackIds = topTracks.map(t => t.trackId);
    const tracks = await prisma.track.findMany({
      where: {
        id: { in: trackIds }
      }
    });

    // Combine data
    const result = topTracks.map(topTrack => {
      const track = tracks.find(t => t.id === topTrack.trackId);
      return {
        track,
        playCount: topTrack._count.trackId
      };
    });

    res.json(result);
  } catch (error) {
    console.error('❌ Error getting top tracks:', error);
    res.status(500).json({ error: 'Failed to get top tracks' });
  }
});

// Get track details by ID
router.get('/:id', async (req: any, res: any) => {
  try {
    const { id } = req.params;
    
    const track = await prisma.track.findUnique({
      where: { id },
      include: {
        playHistory: {
          orderBy: { playedAt: 'desc' },
          take: 10 // Recent plays
        }
      }
    });

    if (!track) {
      return res.status(404).json({ error: 'Track not found' });
    }

    res.json(track);
  } catch (error) {
    console.error(`❌ Error getting track ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get track' });
  }
});

export default router;