// stations.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

// Get all stations with optional pagination
router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 100;
    const skip = (page - 1) * limit;

    const [stations, total] = await Promise.all([
      prisma.station.findMany({
        skip,
        take: limit,
        orderBy: { id: 'asc' }
      }),
      prisma.station.count()
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
      // Return all stations for backward compatibility
      const allStations = await prisma.station.findMany();
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

    const stations = await prisma.station.findMany({
      where: {
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
    const station = await prisma.station.create({ data: req.body });
    res.json(station);
  } catch (error) {
    console.error('❌ Error creating station:', error);
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

export default router;