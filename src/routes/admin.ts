// admin.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const router = Router();
const prisma = new PrismaClient();

// Base admin endpoint
router.get('/', async (req: Request, res: Response) => {
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
    
    return res.json({
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
    });
  } catch (error) {
    console.error('❌ Error in admin base endpoint:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Admin service error' 
    });
  }
});

// Get stations for normalization
router.get('/stations/normalize', async (req: Request, res: Response) => {
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
    return res.json({
      stations,
      pendingChanges: []
    });
  } catch (error) {
    console.error('❌ Error fetching stations for normalization:', error);
    return res.status(500).json({ error: 'Failed to fetch stations' });
  }
});

// Analyze stations for normalization opportunities
router.post('/stations/analyze', async (req: Request, res: Response) => {
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
    return res.json({ 
      pendingChanges,
      analysisStats: {
        totalStations: stations.length,
        suggestedChanges: pendingChanges.length,
        confidence: pendingChanges.length > 0 ? Math.round(pendingChanges.reduce((acc, c) => acc + (c.confidence || 50), 0) / pendingChanges.length) : 0
      }
    });
  } catch (error) {
    console.error('❌ Error analyzing stations:', error);
    return res.status(500).json({ error: 'Failed to analyze stations' });
  }
});

// Apply normalization changes
router.post('/stations/apply-normalization', async (req: Request, res: Response) => {
  try {
    const { changes } = req.body;
    
    if (!Array.isArray(changes)) {
      return res.status(400).json({ error: 'Changes must be an array' });
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
    return res.json({ updated });
  } catch (error) {
    console.error('❌ Error applying normalization:', error);
    return res.status(500).json({ error: 'Failed to apply changes' });
  }
});

// Get normalization rules (placeholder for future functionality)
router.get('/normalization-rules', async (req: Request, res: Response) => {
  // For now, return empty rules - could be stored in database later
  return res.json([]);
});

// Get admin statistics
router.get('/stats', async (req: Request, res: Response) => {
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

    return res.json({
      total: totalStations,
      withGenre: stationsWithGenre,
      withType: stationsWithType,
      countries: countryCounts.length,
      genres: genreCounts.length,
      types: typeCounts.length,
      topCountries: countryCounts.slice(0, 5),
      topGenres: genreCounts.slice(0, 10),
      topTypes: typeCounts.slice(0, 5)
    });
  } catch (error) {
    console.error('❌ Error fetching admin stats:', error);
    return res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Enable/disable a station
router.patch('/stations/:id/toggle', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const stationId = parseInt(req.params.id);
    const { isActive, adminNotes } = req.body;
    
    const station = await prisma.station.findUnique({
      where: { id: stationId }
    });
    
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }
    
    const updatedStation = await prisma.station.update({
      where: { id: stationId },
      data: {
        isActive: isActive !== undefined ? isActive : !station.isActive,
        adminNotes: adminNotes || station.adminNotes,
        userReports: 0, // Reset user reports when admin takes action
        updatedAt: new Date()
      }
    });
    
    console.log(`🔧 Admin ${updatedStation.isActive ? 'enabled' : 'disabled'} station: ${station.name}`);
    
    return res.json({
      success: true,
      station: {
        id: updatedStation.id,
        name: updatedStation.name,
        isActive: updatedStation.isActive,
        adminNotes: updatedStation.adminNotes
      }
    });
    
  } catch (error) {
    console.error('❌ Error toggling station status:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to toggle station status' 
    });
  }
});

// Update station admin notes
router.patch('/stations/:id/notes', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const stationId = parseInt(req.params.id);
    const { adminNotes } = req.body;
    
    const updatedStation = await prisma.station.update({
      where: { id: stationId },
      data: {
        adminNotes,
        updatedAt: new Date()
      }
    });
    
    return res.json({
      success: true,
      stationId,
      adminNotes: updatedStation.adminNotes
    });
    
  } catch (error) {
    console.error('❌ Error updating admin notes:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to update admin notes' 
    });
  }
});

// Reset user reports for a station
router.patch('/stations/:id/reset-reports', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const stationId = parseInt(req.params.id);
    
    const updatedStation = await prisma.station.update({
      where: { id: stationId },
      data: {
        userReports: 0,
        updatedAt: new Date()
      }
    });
    
    return res.json({
      success: true,
      stationId,
      userReports: updatedStation.userReports
    });
    
  } catch (error) {
    console.error('❌ Error resetting user reports:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to reset user reports' 
    });
  }
});

// Report a station as not working (user endpoint)
router.post('/stations/:id/report', async (req: Request<{ id: string }>, res: Response) => {
  try {
    const stationId = parseInt(req.params.id);
    
    const station = await prisma.station.findUnique({
      where: { id: stationId }
    });
    
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }
    
    const updatedStation = await prisma.station.update({
      where: { id: stationId },
      data: {
        userReports: station.userReports + 1,
        updatedAt: new Date()
      }
    });
    
    console.log(`📢 User reported station not working: ${station.name} (${updatedStation.userReports} reports)`);
    
    return res.json({
      success: true,
      message: 'Report submitted successfully',
      stationId,
      totalReports: updatedStation.userReports
    });
    
  } catch (error) {
    console.error('❌ Error submitting user report:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to submit report' 
    });
  }
});

// Scraper endpoint for unified editor
router.post('/scrape-url', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
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
    console.error('❌ Error scraping URL:', error);
    res.status(500).json({ error: 'Failed to scrape website' });
  }
});

// Normalization preview endpoint
router.post('/normalize-preview', async (req: Request, res: Response) => {
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
    
    res.json({
      genre: suggestedGenre,
      type: suggestedType,
      subgenres: suggestedSubgenres,
      allTypes: suggestedTypes,
      confidence: {
        genre: suggestedGenre ? 85 : 0,
        type: suggestedType ? 80 : 0
      }
    });
  } catch (error) {
    console.error('❌ Error getting normalization preview:', error);
    res.status(500).json({ error: 'Failed to get normalization suggestions' });
  }
});

// Constants endpoints for station editor
router.get('/constants/genres', async (req: Request, res: Response) => {
  try {
    const { GENRE_SYSTEM } = await import('../constants/genres');
    
    const response = {
      allGenres: Object.keys(GENRE_SYSTEM),
      genres: GENRE_SYSTEM
    };
    
    res.json(response);
  } catch (error) {
    console.error('❌ Error loading genre constants:', error);
    res.status(500).json({ error: 'Failed to load genre constants' });
  }
});

router.get('/constants/station-types', async (req: Request, res: Response) => {
  try {
    const { STATION_TYPES } = await import('../constants/stationTypes');
    
    const response = {
      allTypes: Object.keys(STATION_TYPES),
      stationTypes: STATION_TYPES
    };
    
    res.json(response);
  } catch (error) {
    console.error('❌ Error loading station type constants:', error);
    res.status(500).json({ error: 'Failed to load station type constants' });
  }
});

router.get('/constants/collection-tags', async (req: Request, res: Response) => {
  try {
    const { COLLECTION_TAGS } = await import('../constants/collectionTags');
    
    const response = {
      allTags: Object.keys(COLLECTION_TAGS),
      collectionTags: COLLECTION_TAGS
    };
    
    res.json(response);
  } catch (error) {
    console.error('❌ Error loading collection tag constants:', error);
    res.status(500).json({ error: 'Failed to load collection tag constants' });
  }
});

// Test metadata URL endpoint
router.post('/test-metadata-url', async (req: Request, res: Response) => {
  try {
    const { url, format } = req.body;
    
    console.log(`🧪 Testing metadata URL: ${url} (format: ${format || 'auto'})`);
    
    // Handle Rogers Auto configuration
    if (url === 'automatic' || format === 'auto') {
      console.log('✅ Rogers Auto configuration detected');
      return res.json({
        success: true,
        metadata: {
          title: 'Rogers Auto Configuration',
          artist: 'System Test',
          song: 'Rogers API integration enabled'
        },
        message: 'Rogers Auto configuration is working. Metadata will be provided automatically during playback.'
      });
    }
    
    if (!url) {
      return res.status(400).json({ 
        success: false, 
        error: 'URL is required' 
      });
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
      return res.json({
        success: true,
        metadata: {
          title: 'XML Response',
          artist: 'Parsed Successfully',
          song: 'XML format detected'
        },
        rawResponse: responseText.substring(0, 500) + '...'
      });
    } else {
      // Try JSON first, then treat as text
      try {
        data = JSON.parse(responseText);
      } catch {
        return res.json({
          success: true,
          metadata: {
            title: 'Text Response',
            artist: 'Parsed Successfully', 
            song: 'Text format detected'
          },
          rawResponse: responseText.substring(0, 500) + '...'
        });
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
    
    res.json({
      success: true,
      metadata,
      format: format || 'auto-detected',
      contentType
    });
    
  } catch (error) {
    console.error('❌ Error testing metadata URL:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;