"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const metadata_1 = require("../services/metadata");
const utils_1 = require("../services/metadata/utils");
const client_1 = require("@prisma/client");
const station_lookup_1 = require("../utils/station-lookup");
const express_2 = require("../types/express");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.get('/', async (req, res) => {
    const { stream } = req.query;
    if (!stream || typeof stream !== 'string') {
        (0, express_2.handleValidationError)(res, 'Stream URL required');
        return;
    }
    try {
        console.log(`🎵 Frontend requesting metadata for: ${stream}`);
        const result = await (0, metadata_1.detectStreamMetadata)(stream);
        if (result.success && result.hasMetadata) {
            if (result.nowPlaying) {
                const parsed = (0, utils_1.parseTrackTitle)(result.nowPlaying);
                const data = {
                    success: true,
                    song: result.nowPlaying,
                    title: parsed.title || result.nowPlaying,
                    artist: parsed.artist,
                    message: result.message
                };
                res.json(data);
                return;
            }
            else {
                const data = {
                    success: true,
                    hasMetadataSupport: true,
                    message: 'Stream supports metadata but no current track'
                };
                res.json(data);
                return;
            }
        }
        else {
            const data = {
                success: false,
                message: result.error || 'No metadata support detected'
            };
            res.json(data);
            return;
        }
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to fetch metadata');
    }
});
router.get('/:stationId', async (req, res) => {
    const { stationId } = req.params;
    if (!stationId) {
        (0, express_2.handleValidationError)(res, 'Station ID required');
        return;
    }
    try {
        console.log(`🎵 Frontend requesting metadata for station: ${stationId}`);
        const station = await (0, station_lookup_1.findStationByEitherId)(stationId, {
            select: { streamUrl: true, name: true, nanoid: true, id: true }
        });
        if (!station || !station.streamUrl) {
            const data = {
                success: false,
                message: `Station ${stationId} not found or missing stream URL`
            };
            res.json(data);
            return;
        }
        console.log(`🔍 Found station "${station.name}" (${station.nanoid || station.id}) with stream URL: ${station.streamUrl}`);
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
                const metadataStationId = station.nanoid || station.id;
                console.log(`🏠 Trying local metadata server: ${localMetadataUrl}/metadata/${metadataStationId}`);
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);
                const localResponse = await fetch(`${localMetadataUrl}/metadata/${metadataStationId}`, {
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
                        const rawSongInfo = localData.song || `${localData.artist} - ${localData.title}`;
                        const songInfo = (0, utils_1.decodeHtmlEntities)(rawSongInfo);
                        console.log(`✅ Local server provided metadata: ${songInfo}`);
                        const parsed = (0, utils_1.parseTrackTitle)(songInfo);
                        const data = {
                            success: true,
                            song: songInfo,
                            title: (0, utils_1.decodeHtmlEntities)(localData.title || '') || parsed.title || songInfo,
                            artist: (0, utils_1.decodeHtmlEntities)(localData.artist || '') || parsed.artist,
                            source: 'local',
                            message: localData.message || 'Enhanced metadata from local server',
                            ...(localData.artwork && { artwork: localData.artwork }),
                            ...(localData.album && { album: localData.album }),
                            ...(localData.rogersData && { rogersData: localData.rogersData })
                        };
                        res.json(data);
                        return;
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
                const data = {
                    success: true,
                    song: result.nowPlaying,
                    title: parsed.title || result.nowPlaying,
                    artist: parsed.artist,
                    source: 'icecast',
                    message: result.message
                };
                res.json(data);
                return;
            }
            else {
                const data = {
                    success: true,
                    hasMetadataSupport: true,
                    source: 'icecast',
                    message: 'Stream supports metadata but no current track'
                };
                res.json(data);
                return;
            }
        }
        else {
            const data = {
                success: false,
                source: 'icecast',
                message: result.error || 'No metadata support detected'
            };
            res.json(data);
            return;
        }
    }
    catch (error) {
        (0, express_2.handleError)(res, error, `Failed to fetch metadata for station ${stationId}`);
    }
});
router.post('/test', async (req, res) => {
    const { streamUrl } = req.body;
    if (!streamUrl) {
        (0, express_2.handleValidationError)(res, 'Stream URL is required');
        return;
    }
    try {
        console.log(`🔍 Admin testing metadata for: ${streamUrl}`);
        const result = await (0, metadata_1.detectStreamMetadata)(streamUrl);
        res.json(result);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to test metadata');
    }
});
exports.default = router;
