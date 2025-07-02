// metadata.ts
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const router = Router();
const prisma = new PrismaClient();

// Helper function to extract metadata from custom API response
const extractMetadataFromResponse = (data: any, fields: any) => {
  const result: any = {};
  
  try {
    if (!fields || typeof fields !== 'object') {
      return {};
    }
    
    for (const [key, path] of Object.entries(fields)) {
      const pathParts = (path as string).split('.');
      let value = data;
      for (const part of pathParts) {
        value = value?.[part];
        if (value === undefined) break;
      }
      if (value !== undefined) {
        result[key] = value;
      }
    }
    
    return result;
  } catch {
    return {};
  }
};

// Get stream metadata (song info)
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const streamUrl = req.query.stream as string;
  
  // Prevent caching of metadata responses
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Pragma': 'no-cache',
    'Expires': '0'
  });
  
  console.log(`🎵 Metadata request for: ${streamUrl}`);
  
  if (!streamUrl) {
    res.status(400).json({ error: 'Stream URL required' });
    return;
  }

  try {
    // First, try to find the station in our database to get custom API settings
    const station = await prisma.station.findFirst({
      where: { streamUrl: streamUrl }
    });

    if (station && station.metadataApiUrl) {
      console.log(`   📡 Using custom API for station: ${station.name}`);
      console.log(`   🔧 API URL: ${station.metadataApiUrl}`);
      console.log(`   🔧 API Type: ${station.metadataApiType}`);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);

        const apiResponse = await fetch(station.metadataApiUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Radio-Station-Player/1.0',
            'Accept': 'application/json, text/plain, */*'
          }
        });

        clearTimeout(timeoutId);

        if (apiResponse.ok) {
          const contentType = apiResponse.headers.get('content-type') || '';
          let data;

          if (contentType.includes('application/json')) {
            data = await apiResponse.json();
          } else {
            const text = await apiResponse.text();
            try {
              data = JSON.parse(text);
            } catch {
              data = { rawText: text };
            }
          }

          console.log(`   ✅ Custom API response received:`, data);

          // Extract metadata using station's field mappings
          let extractedMetadata = {};
          if (station.metadataFields) {
            try {
              const fieldMappings = JSON.parse(station.metadataFields);
              extractedMetadata = extractMetadataFromResponse(data, fieldMappings);
            } catch (error) {
              console.log(`   ⚠️  Error parsing field mappings:`, error);
            }
          }

          // If we have extracted metadata, return it
          if (Object.keys(extractedMetadata).length > 0) {
            console.log(`   🎶 Extracted metadata:`, extractedMetadata);
            res.json({
              success: true,
              metadata: extractedMetadata,
              source: 'custom_api',
              station: station.name
            });
            return;
          } else {
            // Return raw data if no field mappings worked
            res.json({
              success: true,
              metadata: data,
              source: 'custom_api_raw',
              station: station.name
            });
            return;
          }
        } else {
          console.log(`   ❌ Custom API request failed: ${apiResponse.status}`);
        }
      } catch (error) {
        console.log(`   ❌ Custom API error:`, error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // Fallback: Try to get metadata from stream headers (Icecast/Shoutcast)
    console.log(`   🔄 Trying stream header metadata...`);
    
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const streamResponse = await fetch(streamUrl, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Icy-MetaData': '1',
          'User-Agent': 'Radio-Station-Player/1.0'
        }
      });

      clearTimeout(timeoutId);

      // Check if the stream supports metadata
      const icyMetaint = streamResponse.headers.get('icy-metaint');
      const icyName = streamResponse.headers.get('icy-name');
      const icyGenre = streamResponse.headers.get('icy-genre');
      const icyDescription = streamResponse.headers.get('icy-description');

      if (icyName || icyGenre || icyDescription) {
        const metadata: any = {};
        
        if (icyName) metadata.station = icyName;
        if (icyGenre) metadata.genre = icyGenre;
        if (icyDescription) metadata.description = icyDescription;
        
        console.log(`   🎶 Stream metadata found:`, metadata);
        
        res.json({
          success: true,
          metadata,
          source: 'stream_headers',
          hasMetadata: !!icyMetaint
        });
        return;
      }

      // Try to read a small chunk to get inline metadata
      if (icyMetaint) {
        console.log(`   📊 Stream has metadata every ${icyMetaint} bytes`);
        
        res.json({
          success: true,
          metadata: {
            station: icyName || 'Unknown Station',
            note: 'Stream supports metadata but requires real-time parsing'
          },
          source: 'stream_inline',
          hasMetadata: true
        });
        return;
      }

    } catch (streamError) {
      console.log(`   ❌ Stream metadata error:`, streamError instanceof Error ? streamError.message : 'Unknown error');
    }

    // Final fallback: Return station info from database
    if (station) {
      console.log(`   📻 Returning station info from database`);
      res.json({
        success: true,
        metadata: {
          station: station.name,
          genre: station.genre,
          country: station.country,
          city: station.city
        },
        source: 'database',
        hasMetadata: false
      });
      return;
    }

    // No metadata available
    console.log(`   ❌ No metadata available for stream`);
    res.json({
      success: false,
      error: 'No metadata available for this stream',
      source: 'none'
    });

  } catch (error) {
    console.error('❌ Metadata request failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to fetch metadata'
    });
  }
});

// Test metadata API endpoint
router.post('/test-api', async (req: Request, res: Response) => {
  const { apiUrl, fieldMappings } = req.body;
  
  if (!apiUrl) {
    res.status(400).json({ error: 'API URL required' });
    return;
  }

  try {
    console.log(`🧪 Testing metadata API: ${apiUrl}`);
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch(apiUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Radio-Station-Player/1.0',
        'Accept': 'application/json, text/plain, */*'
      }
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API returned ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    let data;

    if (contentType.includes('application/json')) {
      data = await response.json();
    } else {
      const text = await response.text();
      try {
        data = JSON.parse(text);
      } catch {
        data = { rawText: text };
      }
    }

    // If field mappings provided, try to extract data
    let extractedData = {};
    if (fieldMappings) {
      try {
        const mappings = typeof fieldMappings === 'string' 
          ? JSON.parse(fieldMappings) 
          : fieldMappings;
        extractedData = extractMetadataFromResponse(data, mappings);
      } catch (error) {
        console.log('Error applying field mappings:', error);
      }
    }

    res.json({
      success: true,
      rawData: data,
      extractedData,
      contentType,
      hasFieldMappings: !!fieldMappings
    });

  } catch (error) {
    console.error('❌ API test failed:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'API test failed'
    });
  }
});

export default router;