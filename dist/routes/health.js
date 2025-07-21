"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const node_fetch_1 = __importDefault(require("node-fetch"));
const express_2 = require("../types/express");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.get('/', async (req, res) => {
    try {
        const stationCount = await prisma.station.count();
        const stationsWithUrls = await prisma.station.count({
            where: {
                streamUrl: {
                    not: ''
                }
            }
        });
        const data = {
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
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Health service error');
    }
});
const pingStream = async (url) => {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);
        const isHLS = url.includes('.m3u8');
        const method = isHLS ? 'GET' : 'HEAD';
        const response = await (0, node_fetch_1.default)(url, {
            method,
            signal: controller.signal,
            headers: {
                'User-Agent': 'Radio-App-Health-Check/1.0',
                'Icy-MetaData': '1',
                'Accept': isHLS ? 'application/vnd.apple.mpegurl,audio/mpegurl,application/x-mpegurl' : 'audio/*,*/*'
            }
        });
        clearTimeout(timeoutId);
        if ((response.status === 400 || response.status === 405) && method === 'HEAD') {
            console.log(`⚠️  HEAD request failed for ${url}, trying GET...`);
            const controller2 = new AbortController();
            const timeoutId2 = setTimeout(() => controller2.abort(), 10000);
            try {
                const getResponse = await (0, node_fetch_1.default)(url, {
                    method: 'GET',
                    signal: controller2.signal,
                    headers: {
                        'User-Agent': 'Radio-App-Health-Check/1.0',
                        'Icy-MetaData': '1',
                        'Range': 'bytes=0-1023'
                    }
                });
                clearTimeout(timeoutId2);
                const isWorking = getResponse.status === 200 || getResponse.status === 206;
                if (isWorking) {
                    const contentType = getResponse.headers.get('content-type') || '';
                    const isAudioContentType = contentType.includes('audio/') ||
                        contentType.includes('application/ogg') ||
                        contentType.includes('video/') ||
                        contentType === 'application/octet-stream';
                    if (!isAudioContentType) {
                        try {
                            const buffer = await getResponse.arrayBuffer();
                            const firstBytes = new Uint8Array(buffer.slice(0, 10));
                            const isBinary = firstBytes.some(byte => byte < 32 && byte !== 10 && byte !== 13 && byte !== 9);
                            return isBinary;
                        }
                        catch {
                            return true;
                        }
                    }
                    return true;
                }
                return false;
            }
            catch (getError) {
                console.log(`❌ GET request also failed for ${url}:`, getError instanceof Error ? getError.message : 'Unknown error');
                return false;
            }
        }
        if (response.status < 200 || response.status >= 400) {
            return false;
        }
        if (isHLS && method === 'GET') {
            const text = await response.text();
            const isValidHLS = text.includes('#EXTM3U') || text.includes('#EXT-X-');
            if (!isValidHLS) {
                console.log(`❌ Invalid HLS playlist for ${url}`);
                return false;
            }
        }
        return true;
    }
    catch (error) {
        console.log(`❌ Ping failed for ${url}:`, error instanceof Error ? error.message : 'Unknown error');
        return false;
    }
};
router.post('/check/:id', async (req, res) => {
    try {
        const stationId = parseInt(req.params.id);
        const station = await prisma.station.findUnique({
            where: { id: stationId }
        });
        if (!station) {
            (0, express_2.handleNotFound)(res, 'Station');
            return;
        }
        console.log(`🏥 Health checking station: ${station.name}`);
        const isWorking = await pingStream(station.streamUrl);
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
        const data = {
            success: true,
            stationId,
            streamUrl: station.streamUrl,
            isWorking,
            consecutiveFailures: updatedStation.consecutiveFailures,
            lastCheck: updatedStation.lastPingCheck
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Health check failed');
    }
});
router.post('/check-batch', async (req, res) => {
    try {
        const { maxStations = 50 } = req.body;
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const stationsToCheck = await prisma.station.findMany({
            where: {
                isActive: true,
                OR: [
                    { lastPingCheck: null },
                    {
                        AND: [
                            { lastPingSuccess: true },
                            { lastPingCheck: { lt: oneWeekAgo } }
                        ]
                    },
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
                { lastPingCheck: 'asc' },
                { consecutiveFailures: 'desc' }
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
                if (isWorking)
                    working++;
                else
                    failed++;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            catch (error) {
                console.error(`❌ Error checking station ${station.name}:`, error);
                results.push({
                    id: station.id,
                    name: station.name,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        console.log(`🎉 Batch health check complete: ${checked} checked, ${working} working, ${failed} failed`);
        const data = {
            success: true,
            summary: {
                totalChecked: checked,
                working,
                failed,
                availableForCheck: stationsToCheck.length
            },
            results
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Batch health check failed');
    }
});
router.get('/problematic', async (req, res) => {
    try {
        const { limit = 50 } = req.query;
        const problematicStations = await prisma.station.findMany({
            where: {
                OR: [
                    { consecutiveFailures: { gte: 3 } },
                    { userReports: { gte: 2 } },
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
        const data = {
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
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to fetch problematic stations');
    }
});
router.post('/force-check', async (req, res) => {
    try {
        const { stationIds, maxStations = 50 } = req.body;
        let stationsToCheck;
        if (stationIds && Array.isArray(stationIds)) {
            stationsToCheck = await prisma.station.findMany({
                where: {
                    id: { in: stationIds },
                    isActive: true
                },
                take: maxStations
            });
        }
        else {
            stationsToCheck = await prisma.station.findMany({
                where: { isActive: true },
                take: maxStations,
                orderBy: { lastPingCheck: 'asc' }
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
                if (isWorking)
                    working++;
                else
                    failed++;
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            catch (error) {
                console.error(`❌ Error checking station ${station.name}:`, error);
                results.push({
                    id: station.id,
                    name: station.name,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
        console.log(`🎉 Force health check complete: ${checked} checked, ${working} working, ${failed} failed`);
        const data = {
            success: true,
            summary: {
                totalChecked: checked,
                working,
                failed,
                availableForCheck: stationsToCheck.length
            },
            results
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Force health check failed');
    }
});
router.get('/schedule', async (req, res) => {
    try {
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const [neverChecked, needWeeklyCheck, needDailyCheck, recentlyChecked] = await Promise.all([
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
        const data = {
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
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to fetch schedule');
    }
});
router.post('/test-stream', async (req, res) => {
    try {
        const { streamUrl } = req.body;
        if (!streamUrl) {
            (0, express_2.handleValidationError)(res, 'Stream URL is required');
            return;
        }
        console.log(`🧪 Testing stream: ${streamUrl}`);
        const isWorking = await pingStream(streamUrl);
        const data = {
            success: isWorking,
            streamUrl,
            message: isWorking ? 'Stream is accessible' : 'Stream is not accessible',
            tested: true
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Stream test failed');
    }
});
exports.default = router;
