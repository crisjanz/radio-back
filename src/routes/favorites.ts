import express, { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { findStationByEitherId, parseStationIdParam, toggleUserFavorite, findUserFavoriteByStationId } from '../utils/station-lookup';
import { handleError, handleNotFound, handleValidationError } from '../types/express';

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
const authenticateToken = async (req: AuthenticatedRequest, res: Response, next: Function): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    
    // Verify user exists in database
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true }
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid token - user not found' });
      return;
    }

    req.user = { userId: decoded.userId };
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(401).json({ error: 'Invalid token' });
    return;
  }
};

// GET /api/favorites - Get all favorites for the authenticated user
router.get('/', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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
        // Support both legacy stationId and new stationNanoid lookups
        let station = null;
        
        if (favorite.stationNanoid) {
          station = await prisma.station.findUnique({
            where: { nanoid: favorite.stationNanoid },
            select: {
              id: true,
              nanoid: true,
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
        }
        
        // Fallback to legacy stationId if nanoid lookup failed or is null
        if (!station && favorite.stationId) {
          station = await prisma.station.findUnique({
            where: { id: favorite.stationId },
            select: {
              id: true,
              nanoid: true,
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
        }

        return {
          id: favorite.id,
          stationId: favorite.stationId,
          stationNanoid: favorite.stationNanoid,
          createdAt: favorite.createdAt,
          station: station
        };
      })
    );

    // Filter out favorites where station no longer exists
    const validFavorites = favoritesWithStations.filter(fav => fav.station !== null);

    const data = {
      favorites: validFavorites,
      count: validFavorites.length
    };
    res.json(data);

  } catch (error) {
    handleError(res, error, 'Failed to fetch favorites');
  }
});

// POST /api/favorites - Add a station to user's favorites (supports both numeric and nanoid)
router.post('/', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const { stationId } = req.body;

    // Validate input - accept both string (nanoid) and number (legacy)
    if (!stationId) {
      handleValidationError(res, 'stationId is required');
      return;
    }

    const stationIdParam = stationId.toString();

    // Check if station exists using dual lookup
    const station = await findStationByEitherId(stationIdParam, {
      select: {
        id: true,
        nanoid: true,
        name: true,
        country: true,
        genre: true,
        isActive: true
      }
    });

    if (!station) {
      handleNotFound(res, 'Station');
      return;
    }

    // Check if already in favorites using dual lookup
    const existingFavorite = await findUserFavoriteByStationId(userId, stationIdParam);

    if (existingFavorite) {
      res.status(409).json({ error: 'Station already in favorites' });
      return;
    }

    // Add to favorites using dual reference utility
    const favorite = await toggleUserFavorite(userId, stationIdParam, 'add');

    const data = {
      message: 'Station added to favorites',
      favorite: {
        id: favorite.id,
        stationId: favorite.stationId,
        stationNanoid: favorite.stationNanoid,
        createdAt: favorite.createdAt,
        station: station
      }
    };
    res.status(201).json(data);

  } catch (error) {
    handleError(res, error, 'Failed to add favorite');
  }
});

// DELETE /api/favorites/:stationId - Remove a station from user's favorites (supports both numeric and nanoid)
router.delete('/:stationId', authenticateToken, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.userId;
    const stationIdParam = req.params.stationId;

    // Validate stationId format
    const { idType } = parseStationIdParam({ params: { id: stationIdParam } });
    if (idType === 'invalid') {
      handleValidationError(res, 'Invalid stationId format');
      return;
    }

    // Check if favorite exists using dual lookup
    const existingFavorite = await findUserFavoriteByStationId(userId, stationIdParam);

    if (!existingFavorite) {
      handleNotFound(res, 'Favorite');
      return;
    }

    // Remove from favorites using dual reference utility
    await toggleUserFavorite(userId, stationIdParam, 'remove');

    const data = { message: 'Station removed from favorites' };
    res.json(data);

  } catch (error) {
    handleError(res, error, 'Failed to remove favorite');
  }
});

export default router;