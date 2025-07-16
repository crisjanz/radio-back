// stations.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Smart ID gap-filling utility function
async function getNextAvailableStationId(): Promise<number> {
  try {
    // Get all existing station IDs in ascending order
    const existingIds = await prisma.station.findMany({
      select: { id: true },
      orderBy: { id: 'asc' }
    });
    
    // Find the first gap in the sequence
    let expectedId = 1;
    for (const station of existingIds) {
      if (station.id !== expectedId) {
        // Found a gap! Return the missing ID
        console.log(`🔢 Found ID gap: using ID ${expectedId} instead of next sequential ID`);
        return expectedId;
      }
      expectedId++;
    }
    
    // No gaps found, return the next sequential ID
    console.log(`🔢 No ID gaps found: using next sequential ID ${expectedId}`);
    return expectedId;
  } catch (error) {
    console.error('❌ Error finding available station ID:', error);
    // Fallback to letting Postgres handle auto-increment
    throw error;
  }
}

// Get all stations with optional pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = (page - 1) * limit;

    // Filter by active status (default: only active stations)
    const showInactive = req.query.includeInactive === 'true';
    const whereClause = showInactive ? {} : { isActive: true };

    const [stations, total] = await Promise.all([
      prisma.station.findMany({
        where: whereClause,
        skip,
        take: limit,
        orderBy: { id: 'asc' }
      }),
      prisma.station.count({ where: whereClause })
    ]);

    // If pagination is requested, return paginated format
    if (req.query.page || req.query.limit) {
      res.json({
        stations,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      });
      return;
    } else {
      // Return all stations for backward compatibility (filtered by active status)
      const allStations = await prisma.station.findMany({ where: whereClause });
      res.json(allStations);
      return;
    }
  } catch (error) {
    console.error('❌ Error fetching stations:', error);
    res.status(500).json({ error: 'Failed to fetch stations' });
    return;
  }
});

// Search stations - MUST come before /stations/:id route
router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = req.query.q as string;
    
    if (!query || query.trim().length < 2) {
      res.status(400).json({ error: 'Search query must be at least 2 characters long' });
      return;
    }

    const searchTerm = query.trim();
    console.log(`🔍 Searching stations for: "${searchTerm}"`);

    // Filter by active status for search too
    const showInactive = req.query.includeInactive === 'true';
    const activeFilter = showInactive ? {} : { isActive: true };

    const stations = await prisma.station.findMany({
      where: {
        ...activeFilter,
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { country: { contains: searchTerm, mode: 'insensitive' } },
          { city: { contains: searchTerm, mode: 'insensitive' } },
          { genre: { contains: searchTerm, mode: 'insensitive' } },
          { type: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
          { tags: { contains: searchTerm, mode: 'insensitive' } }
        ]
      },
      take: 100 // Limit results
    });

    console.log(`   ✅ Found ${stations.length} stations`);
    
    res.json(stations);
  } catch (error) {
    console.error('❌ Error searching stations:', error);
    res.status(500).json({ error: 'Failed to search stations' });
  }
});

// Get database statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [total, withImages, recentImports] = await Promise.all([
      prisma.station.count(),
      prisma.station.count({
        where: {
          OR: [
            { favicon: { not: null } },
            { logo: { not: null } }
          ]
        }
      }),
      prisma.station.count({
        where: {
          createdAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // Last 7 days
          }
        }
      })
    ]);

    res.json({
      total,
      active: total, // For now, assume all are active
      withImages,
      recentImports
    });
  } catch (error) {
    console.error('Error getting database stats:', error);
    res.status(500).json({ error: 'Failed to get database stats' });
  }
});

// Get countries with station counts
router.get('/countries', async (req: Request, res: Response) => {
  try {
    const countries = await prisma.station.groupBy({
      by: ['country'],
      _count: true,
      orderBy: {
        _count: {
          country: 'desc'
        }
      }
    });

    const formattedCountries = countries.map(country => ({
      country: country.country,
      count: country._count
    }));

    res.json(formattedCountries);
  } catch (error) {
    console.error('❌ Error fetching countries:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// Get genres with station counts
router.get('/genres', async (req: Request, res: Response) => {
  try {
    const genres = await prisma.station.groupBy({
      by: ['genre'],
      _count: true,
      where: {
        genre: {
          not: null
        }
      },
      orderBy: {
        _count: {
          genre: 'desc'
        }
      }
    });

    const formattedGenres = genres.map(genre => ({
      genre: genre.genre,
      count: genre._count
    }));

    res.json(formattedGenres);
  } catch (error) {
    console.error('❌ Error fetching genres:', error);
    res.status(500).json({ error: 'Failed to fetch genres' });
  }
});

// Update station by ID
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid station ID' });
      return;
    }

    const updateData = req.body;
    
    // Remove undefined and empty string values
    const cleanedData = Object.fromEntries(
      Object.entries(updateData).filter(([_, value]) => value !== undefined && value !== '')
    );

    const updatedStation = await prisma.station.update({
      where: { id },
      data: cleanedData
    });

    res.json(updatedStation);
  } catch (error) {
    console.error('❌ Error updating station:', error);
    res.status(500).json({ error: 'Failed to update station' });
  }
});

// Get single station by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid station ID' });
      return;
    }

    const station = await prisma.station.findUnique({
      where: { id }
    });

    if (!station) {
      res.status(404).json({ error: 'Station not found' });
      return;
    }

    res.json(station);
  } catch (error) {
    console.error('❌ Error fetching station:', error);
    res.status(500).json({ error: 'Failed to fetch station' });
  }
});

// Add station
router.post('/', async (req: Request, res: Response) => {
  try {
    const stationData = req.body;
    
    // Check for duplicates before creating
    if (stationData.streamUrl || (stationData.name && stationData.country)) {
      const existing = await prisma.station.findFirst({
        where: {
          OR: [
            ...(stationData.streamUrl ? [{ streamUrl: stationData.streamUrl }] : []),
            ...(stationData.name && stationData.country ? [{ 
              name: stationData.name, 
              country: stationData.country 
            }] : [])
          ]
        }
      });

      if (existing) {
        console.log(`⚠️ Duplicate station detected: "${stationData.name}" already exists as ID ${existing.id}`);
        return res.status(409).json({ 
          error: 'Station already exists',
          duplicate: true,
          existingStation: existing
        });
      }
    }
    
    // Get the optimal ID (fills gaps if available)
    const optimalId = await getNextAvailableStationId();
    
    // Create station with the optimal ID
    const station = await prisma.station.create({ 
      data: {
        id: optimalId,
        ...stationData
      }
    });
    
    console.log(`✅ Created station "${station.name}" with ID ${station.id}`);
    res.json(station);
  } catch (error) {
    console.error('❌ Error creating station:', error);
    
    // If ID assignment failed, try without explicit ID (fallback to auto-increment)
    if (error instanceof Error && error.message.includes('unique constraint')) {
      console.log('🔄 ID conflict detected, falling back to auto-increment...');
      try {
        const station = await prisma.station.create({ data: req.body });
        console.log(`✅ Created station "${station.name}" with auto-generated ID ${station.id}`);
        res.json(station);
        return;
      } catch (fallbackError) {
        console.error('❌ Fallback creation also failed:', fallbackError);
        res.status(500).json({ error: 'Failed to create station' });
        return;
      }
    }
    
    res.status(500).json({ error: 'Failed to create station' });
  }
});

// Update station
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid station ID' });
      return;
    }

    const station = await prisma.station.update({
      where: { id },
      data: req.body
    });
    
    res.json(station);
  } catch (error) {
    console.error('❌ Error updating station:', error);
    res.status(500).json({ error: 'Failed to update station' });
  }
});

// Delete station
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid station ID' });
      return;
    }

    await prisma.station.delete({
      where: { id }
    });
    
    res.json({ success: true });
  } catch (error) {
    console.error('❌ Error deleting station:', error);
    res.status(500).json({ error: 'Failed to delete station' });
  }
});

// Calculate quality score for a station
router.post('/:id/calculate-quality', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    
    if (isNaN(id)) {
      res.status(400).json({ error: 'Invalid station ID' });
      return;
    }

    // Get station data
    const station = await prisma.station.findUnique({
      where: { id }
    });

    if (!station) {
      res.status(404).json({ error: 'Station not found' });
      return;
    }

    // Get feedback data for this station
    const feedback = await prisma.stationFeedback.findMany({
      where: { stationId: id }
    });

    // Calculate quality score based on the algorithm from homescreen-plan.txt
    const totalFeedback = feedback.length;
    const streamWorkingReports = feedback.filter(f => f.feedbackType === 'great_station').length;
    const audioQualityReports = feedback.filter(f => f.feedbackType !== 'poor_audio_quality').length;
    const correctInfoReports = feedback.filter(f => f.feedbackType !== 'wrong_information').length;
    const positiveReports = feedback.filter(f => f.feedbackType === 'great_station').length;
    const hasMetadata = !!(station.metadataApiUrl || station.metadataApiType);

    let qualityScore = 0;
    let breakdown = {
      streamReliability: 0,
      audioQuality: 0,
      informationAccuracy: 0,
      userSatisfaction: 0,
      metadataRichness: 0
    };

    if (totalFeedback > 0) {
      // Stream reliability (30%)
      breakdown.streamReliability = ((streamWorkingReports / totalFeedback) * 100) * 0.3;
      
      // Audio quality (25%)
      breakdown.audioQuality = ((audioQualityReports / totalFeedback) * 100) * 0.25;
      
      // Information accuracy (20%)
      breakdown.informationAccuracy = ((correctInfoReports / totalFeedback) * 100) * 0.2;
      
      // User satisfaction (15%)
      breakdown.userSatisfaction = ((positiveReports / totalFeedback) * 100) * 0.15;
    } else {
      // Default scores for stations without feedback
      breakdown.streamReliability = station.lastPingSuccess ? 30 : 0;
      breakdown.audioQuality = station.bitrate && station.bitrate > 64 ? 25 : 15;
      breakdown.informationAccuracy = station.description && station.homepage ? 20 : 10;
      breakdown.userSatisfaction = station.votes && station.votes > 0 ? 15 : 7.5;
    }

    // Metadata richness (10%)
    breakdown.metadataRichness = hasMetadata ? 10 : 0;

    // Calculate total score
    qualityScore = breakdown.streamReliability + breakdown.audioQuality + 
                   breakdown.informationAccuracy + breakdown.userSatisfaction + 
                   breakdown.metadataRichness;

    // Update station with calculated quality score
    await prisma.station.update({
      where: { id },
      data: {
        qualityScore,
        feedbackCount: totalFeedback
      }
    });

    console.log(`✅ Quality score calculated for station ${id}: ${qualityScore.toFixed(2)}%`);

    res.json({
      qualityScore,
      feedbackCount: totalFeedback,
      breakdown: {
        streamReliability: breakdown.streamReliability / 0.3,
        audioQuality: breakdown.audioQuality / 0.25,
        informationAccuracy: breakdown.informationAccuracy / 0.2,
        userSatisfaction: breakdown.userSatisfaction / 0.15,
        metadataRichness: breakdown.metadataRichness / 0.1
      }
    });
  } catch (error) {
    console.error('❌ Error calculating quality score:', error);
    res.status(500).json({ error: 'Failed to calculate quality score' });
  }
});

export default router;