// iheart.ts - iHeart Radio import routes
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import * as iheart from 'iheart';

const router = Router();
const prisma = new PrismaClient();

// Smart ID gap-filling utility function (shared with stations.ts)
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

// Search iHeart stations
router.get('/search', async (req: Request, res: Response) => {
  try {
    const { location, keyword, limit = 50 } = req.query;
    
    if (!location && !keyword) {
      return res.status(400).json({ error: 'Location or keyword parameter is required' });
    }

    const searchTerm = (location || keyword) as string;
    console.log(`🔍 Searching iHeart stations for: "${searchTerm}"`);

    // Search for stations using the iheart package
    // Try to get both US and Canadian results by searching broadly
    const results = await iheart.search(searchTerm, { limit: 100 });
    
    if (!results || !results.stations) {
      return res.json({ stations: [], total: 0 });
    }

    // Limit results
    const limitNum = Math.min(parseInt(limit as string), 100);
    const stations = results.stations.slice(0, limitNum);

    // Transform iHeart station data to our format
    const transformedStations = stations.map((station: any) => ({
      iheartId: station.id,
      name: station.name || 'Unknown Station',
      description: station.description || '',
      city: station.city || '',
      state: station.state || '',
      country: station.country || 'USA', // iHeart is primarily US
      genre: station.genre || '',
      logo: station.logo || station.image || '',
      website: station.website || `https://www.iheart.com/live/${station.id}/`,
      // Note: streamUrl will be resolved during import for better reliability
    }));

    console.log(`✅ Found ${transformedStations.length} iHeart stations`);
    
    res.json({
      stations: transformedStations,
      total: transformedStations.length,
      searchTerm
    });

  } catch (error) {
    console.error('❌ Error searching iHeart stations:', error);
    res.status(500).json({ 
      error: 'Failed to search iHeart stations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Import selected iHeart stations
router.post('/import', async (req: Request, res: Response) => {
  try {
    const { stations } = req.body;
    
    if (!Array.isArray(stations) || stations.length === 0) {
      return res.status(400).json({ error: 'Stations array is required' });
    }

    console.log(`📥 Importing ${stations.length} iHeart stations`);
    
    const imported = [];
    const errors = [];

    for (const stationData of stations) {
      try {
        // Get stream URL for this station
        let streamUrl = '';
        try {
          streamUrl = await iheart.streamURL({ id: stationData.iheartId });
          console.log(`🎵 Got stream URL for ${stationData.name}: ${streamUrl}`);
        } catch (streamError) {
          console.warn(`⚠️ Could not get stream URL for ${stationData.name}:`, streamError);
          // Continue without stream URL - can be added manually later
        }

        // Check for existing station by name to avoid duplicates
        const existingStation = await prisma.station.findFirst({
          where: {
            OR: [
              { name: { equals: stationData.name, mode: 'insensitive' } },
              { streamUrl: streamUrl }
            ]
          }
        });

        if (existingStation) {
          console.log(`⚠️ Station ${stationData.name} already exists, skipping`);
          errors.push(`Station "${stationData.name}" already exists`);
          continue;
        }

        // Create station record with ID management
        let newStation;
        try {
          // Try with optimal ID first
          const optimalId = await getNextAvailableStationId();
          newStation = await prisma.station.create({
            data: {
              id: optimalId,
              name: stationData.name,
              description: stationData.description || null,
              city: stationData.city || null,
              state: stationData.state || null,
              country: stationData.country || 'USA',
              genre: stationData.genre || null,
              logo: stationData.logo || null,
              favicon: stationData.logo || null, // Use logo as favicon fallback
              homepage: stationData.website || null,
              streamUrl: streamUrl || 'https://example.com/stream.mp3', // Placeholder if no stream found
              isActive: false, // Set to inactive so user can curate
              // Add iHeart-specific metadata
              tags: `iheart,${stationData.genre || ''}`.toLowerCase()
            }
          });
        } catch (idError) {
          // Fallback to auto-increment if ID assignment fails
          if (idError instanceof Error && idError.message.includes('unique constraint')) {
            console.log('🔄 ID conflict detected, falling back to auto-increment...');
            newStation = await prisma.station.create({
              data: {
                name: stationData.name,
                description: stationData.description || null,
                city: stationData.city || null,
                state: stationData.state || null,
                country: stationData.country || 'USA',
                genre: stationData.genre || null,
                logo: stationData.logo || null,
                favicon: stationData.logo || null, // Use logo as favicon fallback
                homepage: stationData.website || null,
                streamUrl: streamUrl || 'https://example.com/stream.mp3', // Placeholder if no stream found
                isActive: false, // Set to inactive so user can curate
                // Add iHeart-specific metadata
                tags: `iheart,${stationData.genre || ''}`.toLowerCase()
              }
            });
          } else {
            throw idError;
          }
        }

        imported.push({
          id: newStation.id,
          name: newStation.name,
          streamUrl: newStation.streamUrl
        });

        console.log(`✅ Imported: ${newStation.name} (ID: ${newStation.id})`);

      } catch (stationError) {
        console.error(`❌ Error importing station ${stationData.name}:`, stationError);
        errors.push(`Failed to import "${stationData.name}": ${stationError instanceof Error ? stationError.message : 'Unknown error'}`);
      }
    }

    console.log(`🎯 Import complete: ${imported.length} successful, ${errors.length} errors`);

    res.json({
      success: true,
      imported: imported.length,
      errors: errors.length,
      stations: imported,
      errorDetails: errors
    });

  } catch (error) {
    console.error('❌ Error importing iHeart stations:', error);
    res.status(500).json({ 
      error: 'Failed to import stations',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;