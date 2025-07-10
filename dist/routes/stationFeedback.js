"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const qualityScoring_js_1 = require("../utils/qualityScoring.js");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.post('/stations/:id/feedback', async (req, res) => {
    try {
        const stationId = parseInt(req.params.id);
        const { feedbackType, details, userId } = req.body;
        const validTypes = ['stream_broken', 'poor_quality', 'wrong_info', 'great_station', 'missing_metadata'];
        if (!validTypes.includes(feedbackType)) {
            return res.status(400).json({
                success: false,
                error: 'Invalid feedback type'
            });
        }
        const station = await prisma.station.findUnique({
            where: { id: stationId }
        });
        if (!station) {
            return res.status(404).json({
                success: false,
                error: 'Station not found'
            });
        }
        const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';
        const userAgent = req.get('User-Agent') || 'unknown';
        const recentFeedback = await prisma.stationFeedback.findFirst({
            where: {
                stationId,
                ipAddress,
                createdAt: {
                    gte: new Date(Date.now() - 60 * 60 * 1000)
                }
            }
        });
        if (recentFeedback) {
            return res.status(429).json({
                success: false,
                error: 'Please wait before submitting more feedback for this station'
            });
        }
        const feedback = await prisma.stationFeedback.create({
            data: {
                stationId,
                feedbackType,
                details,
                userId: userId || null,
                ipAddress,
                userAgent
            }
        });
        await prisma.station.update({
            where: { id: stationId },
            data: {
                feedbackCount: {
                    increment: 1
                }
            }
        });
        await updateStationQualityScore(stationId);
        console.log(`📝 Feedback received for station ${station.name}: ${feedbackType}`);
        return res.json({
            success: true,
            message: 'Feedback submitted successfully',
            feedbackId: feedback.id
        });
    }
    catch (error) {
        console.error('❌ Error submitting station feedback:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to submit feedback'
        });
    }
});
router.get('/stations/:id/quality', async (req, res) => {
    try {
        const stationId = parseInt(req.params.id);
        const station = await prisma.station.findUnique({
            where: { id: stationId },
            include: {
                feedback: true
            }
        });
        if (!station) {
            return res.status(404).json({
                success: false,
                error: 'Station not found'
            });
        }
        const feedbackSummary = {
            total: station.feedback.length,
            streamBroken: station.feedback.filter(f => f.feedbackType === 'stream_broken').length,
            poorQuality: station.feedback.filter(f => f.feedbackType === 'poor_quality').length,
            wrongInfo: station.feedback.filter(f => f.feedbackType === 'wrong_info').length,
            greatStation: station.feedback.filter(f => f.feedbackType === 'great_station').length,
            missingMetadata: station.feedback.filter(f => f.feedbackType === 'missing_metadata').length
        };
        const qualityScore = (0, qualityScoring_js_1.calculateStationQualityScore)(feedbackSummary, station);
        const tier = (0, qualityScoring_js_1.getQualityTier)(qualityScore.overall);
        return res.json({
            success: true,
            stationId,
            qualityScore: qualityScore.overall,
            breakdown: qualityScore.breakdown,
            feedbackCount: qualityScore.feedbackCount,
            tier,
            lastCalculated: qualityScore.lastCalculated,
            feedbackSummary
        });
    }
    catch (error) {
        console.error('❌ Error getting station quality:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get station quality'
        });
    }
});
router.get('/stations/:id/feedback', async (req, res) => {
    try {
        const stationId = parseInt(req.params.id);
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const [feedback, total] = await Promise.all([
            prisma.stationFeedback.findMany({
                where: { stationId },
                include: {
                    user: {
                        select: { id: true, email: true }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit
            }),
            prisma.stationFeedback.count({
                where: { stationId }
            })
        ]);
        return res.json({
            success: true,
            feedback,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('❌ Error getting station feedback:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get station feedback'
        });
    }
});
router.patch('/feedback/:id/resolve', async (req, res) => {
    try {
        const feedbackId = parseInt(req.params.id);
        const { resolved } = req.body;
        const feedback = await prisma.stationFeedback.update({
            where: { id: feedbackId },
            data: { resolved: resolved !== false }
        });
        await updateStationQualityScore(feedback.stationId);
        return res.json({
            success: true,
            feedbackId,
            resolved: feedback.resolved
        });
    }
    catch (error) {
        console.error('❌ Error resolving feedback:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to resolve feedback'
        });
    }
});
router.post('/quality/recalculate-all', async (req, res) => {
    try {
        const stations = await prisma.station.findMany({
            select: { id: true }
        });
        let updated = 0;
        for (const station of stations) {
            try {
                await updateStationQualityScore(station.id);
                updated++;
            }
            catch (error) {
                console.error(`❌ Error updating quality score for station ${station.id}:`, error);
            }
        }
        console.log(`✅ Recalculated quality scores for ${updated} stations`);
        return res.json({
            success: true,
            message: `Updated quality scores for ${updated} stations`,
            totalStations: stations.length,
            updated
        });
    }
    catch (error) {
        console.error('❌ Error recalculating all quality scores:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to recalculate quality scores'
        });
    }
});
router.get('/quality/by-tier/:tier', async (req, res) => {
    try {
        const { tier } = req.params;
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;
        const tierRanges = {
            premium: { min: 90, max: 100 },
            high: { min: 80, max: 89.99 },
            good: { min: 70, max: 79.99 },
            fair: { min: 60, max: 69.99 },
            poor: { min: 0, max: 59.99 }
        };
        const range = tierRanges[tier];
        if (!range) {
            return res.status(400).json({
                success: false,
                error: 'Invalid quality tier'
            });
        }
        const [stations, total] = await Promise.all([
            prisma.station.findMany({
                where: {
                    qualityScore: {
                        gte: range.min,
                        lte: range.max
                    },
                    isActive: true
                },
                orderBy: { qualityScore: 'desc' },
                skip,
                take: limit
            }),
            prisma.station.count({
                where: {
                    qualityScore: {
                        gte: range.min,
                        lte: range.max
                    },
                    isActive: true
                }
            })
        ]);
        return res.json({
            success: true,
            stations,
            tier,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit)
            }
        });
    }
    catch (error) {
        console.error('❌ Error getting stations by quality tier:', error);
        return res.status(500).json({
            success: false,
            error: 'Failed to get stations by quality tier'
        });
    }
});
async function updateStationQualityScore(stationId) {
    try {
        const station = await prisma.station.findUnique({
            where: { id: stationId },
            include: {
                feedback: {
                    where: { resolved: false }
                }
            }
        });
        if (!station) {
            throw new Error('Station not found');
        }
        const feedbackSummary = {
            total: station.feedback.length,
            streamBroken: station.feedback.filter(f => f.feedbackType === 'stream_broken').length,
            poorQuality: station.feedback.filter(f => f.feedbackType === 'poor_quality').length,
            wrongInfo: station.feedback.filter(f => f.feedbackType === 'wrong_info').length,
            greatStation: station.feedback.filter(f => f.feedbackType === 'great_station').length,
            missingMetadata: station.feedback.filter(f => f.feedbackType === 'missing_metadata').length
        };
        const qualityScore = (0, qualityScoring_js_1.calculateStationQualityScore)(feedbackSummary, station);
        await prisma.station.update({
            where: { id: stationId },
            data: {
                qualityScore: qualityScore.overall,
                feedbackCount: feedbackSummary.total
            }
        });
        if ((0, qualityScoring_js_1.shouldHideStation)(qualityScore.overall, feedbackSummary.total)) {
            await prisma.station.update({
                where: { id: stationId },
                data: { isActive: false }
            });
            console.log(`🚫 Station ${station.name} hidden due to poor quality (${qualityScore.overall})`);
        }
    }
    catch (error) {
        console.error(`❌ Error updating quality score for station ${stationId}:`, error);
        throw error;
    }
}
exports.default = router;
