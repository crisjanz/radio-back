"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const metadata_1 = require("../services/metadata");
const utils_1 = require("../services/metadata/utils");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.get('/', async (req, res) => {
    const { stream } = req.query;
    if (!stream || typeof stream !== 'string') {
        return res.status(400).json({ error: 'Stream URL required' });
    }
    try {
        console.log(`🎵 Frontend requesting metadata for: ${stream}`);
        const result = await (0, metadata_1.detectStreamMetadata)(stream);
        if (result.success && result.hasMetadata) {
            if (result.nowPlaying) {
                const parsed = (0, utils_1.parseTrackTitle)(result.nowPlaying);
                return res.json({
                    success: true,
                    song: result.nowPlaying,
                    title: parsed.title || result.nowPlaying,
                    artist: parsed.artist,
                    message: result.message
                });
            }
            else {
                return res.json({
                    success: true,
                    hasMetadataSupport: true,
                    message: 'Stream supports metadata but no current track'
                });
            }
        }
        else {
            return res.json({
                success: false,
                message: result.error || 'No metadata support detected'
            });
        }
    }
    catch (error) {
        console.error('Frontend metadata error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch metadata'
        });
    }
});
router.get('/:stationId', async (req, res) => {
    const { stationId } = req.params;
    if (!stationId) {
        return res.status(400).json({ error: 'Station ID required' });
    }
    try {
        console.log(`🎵 Frontend requesting metadata for station: ${stationId}`);
        const station = await prisma.station.findUnique({
            where: { id: parseInt(stationId) },
            select: { streamUrl: true, name: true }
        });
        if (!station || !station.streamUrl) {
            return res.json({
                success: false,
                message: `Station ${stationId} not found or missing stream URL`
            });
        }
        console.log(`🔍 Found station "${station.name}" with stream URL: ${station.streamUrl}`);
        let localMetadataUrl = process.env.LOCAL_METADATA_URL;
        if (process.env.NODE_ENV === 'development' || process.env.RENDER !== 'true') {
            localMetadataUrl = 'http://localhost:3002';
            console.log(`🏠 Detected local environment, using localhost metadata server`);
        }
        else {
            console.log(`☁️ Detected production environment, using DDNS metadata server: ${localMetadataUrl}`);
        }
        if (localMetadataUrl) {
            try {
                console.log(`🏠 Trying local metadata server: ${localMetadataUrl}/metadata/${stationId}`);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const localResponse = await fetch(`${localMetadataUrl}/metadata/${stationId}`, {
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json',
                        'User-Agent': 'Streemr-Backend/1.0'
                    }
                });
                clearTimeout(timeoutId);
                if (localResponse.ok) {
                    const localData = await localResponse.json();
                    if (localData.song || (localData.title && localData.artist)) {
                        const songInfo = localData.song || `${localData.artist} - ${localData.title}`;
                        console.log(`✅ Local server provided metadata: ${songInfo}`);
                        const parsed = (0, utils_1.parseTrackTitle)(songInfo);
                        return res.json({
                            success: true,
                            song: songInfo,
                            title: localData.title || parsed.title || songInfo,
                            artist: localData.artist || parsed.artist,
                            source: 'local',
                            message: localData.message || 'Enhanced metadata from local server',
                            ...(localData.artwork && { artwork: localData.artwork }),
                            ...(localData.album && { album: localData.album }),
                            ...(localData.rogersData && { rogersData: localData.rogersData })
                        });
                    }
                    else {
                        console.log(`⚠️ Local server returned no metadata, falling back to Icecast`);
                    }
                }
                else {
                    console.log(`⚠️ Local server responded with ${localResponse.status}, falling back to Icecast`);
                }
            }
            catch (error) {
                if (error.name === 'AbortError') {
                    console.log(`⏰ Local server timeout, falling back to Icecast`);
                }
                else {
                    console.log(`⚠️ Local server error: ${error.message}, falling back to Icecast`);
                }
            }
        }
        console.log(`🔄 Falling back to Icecast metadata detection`);
        const result = await (0, metadata_1.detectStreamMetadata)(station.streamUrl);
        if (result.success && result.hasMetadata) {
            if (result.nowPlaying) {
                const parsed = (0, utils_1.parseTrackTitle)(result.nowPlaying);
                return res.json({
                    success: true,
                    song: result.nowPlaying,
                    title: parsed.title || result.nowPlaying,
                    artist: parsed.artist,
                    source: 'icecast',
                    message: result.message
                });
            }
            else {
                return res.json({
                    success: true,
                    hasMetadataSupport: true,
                    source: 'icecast',
                    message: 'Stream supports metadata but no current track'
                });
            }
        }
        else {
            return res.json({
                success: false,
                source: 'icecast',
                message: result.error || 'No metadata support detected'
            });
        }
    }
    catch (error) {
        console.error(`Metadata error for station ${stationId}:`, error);
        return res.status(500).json({
            success: false,
            error: 'Failed to fetch metadata'
        });
    }
});
router.post('/test', async (req, res) => {
    const { streamUrl } = req.body;
    if (!streamUrl) {
        return res.status(400).json({ error: 'Stream URL is required' });
    }
    try {
        console.log(`🔍 Admin testing metadata for: ${streamUrl}`);
        const result = await (0, metadata_1.detectStreamMetadata)(streamUrl);
        return res.json(result);
    }
    catch (error) {
        console.error('Admin metadata test error:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to test metadata'
        });
    }
});
exports.default = router;
