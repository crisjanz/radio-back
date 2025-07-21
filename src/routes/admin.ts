// admin.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';
import { findStationByEitherId, parseStationIdParam } from '../utils/station-lookup';
import { handleError, handleNotFound, handleValidationError } from '../types/express';

const router = Router();
const prisma = new PrismaClient();

// Base admin endpoint
router.get('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const [totalStations, stationsNeedingNormalization, activeStations] = await Promise.all([
      prisma.station.count(),
      prisma.station.count({
        where: {
          OR: [
            { genre: null },
            { type: null },
            { genre: '' },
            { type: '' }
          ]
        }
      }),
      prisma.station.count({ where: { isActive: true } })
    ]);
    
    const data = {
      success: true,
      message: 'Admin service is running',
      stats: {
        totalStations,
        activeStations,
        stationsNeedingNormalization,
        completeness: totalStations > 0 ? Math.round(((totalStations - stationsNeedingNormalization) / totalStations) * 100) : 0
      },
      endpoints: {
        '/admin/stations/normalize': 'Get stations needing normalization',
        '/admin/normalization-rules': 'Get normalization rules',
        '/admin/stations/analyze': 'Analyze stations for normalization',
        '/admin/stations/apply-normalization': 'Apply normalization changes',
        '/admin/stations/:id/toggle': 'Toggle station active status',
        '/admin/stats': 'Get admin statistics'
      }
    };
    
    res.json(data);
  } catch (error) {
    handleError(res, error, 'Admin service error');
  }
});

// Get stations for normalization
router.get('/stations/normalize', async (req: Request, res: Response): Promise<void> => {
  try {
    const stations = await prisma.station.findMany({
      select: {
        id: true,
        name: true,
        genre: true,
        type: true,
        country: true
      }
    });
    
    // For now, return empty pending changes - the frontend will analyze
    const data = {
      stations,
      pendingChanges: []
    };
    
    res.json(data);
  } catch (error) {
    handleError(res, error, 'Failed to fetch stations');
  }
});

// Analyze stations for normalization opportunities
router.post('/stations/analyze', async (req: Request, res: Response): Promise<void> => {
  try {
    const stations = await prisma.station.findMany({
      select: {
        id: true,
        name: true,
        genre: true,
        type: true,
        country: true,
        description: true
      }
    });
    
    const pendingChanges: any[] = [];
    
    // Import sophisticated analysis constants
    const { GENRE_SYSTEM, getAllGenres, isValidGenre } = await import('../constants/genres');
    const { STATION_TYPES, suggestStationTypeForStation, isValidStationType } = await import('../constants/stationTypes');
    
    // Create analysis rules from genre system
    const genreRules: { keywords: string[], normalized: string }[] = [];
    Object.entries(GENRE_SYSTEM).forEach(([key, info]) => {
      genreRules.push({
        keywords: [key, info.name.toLowerCase(), ...info.subgenres],
        normalized: key
      });
    });
    
    // Create analysis rules from station types
    const typeRules: { keywords: string[], normalized: string }[] = [];
    Object.entries(STATION_TYPES).forEach(([key, info]) => {
      typeRules.push({
        keywords: [key, info.name.toLowerCase(), ...info.keywords],
        normalized: key
      });
    });
    
    // Analyze each station
    for (const station of stations) {
      const stationData = {
        name: station.name,
        description: station.description || '',
        genre: station.genre || '',
        subgenre: ''
      };
      
      // Sophisticated genre analysis
      if (station.genre) {
        const currentGenre = station.genre.toLowerCase();
        
        // Check if current genre is valid
        if (!isValidGenre(currentGenre)) {
          // Try to find a match in our genre system
          let bestMatch = null;
          let bestScore = 0;
          
          for (const rule of genreRules) {
            const score = rule.keywords.reduce((acc, keyword) => {
              if (currentGenre.includes(keyword.toLowerCase())) {
                return acc + (keyword.length / currentGenre.length);
              }
              return acc;
            }, 0);
            
            if (score > bestScore) {
              bestScore = score;
              bestMatch = rule.normalized;
            }
          }
          
          if (bestMatch && bestScore > 0.3) {
            const existingChange = pendingChanges.find(
              c => c.stationId === station.id && c.field === 'genre'
            );
            
            if (!existingChange) {
              pendingChanges.push({
                stationId: station.id,
                field: 'genre',
                original: station.genre,
                suggested: bestMatch,
                confidence: Math.round(bestScore * 100),
                status: 'pending'
              });
            }
          }
        }
      }
      
      // Sophisticated type analysis
      const suggestedTypes = suggestStationTypeForStation(stationData);
      
      if (station.type) {
        const currentType = station.type.toLowerCase();
        
        // Check if current type is valid
        if (!isValidStationType(currentType)) {
          // Use the first suggested type
          if (suggestedTypes.length > 0) {
            const existingChange = pendingChanges.find(
              c => c.stationId === station.id && c.field === 'type'
            );
            
            if (!existingChange) {
              pendingChanges.push({
                stationId: station.id,
                field: 'type',
                original: station.type,
                suggested: suggestedTypes[0],
                confidence: 85,
                status: 'pending'
              });
            }
          }
        }
      } else {
        // If no type, suggest based on analysis
        if (suggestedTypes.length > 0) {
          pendingChanges.push({
            stationId: station.id,
            field: 'type',
            original: null,
            suggested: suggestedTypes[0],
            confidence: 75,
            status: 'pending'
          });
        }
      }
      
      // Note: Subgenre analysis skipped - field not in database schema yet
    }
    
    console.log(`🔍 Sophisticated analysis complete: found ${pendingChanges.length} suggested changes`);
    const data = { 
      pendingChanges,
      analysisStats: {
        totalStations: stations.length,
        suggestedChanges: pendingChanges.length,
        confidence: pendingChanges.length > 0 ? Math.round(pendingChanges.reduce((acc, c) => acc + (c.confidence || 50), 0) / pendingChanges.length) : 0
      }
    };
    res.json(data);
  } catch (error) {
    handleError(res, error, 'Failed to analyze stations');
  }
});

// Apply normalization changes
router.post('/stations/apply-normalization', async (req: Request, res: Response): Promise<void> => {
  try {
    const { changes } = req.body;
    
    if (!Array.isArray(changes)) {
      handleValidationError(res, 'Changes must be an array');
      return;
    }
    
    let updated = 0;
    
    for (const change of changes) {
      if (change.status === 'approved' && change.stationId && change.field && change.suggested) {
        try {
          await prisma.station.update({
            where: { id: change.stationId },
            data: {
              [change.field]: change.suggested
            }
          });
          updated++;
        } catch (updateError) {
          console.error(`❌ Error updating station ${change.stationId}:`, updateError);
        }
      }
    }
    
    console.log(`✅ Applied ${updated} normalization changes`);
    const data = { updated };
    res.json(data);
  } catch (error) {
    handleError(res, error, 'Failed to apply normalization changes');
  }
});

// Get normalization rules (placeholder for future functionality)
router.get('/normalization-rules', async (req: Request, res: Response): Promise<void> => {
  // For now, return empty rules - could be stored in database later
  const data = [];
  res.json(data);
});

// Get admin statistics
router.get('/stats', async (req: Request, res: Response): Promise<void> => {
  try {
    const [
      totalStations,
      stationsWithGenre,
      stationsWithType,
      countryCounts,
      genreCounts,
      typeCounts
    ] = await Promise.all([
      prisma.station.count(),
      prisma.station.count({ where: { genre: { not: null } } }),
      prisma.station.count({ where: { type: { not: null } } }),
      prisma.station.groupBy({ by: ['country'], _count: true }),
      prisma.station.groupBy({ by: ['genre'], _count: true, where: { genre: { not: null } } }),
      prisma.station.groupBy({ by: ['type'], _count: true, where: { type: { not: null } } })
    ]);

    const data = {
      total: totalStations,
      withGenre: stationsWithGenre,
      withType: stationsWithType,
      countries: countryCounts.length,
      genres: genreCounts.length,
      types: typeCounts.length,
      topCountries: countryCounts.slice(0, 5),
      topGenres: genreCounts.slice(0, 10),
      topTypes: typeCounts.slice(0, 5)
    };
    res.json(data);
  } catch (error) {
    handleError(res, error, 'Failed to fetch admin statistics');
  }
});

// Enable/disable a station (supports both numeric and nanoid)
router.patch('/stations/:id/toggle', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { stationIdParam, idType } = parseStationIdParam(req);
    const { isActive, adminNotes } = req.body;
    
    if (idType === 'invalid') {
      handleValidationError(res, 'Invalid station ID format');
      return;
    }
    
    const station = await findStationByEitherId(stationIdParam);
    
    if (!station) {
      handleNotFound(res, 'Station');
      return;
    }
    
    const updatedStation = await prisma.station.update({
      where: { id: station.id },
      data: {
        isActive: isActive !== undefined ? isActive : !station.isActive,
        adminNotes: adminNotes || station.adminNotes,
        userReports: 0, // Reset user reports when admin takes action
        updatedAt: new Date()
      }
    });
    
    console.log(`🔧 Admin ${updatedStation.isActive ? 'enabled' : 'disabled'} station: ${station.name}`);
    
    const data = {
      success: true,
      station: {
        id: updatedStation.id,
        name: updatedStation.name,
        isActive: updatedStation.isActive,
        adminNotes: updatedStation.adminNotes
      }
    };
    res.json(data);
    
  } catch (error) {
    handleError(res, error, 'Failed to toggle station status');
  }
});

// Update station admin notes (supports both numeric and nanoid)
router.patch('/stations/:id/notes', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { stationIdParam, idType } = parseStationIdParam(req);
    const { adminNotes } = req.body;
    
    if (idType === 'invalid') {
      handleValidationError(res, 'Invalid station ID format');
      return;
    }
    
    const station = await findStationByEitherId(stationIdParam, {
      select: { id: true }
    });
    
    if (!station) {
      handleNotFound(res, 'Station');
      return;
    }
    
    const updatedStation = await prisma.station.update({
      where: { id: station.id },
      data: {
        adminNotes,
        updatedAt: new Date()
      }
    });
    
    const data = {
      success: true,
      stationId: station.id,
      adminNotes: updatedStation.adminNotes
    };
    res.json(data);
    
  } catch (error) {
    handleError(res, error, 'Failed to update admin notes');
  }
});

// Reset user reports for a station (supports both numeric and nanoid)
router.patch('/stations/:id/reset-reports', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { stationIdParam, idType } = parseStationIdParam(req);
    
    if (idType === 'invalid') {
      handleValidationError(res, 'Invalid station ID format');
      return;
    }
    
    const station = await findStationByEitherId(stationIdParam, {
      select: { id: true }
    });
    
    if (!station) {
      handleNotFound(res, 'Station');
      return;
    }
    
    const updatedStation = await prisma.station.update({
      where: { id: station.id },
      data: {
        userReports: 0,
        updatedAt: new Date()
      }
    });
    
    const data = {
      success: true,
      stationId: station.id,
      userReports: updatedStation.userReports
    };
    res.json(data);
    
  } catch (error) {
    handleError(res, error, 'Failed to reset user reports');
  }
});

// Report a station as not working (user endpoint) - supports both numeric and nanoid
router.post('/stations/:id/report', async (req: Request<{ id: string }>, res: Response): Promise<void> => {
  try {
    const { stationIdParam, idType } = parseStationIdParam(req);
    
    if (idType === 'invalid') {
      handleValidationError(res, 'Invalid station ID format');
      return;
    }
    
    const station = await findStationByEitherId(stationIdParam);
    
    if (!station) {
      handleNotFound(res, 'Station');
      return;
    }
    
    const updatedStation = await prisma.station.update({
      where: { id: station.id },
      data: {
        userReports: station.userReports + 1,
        updatedAt: new Date()
      }
    });
    
    console.log(`📢 User reported station not working: ${station.name} (${updatedStation.userReports} reports)`);
    
    const data = {
      success: true,
      message: 'Report submitted successfully',
      stationId: station.id,
      totalReports: updatedStation.userReports
    };
    res.json(data);
    
  } catch (error) {
    handleError(res, error, 'Failed to submit user report');
  }
});

// Scraper endpoint for unified editor
router.post('/scrape-url', async (req: Request, res: Response): Promise<void> => {
  try {
    const { url } = req.body;
    
    if (!url) {
      handleValidationError(res, 'URL is required');
      return;
    }

    // Use the existing scraping endpoint - construct URL from current request
    const protocol = req.protocol;
    const host = req.get('host');
    const baseUrl = `${protocol}://${host}`;
    const response = await fetch(`${baseUrl}/scrape/business`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ url })
    });

    if (response.ok) {
      const scrapedData = await response.json();
      
      // Transform response to match frontend expectations
      if (scrapedData.success && scrapedData.data) {
        // Single URL scraping - no conflicts by definition
        res.json({
          success: true,
          hasConflicts: false,
          data: scrapedData.data,
          source: scrapedData.source || 'website'
        });
      } else {
        res.json(scrapedData);
      }
    } else {
      throw new Error('Failed to scrape website');
    }
  } catch (error) {
    handleError(res, error, 'Failed to scrape website');
  }
});

// Normalization preview endpoint
router.post('/normalize-preview', async (req: Request, res: Response): Promise<void> => {
  try {
    const { genre, type, name, description } = req.body;
    
    // Import sophisticated analysis constants
    const { GENRE_SYSTEM, isValidGenre } = await import('../constants/genres');
    const { suggestStationTypeForStation, isValidStationType } = await import('../constants/stationTypes');
    
    let suggestedGenre = null;
    let suggestedType = null;
    let suggestedSubgenres: string[] = [];
    
    // Sophisticated genre analysis
    if (genre) {
      const currentGenre = genre.toLowerCase();
      
      if (!isValidGenre(currentGenre)) {
        // Try to find a match in our genre system
        let bestMatch = null;
        let bestScore = 0;
        
        Object.entries(GENRE_SYSTEM).forEach(([key, info]) => {
          const keywords = [key, info.name.toLowerCase(), ...info.subgenres];
          const score = keywords.reduce((acc, keyword) => {
            if (currentGenre.includes(keyword.toLowerCase())) {
              return acc + (keyword.length / currentGenre.length);
            }
            return acc;
          }, 0);
          
          if (score > bestScore) {
            bestScore = score;
            bestMatch = key;
          }
        });
        
        if (bestMatch && bestScore > 0.3) {
          suggestedGenre = bestMatch;
        }
      }
    }
    
    // Sophisticated type analysis
    const stationData = {
      name: name || '',
      description: description || '',
      genre: genre || '',
      subgenre: ''
    };
    
    const suggestedTypes = suggestStationTypeForStation(stationData);
    
    if (type) {
      const currentType = type.toLowerCase();
      
      if (!isValidStationType(currentType)) {
        if (suggestedTypes.length > 0) {
          suggestedType = suggestedTypes[0];
        }
      }
    } else {
      // If no type, suggest based on analysis
      if (suggestedTypes.length > 0) {
        suggestedType = suggestedTypes[0];
      }
    }
    
    // Suggest subgenres if we have a genre
    const effectiveGenre = suggestedGenre || genre;
    if (effectiveGenre && GENRE_SYSTEM[effectiveGenre]) {
      suggestedSubgenres = GENRE_SYSTEM[effectiveGenre].subgenres.slice(0, 3); // First 3 subgenres
    }
    
    const data = {
      genre: suggestedGenre,
      type: suggestedType,
      subgenres: suggestedSubgenres,
      allTypes: suggestedTypes,
      confidence: {
        genre: suggestedGenre ? 85 : 0,
        type: suggestedType ? 80 : 0
      }
    };
    res.json(data);
  } catch (error) {
    handleError(res, error, 'Failed to get normalization suggestions');
  }
});

// Constants endpoints for station editor
router.get('/constants/genres', async (req: Request, res: Response): Promise<void> => {
  try {
    const { GENRE_SYSTEM } = await import('../constants/genres');
    
    const response = {
      allGenres: Object.keys(GENRE_SYSTEM),
      genres: GENRE_SYSTEM
    };
    
    res.json(response);
  } catch (error) {
    handleError(res, error, 'Failed to load genre constants');
  }
});

router.get('/constants/station-types', async (req: Request, res: Response): Promise<void> => {
  try {
    const { STATION_TYPES } = await import('../constants/stationTypes');
    
    const response = {
      allTypes: Object.keys(STATION_TYPES),
      stationTypes: STATION_TYPES
    };
    
    res.json(response);
  } catch (error) {
    handleError(res, error, 'Failed to load station type constants');
  }
});

router.get('/constants/collection-tags', async (req: Request, res: Response): Promise<void> => {
  try {
    const { COLLECTION_TAGS } = await import('../constants/collectionTags');
    
    const response = {
      allTags: Object.keys(COLLECTION_TAGS),
      collectionTags: COLLECTION_TAGS
    };
    
    res.json(response);
  } catch (error) {
    handleError(res, error, 'Failed to load collection tag constants');
  }
});

// Test metadata URL endpoint
router.post('/test-metadata-url', async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, format } = req.body;
    
    console.log(`🧪 Testing metadata URL: ${url} (format: ${format || 'auto'})`);
    
    // Handle Rogers Auto configuration
    if (url === 'automatic' || format === 'auto') {
      console.log('✅ Rogers Auto configuration detected');
      const data = {
        success: true,
        metadata: {
          title: 'Rogers Auto Configuration',
          artist: 'System Test',
          song: 'Rogers API integration enabled'
        },
        message: 'Rogers Auto configuration is working. Metadata will be provided automatically during playback.'
      };
      res.json(data);
      return;
    }
    
    if (!url) {
      const data = { 
        success: false, 
        error: 'URL is required' 
      };
      res.status(400).json(data);
      return;
    }
    
    // Test the URL directly
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout for testing
    
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Streemr-Admin-Test/1.0',
        'Accept': 'application/json, text/javascript, */*'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type') || '';
    let data;
    
    // Try to parse the response based on format or content type
    const responseText = await response.text();
    
    if (format === 'jsonp' || url.includes('callback=')) {
      // Handle JSONP response (like SoCast)
      const jsonpMatch = responseText.match(/(?:callback|jsonpcallback|cb)\((.+)\);?$/);
      if (jsonpMatch) {
        data = JSON.parse(jsonpMatch[1]);
      } else {
        throw new Error('Invalid JSONP format');
      }
    } else if (format === 'json' || contentType.includes('json') || responseText.trim().startsWith('{')) {
      data = JSON.parse(responseText);
    } else if (format === 'xml' || contentType.includes('xml')) {
      // For XML, just return a success message
      const xmlData = {
        success: true,
        metadata: {
          title: 'XML Response',
          artist: 'Parsed Successfully',
          song: 'XML format detected'
        },
        rawResponse: responseText.substring(0, 500) + '...'
      };
      res.json(xmlData);
      return;
    } else {
      // Try JSON first, then treat as text
      try {
        data = JSON.parse(responseText);
      } catch {
        const textData = {
          success: true,
          metadata: {
            title: 'Text Response',
            artist: 'Parsed Successfully', 
            song: 'Text format detected'
          },
          rawResponse: responseText.substring(0, 500) + '...'
        };
        res.json(textData);
        return;
      }
    }
    
    // Extract metadata based on common patterns
    let metadata: any = {};
    
    // SoCast format
    if (data.song_name && data.artist_name) {
      metadata = {
        title: data.song_name,
        artist: data.artist_name,
        song: `${data.artist_name} - ${data.song_name}`,
        artwork: data.itunes_img || data.image
      };
    }
    // Generic JSON patterns
    else if (data.title || data.artist || data.track) {
      metadata = {
        title: data.title || data.track || data.song,
        artist: data.artist || data.performer,
        song: data.song || (data.artist && data.title ? `${data.artist} - ${data.title}` : ''),
        album: data.album
      };
    }
    // Radio.co format
    else if (data.data && (data.data.title || data.data.artist)) {
      metadata = {
        title: data.data.title,
        artist: data.data.artist,
        song: data.data.title && data.data.artist ? `${data.data.artist} - ${data.data.title}` : ''
      };
    }
    // Fallback - just return what we found
    else {
      metadata = {
        title: 'Data Found',
        artist: 'Successfully Parsed',
        song: 'Metadata detected but format unknown'
      };
    }
    
    const resultData = {
      success: true,
      metadata,
      format: format || 'auto-detected',
      contentType
    };
    res.json(resultData);
    
  } catch (error) {
    handleError(res, error, 'Failed to test metadata URL');
  }
});

export default router;