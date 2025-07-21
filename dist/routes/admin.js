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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const node_fetch_1 = __importDefault(require("node-fetch"));
const station_lookup_1 = require("../utils/station-lookup");
const express_2 = require("../types/express");
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
router.get('/', async (req, res) => {
    try {
        const [totalStations, stationsNeedingNormalization, activeStations] = await Promise.all([
            prisma.station.count(),
            prisma.station.count({
                where: {
                    OR: [
                        { genre: null },
                        { type: null },
                        { genre: '' },
                        { type: '' }
                    ]
                }
            }),
            prisma.station.count({ where: { isActive: true } })
        ]);
        const data = {
            success: true,
            message: 'Admin service is running',
            stats: {
                totalStations,
                activeStations,
                stationsNeedingNormalization,
                completeness: totalStations > 0 ? Math.round(((totalStations - stationsNeedingNormalization) / totalStations) * 100) : 0
            },
            endpoints: {
                '/admin/stations/normalize': 'Get stations needing normalization',
                '/admin/normalization-rules': 'Get normalization rules',
                '/admin/stations/analyze': 'Analyze stations for normalization',
                '/admin/stations/apply-normalization': 'Apply normalization changes',
                '/admin/stations/:id/toggle': 'Toggle station active status',
                '/admin/stats': 'Get admin statistics'
            }
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Admin service error');
    }
});
router.get('/stations/normalize', async (req, res) => {
    try {
        const stations = await prisma.station.findMany({
            select: {
                id: true,
                name: true,
                genre: true,
                type: true,
                country: true
            }
        });
        const data = {
            stations,
            pendingChanges: []
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to fetch stations');
    }
});
router.post('/stations/analyze', async (req, res) => {
    try {
        const stations = await prisma.station.findMany({
            select: {
                id: true,
                name: true,
                genre: true,
                type: true,
                country: true,
                description: true
            }
        });
        const pendingChanges = [];
        const { GENRE_SYSTEM, getAllGenres, isValidGenre } = await Promise.resolve().then(() => __importStar(require('../constants/genres')));
        const { STATION_TYPES, suggestStationTypeForStation, isValidStationType } = await Promise.resolve().then(() => __importStar(require('../constants/stationTypes')));
        const genreRules = [];
        Object.entries(GENRE_SYSTEM).forEach(([key, info]) => {
            genreRules.push({
                keywords: [key, info.name.toLowerCase(), ...info.subgenres],
                normalized: key
            });
        });
        const typeRules = [];
        Object.entries(STATION_TYPES).forEach(([key, info]) => {
            typeRules.push({
                keywords: [key, info.name.toLowerCase(), ...info.keywords],
                normalized: key
            });
        });
        for (const station of stations) {
            const stationData = {
                name: station.name,
                description: station.description || '',
                genre: station.genre || '',
                subgenre: ''
            };
            if (station.genre) {
                const currentGenre = station.genre.toLowerCase();
                if (!isValidGenre(currentGenre)) {
                    let bestMatch = null;
                    let bestScore = 0;
                    for (const rule of genreRules) {
                        const score = rule.keywords.reduce((acc, keyword) => {
                            if (currentGenre.includes(keyword.toLowerCase())) {
                                return acc + (keyword.length / currentGenre.length);
                            }
                            return acc;
                        }, 0);
                        if (score > bestScore) {
                            bestScore = score;
                            bestMatch = rule.normalized;
                        }
                    }
                    if (bestMatch && bestScore > 0.3) {
                        const existingChange = pendingChanges.find(c => c.stationId === station.id && c.field === 'genre');
                        if (!existingChange) {
                            pendingChanges.push({
                                stationId: station.id,
                                field: 'genre',
                                original: station.genre,
                                suggested: bestMatch,
                                confidence: Math.round(bestScore * 100),
                                status: 'pending'
                            });
                        }
                    }
                }
            }
            const suggestedTypes = suggestStationTypeForStation(stationData);
            if (station.type) {
                const currentType = station.type.toLowerCase();
                if (!isValidStationType(currentType)) {
                    if (suggestedTypes.length > 0) {
                        const existingChange = pendingChanges.find(c => c.stationId === station.id && c.field === 'type');
                        if (!existingChange) {
                            pendingChanges.push({
                                stationId: station.id,
                                field: 'type',
                                original: station.type,
                                suggested: suggestedTypes[0],
                                confidence: 85,
                                status: 'pending'
                            });
                        }
                    }
                }
            }
            else {
                if (suggestedTypes.length > 0) {
                    pendingChanges.push({
                        stationId: station.id,
                        field: 'type',
                        original: null,
                        suggested: suggestedTypes[0],
                        confidence: 75,
                        status: 'pending'
                    });
                }
            }
        }
        console.log(`🔍 Sophisticated analysis complete: found ${pendingChanges.length} suggested changes`);
        const data = {
            pendingChanges,
            analysisStats: {
                totalStations: stations.length,
                suggestedChanges: pendingChanges.length,
                confidence: pendingChanges.length > 0 ? Math.round(pendingChanges.reduce((acc, c) => acc + (c.confidence || 50), 0) / pendingChanges.length) : 0
            }
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to analyze stations');
    }
});
router.post('/stations/apply-normalization', async (req, res) => {
    try {
        const { changes } = req.body;
        if (!Array.isArray(changes)) {
            (0, express_2.handleValidationError)(res, 'Changes must be an array');
            return;
        }
        let updated = 0;
        for (const change of changes) {
            if (change.status === 'approved' && change.stationId && change.field && change.suggested) {
                try {
                    await prisma.station.update({
                        where: { id: change.stationId },
                        data: {
                            [change.field]: change.suggested
                        }
                    });
                    updated++;
                }
                catch (updateError) {
                    console.error(`❌ Error updating station ${change.stationId}:`, updateError);
                }
            }
        }
        console.log(`✅ Applied ${updated} normalization changes`);
        const data = { updated };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to apply normalization changes');
    }
});
router.get('/normalization-rules', async (req, res) => {
    const data = [];
    res.json(data);
});
router.get('/stats', async (req, res) => {
    try {
        const [totalStations, stationsWithGenre, stationsWithType, countryCounts, genreCounts, typeCounts] = await Promise.all([
            prisma.station.count(),
            prisma.station.count({ where: { genre: { not: null } } }),
            prisma.station.count({ where: { type: { not: null } } }),
            prisma.station.groupBy({ by: ['country'], _count: true }),
            prisma.station.groupBy({ by: ['genre'], _count: true, where: { genre: { not: null } } }),
            prisma.station.groupBy({ by: ['type'], _count: true, where: { type: { not: null } } })
        ]);
        const data = {
            total: totalStations,
            withGenre: stationsWithGenre,
            withType: stationsWithType,
            countries: countryCounts.length,
            genres: genreCounts.length,
            types: typeCounts.length,
            topCountries: countryCounts.slice(0, 5),
            topGenres: genreCounts.slice(0, 10),
            topTypes: typeCounts.slice(0, 5)
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to fetch admin statistics');
    }
});
router.patch('/stations/:id/toggle', async (req, res) => {
    try {
        const { stationIdParam, idType } = (0, station_lookup_1.parseStationIdParam)(req);
        const { isActive, adminNotes } = req.body;
        if (idType === 'invalid') {
            (0, express_2.handleValidationError)(res, 'Invalid station ID format');
            return;
        }
        const station = await (0, station_lookup_1.findStationByEitherId)(stationIdParam);
        if (!station) {
            (0, express_2.handleNotFound)(res, 'Station');
            return;
        }
        const updatedStation = await prisma.station.update({
            where: { id: station.id },
            data: {
                isActive: isActive !== undefined ? isActive : !station.isActive,
                adminNotes: adminNotes || station.adminNotes,
                userReports: 0,
                updatedAt: new Date()
            }
        });
        console.log(`🔧 Admin ${updatedStation.isActive ? 'enabled' : 'disabled'} station: ${station.name}`);
        const data = {
            success: true,
            station: {
                id: updatedStation.id,
                name: updatedStation.name,
                isActive: updatedStation.isActive,
                adminNotes: updatedStation.adminNotes
            }
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to toggle station status');
    }
});
router.patch('/stations/:id/notes', async (req, res) => {
    try {
        const { stationIdParam, idType } = (0, station_lookup_1.parseStationIdParam)(req);
        const { adminNotes } = req.body;
        if (idType === 'invalid') {
            (0, express_2.handleValidationError)(res, 'Invalid station ID format');
            return;
        }
        const station = await (0, station_lookup_1.findStationByEitherId)(stationIdParam, {
            select: { id: true }
        });
        if (!station) {
            (0, express_2.handleNotFound)(res, 'Station');
            return;
        }
        const updatedStation = await prisma.station.update({
            where: { id: station.id },
            data: {
                adminNotes,
                updatedAt: new Date()
            }
        });
        const data = {
            success: true,
            stationId: station.id,
            adminNotes: updatedStation.adminNotes
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to update admin notes');
    }
});
router.patch('/stations/:id/reset-reports', async (req, res) => {
    try {
        const { stationIdParam, idType } = (0, station_lookup_1.parseStationIdParam)(req);
        if (idType === 'invalid') {
            (0, express_2.handleValidationError)(res, 'Invalid station ID format');
            return;
        }
        const station = await (0, station_lookup_1.findStationByEitherId)(stationIdParam, {
            select: { id: true }
        });
        if (!station) {
            (0, express_2.handleNotFound)(res, 'Station');
            return;
        }
        const updatedStation = await prisma.station.update({
            where: { id: station.id },
            data: {
                userReports: 0,
                updatedAt: new Date()
            }
        });
        const data = {
            success: true,
            stationId: station.id,
            userReports: updatedStation.userReports
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to reset user reports');
    }
});
router.post('/stations/:id/report', async (req, res) => {
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
        const updatedStation = await prisma.station.update({
            where: { id: station.id },
            data: {
                userReports: station.userReports + 1,
                updatedAt: new Date()
            }
        });
        console.log(`📢 User reported station not working: ${station.name} (${updatedStation.userReports} reports)`);
        const data = {
            success: true,
            message: 'Report submitted successfully',
            stationId: station.id,
            totalReports: updatedStation.userReports
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to submit user report');
    }
});
router.post('/scrape-url', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            (0, express_2.handleValidationError)(res, 'URL is required');
            return;
        }
        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;
        const response = await (0, node_fetch_1.default)(`${baseUrl}/scrape/business`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url })
        });
        if (response.ok) {
            const scrapedData = await response.json();
            if (scrapedData.success && scrapedData.data) {
                res.json({
                    success: true,
                    hasConflicts: false,
                    data: scrapedData.data,
                    source: scrapedData.source || 'website'
                });
            }
            else {
                res.json(scrapedData);
            }
        }
        else {
            throw new Error('Failed to scrape website');
        }
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to scrape website');
    }
});
router.post('/normalize-preview', async (req, res) => {
    try {
        const { genre, type, name, description } = req.body;
        const { GENRE_SYSTEM, isValidGenre } = await Promise.resolve().then(() => __importStar(require('../constants/genres')));
        const { suggestStationTypeForStation, isValidStationType } = await Promise.resolve().then(() => __importStar(require('../constants/stationTypes')));
        let suggestedGenre = null;
        let suggestedType = null;
        let suggestedSubgenres = [];
        if (genre) {
            const currentGenre = genre.toLowerCase();
            if (!isValidGenre(currentGenre)) {
                let bestMatch = null;
                let bestScore = 0;
                Object.entries(GENRE_SYSTEM).forEach(([key, info]) => {
                    const keywords = [key, info.name.toLowerCase(), ...info.subgenres];
                    const score = keywords.reduce((acc, keyword) => {
                        if (currentGenre.includes(keyword.toLowerCase())) {
                            return acc + (keyword.length / currentGenre.length);
                        }
                        return acc;
                    }, 0);
                    if (score > bestScore) {
                        bestScore = score;
                        bestMatch = key;
                    }
                });
                if (bestMatch && bestScore > 0.3) {
                    suggestedGenre = bestMatch;
                }
            }
        }
        const stationData = {
            name: name || '',
            description: description || '',
            genre: genre || '',
            subgenre: ''
        };
        const suggestedTypes = suggestStationTypeForStation(stationData);
        if (type) {
            const currentType = type.toLowerCase();
            if (!isValidStationType(currentType)) {
                if (suggestedTypes.length > 0) {
                    suggestedType = suggestedTypes[0];
                }
            }
        }
        else {
            if (suggestedTypes.length > 0) {
                suggestedType = suggestedTypes[0];
            }
        }
        const effectiveGenre = suggestedGenre || genre;
        if (effectiveGenre && GENRE_SYSTEM[effectiveGenre]) {
            suggestedSubgenres = GENRE_SYSTEM[effectiveGenre].subgenres.slice(0, 3);
        }
        const data = {
            genre: suggestedGenre,
            type: suggestedType,
            subgenres: suggestedSubgenres,
            allTypes: suggestedTypes,
            confidence: {
                genre: suggestedGenre ? 85 : 0,
                type: suggestedType ? 80 : 0
            }
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to get normalization suggestions');
    }
});
router.get('/constants/genres', async (req, res) => {
    try {
        const { GENRE_SYSTEM } = await Promise.resolve().then(() => __importStar(require('../constants/genres')));
        const response = {
            allGenres: Object.keys(GENRE_SYSTEM),
            genres: GENRE_SYSTEM
        };
        res.json(response);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to load genre constants');
    }
});
router.get('/constants/station-types', async (req, res) => {
    try {
        const { STATION_TYPES } = await Promise.resolve().then(() => __importStar(require('../constants/stationTypes')));
        const response = {
            allTypes: Object.keys(STATION_TYPES),
            stationTypes: STATION_TYPES
        };
        res.json(response);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to load station type constants');
    }
});
router.get('/constants/collection-tags', async (req, res) => {
    try {
        const { COLLECTION_TAGS } = await Promise.resolve().then(() => __importStar(require('../constants/collectionTags')));
        const response = {
            allTags: Object.keys(COLLECTION_TAGS),
            collectionTags: COLLECTION_TAGS
        };
        res.json(response);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to load collection tag constants');
    }
});
router.post('/test-metadata-url', async (req, res) => {
    try {
        const { url, format } = req.body;
        console.log(`🧪 Testing metadata URL: ${url} (format: ${format || 'auto'})`);
        if (url === 'automatic' || format === 'auto') {
            console.log('✅ Rogers Auto configuration detected');
            const data = {
                success: true,
                metadata: {
                    title: 'Rogers Auto Configuration',
                    artist: 'System Test',
                    song: 'Rogers API integration enabled'
                },
                message: 'Rogers Auto configuration is working. Metadata will be provided automatically during playback.'
            };
            res.json(data);
            return;
        }
        if (!url) {
            const data = {
                success: false,
                error: 'URL is required'
            };
            res.status(400).json(data);
            return;
        }
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await (0, node_fetch_1.default)(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Streemr-Admin-Test/1.0',
                'Accept': 'application/json, text/javascript, */*'
            }
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        const contentType = response.headers.get('content-type') || '';
        let data;
        const responseText = await response.text();
        if (format === 'jsonp' || url.includes('callback=')) {
            const jsonpMatch = responseText.match(/(?:callback|jsonpcallback|cb)\((.+)\);?$/);
            if (jsonpMatch) {
                data = JSON.parse(jsonpMatch[1]);
            }
            else {
                throw new Error('Invalid JSONP format');
            }
        }
        else if (format === 'json' || contentType.includes('json') || responseText.trim().startsWith('{')) {
            data = JSON.parse(responseText);
        }
        else if (format === 'xml' || contentType.includes('xml')) {
            const xmlData = {
                success: true,
                metadata: {
                    title: 'XML Response',
                    artist: 'Parsed Successfully',
                    song: 'XML format detected'
                },
                rawResponse: responseText.substring(0, 500) + '...'
            };
            res.json(xmlData);
            return;
        }
        else {
            try {
                data = JSON.parse(responseText);
            }
            catch {
                const textData = {
                    success: true,
                    metadata: {
                        title: 'Text Response',
                        artist: 'Parsed Successfully',
                        song: 'Text format detected'
                    },
                    rawResponse: responseText.substring(0, 500) + '...'
                };
                res.json(textData);
                return;
            }
        }
        let metadata = {};
        if (data.song_name && data.artist_name) {
            metadata = {
                title: data.song_name,
                artist: data.artist_name,
                song: `${data.artist_name} - ${data.song_name}`,
                artwork: data.itunes_img || data.image
            };
        }
        else if (data.title || data.artist || data.track) {
            metadata = {
                title: data.title || data.track || data.song,
                artist: data.artist || data.performer,
                song: data.song || (data.artist && data.title ? `${data.artist} - ${data.title}` : ''),
                album: data.album
            };
        }
        else if (data.data && (data.data.title || data.data.artist)) {
            metadata = {
                title: data.data.title,
                artist: data.data.artist,
                song: data.data.title && data.data.artist ? `${data.data.artist} - ${data.data.title}` : ''
            };
        }
        else {
            metadata = {
                title: 'Data Found',
                artist: 'Successfully Parsed',
                song: 'Metadata detected but format unknown'
            };
        }
        const resultData = {
            success: true,
            metadata,
            format: format || 'auto-detected',
            contentType
        };
        res.json(resultData);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to test metadata URL');
    }
});
exports.default = router;
