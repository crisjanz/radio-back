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
        Track: true
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
        id: play.Track.id,
        title: play.Track.title,
        artist: play.Track.artist,
        album: play.Track.album,
        artwork: play.Track.artwork,
        duration: play.Track.duration
      }
    }));

    res.json(formattedTracks);

  } catch (error) {
    console.error(`Error getting recent tracks for station ${req.params.id}:`, error);
    res.status(500).json({ error: 'Failed to get recent tracks' });
  }
});

// Historical track feature disabled - only today's tracks supported
// router.get('/stations/:id/available-days', async (req: any, res: any) => {
//   res.json([]); // Return empty array - no historical data available
// });

// Historical track feature disabled - only today's tracks supported
// router.get('/stations/:id/tracks/:date', async (req: any, res: any) => {
//   res.status(404).json({ error: 'Historical track data not supported' });
// });

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