import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import fetch from 'node-fetch';

const router = Router();
const prisma = new PrismaClient();

// Base health endpoint
router.get('/', async (req: Request, res: Response) => {
  try {
    const stationCount = await prisma.station.count();
    const stationsWithUrls = await prisma.station.count({
      where: {
        streamUrl: {
          not: null,
          notIn: ['', ' ']
        }
      }
    });
    
    return res.json({
      success: true,
      message: 'Health check service is running',
      stats: {
        totalStations: stationCount,
        stationsWithUrls: stationsWithUrls,
        coverage: stationCount > 0 ? Math.round((stationsWithUrls / stationCount) * 100) : 0
      },
      endpoints: {
        '/health/problematic': 'Get stations with issues',
        '/health/check-batch': 'Run batch health check',
        '/health/force-check': 'Force check specific station',
        '/health/schedule': 'Get health check schedule',
        '/health/test-stream': 'Test a specific stream URL'
      }
    });
  } catch (error) {
    console.error('❌ Error in health base endpoint:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Health service error' 
    });
  }
});

// Ping a single stream to check if it's working
const pingStream = async (url: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    // For HLS streams (.m3u8), we need to use GET to check the playlist content
    const isHLS = url.includes('.m3u8');
    const method = isHLS ? 'GET' : 'HEAD';
    
    const response = await fetch(url, {
      method,
      signal: controller.signal,
      headers: {
        'User-Agent': 'Radio-App-Health-Check/1.0',
        'Icy-MetaData': '1',
        'Accept': isHLS ? 'application/vnd.apple.mpegurl,audio/mpegurl,application/x-mpegurl' : 'audio/*,*/*'
      }
    });
    
    clearTimeout(timeoutId);
    
    // If HEAD request fails with 400/405, try GET request (some Icecast servers don't support HEAD)
    if ((response.status === 400 || response.status === 405) && method === 'HEAD') {
      console.log(`⚠️  HEAD request failed for ${url}, trying GET...`);
      
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), 10000); // Shorter timeout for GET
      
      try {
        const getResponse = await fetch(url, {
          method: 'GET',
          signal: controller2.signal,
          headers: {
            'User-Agent': 'Radio-App-Health-Check/1.0',
            'Icy-MetaData': '1',
            'Range': 'bytes=0-1023' // Only get first 1KB to check if stream works
          }
        });
        
        clearTimeout(timeoutId2);
        
        // For GET requests, we consider it working if we get 200 or 206 (partial content)
        const isWorking = getResponse.status === 200 || getResponse.status === 206;
        
        if (isWorking) {
          // Quickly check if it looks like audio data (not an error page)
          const contentType = getResponse.headers.get('content-type') || '';
          const isAudioContentType = contentType.includes('audio/') || 
                                   contentType.includes('application/ogg') || 
                                   contentType.includes('video/') ||
                                   contentType === 'application/octet-stream';
          
          if (!isAudioContentType) {
            // Read a bit of content to see if it's binary (audio) data
            try {
              const buffer = await getResponse.arrayBuffer();
              const firstBytes = new Uint8Array(buffer.slice(0, 10));
              // Check for common audio signatures or binary data
              const isBinary = firstBytes.some(byte => byte < 32 && byte !== 10 && byte !== 13 && byte !== 9);
              return isBinary;
            } catch {
              // If we can't read the content, assume it's working since we got a good status
              return true;
            }
          }
          
          return true;
        }
        
        return false;
      } catch (getError) {
        console.log(`❌ GET request also failed for ${url}:`, getError instanceof Error ? getError.message : 'Unknown error');
        return false;
      }
    }
    
    // Consider 200-299 and some redirect codes as success
    if (response.status < 200 || response.status >= 400) {
      return false;
    }
    
    // For HLS streams, also check if the content looks like a valid playlist
    if (isHLS && method === 'GET') {
      const text = await response.text();
      // Basic HLS playlist validation
      const isValidHLS = text.includes('#EXTM3U') || text.includes('#EXT-X-');
      if (!isValidHLS) {
        console.log(`❌ Invalid HLS playlist for ${url}`);
        return false;
      }
    }
    
    return true;
  } catch (error) {
    console.log(`❌ Ping failed for ${url}:`, error instanceof Error ? error.message : 'Unknown error');
    return false;
  }
};

// Check health of a specific station
router.post('/check/:id', async (req: Request, res: Response) => {
  try {
    const stationId = parseInt(req.params.id);
    
    const station = await prisma.station.findUnique({
      where: { id: stationId }
    });
    
    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }
    
    console.log(`🏥 Health checking station: ${station.name}`);
    const isWorking = await pingStream(station.streamUrl);
    
    // Update health status
    const updatedStation = await prisma.station.update({
      where: { id: stationId },
      data: {
        lastPingCheck: new Date(),
        lastPingSuccess: isWorking,
        consecutiveFailures: isWorking ? 0 : station.consecutiveFailures + 1,
        updatedAt: new Date()
      }
    });
    
    console.log(`${isWorking ? '✅' : '❌'} Stream ${isWorking ? 'working' : 'failed'}: ${station.name}`);
    
    return res.json({
      success: true,
      stationId,
      streamUrl: station.streamUrl,
      isWorking,
      consecutiveFailures: updatedStation.consecutiveFailures,
      lastCheck: updatedStation.lastPingCheck
    });
    
  } catch (error) {
    console.error('❌ Error checking station health:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Health check failed' 
    });
  }
});

// Bulk health check for stations that need checking
router.post('/check-batch', async (req: Request, res: Response) => {
  try {
    const { maxStations = 50 } = req.body;
    
    // Find stations that need checking (haven't been checked in a week, or failed stations daily)
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const stationsToCheck = await prisma.station.findMany({
      where: {
        isActive: true,
        OR: [
          // Never checked
          { lastPingCheck: null },
          // Healthy stations - check weekly
          { 
            AND: [
              { lastPingSuccess: true },
              { lastPingCheck: { lt: oneWeekAgo } }
            ]
          },
          // Potentially broken stations - check daily
          { 
            AND: [
              { lastPingSuccess: false },
              { lastPingCheck: { lt: oneDayAgo } }
            ]
          }
        ]
      },
      take: maxStations,
      orderBy: [
        { lastPingCheck: 'asc' }, // Oldest checks first
        { consecutiveFailures: 'desc' } // Then most failed
      ]
    });
    
    console.log(`🏥 Batch health check starting for ${stationsToCheck.length} stations...`);
    
    const results = [];
    let checked = 0;
    let working = 0;
    let failed = 0;
    
    for (const station of stationsToCheck) {
      try {
        const isWorking = await pingStream(station.streamUrl);
        
        await prisma.station.update({
          where: { id: station.id },
          data: {
            lastPingCheck: new Date(),
            lastPingSuccess: isWorking,
            consecutiveFailures: isWorking ? 0 : station.consecutiveFailures + 1,
            updatedAt: new Date()
          }
        });
        
        results.push({
          id: station.id,
          name: station.name,
          streamUrl: station.streamUrl,
          isWorking,
          consecutiveFailures: isWorking ? 0 : station.consecutiveFailures + 1
        });
        
        checked++;
        if (isWorking) working++; else failed++;
        
        // Small delay to be nice to servers
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error checking station ${station.name}:`, error);
        results.push({
          id: station.id,
          name: station.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    console.log(`🎉 Batch health check complete: ${checked} checked, ${working} working, ${failed} failed`);
    
    return res.json({
      success: true,
      summary: {
        totalChecked: checked,
        working,
        failed,
        availableForCheck: stationsToCheck.length
      },
      results
    });
    
  } catch (error) {
    console.error('❌ Error in batch health check:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Batch health check failed' 
    });
  }
});

// Get stations that might need admin attention
router.get('/problematic', async (req: Request, res: Response) => {
  try {
    const { limit = 50 } = req.query;
    
    const problematicStations = await prisma.station.findMany({
      where: {
        OR: [
          // Multiple consecutive failures
          { consecutiveFailures: { gte: 3 } },
          // User reports
          { userReports: { gte: 2 } },
          // Failed recent check
          { 
            AND: [
              { lastPingSuccess: false },
              { lastPingCheck: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }
            ]
          }
        ]
      },
      orderBy: [
        { consecutiveFailures: 'desc' },
        { userReports: 'desc' },
        { lastPingCheck: 'desc' }
      ],
      take: parseInt(limit.toString())
    });
    
    return res.json({
      success: true,
      count: problematicStations.length,
      stations: problematicStations.map(station => ({
        id: station.id,
        name: station.name,
        country: station.country,
        city: station.city,
        streamUrl: station.streamUrl,
        isActive: station.isActive,
        consecutiveFailures: station.consecutiveFailures,
        userReports: station.userReports,
        lastPingCheck: station.lastPingCheck,
        lastPingSuccess: station.lastPingSuccess,
        adminNotes: station.adminNotes
      }))
    });
    
  } catch (error) {
    console.error('❌ Error fetching problematic stations:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch problematic stations' 
    });
  }
});

// Force recheck stations (ignores timing rules)
router.post('/force-check', async (req: Request, res: Response) => {
  try {
    const { stationIds, maxStations = 50 } = req.body;
    
    let stationsToCheck;
    
    if (stationIds && Array.isArray(stationIds)) {
      // Check specific stations by ID
      stationsToCheck = await prisma.station.findMany({
        where: {
          id: { in: stationIds },
          isActive: true
        },
        take: maxStations
      });
    } else {
      // Check all active stations (ignore timing)
      stationsToCheck = await prisma.station.findMany({
        where: { isActive: true },
        take: maxStations,
        orderBy: { lastPingCheck: 'asc' } // Oldest checks first
      });
    }
    
    console.log(`🏥 Force health check starting for ${stationsToCheck.length} stations...`);
    
    const results = [];
    let checked = 0;
    let working = 0;
    let failed = 0;
    
    for (const station of stationsToCheck) {
      try {
        const isWorking = await pingStream(station.streamUrl);
        
        await prisma.station.update({
          where: { id: station.id },
          data: {
            lastPingCheck: new Date(),
            lastPingSuccess: isWorking,
            consecutiveFailures: isWorking ? 0 : station.consecutiveFailures + 1,
            updatedAt: new Date()
          }
        });
        
        results.push({
          id: station.id,
          name: station.name,
          streamUrl: station.streamUrl,
          isWorking,
          consecutiveFailures: isWorking ? 0 : station.consecutiveFailures + 1
        });
        
        checked++;
        if (isWorking) working++; else failed++;
        
        // Small delay to be nice to servers
        await new Promise(resolve => setTimeout(resolve, 200));
        
      } catch (error) {
        console.error(`❌ Error checking station ${station.name}:`, error);
        results.push({
          id: station.id,
          name: station.name,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }
    
    console.log(`🎉 Force health check complete: ${checked} checked, ${working} working, ${failed} failed`);
    
    return res.json({
      success: true,
      summary: {
        totalChecked: checked,
        working,
        failed,
        availableForCheck: stationsToCheck.length
      },
      results
    });
    
  } catch (error) {
    console.error('❌ Error in force health check:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Force health check failed' 
    });
  }
});

// Get health check settings and next check times
router.get('/schedule', async (req: Request, res: Response) => {
  try {
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    
    const [
      neverChecked,
      needWeeklyCheck,
      needDailyCheck,
      recentlyChecked
    ] = await Promise.all([
      prisma.station.count({ 
        where: { isActive: true, lastPingCheck: null } 
      }),
      prisma.station.count({ 
        where: { 
          isActive: true,
          lastPingSuccess: true,
          lastPingCheck: { lt: oneWeekAgo }
        } 
      }),
      prisma.station.count({ 
        where: { 
          isActive: true,
          lastPingSuccess: false,
          lastPingCheck: { lt: oneDayAgo }
        } 
      }),
      prisma.station.count({ 
        where: { 
          isActive: true,
          lastPingCheck: { gte: oneDayAgo }
        } 
      })
    ]);
    
    return res.json({
      success: true,
      schedule: {
        healthyStationsInterval: '7 days',
        brokenStationsInterval: '1 day',
        neverChecked,
        needWeeklyCheck,
        needDailyCheck,
        recentlyChecked,
        totalDueForCheck: neverChecked + needWeeklyCheck + needDailyCheck
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching health schedule:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch schedule' 
    });
  }
});

// Test a specific stream URL (for station editor)
router.post('/test-stream', async (req: Request, res: Response) => {
  try {
    const { streamUrl } = req.body;
    
    if (!streamUrl) {
      return res.status(400).json({ 
        success: false, 
        error: 'Stream URL is required' 
      });
    }
    
    console.log(`🧪 Testing stream: ${streamUrl}`);
    const isWorking = await pingStream(streamUrl);
    
    return res.json({
      success: isWorking,
      streamUrl,
      message: isWorking ? 'Stream is accessible' : 'Stream is not accessible',
      tested: true
    });
    
  } catch (error) {
    console.error('❌ Error testing stream:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Stream test failed' 
    });
  }
});

export default router;