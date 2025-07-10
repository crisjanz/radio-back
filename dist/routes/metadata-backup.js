"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const node_fetch_1 = __importDefault(require("node-fetch"));
const child_process_1 = require("child_process");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.get('/', async (req, res) => {
    const { stream } = req.query;
    if (!stream || typeof stream !== 'string') {
        return res.status(400).json({ error: 'Stream URL required' });
    }
    try {
        console.log(`🎵 Frontend requesting metadata for: ${stream}`);
        const station = await prisma.station.findFirst({
            where: { streamUrl: stream },
            select: {
                id: true,
                name: true,
                homepage: true,
                metadataApiUrl: true,
                metadataApiType: true,
                metadataFormat: true,
                metadataFields: true
            }
        });
        if (station && (station.metadataApiUrl || station.metadataApiType)) {
            console.log(`✅ Found station ${station.id} with saved metadata config`);
            const result = await testExistingMetadata(station);
            if (!result.error && result.nowPlaying) {
                const nowPlaying = result.nowPlaying;
                if (nowPlaying.includes(' - ')) {
                    const [artist, title] = nowPlaying.split(' - ', 2);
                    return res.json({
                        success: true,
                        title: title.trim(),
                        artist: artist.trim(),
                        song: nowPlaying
                    });
                }
                else {
                    return res.json({
                        success: true,
                        title: nowPlaying,
                        song: nowPlaying
                    });
                }
            }
        }
        console.log(`🔍 No saved config found, trying basic Icecast detection...`);
        const icecastResult = await testIcecastMetadata(stream);
        if (!icecastResult.error && icecastResult.nowPlaying) {
            const nowPlaying = icecastResult.nowPlaying;
            if (nowPlaying.includes(' - ')) {
                const [artist, title] = nowPlaying.split(' - ', 2);
                return res.json({
                    success: true,
                    title: title.trim(),
                    artist: artist.trim(),
                    song: nowPlaying
                });
            }
            else {
                return res.json({
                    success: true,
                    title: nowPlaying,
                    song: nowPlaying
                });
            }
        }
        return res.json({
            success: false,
            message: 'No metadata available for this stream'
        });
    }
    catch (error) {
        console.error('Frontend metadata error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch metadata'
        });
    }
});
router.post('/test-station', async (req, res) => {
    const { stationId } = req.body;
    try {
        const station = await prisma.station.findUnique({
            where: { id: parseInt(stationId) }
        });
        if (!station) {
            return res.json({
                success: false,
                error: 'Station not found'
            });
        }
        console.log(`🔍 Testing metadata for station ${station.id}: ${station.name}`);
        const result = await detectMetadataSources(station.streamUrl, {
            id: station.id,
            name: station.name,
            homepage: station.homepage,
            metadataApiUrl: station.metadataApiUrl,
            metadataApiType: station.metadataApiType,
            metadataFormat: station.metadataFormat,
            metadataFields: station.metadataFields
        });
        console.log('🔍 Final result for station', station.id, ':', JSON.stringify(result, null, 2));
        console.log('🔍 About to send response...');
        res.json(result);
        console.log('🔍 Response sent successfully');
    }
    catch (error) {
        console.error('Error testing station:', error);
        res.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
router.post('/test-stream', async (req, res) => {
    const { streamUrl } = req.body;
    try {
        console.log(`🔍 Testing metadata for stream: ${streamUrl}`);
        const result = await detectMetadataSources(streamUrl, {
            id: 0,
            name: 'Test Stream',
            homepage: null
        });
        res.json(result);
    }
    catch (error) {
        console.error('Error testing stream:', error);
        res.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});
async function detectMetadataSources(streamUrl, stationInfo) {
    const workingMethods = [];
    const testedMethods = [];
    console.log('🧊 Testing Icecast/Shoutcast metadata...');
    const icecastResult = await testIcecastMetadata(streamUrl);
    testedMethods.push(icecastResult);
    if (!icecastResult.error && (icecastResult.nowPlaying || icecastResult.config?.metaint)) {
        workingMethods.push(icecastResult);
    }
    console.log('📺 Testing HLS metadata...');
    const hlsResult = await testHLSMetadata(streamUrl);
    testedMethods.push(hlsResult);
    if (!hlsResult.error) {
        workingMethods.push(hlsResult);
    }
    console.log('📋 Testing HTTP headers...');
    const headersResult = await testHTTPHeaders(streamUrl);
    testedMethods.push(headersResult);
    if (!headersResult.error) {
        workingMethods.push(headersResult);
    }
    if (stationInfo.homepage) {
        console.log('🔗 Testing JSON endpoints...');
        try {
            const jsonResult = await testJSONEndpoints(stationInfo.homepage);
            testedMethods.push(jsonResult);
            if (!jsonResult.error) {
                workingMethods.push(jsonResult);
            }
            console.log('🔗 JSON endpoints testing completed');
        }
        catch (error) {
            console.log('🔗 JSON endpoints testing failed:', error);
            testedMethods.push({
                type: 'json',
                description: 'JSON API endpoint with metadata',
                error: 'Testing failed: ' + error.message
            });
        }
    }
    if (stationInfo.homepage) {
        console.log('🕷️ Testing website scraping...');
        const websiteResult = await testWebsiteScraping(stationInfo.homepage);
        testedMethods.push(websiteResult);
        if (!websiteResult.error) {
            workingMethods.push(websiteResult);
        }
    }
    return {
        success: workingMethods.length > 0,
        workingMethods: workingMethods.sort((a, b) => getMethodPriority(a.type) - getMethodPriority(b.type)),
        testedMethods
    };
}
function getMethodPriority(type) {
    const priorities = {
        'existing': 0,
        'laut.fm': 1,
        'custom': 1,
        'icecast': 2,
        'hls': 3,
        'headers': 4,
        'json': 5,
        'website': 6,
        'social': 7
    };
    return priorities[type] || 999;
}
async function testExistingMetadata(stationInfo) {
    try {
        const { metadataApiUrl, metadataApiType, metadataFormat, metadataFields } = stationInfo;
        if (!metadataApiUrl && !metadataApiType) {
            return {
                type: 'existing',
                description: 'Existing metadata configuration',
                error: 'No existing metadata configuration found'
            };
        }
        console.log(`🔍 Testing existing ${metadataApiType || 'unknown'} configuration...`);
        switch (metadataApiType) {
            case 'laut.fm':
                return await testLautFM(metadataApiUrl);
            case 'custom':
                return await testCustomAPI(metadataApiUrl, metadataFormat, metadataFields);
            case 'website':
                return await testExistingWebsiteConfig(metadataApiUrl, metadataFields);
            case 'icecast':
                return await testIcecastMetadata(metadataApiUrl);
            default:
                if (metadataApiUrl) {
                    if (metadataApiUrl.includes('playlist.php') || metadataApiUrl.includes('radioplayer')) {
                        return await testVistaRadioAPI(metadataApiUrl);
                    }
                    return await testGenericAPI(metadataApiUrl, metadataApiType || 'unknown', metadataFormat, metadataFields);
                }
                break;
        }
        return {
            type: metadataApiType || 'existing',
            description: 'Existing metadata configuration',
            error: 'Unable to test existing configuration'
        };
    }
    catch (error) {
        return {
            type: 'existing',
            description: 'Existing metadata configuration',
            error: error instanceof Error ? error.message : 'Failed to test existing config'
        };
    }
}
async function testLautFM(apiUrl) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await (0, node_fetch_1.default)(apiUrl, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (compatible; MetadataBot/1.0)'
            }
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            return {
                type: 'laut.fm',
                description: 'laut.fm API',
                error: `HTTP ${response.status}`
            };
        }
        const data = await response.json();
        if (data && (data.title || data.artist)) {
            const nowPlaying = data.artist?.name ? `${data.artist.name} - ${data.title}` : data.title;
            console.log(`✅ laut.fm API working: ${nowPlaying}`);
            return {
                type: 'laut.fm',
                description: 'laut.fm streaming API',
                endpoint: apiUrl,
                confidence: 'High',
                updateInterval: 30,
                nowPlaying: nowPlaying,
                config: {
                    method: 'laut.fm-api',
                    endpoint: apiUrl,
                    fields: { title: 'title', artist: 'artist.name' }
                }
            };
        }
        return {
            type: 'laut.fm',
            description: 'laut.fm API',
            error: 'No current song data available'
        };
    }
    catch (error) {
        return {
            type: 'laut.fm',
            description: 'laut.fm API',
            error: error instanceof Error ? error.message : 'API request failed'
        };
    }
}
async function testCustomAPI(apiUrl, format, fields) {
    try {
        if (!apiUrl) {
            return {
                type: 'custom',
                description: 'Custom API',
                error: 'No API URL configured'
            };
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await (0, node_fetch_1.default)(apiUrl, {
            signal: controller.signal,
            headers: {
                'Accept': format === 'json' ? 'application/json' : 'text/plain',
                'User-Agent': 'Mozilla/5.0 (compatible; MetadataBot/1.0)'
            }
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            return {
                type: 'custom',
                description: 'Custom API',
                error: `HTTP ${response.status}`
            };
        }
        const data = format === 'json' ? await response.json() : await response.text();
        console.log(`✅ Custom API responded with data`);
        return {
            type: 'custom',
            description: 'Custom API endpoint',
            endpoint: apiUrl,
            confidence: 'High',
            updateInterval: 60,
            nowPlaying: typeof data === 'string' ? data : 'Custom API data available',
            config: {
                method: 'custom-api',
                endpoint: apiUrl,
                format: format,
                fields: fields ? JSON.parse(fields) : null
            }
        };
    }
    catch (error) {
        return {
            type: 'custom',
            description: 'Custom API',
            error: error instanceof Error ? error.message : 'API request failed'
        };
    }
}
async function testExistingWebsiteConfig(url, fields) {
    try {
        const config = fields ? JSON.parse(fields) : null;
        const patterns = config?.patterns || [];
        if (patterns.length === 0) {
            return {
                type: 'website',
                description: 'Website scraping',
                error: 'No scraping patterns configured'
            };
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await (0, node_fetch_1.default)(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            return {
                type: 'website',
                description: 'Website scraping',
                error: `HTTP ${response.status}`
            };
        }
        const html = await response.text();
        const firstPattern = patterns[0];
        if (firstPattern?.pattern) {
            const regex = new RegExp(firstPattern.pattern, 'gi');
            const match = html.match(regex);
            if (match && match[0]) {
                console.log(`✅ Website scraping pattern matched`);
                return {
                    type: 'website',
                    description: 'Website scraping (configured)',
                    endpoint: url,
                    confidence: 'Medium',
                    updateInterval: 60,
                    nowPlaying: match[0].replace(/<[^>]*>/g, '').trim(),
                    config: config
                };
            }
        }
        return {
            type: 'website',
            description: 'Website scraping',
            error: 'Configured patterns did not match current content'
        };
    }
    catch (error) {
        return {
            type: 'website',
            description: 'Website scraping',
            error: error instanceof Error ? error.message : 'Website scraping failed'
        };
    }
}
async function testGenericAPI(apiUrl, type, format, fields) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await (0, node_fetch_1.default)(apiUrl, {
            signal: controller.signal,
            headers: {
                'Accept': 'application/json, text/plain, */*',
                'User-Agent': 'Mozilla/5.0 (compatible; MetadataBot/1.0)'
            }
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            return {
                type: type,
                description: `${type} API`,
                error: `HTTP ${response.status}`
            };
        }
        const contentType = response.headers.get('content-type') || '';
        const data = contentType.includes('application/json') ?
            await response.json() : await response.text();
        console.log(`✅ ${type} API responded with data`);
        let nowPlaying = 'API data available';
        if (typeof data === 'object' && data) {
            const possibleFields = ['nowplaying', 'current', 'song', 'track', 'title', 'artist'];
            for (const field of possibleFields) {
                if (data[field]) {
                    nowPlaying = data[field];
                    break;
                }
            }
        }
        else if (typeof data === 'string' && data.length > 0 && data.length < 200) {
            nowPlaying = data.trim();
        }
        return {
            type: type,
            description: `${type} API endpoint`,
            endpoint: apiUrl,
            confidence: 'Medium',
            updateInterval: 60,
            nowPlaying: nowPlaying,
            config: {
                method: 'generic-api',
                endpoint: apiUrl,
                format: format || 'auto-detect',
                fields: fields ? JSON.parse(fields) : null
            }
        };
    }
    catch (error) {
        return {
            type: type,
            description: `${type} API`,
            error: error instanceof Error ? error.message : 'API request failed'
        };
    }
}
async function testIcecastMetadata(streamUrl) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await (0, node_fetch_1.default)(streamUrl, {
            method: 'GET',
            headers: {
                'Icy-Metadata': '1',
                'User-Agent': 'Mozilla/5.0 (compatible; MetadataBot/1.0)'
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const headers = response.headers;
        const hasIcyMetadata = headers.get('icy-metaint') ||
            headers.get('ice-metaint') ||
            headers.get('icy-name') ||
            headers.get('icy-description');
        if (hasIcyMetadata) {
            const metaint = headers.get('icy-metaint') || headers.get('ice-metaint');
            const stationName = headers.get('icy-name') || headers.get('ice-name');
            const description = headers.get('icy-description') || headers.get('ice-description');
            console.log(`✅ Icecast metadata found - MetaInt: ${metaint}, Station: ${stationName}`);
            let nowPlaying = null;
            if (metaint) {
                try {
                    console.log('🎵 Attempting lightweight track extraction...');
                    const trackInfo = await extractIcecastCurrentTrackLightweight(streamUrl, parseInt(metaint));
                    console.log('🎵 Track extraction completed:', trackInfo);
                    nowPlaying = trackInfo;
                }
                catch (e) {
                    console.log('Could not extract current track, but metadata is available');
                }
            }
            console.log('🎵 Icecast detection completed, returning result');
            return {
                type: 'icecast',
                description: 'Icecast/Shoutcast stream metadata',
                endpoint: streamUrl,
                confidence: 'High',
                updateInterval: 30,
                nowPlaying: nowPlaying || (stationName ? `Station: ${stationName}` : null),
                config: {
                    metaint: metaint ? parseInt(metaint) : null,
                    stationName,
                    description,
                    method: 'icy-metadata'
                }
            };
        }
        return {
            type: 'icecast',
            description: 'Icecast/Shoutcast stream metadata',
            error: 'No Icecast metadata headers found'
        };
    }
    catch (error) {
        return {
            type: 'icecast',
            description: 'Icecast/Shoutcast stream metadata',
            error: error instanceof Error ? error.message : 'Connection failed'
        };
    }
}
async function extractIcecastCurrentTrack(streamUrl, metaint) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await (0, node_fetch_1.default)(streamUrl, {
            method: 'GET',
            headers: {
                'Icy-MetaData': '1',
                'Range': `bytes=0-${metaint + 4080}`
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.body)
            return null;
        const buffer = await response.arrayBuffer();
        const data = new Uint8Array(buffer);
        if (data.length > metaint) {
            const metaLength = data[metaint] * 16;
            if (metaLength > 0 && data.length > metaint + 1 + metaLength) {
                const metadataBytes = data.slice(metaint + 1, metaint + 1 + metaLength);
                const metadata = new TextDecoder().decode(metadataBytes);
                const titleMatch = metadata.match(/StreamTitle='([^']+)'/);
                if (titleMatch && titleMatch[1]) {
                    return titleMatch[1];
                }
            }
        }
        return null;
    }
    catch (error) {
        console.log('Failed to extract current track:', error);
        return null;
    }
}
async function extractIcecastCurrentTrackLightweight(streamUrl, metaint) {
    return new Promise((resolve) => {
        console.log(`🎵 Starting curl-based extraction with metaint: ${metaint}`);
        const curl = (0, child_process_1.spawn)('curl', [
            '-H', 'Icy-Metadata: 1',
            '--max-time', '8',
            '-s',
            streamUrl
        ]);
        const head = (0, child_process_1.spawn)('head', ['-c', `${metaint + 300}`]);
        const tail = (0, child_process_1.spawn)('tail', ['-c', '300']);
        curl.stdout.pipe(head.stdin);
        head.stdout.pipe(tail.stdin);
        let data = Buffer.alloc(0);
        tail.stdout.on('data', (chunk) => {
            data = Buffer.concat([data, chunk]);
        });
        tail.on('close', () => {
            try {
                const text = data.toString('utf8');
                const match = text.match(/StreamTitle='([^']+)'/);
                if (match && match[1]) {
                    console.log(`🎵 Extracted title: ${match[1]}`);
                    resolve(match[1]);
                }
                else {
                    console.log('🎵 No StreamTitle found in metadata');
                    resolve(null);
                }
            }
            catch (error) {
                console.log('🎵 Error parsing metadata:', error);
                resolve(null);
            }
        });
        const cleanup = () => {
            curl.kill();
            head.kill();
            tail.kill();
            resolve(null);
        };
        curl.on('error', cleanup);
        head.on('error', cleanup);
        tail.on('error', cleanup);
        setTimeout(() => {
            console.log('🎵 Extraction timeout');
            cleanup();
        }, 10000);
    });
}
async function testVistaRadioAPI(apiUrl) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await (0, node_fetch_1.default)(apiUrl, {
            signal: controller.signal,
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'User-Agent': 'Mozilla/5.0 (compatible; MetadataBot/1.0)'
            }
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            return {
                type: 'vista-radio',
                description: 'Vista Radio playlist API',
                error: `HTTP ${response.status}`
            };
        }
        const html = await response.text();
        const songMatch = html.match(/<span class="rb-song"><strong>([^<]+)<\/strong><\/span>/);
        const artistMatch = html.match(/<span class="rb-artist">([^<]+)<\/span>/);
        if (songMatch && artistMatch) {
            const song = songMatch[1].trim();
            const artist = artistMatch[1].trim();
            const nowPlaying = `${artist} - ${song}`;
            console.log(`✅ Vista Radio API working: ${nowPlaying}`);
            return {
                type: 'vista-radio',
                description: 'Vista Radio playlist API',
                endpoint: apiUrl,
                confidence: 'High',
                updateInterval: 30,
                nowPlaying: nowPlaying,
                config: {
                    method: 'vista-radio-html',
                    endpoint: apiUrl,
                    songSelector: '<span class="rb-song"><strong>([^<]+)</strong></span>',
                    artistSelector: '<span class="rb-artist">([^<]+)</span>'
                }
            };
        }
        return {
            type: 'vista-radio',
            description: 'Vista Radio playlist API',
            error: 'No current song data found in HTML'
        };
    }
    catch (error) {
        return {
            type: 'vista-radio',
            description: 'Vista Radio playlist API',
            error: error instanceof Error ? error.message : 'API request failed'
        };
    }
}
async function testHLSMetadata(streamUrl) {
    try {
        if (!streamUrl.includes('.m3u8') && !streamUrl.includes('hls')) {
            return {
                type: 'hls',
                description: 'HLS stream metadata',
                error: 'Not an HLS stream'
            };
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await (0, node_fetch_1.default)(streamUrl, {
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const playlist = await response.text();
        const hasMetadata = playlist.includes('#EXT-X-PROGRAM-DATE-TIME') ||
            playlist.includes('#EXT-X-DATERANGE') ||
            playlist.includes('#EXT-X-TIMED-METADATA');
        if (hasMetadata) {
            console.log('✅ HLS metadata found in playlist');
            return {
                type: 'hls',
                description: 'HLS stream with timed metadata',
                endpoint: streamUrl,
                confidence: 'High',
                updateInterval: 10,
                config: {
                    method: 'hls-playlist',
                    hasTimedMetadata: playlist.includes('#EXT-X-TIMED-METADATA'),
                    hasDateRange: playlist.includes('#EXT-X-DATERANGE')
                }
            };
        }
        return {
            type: 'hls',
            description: 'HLS stream metadata',
            error: 'No metadata tags found in HLS playlist'
        };
    }
    catch (error) {
        return {
            type: 'hls',
            description: 'HLS stream metadata',
            error: error instanceof Error ? error.message : 'Failed to fetch HLS playlist'
        };
    }
}
async function testHTTPHeaders(streamUrl) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await (0, node_fetch_1.default)(streamUrl, {
            method: 'HEAD',
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const headers = response.headers;
        const customHeaders = [];
        for (const [key, value] of headers.entries()) {
            if (key.toLowerCase().includes('song') ||
                key.toLowerCase().includes('track') ||
                key.toLowerCase().includes('artist') ||
                key.toLowerCase().includes('title') ||
                key.toLowerCase().includes('nowplaying') ||
                key.toLowerCase().includes('current')) {
                customHeaders.push({ key, value });
            }
        }
        if (customHeaders.length > 0) {
            console.log('✅ Custom metadata headers found:', customHeaders);
            const nowPlaying = customHeaders.find(h => h.key.toLowerCase().includes('nowplaying') ||
                h.key.toLowerCase().includes('current') ||
                h.key.toLowerCase().includes('song'))?.value;
            return {
                type: 'headers',
                description: 'Custom HTTP headers with metadata',
                endpoint: streamUrl,
                confidence: 'Medium',
                updateInterval: 60,
                nowPlaying: nowPlaying || 'Found metadata headers',
                config: {
                    method: 'http-headers',
                    headers: customHeaders
                }
            };
        }
        return {
            type: 'headers',
            description: 'Custom HTTP headers with metadata',
            error: 'No custom metadata headers found'
        };
    }
    catch (error) {
        return {
            type: 'headers',
            description: 'Custom HTTP headers with metadata',
            error: error instanceof Error ? error.message : 'Failed to fetch headers'
        };
    }
}
async function testJSONEndpoints(homepage) {
    try {
        const baseUrl = new URL(homepage).origin;
        const domain = new URL(homepage).hostname;
        const endpoints = [
            '/nowplaying.json',
            '/current.json',
            '/live.json',
            '/api/nowplaying',
            '/api/current',
            '/api/live',
            '/status.json',
            '/metadata.json',
            '/info.json',
            ...(domain.includes('radiou.com') ? ['/assets/player/now-playing_live.php'] : []),
            ...(domain.includes('radioplayer.vistaradio.ca') ? ['/content/playlist.php'] : []),
            ...(domain.includes('goldenweststreaming.com') ? ['/rds/api'] : []),
            ...(domain.includes('laut.fm') ? ['/api/current_song'] : []),
            '/player/nowplaying',
            '/player/current.json',
            '/assets/player/current',
            '/content/nowplaying',
            '/rds/api',
            '/stream/metadata'
        ];
        for (const endpoint of endpoints) {
            try {
                const url = baseUrl + endpoint;
                console.log(`Testing JSON endpoint: ${url}`);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const response = await (0, node_fetch_1.default)(url, {
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Mozilla/5.0 (compatible; MetadataBot/1.0)'
                    }
                });
                clearTimeout(timeoutId);
                if (response.ok) {
                    const data = await response.json();
                    const hasMetadata = data && (data.nowplaying || data.current || data.song || data.track ||
                        data.artist || data.title || data.live || data.playing ||
                        (typeof data === 'object' && Object.keys(data).some(key => key.toLowerCase().includes('song') ||
                            key.toLowerCase().includes('track') ||
                            key.toLowerCase().includes('artist') ||
                            key.toLowerCase().includes('title') ||
                            key.toLowerCase().includes('playing'))));
                    if (hasMetadata) {
                        console.log(`✅ JSON metadata found at ${url}:`, data);
                        const nowPlaying = data.nowplaying || data.current || data.song ||
                            data.track || data.title ||
                            `${data.artist || ''} - ${data.title || ''}`.trim().replace(/^- | -$/, '') ||
                            'Metadata available';
                        return {
                            type: 'json',
                            description: 'JSON API endpoint with metadata',
                            endpoint: url,
                            confidence: 'High',
                            updateInterval: 30,
                            nowPlaying: nowPlaying,
                            config: {
                                method: 'json-api',
                                endpoint: url,
                                dataStructure: Object.keys(data)
                            }
                        };
                    }
                }
            }
            catch (e) {
                continue;
            }
        }
        return {
            type: 'json',
            description: 'JSON API endpoint with metadata',
            error: 'No working JSON endpoints found'
        };
    }
    catch (error) {
        return {
            type: 'json',
            description: 'JSON API endpoint with metadata',
            error: error instanceof Error ? error.message : 'Failed to test JSON endpoints'
        };
    }
}
async function testWebsiteScraping(homepage) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await (0, node_fetch_1.default)(homepage, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            return {
                type: 'website',
                description: 'Website scraping for now playing',
                error: `HTTP ${response.status}`
            };
        }
        const html = await response.text();
        const patterns = [
            /"nowPlaying":\s*"([^"]{3,80})"/gi,
            /"currentSong":\s*"([^"]{3,80})"/gi,
            /"onAir":\s*"([^"]{3,80})"/gi,
            /"current_track":\s*"([^"]{3,80})"/gi,
            /now playing:?\s*([a-zA-Z0-9][^<>\n\r]{8,80}[a-zA-Z0-9])/gi,
            /currently playing:?\s*([a-zA-Z0-9][^<>\n\r]{8,80}[a-zA-Z0-9])/gi,
            /on air:?\s*([a-zA-Z0-9][^<>\n\r]{8,80}[a-zA-Z0-9])/gi,
            /<[^>]*(?:class|id)="[^"]*(?:now-?playing|current-?song|on-?air|live-?track)[^"]*"[^>]*>\s*([a-zA-Z0-9][^<>{8,80}[a-zA-Z0-9])\s*<\//gi,
            /<[^>]*(?:class|id)="[^"]*(?:song|track|artist|title)[^"]*"[^>]*>\s*([a-zA-Z0-9][^<>]{8,80}[a-zA-Z0-9])\s*<\//gi
        ];
        const foundMatches = [];
        for (const pattern of patterns) {
            const matches = [...html.matchAll(pattern)];
            for (const match of matches) {
                if (match[1] && match[1].trim().length > 5) {
                    const text = match[1].trim();
                    if (text.includes('-->') ||
                        text.includes('<!--') ||
                        text.includes('<script') ||
                        text.includes('</') ||
                        text.includes('function(') ||
                        text.includes('var ') ||
                        text.includes('.jpg') ||
                        text.includes('.png') ||
                        text.includes('.gif') ||
                        text.includes('class=') ||
                        text.includes('id=') ||
                        text.includes('http://') ||
                        text.includes('https://') ||
                        text.match(/^[^a-zA-Z0-9]*$/) ||
                        text.length < 8 ||
                        text.length > 80) {
                        continue;
                    }
                    foundMatches.push({
                        pattern: pattern.source,
                        text: text,
                        fullMatch: match[0]
                    });
                }
            }
        }
        if (foundMatches.length > 0) {
            console.log(`✅ Website metadata patterns found:`, foundMatches.slice(0, 3));
            const bestMatch = foundMatches[0];
            return {
                type: 'website',
                description: 'Website scraping for now playing',
                endpoint: homepage,
                confidence: 'Medium',
                updateInterval: 60,
                nowPlaying: bestMatch.text,
                config: {
                    method: 'website-scraping',
                    patterns: foundMatches.slice(0, 5).map(m => ({
                        pattern: m.pattern,
                        example: m.text
                    }))
                }
            };
        }
        return {
            type: 'website',
            description: 'Website scraping for now playing',
            error: 'No "now playing" patterns found on website'
        };
    }
    catch (error) {
        return {
            type: 'website',
            description: 'Website scraping for now playing',
            error: error instanceof Error ? error.message : 'Failed to scrape website'
        };
    }
}
router.post('/save-config', async (req, res) => {
    const { identifier, method } = req.body;
    try {
        const stationIdMatch = identifier.match(/Station (\d+)/);
        if (!stationIdMatch) {
            return res.json({
                success: false,
                error: 'Invalid station identifier'
            });
        }
        const stationId = parseInt(stationIdMatch[1]);
        await prisma.station.update({
            where: { id: stationId },
            data: {
                metadataApiUrl: method.endpoint,
                metadataApiType: method.type,
                metadataFormat: method.type === 'json' ? 'json' : 'text',
                metadataFields: method.config ? JSON.stringify(method.config) : null,
                updatedAt: new Date()
            }
        });
        console.log(`💾 Saved metadata config for station ${stationId}: ${method.type}`);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error saving metadata config:', error);
        res.json({
            success: false,
            error: error instanceof Error ? error.message : 'Database error'
        });
    }
});
router.post('/test-live', async (req, res) => {
    const { identifier, method } = req.body;
    try {
        let nowPlaying = null;
        switch (method.type) {
            case 'icecast':
                if (method.config?.metaint) {
                    nowPlaying = await extractIcecastCurrentTrack(method.endpoint, method.config.metaint);
                }
                break;
            case 'json':
                const jsonResponse = await (0, node_fetch_1.default)(method.endpoint);
                const jsonData = await jsonResponse.json();
                nowPlaying = jsonData.nowplaying || jsonData.current || jsonData.song || 'No current data';
                break;
            case 'website':
                const htmlResponse = await (0, node_fetch_1.default)(method.endpoint);
                const html = await htmlResponse.text();
                if (method.config?.patterns?.[0]?.pattern) {
                    const pattern = new RegExp(method.config.patterns[0].pattern, 'gi');
                    const match = html.match(pattern);
                    if (match && match[0]) {
                        nowPlaying = match[0];
                    }
                }
                break;
        }
        res.json({
            success: true,
            nowPlaying: nowPlaying || 'No data available',
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        res.json({
            success: false,
            error: error instanceof Error ? error.message : 'Live test failed'
        });
    }
});
router.post('/test-random', async (req, res) => {
    const { count = 10 } = req.body;
    try {
        const stations = await prisma.station.findMany({
            take: count,
            orderBy: { id: 'asc' },
            skip: Math.floor(Math.random() * 1000)
        });
        res.json({
            success: true,
            stations: stations.map(s => ({ id: s.id, name: s.name, streamUrl: s.streamUrl })),
            message: `Testing ${stations.length} random stations`
        });
    }
    catch (error) {
        res.json({
            success: false,
            error: error instanceof Error ? error.message : 'Database error'
        });
    }
});
router.get('/database-stats', async (req, res) => {
    try {
        const totalStations = await prisma.station.count();
        const withMetadata = await prisma.station.count({
            where: {
                OR: [
                    {
                        metadataApiUrl: {
                            not: null,
                            not: ""
                        }
                    },
                    {
                        metadataApiType: {
                            not: null,
                            not: ""
                        }
                    }
                ]
            }
        });
        const typeStats = await prisma.station.groupBy({
            by: ['metadataApiType'],
            _count: true,
            where: {
                metadataApiType: {
                    not: null,
                    not: ""
                }
            }
        });
        const withoutMetadata = totalStations - withMetadata;
        console.log(`📊 Metadata Stats: ${withMetadata}/${totalStations} stations have metadata (${Math.round((withMetadata / totalStations) * 100)}%)`);
        res.json({
            success: true,
            total: totalStations,
            withMetadata,
            withoutMetadata,
            coveragePercent: Math.round((withMetadata / totalStations) * 100),
            typeBreakdown: typeStats.map(stat => ({
                type: stat.metadataApiType,
                count: stat._count
            }))
        });
    }
    catch (error) {
        console.error('Error getting database stats:', error);
        res.json({
            success: false,
            error: error instanceof Error ? error.message : 'Database error'
        });
    }
});
router.get('/stations-with-metadata', async (req, res) => {
    try {
        const stations = await prisma.station.findMany({
            where: {
                OR: [
                    {
                        metadataApiUrl: {
                            not: null,
                            not: ""
                        }
                    },
                    {
                        metadataApiType: {
                            not: null,
                            not: ""
                        }
                    }
                ]
            },
            select: {
                id: true,
                name: true,
                metadataApiType: true,
                metadataApiUrl: true,
                metadataFormat: true,
                updatedAt: true
            },
            orderBy: { updatedAt: 'desc' }
        });
        const typeStats = await prisma.station.groupBy({
            by: ['metadataApiType'],
            _count: true,
            where: {
                metadataApiType: {
                    not: null,
                    not: ""
                }
            }
        });
        console.log(`📋 Found ${stations.length} stations with metadata configuration`);
        res.json({
            success: true,
            stations,
            typeBreakdown: typeStats.map(stat => ({
                type: stat.metadataApiType,
                count: stat._count
            }))
        });
    }
    catch (error) {
        console.error('Error getting stations with metadata:', error);
        res.json({
            success: false,
            error: error instanceof Error ? error.message : 'Database error'
        });
    }
});
router.post('/clear-config', async (req, res) => {
    const { stationId } = req.body;
    try {
        await prisma.station.update({
            where: { id: parseInt(stationId) },
            data: {
                metadataApiUrl: null,
                metadataApiType: null,
                metadataFormat: null,
                metadataFields: null,
                updatedAt: new Date()
            }
        });
        console.log(`🗑️ Cleared metadata config for station ${stationId}`);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Error clearing metadata config:', error);
        res.json({
            success: false,
            error: error instanceof Error ? error.message : 'Database error'
        });
    }
});
exports.default = router;
