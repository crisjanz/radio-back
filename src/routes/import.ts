// import.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const router = Router();
const prisma = new PrismaClient();

// HTML entity decoder function
const decodeHtmlEntities = (text: string): string => {
  if (!text) return text;
  
  return text
    // Named entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&hellip;/g, '…')
    // Numeric entities (decimal)
    .replace(/&#(\d+);/g, (match, num) => String.fromCharCode(parseInt(num, 10)))
    // Hex entities
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
};

// City extraction utilities
const extractCityFromState = (state: string): string | null => {
  if (!state) return null;
  
  // Clean and normalize the state string
  const cleaned = state.trim();
  
  // If it looks like a city (not a state code like "CA", "NY", "BC")
  if (cleaned.length > 2 && !/^[A-Z]{2}$/.test(cleaned)) {
    // Handle patterns like "New York NY", "Los Angeles, California"
    if (cleaned.includes(',')) {
      const parts = cleaned.split(',').map(p => p.trim());
      return parts[0]; // Return the first part (likely the city)
    }
    
    // Handle patterns like "New York NY" (space separated)
    const words = cleaned.split(/\s+/);
    if (words.length >= 2) {
      const lastWord = words[words.length - 1];
      // If last word is likely a state code, return everything before it
      if (lastWord.length === 2 && lastWord === lastWord.toUpperCase()) {
        return words.slice(0, -1).join(' ');
      }
    }
    
    // Return as-is if it looks like a city name
    return cleaned;
  }
  
  return null;
};

const extractCityFromName = (name: string): string | null => {
  if (!name) return null;
  
  // Pattern 1: City in parentheses - "CALI 93.9 (Los Ángeles)"
  const parenthesesMatch = name.match(/\(([^)]+)\)$/);
  if (parenthesesMatch) {
    const cityCandidate = parenthesesMatch[1].trim();
    if (cityCandidate.length > 2) {
      return cityCandidate;
    }
  }
  
  // Pattern 2: City after dash/hyphen - "ESPN 1320 - Sacramento"
  const dashMatch = name.match(/[-–]\s*([A-Z][a-zA-Z\s]+)$/);
  if (dashMatch) {
    const cityCandidate = dashMatch[1].trim();
    if (cityCandidate.length > 2 && !cityCandidate.includes('FM') && !cityCandidate.includes('AM')) {
      return cityCandidate;
    }
  }
  
  // Pattern 3: City at the beginning - "Vancouver Island Radio"
  const prefixMatch = name.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+/);
  if (prefixMatch) {
    const cityCandidate = prefixMatch[1].trim();
    // Only return if it's likely a city (not radio-related terms)
    const radioTerms = ['Radio', 'FM', 'AM', 'Station', 'Music', 'News', 'BBC', 'CBC', 'NPR'];
    if (cityCandidate.length > 2 && !radioTerms.some(term => cityCandidate.includes(term))) {
      return cityCandidate;
    }
  }
  
  return null;
};


// Import from Radio Browser API
router.post('/radio-browser', async (req: Request, res: Response) => {
  try {
    const { 
      countrycode = '', 
      limit = 100, 
      offset = 0,
      name = '',
      tag = '',
      language = ''
    } = req.body;

    console.log('🌐 Importing from Radio-Browser API...');
    console.log(`   📊 Parameters: country=${countrycode}, limit=${limit}, offset=${offset}`);

    // Build query parameters
    const params = new URLSearchParams({
      limit: limit.toString(),
      offset: offset.toString(),
      hidebroken: 'true',
      order: 'clickcount',
      reverse: 'true'
    });

    if (countrycode) params.append('countrycode', countrycode);
    if (name) params.append('name', name);
    if (tag) params.append('tag', tag);
    if (language) params.append('language', language);

    const response = await fetch(`https://de1.api.radio-browser.info/json/stations/search?${params.toString()}`);
    
    if (!response.ok) {
      throw new Error(`Radio-Browser API returned ${response.status}`);
    }

    const stations = await response.json() as any[];
    console.log(`   📻 Fetched ${stations.length} stations from API`);

    let imported = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const station of stations) {
      try {
        // Check if station already exists
        const existing = await prisma.station.findFirst({
          where: {
            OR: [
              { streamUrl: station.url || station.url_resolved },
              { name: station.name, country: station.country }
            ]
          }
        });

        if (existing) {
          skipped++;
          continue;
        }

        // Extract and clean city information
        let extractedCity = extractCityFromState(station.state) || extractCityFromName(station.name);

        // Use languagecodes if available, fallback to language
        const stationLanguage = station.languagecodes || station.language || null;
        
        // Create the station record
        await prisma.station.create({
          data: {
            name: decodeHtmlEntities(station.name) || 'Unknown Station',
            streamUrl: station.url_resolved || station.url || '',
            homepage: station.homepage || null,
            favicon: station.favicon || null,
            country: station.country || 'Unknown',
            city: extractedCity,
            state: station.state || null,
            language: stationLanguage,
            genre: station.tags || null,
            type: 'music', // Default type
            bitrate: station.bitrate || null,
            codec: station.codec || null,
            description: null,
            frequency: null,
            tags: station.tags || null,
            latitude: station.geo_lat ? parseFloat(station.geo_lat) : null,
            longitude: station.geo_long ? parseFloat(station.geo_long) : null,
            clickcount: station.clickcount || null,
            votes: station.votes || null,
            radioBrowserUuid: station.stationuuid || null,
          }
        });

        imported++;
      } catch (error) {
        console.error(`❌ Error importing station "${station.name}":`, error);
        errors.push(`${station.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`✅ Import complete: ${imported} imported, ${skipped} skipped`);

    res.json({
      success: true,
      imported,
      skipped,
      total: stations.length,
      errors: errors.slice(0, 10) // Limit error details
    });

  } catch (error) {
    console.error('❌ Error during Radio-Browser import:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Import failed'
    });
  }
});

// Quick start import (pre-configured import)
router.post('/quick-start', async (req: Request, res: Response) => {
  try {
    console.log('🚀 Starting quick import...');

    const countries = ['CA', 'US', 'GB', 'AU', 'DE'];
    let totalImported = 0;
    let totalSkipped = 0;

    for (const countrycode of countries) {
      try {
        const importResponse = await fetch('http://localhost:3001/import/radio-browser', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            countrycode,
            limit: 50
          })
        });

        if (importResponse.ok) {
          const result = await importResponse.json();
          totalImported += result.imported || 0;
          totalSkipped += result.skipped || 0;
          console.log(`   ✅ ${countrycode}: ${result.imported} imported, ${result.skipped} skipped`);
        }
      } catch (error) {
        console.error(`❌ Error importing from ${countrycode}:`, error);
      }
    }

    console.log(`🎉 Quick import complete: ${totalImported} total imported, ${totalSkipped} total skipped`);

    res.json({
      success: true,
      imported: totalImported,
      skipped: totalSkipped,
      countries: countries.length
    });

  } catch (error) {
    console.error('❌ Error during quick import:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Quick import failed'
    });
  }
});

// Get countries for import wizard
router.get('/countries', async (req: Request, res: Response) => {
  try {
    const response = await fetch('https://de1.api.radio-browser.info/json/countries');
    if (!response.ok) {
      throw new Error(`Radio-Browser API returned ${response.status}`);
    }
    const countries = await response.json() as any[];
    const countryNames = countries
      .filter(country => country.stationcount > 0)
      .map(country => country.name)
      .sort();
    
    res.json({ countries: countryNames });
  } catch (error) {
    console.error('❌ Error fetching countries:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

// Get states for a specific country
router.get('/states/:country', async (req: Request, res: Response) => {
  try {
    const { country } = req.params;
    // Get states from actual stations since the dedicated states endpoint doesn't work well for all countries
    const response = await fetch(`https://de1.api.radio-browser.info/json/stations/search?country=${encodeURIComponent(country)}&limit=1000`);
    if (!response.ok) {
      throw new Error(`Radio-Browser API returned ${response.status}`);
    }
    const stations = await response.json() as any[];
    
    // Extract unique states from stations, filter out empty/invalid ones
    const stateSet = new Set<string>();
    stations.forEach((station: any) => {
      if (station.state && station.state.trim()) {
        const cleanState = station.state.trim();
        // Filter out generic country names and clean up
        if (cleanState !== country && 
            cleanState !== 'Canada' && 
            !cleanState.includes('Non ') &&
            cleanState.length > 1) {
          stateSet.add(cleanState);
        }
      }
    });
    
    const stateNames = Array.from(stateSet).sort();
    
    res.json({ states: stateNames });
  } catch (error) {
    console.error('❌ Error fetching states:', error);
    res.status(500).json({ error: 'Failed to fetch states' });
  }
});

// Preview stations before import
router.get('/preview', async (req: Request, res: Response) => {
  try {
    console.log('📊 Preview request query params:', req.query);
    const {
      country = '',
      state = '',
      minVotes = '0',
      minBitrate = '0',
      hasGeo = 'false',
      hidebroken = 'true',
      order = 'clickcount',
      limit = '100'
    } = req.query;

    const params = new URLSearchParams({
      limit: limit.toString(),
      hidebroken: hidebroken.toString(),
      order: order.toString(),
      reverse: 'true'
    });

    if (country) params.append('country', country.toString());
    if (state) params.append('state', state.toString());
    if (parseInt(minVotes.toString()) > 0) params.append('votes_min', minVotes.toString());
    if (parseInt(minBitrate.toString()) > 0) params.append('bitrate_min', minBitrate.toString());
    if (hasGeo === 'true') params.append('has_geo', 'true');

    const apiUrl = `https://de1.api.radio-browser.info/json/stations/search?${params.toString()}`;
    console.log('🌐 Radio Browser API URL:', apiUrl);
    const response = await fetch(apiUrl);
    if (!response.ok) {
      throw new Error(`Radio-Browser API returned ${response.status}`);
    }

    const allStations = await response.json() as any[];
    
    // Apply client-side filtering since Radio Browser API filters don't work reliably
    let filteredStations = allStations;
    
    // Filter out broken streams (keep only working ones)
    filteredStations = filteredStations.filter(station => 
      station.lastcheckok === 1
    );
    
    // Apply minimum votes filter
    const minVotesNum = parseInt(minVotes.toString());
    if (minVotesNum > 0) {
      filteredStations = filteredStations.filter(station => 
        (station.votes || 0) >= minVotesNum
      );
    }
    
    // Apply minimum bitrate filter
    const minBitrateNum = parseInt(minBitrate.toString());
    if (minBitrateNum > 0) {
      filteredStations = filteredStations.filter(station => 
        (station.bitrate || 0) >= minBitrateNum
      );
    }
    
    // Apply geo filter
    if (hasGeo === 'true') {
      filteredStations = filteredStations.filter(station => 
        station.geo_lat && station.geo_long
      );
    }
    
    console.log(`🔍 Filtered ${allStations.length} -> ${filteredStations.length} stations`);
    
    res.json({ stations: filteredStations });
  } catch (error) {
    console.error('❌ Error fetching preview stations:', error);
    res.status(500).json({ error: 'Failed to fetch preview stations' });
  }
});

// Import selected stations
router.post('/stations', async (req: Request, res: Response) => {
  try {
    const { stations } = req.body;
    
    if (!Array.isArray(stations) || stations.length === 0) {
      return res.status(400).json({ error: 'No stations provided' });
    }

    let imported = 0;
    let duplicates = 0;
    const errors: string[] = [];

    console.log(`📦 Starting import of ${stations.length} stations...`);
    
    for (const station of stations) {
      try {
        // Check if station already exists
        const existing = await prisma.station.findFirst({
          where: {
            OR: [
              { streamUrl: station.url || station.url_resolved },
              { name: station.name, country: station.country }
            ]
          }
        });

        if (existing) {
          console.log(`⚠️  Duplicate found: "${station.name}" (${existing.streamUrl})`);
          duplicates++;
          continue;
        }

        // Extract and clean city information
        let extractedCity = extractCityFromState(station.state) || extractCityFromName(station.name);

        // Use languagecodes if available, fallback to language
        const stationLanguage = station.languagecodes || station.language || null;
        
        // Create the station record
        await prisma.station.create({
          data: {
            name: decodeHtmlEntities(station.name) || 'Unknown Station',
            streamUrl: station.url_resolved || station.url || '',
            homepage: station.homepage || null,
            favicon: station.favicon || null,
            country: station.country || 'Unknown',
            city: extractedCity,
            state: station.state || null,
            language: stationLanguage,
            genre: station.tags || null,
            type: 'music',
            bitrate: station.bitrate || null,
            codec: station.codec || null,
            description: null,
            frequency: null,
            tags: station.tags || null,
            latitude: station.geo_lat ? parseFloat(station.geo_lat) : null,
            longitude: station.geo_long ? parseFloat(station.geo_long) : null,
            clickcount: station.clickcount || null,
            votes: station.votes || null,
            radioBrowserUuid: station.stationuuid || null,
          }
        });

        console.log(`✅ Imported: "${station.name}"`);
        imported++;
      } catch (error) {
        console.error(`❌ Error importing station "${station.name}":`, error);
        errors.push(`${station.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    console.log(`🎉 Import complete: ${imported} imported, ${duplicates} duplicates, ${errors.length} errors`);

    res.json({
      success: true,
      imported,
      duplicates,
      errors
    });

  } catch (error) {
    console.error('❌ Error importing stations:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Import failed'
    });
  }
});

// Get import statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const [
      totalStations,
      countryCounts,
      recentImports
    ] = await Promise.all([
      prisma.station.count(),
      prisma.station.groupBy({
        by: ['country'],
        _count: true,
        orderBy: { _count: { country: 'desc' } }
      }),
      prisma.station.findMany({
        select: { id: true, name: true, country: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 10
      })
    ]);

    res.json({
      totalStations,
      countries: countryCounts.length,
      topCountries: countryCounts.slice(0, 10),
      recentImports
    });
  } catch (error) {
    console.error('❌ Error fetching import stats:', error);
    res.status(500).json({ error: 'Failed to fetch import statistics' });
  }
});

export default router;