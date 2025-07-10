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
