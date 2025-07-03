import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const router = express.Router();
const prisma = new PrismaClient();

// JWT Secret (should match the one in auth.ts)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Extended Request interface to include user data
interface AuthenticatedRequest extends Request {
  user?: {
    userId: number;
  };
}

// Authentication middleware
const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: Function) => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    
    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid token - user not found' });
    }

    req.user = { userId: decoded.userId };
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// GET /api/favorites - Get all favorites for the authenticated user
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;

    const favorites = await prisma.userFavorites.findMany({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Get station details for each favorite
    const favoritesWithStations = await Promise.all(
      favorites.map(async (favorite) => {
        const station = await prisma.station.findUnique({
          where: { id: favorite.stationId },
          select: {
            id: true,
            name: true,
            country: true,
            genre: true,
            type: true,
            streamUrl: true,
            favicon: true,
            logo: true,
            homepage: true,
            city: true,
            state: true,
            description: true,
            language: true,
            frequency: true,
            bitrate: true,
            codec: true,
            isActive: true
          }
        });

        return {
          id: favorite.id,
          stationId: favorite.stationId,
          createdAt: favorite.createdAt,
          station: station
        };
      })
    );

    // Filter out favorites where station no longer exists
    const validFavorites = favoritesWithStations.filter(fav => fav.station !== null);

    res.json({
      favorites: validFavorites,
      count: validFavorites.length
    });

  } catch (error) {
    console.error('Error fetching favorites:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/favorites - Add a station to user's favorites
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const { stationId } = req.body;

    // Validate input
    if (!stationId || typeof stationId !== 'number') {
      return res.status(400).json({ error: 'Valid stationId is required' });
    }

    // Check if station exists
    const station = await prisma.station.findUnique({
      where: { id: stationId },
      select: {
        id: true,
        name: true,
        country: true,
        genre: true,
        isActive: true
      }
    });

    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    // Check if already in favorites
    const existingFavorite = await prisma.userFavorites.findUnique({
      where: {
        userId_stationId: {
          userId,
          stationId
        }
      }
    });

    if (existingFavorite) {
      return res.status(409).json({ error: 'Station already in favorites' });
    }

    // Add to favorites
    const favorite = await prisma.userFavorites.create({
      data: {
        userId,
        stationId
      },
      include: {
        user: {
          select: {
            id: true,
            email: true
          }
        }
      }
    });

    res.status(201).json({
      message: 'Station added to favorites',
      favorite: {
        id: favorite.id,
        stationId: favorite.stationId,
        createdAt: favorite.createdAt,
        station: station
      }
    });

  } catch (error) {
    console.error('Error adding favorite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/favorites/:stationId - Remove a station from user's favorites
router.delete('/:stationId', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const stationId = parseInt(req.params.stationId, 10);

    // Validate stationId
    if (isNaN(stationId)) {
      return res.status(400).json({ error: 'Invalid stationId' });
    }

    // Check if favorite exists
    const existingFavorite = await prisma.userFavorites.findUnique({
      where: {
        userId_stationId: {
          userId,
          stationId
        }
      }
    });

    if (!existingFavorite) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    // Remove from favorites
    await prisma.userFavorites.delete({
      where: {
        userId_stationId: {
          userId,
          stationId
        }
      }
    });

    res.json({ message: 'Station removed from favorites' });

  } catch (error) {
    console.error('Error removing favorite:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;