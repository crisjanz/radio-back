"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const station_lookup_1 = require("../utils/station-lookup");
const express_2 = require("../types/express");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
async function getNextAvailableStationId() {
    try {
        const existingIds = await prisma.station.findMany({
            select: { id: true },
            orderBy: { id: 'asc' }
        });
        let expectedId = 1;
        for (const station of existingIds) {
            if (station.id !== expectedId) {
                console.log(`🔢 Found ID gap: using ID ${expectedId} instead of next sequential ID`);
                return expectedId;
            }
            expectedId++;
        }
        console.log(`🔢 No ID gaps found: using next sequential ID ${expectedId}`);
        return expectedId;
    }
    catch (error) {
        console.error('❌ Error finding available station ID:', error);
        throw error;
    }
}
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const skip = (page - 1) * limit;
        const showInactive = req.query.includeInactive === 'true';
        const whereClause = showInactive ? {} : { isActive: true };
        const [stations, total] = await Promise.all([
            prisma.station.findMany({
                where: whereClause,
                skip,
                take: limit,
                orderBy: { id: 'asc' }
            }),
            prisma.station.count({ where: whereClause })
        ]);
        if (req.query.page || req.query.limit) {
            const data = {
                stations,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            };
            res.json(data);
            return;
        }
        else {
            const allStations = await prisma.station.findMany({ where: whereClause });
            res.json(allStations);
            return;
        }
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to fetch stations');
    }
});
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || query.trim().length < 2) {
            (0, express_2.handleValidationError)(res, 'Search query must be at least 2 characters long');
            return;
        }
        const searchTerm = query.trim();
        console.log(`🔍 Searching stations for: "${searchTerm}"`);
        const showInactive = req.query.includeInactive === 'true';
        const activeFilter = showInactive ? {} : { isActive: true };
        const stations = await prisma.station.findMany({
            where: {
                ...activeFilter,
                OR: [
                    { name: { contains: searchTerm, mode: 'insensitive' } },
                    { country: { contains: searchTerm, mode: 'insensitive' } },
                    { city: { contains: searchTerm, mode: 'insensitive' } },
                    { genre: { contains: searchTerm, mode: 'insensitive' } },
                    { type: { contains: searchTerm, mode: 'insensitive' } },
                    { description: { contains: searchTerm, mode: 'insensitive' } },
                    { tags: { contains: searchTerm, mode: 'insensitive' } }
                ]
            },
            take: 100
        });
        console.log(`   ✅ Found ${stations.length} stations`);
        res.json(stations);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to search stations');
    }
});
router.get('/stats', async (req, res) => {
    try {
        const [total, withImages, recentImports] = await Promise.all([
            prisma.station.count(),
            prisma.station.count({
                where: {
                    OR: [
                        { favicon: { not: null } },
                        { logo: { not: null } }
                    ]
                }
            }),
            prisma.station.count({
                where: {
                    createdAt: {
                        gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                    }
                }
            })
        ]);
        const data = {
            total,
            active: total,
            withImages,
            recentImports
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to get database stats');
    }
});
router.get('/countries', async (req, res) => {
    try {
        const countries = await prisma.station.groupBy({
            by: ['country'],
            _count: true,
            orderBy: {
                _count: {
                    country: 'desc'
                }
            }
        });
        const formattedCountries = countries.map(country => ({
            country: country.country,
            count: country._count
        }));
        res.json(formattedCountries);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to fetch countries');
    }
});
router.get('/genres', async (req, res) => {
    try {
        const genres = await prisma.station.groupBy({
            by: ['genre'],
            _count: true,
            where: {
                genre: {
                    not: null
                }
            },
            orderBy: {
                _count: {
                    genre: 'desc'
                }
            }
        });
        const formattedGenres = genres.map(genre => ({
            genre: genre.genre,
            count: genre._count
        }));
        res.json(formattedGenres);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to fetch genres');
    }
});
router.put('/:id', async (req, res) => {
    try {
        const { stationIdParam, idType } = (0, station_lookup_1.parseStationIdParam)(req);
        if (idType === 'invalid') {
            (0, express_2.handleValidationError)(res, 'Invalid station ID format');
            return;
        }
        const existingStation = await (0, station_lookup_1.findStationByEitherId)(stationIdParam, {
            select: { id: true, nanoid: true }
        });
        if (!existingStation) {
            (0, express_2.handleNotFound)(res, 'Station');
            return;
        }
        const updateData = req.body;
        const cleanedData = Object.fromEntries(Object.entries(updateData).filter(([_, value]) => value !== undefined && value !== ''));
        const updatedStation = await prisma.station.update({
            where: { id: existingStation.id },
            data: cleanedData
        });
        res.json(updatedStation);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to update station');
    }
});
router.get('/:id', async (req, res) => {
    try {
        const { stationIdParam, idType } = (0, station_lookup_1.parseStationIdParam)(req);
        if (idType === 'invalid') {
            (0, express_2.handleValidationError)(res, 'Invalid station ID format');
            return;
        }
        const station = await (0, station_lookup_1.findStationByEitherId)(stationIdParam);
        if (!station) {
            (0, express_2.handleNotFound)(res, 'Station');
            return;
        }
        res.json(station);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to fetch station');
    }
});
router.post('/', async (req, res) => {
    try {
        const stationData = req.body;
        if (stationData.streamUrl || (stationData.name && stationData.country)) {
            const existing = await prisma.station.findFirst({
                where: {
                    OR: [
                        ...(stationData.streamUrl ? [{ streamUrl: stationData.streamUrl }] : []),
                        ...(stationData.name && stationData.country ? [{
                                name: stationData.name,
                                country: stationData.country
                            }] : [])
                    ]
                }
            });
            if (existing) {
                console.log(`⚠️ Duplicate station detected: "${stationData.name}" already exists as ID ${existing.id}`);
                const data = {
                    error: 'Station already exists',
                    duplicate: true,
                    existingStation: existing
                };
                res.status(409).json(data);
                return;
            }
        }
        const optimalId = await getNextAvailableStationId();
        const station = await prisma.station.create({
            data: {
                id: optimalId,
                ...stationData
            }
        });
        console.log(`✅ Created station "${station.name}" with ID ${station.id}`);
        res.json(station);
    }
    catch (error) {
        console.error('❌ Error creating station:', error);
        if (error instanceof Error && error.message.includes('unique constraint')) {
            console.log('🔄 ID conflict detected, falling back to auto-increment...');
            try {
                const station = await prisma.station.create({ data: req.body });
                console.log(`✅ Created station "${station.name}" with auto-generated ID ${station.id}`);
                res.json(station);
                return;
            }
            catch (fallbackError) {
                (0, express_2.handleError)(res, fallbackError, 'Failed to create station');
                return;
            }
        }
        (0, express_2.handleError)(res, error, 'Failed to create station');
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const { stationIdParam, idType } = (0, station_lookup_1.parseStationIdParam)(req);
        if (idType === 'invalid') {
            (0, express_2.handleValidationError)(res, 'Invalid station ID format');
            return;
        }
        const existingStation = await (0, station_lookup_1.findStationByEitherId)(stationIdParam, {
            select: { id: true }
        });
        if (!existingStation) {
            (0, express_2.handleNotFound)(res, 'Station');
            return;
        }
        await prisma.station.delete({
            where: { id: existingStation.id }
        });
        const data = { success: true };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to delete station');
    }
});
router.post('/:id/calculate-quality', async (req, res) => {
    try {
        const { stationIdParam, idType } = (0, station_lookup_1.parseStationIdParam)(req);
        if (idType === 'invalid') {
            (0, express_2.handleValidationError)(res, 'Invalid station ID format');
            return;
        }
        const station = await (0, station_lookup_1.findStationByEitherId)(stationIdParam);
        if (!station) {
            (0, express_2.handleNotFound)(res, 'Station');
            return;
        }
        const { getStationFeedback } = require('../utils/station-lookup');
        const feedback = await getStationFeedback(stationIdParam);
        const totalFeedback = feedback.length;
        const streamWorkingReports = feedback.filter(f => f.feedbackType === 'great_station').length;
        const audioQualityReports = feedback.filter(f => f.feedbackType !== 'poor_audio_quality').length;
        const correctInfoReports = feedback.filter(f => f.feedbackType !== 'wrong_information').length;
        const positiveReports = feedback.filter(f => f.feedbackType === 'great_station').length;
        const hasMetadata = !!(station.metadataApiUrl || station.metadataApiType);
        let qualityScore = 0;
        let breakdown = {
            streamReliability: 0,
            audioQuality: 0,
            informationAccuracy: 0,
            userSatisfaction: 0,
            metadataRichness: 0
        };
        if (totalFeedback > 0) {
            breakdown.streamReliability = ((streamWorkingReports / totalFeedback) * 100) * 0.3;
            breakdown.audioQuality = ((audioQualityReports / totalFeedback) * 100) * 0.25;
            breakdown.informationAccuracy = ((correctInfoReports / totalFeedback) * 100) * 0.2;
            breakdown.userSatisfaction = ((positiveReports / totalFeedback) * 100) * 0.15;
        }
        else {
            breakdown.streamReliability = station.lastPingSuccess ? 30 : 0;
            breakdown.audioQuality = station.bitrate && station.bitrate > 64 ? 25 : 15;
            breakdown.informationAccuracy = station.description && station.homepage ? 20 : 10;
            breakdown.userSatisfaction = station.votes && station.votes > 0 ? 15 : 7.5;
        }
        breakdown.metadataRichness = hasMetadata ? 10 : 0;
        qualityScore = breakdown.streamReliability + breakdown.audioQuality +
            breakdown.informationAccuracy + breakdown.userSatisfaction +
            breakdown.metadataRichness;
        await prisma.station.update({
            where: { id: station.id },
            data: {
                qualityScore,
                feedbackCount: totalFeedback
            }
        });
        console.log(`✅ Quality score calculated for station ${station.id}: ${qualityScore.toFixed(2)}%`);
        const data = {
            qualityScore,
            feedbackCount: totalFeedback,
            breakdown: {
                streamReliability: breakdown.streamReliability / 0.3,
                audioQuality: breakdown.audioQuality / 0.25,
                informationAccuracy: breakdown.informationAccuracy / 0.2,
                userSatisfaction: breakdown.userSatisfaction / 0.15,
                metadataRichness: breakdown.metadataRichness / 0.1
            }
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to calculate quality score');
    }
});
router.get('/:id/recently-played', async (req, res) => {
    try {
        const { stationIdParam, idType } = (0, station_lookup_1.parseStationIdParam)(req);
        if (idType === 'invalid') {
            (0, express_2.handleValidationError)(res, 'Invalid station ID format');
            return;
        }
        const limit = parseInt(req.query.limit) || 50;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        let whereClause = {
            playedAt: { gte: today }
        };
        if (idType === 'nanoid') {
            whereClause.stationNanoid = stationIdParam;
        }
        else {
            whereClause.stationId = parseInt(stationIdParam);
        }
        const tracks = await prisma.stationPlayHistory.findMany({
            where: whereClause,
            include: {
                track: true
            },
            orderBy: { playedAt: 'desc' },
            take: limit
        });
        const formattedTracks = tracks.map(play => ({
            id: play.id,
            playedAt: play.playedAt,
            source: play.source,
            showName: play.showName,
            djName: play.djName,
            track: {
                id: play.track.id,
                title: play.track.title,
                artist: play.track.artist,
                album: play.track.album,
                artwork: play.track.artwork,
                duration: play.track.duration
            }
        }));
        res.json(formattedTracks);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to get recently played tracks');
    }
});
router.get('/:id/history/:date', async (req, res) => {
    try {
        const { stationIdParam, idType } = (0, station_lookup_1.parseStationIdParam)(req);
        const { date } = req.params;
        if (idType === 'invalid') {
            (0, express_2.handleValidationError)(res, 'Invalid station ID format');
            return;
        }
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(date)) {
            (0, express_2.handleValidationError)(res, 'Invalid date format. Use YYYY-MM-DD');
            return;
        }
        const requestedDate = new Date(date);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (requestedDate.getTime() === today.getTime()) {
            const data = {
                error: 'Use /recently-played endpoint for today\'s tracks',
                redirect: `/stations/${stationIdParam}/recently-played`
            };
            res.status(400).json(data);
            return;
        }
        const metadataServerUrl = process.env.METADATA_SERVER_URL || 'https://streemr.ddns.net:3002';
        const exportUrl = `${metadataServerUrl}/exports/${date}.json`;
        try {
            const fetch = (await Promise.resolve().then(() => __importStar(require('node-fetch')))).default;
            const response = await fetch(exportUrl);
            if (!response.ok) {
                if (response.status === 404) {
                    (0, express_2.handleNotFound)(res, 'Track data for this date');
                    return;
                }
                throw new Error(`HTTP ${response.status}`);
            }
            const exportData = await response.json();
            const stationTracks = exportData.stations[stationIdParam] || [];
            res.json(stationTracks);
        }
        catch (fetchError) {
            console.error(`❌ Error fetching historical data for ${date}:`, fetchError);
            res.status(503).json({ error: 'Historical data service unavailable' });
        }
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to get historical tracks');
    }
});
exports.default = router;
