import { PrismaClient } from '@prisma/client';
import { getIdType, isValidNanoId } from './nanoid';

const prisma = new PrismaClient();

/**
 * Find a station by either its numeric ID or NanoID
 * This enables seamless transition between ID systems
 */
export async function findStationByEitherId(idParam: string, includeOptions: any = {}) {
  const idType = getIdType(idParam);
  
  switch (idType) {
    case 'nanoid':
      return await prisma.station.findUnique({
        where: { nanoid: idParam },
        ...includeOptions
      });
      
    case 'numeric':
      const numericId = parseInt(idParam, 10);
      return await prisma.station.findUnique({
        where: { id: numericId },
        ...includeOptions
      });
      
    case 'invalid':
      return null;
      
    default:
      return null;
  }
}

/**
 * Get station reference fields for foreign key operations
 * Returns both numeric ID and nanoid for transition period
 */
export async function getStationReferenceFields(idParam: string) {
  const station = await findStationByEitherId(idParam, {
    select: { id: true, nanoid: true }
  });
  
  if (!station) {
    return null;
  }
  
  return {
    stationId: station.id,           // Legacy reference
    stationNanoid: station.nanoid    // New reference
  };
}

/**
 * Find user favorites by station ID (either type)
 */
export async function findUserFavoriteByStationId(userId: number, stationIdParam: string) {
  const stationRefs = await getStationReferenceFields(stationIdParam);
  if (!stationRefs) return null;
  
  // Try to find favorite by either reference method
  // Check nanoid first (preferred), then fallback to numeric
  if (stationRefs.stationNanoid) {
    const favoriteByNanoid = await prisma.userFavorites.findUnique({
      where: {
        userId_stationNanoid: {
          userId,
          stationNanoid: stationRefs.stationNanoid
        }
      }
    });
    if (favoriteByNanoid) return favoriteByNanoid;
  }
  
  // Fallback to numeric ID
  return await prisma.userFavorites.findUnique({
    where: {
      userId_stationId: {
        userId,
        stationId: stationRefs.stationId
      }
    }
  });
}

/**
 * Create or remove user favorite with dual reference support
 */
export async function toggleUserFavorite(userId: number, stationIdParam: string, action: 'add' | 'remove') {
  const stationRefs = await getStationReferenceFields(stationIdParam);
  if (!stationRefs) {
    throw new Error('Station not found');
  }
  
  if (action === 'add') {
    // Create favorite with both references for transition
    return await prisma.userFavorites.create({
      data: {
        userId,
        stationId: stationRefs.stationId,           // Legacy reference
        stationNanoid: stationRefs.stationNanoid    // New reference
      }
    });
  } else {
    // Remove favorite - try both reference methods
    const existing = await findUserFavoriteByStationId(userId, stationIdParam);
    if (existing) {
      return await prisma.userFavorites.delete({
        where: { id: existing.id }
      });
    }
    return null;
  }
}

/**
 * Submit station feedback with dual reference support
 */
export async function createStationFeedback(stationIdParam: string, feedbackData: any) {
  const stationRefs = await getStationReferenceFields(stationIdParam);
  if (!stationRefs) {
    throw new Error('Station not found');
  }
  
  return await prisma.stationFeedback.create({
    data: {
      ...feedbackData,
      stationId: stationRefs.stationId,           // Legacy reference
      stationNanoid: stationRefs.stationNanoid    // New reference
    }
  });
}

/**
 * Get station feedback with dual reference support
 */
export async function getStationFeedback(stationIdParam: string, options: any = {}) {
  const stationRefs = await getStationReferenceFields(stationIdParam);
  if (!stationRefs) return [];
  
  // Query by nanoid first (preferred), fallback to numeric
  if (stationRefs.stationNanoid) {
    const feedbackByNanoid = await prisma.stationFeedback.findMany({
      where: { stationNanoid: stationRefs.stationNanoid },
      ...options
    });
    if (feedbackByNanoid.length > 0) return feedbackByNanoid;
  }
  
  // Fallback to numeric ID
  return await prisma.stationFeedback.findMany({
    where: { stationId: stationRefs.stationId },
    ...options
  });
}

/**
 * Utility function to get the preferred ID for API responses
 * During transition: prefer nanoid, fallback to numeric
 * After transition: nanoid only
 */
export function getPreferredStationId(station: { id: number; nanoid: string | null }): string {
  return station.nanoid || station.id.toString();
}

/**
 * Middleware-style function to extract and validate station ID from request params
 */
export function parseStationIdParam(req: any): { stationIdParam: string; idType: 'nanoid' | 'numeric' | 'invalid' } {
  const stationIdParam = req.params.id || req.params.stationId;
  const idType = getIdType(stationIdParam);
  
  return { stationIdParam, idType };
}

export default {
  findStationByEitherId,
  getStationReferenceFields,
  findUserFavoriteByStationId,
  toggleUserFavorite,
  createStationFeedback,
  getStationFeedback,
  getPreferredStationId,
  parseStationIdParam
};