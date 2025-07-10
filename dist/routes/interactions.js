"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const qualityScoring_1 = require("../utils/qualityScoring");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const interactionRateLimit = new Map();
const INTERACTION_COOLDOWN = 10 * 1000;
function isRateLimited(ip) {
    const lastInteraction = interactionRateLimit.get(ip);
    const now = Date.now();
    if (lastInteraction && (now - lastInteraction) < INTERACTION_COOLDOWN) {
        return true;
    }
    interactionRateLimit.set(ip, now);
    return false;
}
router.post('/stations/:id/play', async (req, res) => {
    try {
        const stationId = parseInt(req.params.id);
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        if (isNaN(stationId)) {
            return res.status(400).json({ error: 'Invalid station ID' });
        }
        if (isRateLimited(ipAddress)) {
            return res.status(429).json({ error: 'Rate limit exceeded' });
        }
        const station = await prisma.station.findUnique({
            where: { id: stationId },
            include: {
                feedback: {
                    where: { resolved: false }
                }
            }
        });
        if (!station) {
            return res.status(404).json({ error: 'Station not found' });
        }
        const updatedStation = await prisma.station.update({
            where: { id: stationId },
            data: {
                clickcount: {
                    increment: 1
                }
            }
        });
        const feedbackSummary = {
            total: station.feedback.length,
            streamBroken: station.feedback.filter(f => f.feedbackType === 'stream_broken').length,
            poorQuality: station.feedback.filter(f => f.feedbackType === 'poor_quality').length,
            wrongInfo: station.feedback.filter(f => f.feedbackType === 'wrong_info').length,
            greatStation: station.feedback.filter(f => f.feedbackType === 'great_station').length,
            missingMetadata: station.feedback.filter(f => f.feedbackType === 'missing_metadata').length
        };
        const qualityScore = (0, qualityScoring_1.calculateStationQualityScore)(feedbackSummary, {
            metadataApiUrl: station.metadataApiUrl,
            metadataApiType: station.metadataApiType,
            local_image_url: station.local_image_url,
            favicon: station.favicon,
            logo: station.logo,
            description: station.description,
            language: station.language,
            bitrate: station.bitrate,
            clickcount: (station.clickcount || 0) + 1,
            votes: station.votes
        });
        await prisma.station.update({
            where: { id: stationId },
            data: {
                qualityScore: qualityScore.overall
            }
        });
        console.log(`📈 Station ${station.name} played: clickcount=${(station.clickcount || 0) + 1}, qualityScore=${qualityScore.overall.toFixed(2)}`);
        res.json({
            success: true,
            clickcount: (station.clickcount || 0) + 1,
            qualityScore: qualityScore.overall,
            message: 'Play recorded successfully'
        });
    }
    catch (error) {
        console.error('❌ Error recording station play:', error);
        res.status(500).json({ error: 'Failed to record station play' });
    }
});
router.post('/stations/:id/like', async (req, res) => {
    try {
        const stationId = parseInt(req.params.id);
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        if (isNaN(stationId)) {
            return res.status(400).json({ error: 'Invalid station ID' });
        }
        if (isRateLimited(ipAddress)) {
            return res.status(429).json({ error: 'Rate limit exceeded' });
        }
        const station = await prisma.station.findUnique({
            where: { id: stationId },
            include: {
                feedback: {
                    where: { resolved: false }
                }
            }
        });
        if (!station) {
            return res.status(404).json({ error: 'Station not found' });
        }
        const updatedStation = await prisma.station.update({
            where: { id: stationId },
            data: {
                votes: {
                    increment: 1
                }
            }
        });
        const feedbackSummary = {
            total: station.feedback.length,
            streamBroken: station.feedback.filter(f => f.feedbackType === 'stream_broken').length,
            poorQuality: station.feedback.filter(f => f.feedbackType === 'poor_quality').length,
            wrongInfo: station.feedback.filter(f => f.feedbackType === 'wrong_info').length,
            greatStation: station.feedback.filter(f => f.feedbackType === 'great_station').length,
            missingMetadata: station.feedback.filter(f => f.feedbackType === 'missing_metadata').length
        };
        const qualityScore = (0, qualityScoring_1.calculateStationQualityScore)(feedbackSummary, {
            metadataApiUrl: station.metadataApiUrl,
            metadataApiType: station.metadataApiType,
            local_image_url: station.local_image_url,
            favicon: station.favicon,
            logo: station.logo,
            description: station.description,
            language: station.language,
            bitrate: station.bitrate,
            clickcount: station.clickcount,
            votes: (station.votes || 0) + 1
        });
        await prisma.station.update({
            where: { id: stationId },
            data: {
                qualityScore: qualityScore.overall
            }
        });
        console.log(`👍 Station ${station.name} liked: votes=${(station.votes || 0) + 1}, qualityScore=${qualityScore.overall.toFixed(2)}`);
        res.json({
            success: true,
            votes: (station.votes || 0) + 1,
            qualityScore: qualityScore.overall,
            message: 'Like recorded successfully'
        });
    }
    catch (error) {
        console.error('❌ Error recording station like:', error);
        res.status(500).json({ error: 'Failed to record station like' });
    }
});
router.get('/stations/:id/stats', async (req, res) => {
    try {
        const stationId = parseInt(req.params.id);
        if (isNaN(stationId)) {
            return res.status(400).json({ error: 'Invalid station ID' });
        }
        const station = await prisma.station.findUnique({
            where: { id: stationId },
            select: {
                id: true,
                name: true,
                clickcount: true,
                votes: true,
                qualityScore: true,
                feedbackCount: true,
                createdAt: true,
                updatedAt: true
            }
        });
        if (!station) {
            return res.status(404).json({ error: 'Station not found' });
        }
        res.json({
            station: station,
            stats: {
                totalPlays: station.clickcount || 0,
                totalLikes: station.votes || 0,
                feedbackCount: station.feedbackCount || 0,
                qualityScore: station.qualityScore || null,
                createdAt: station.createdAt,
                lastUpdated: station.updatedAt
            }
        });
    }
    catch (error) {
        console.error('❌ Error fetching station stats:', error);
        res.status(500).json({ error: 'Failed to fetch station stats' });
    }
});
exports.default = router;
