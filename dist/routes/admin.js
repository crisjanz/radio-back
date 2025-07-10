"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const node_fetch_1 = __importDefault(require("node-fetch"));
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
        return res.json({
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
        });
    }
    catch (error) {
        console.error('❌ Error in admin base endpoint:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Admin service error'
        });
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
        return res.json({
            stations,
            pendingChanges: []
        });
    }
    catch (error) {
        console.error('❌ Error fetching stations for normalization:', error);
        return res.status(500).json({ error: 'Failed to fetch stations' });
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
                country: true
            }
        });
        const pendingChanges = [];
        const genreRules = [
            { keywords: ['rock'], normalized: 'rock' },
            { keywords: ['country'], normalized: 'country' },
            { keywords: ['pop'], normalized: 'pop' },
            { keywords: ['jazz'], normalized: 'jazz' },
            { keywords: ['blues'], normalized: 'blues' },
            { keywords: ['classical'], normalized: 'classical' },
            { keywords: ['electronic', 'dance', 'edm'], normalized: 'electronic' },
            { keywords: ['hip', 'rap'], normalized: 'hip-hop' },
            { keywords: ['folk'], normalized: 'folk' },
            { keywords: ['christian', 'religious', 'gospel'], normalized: 'christian' },
            { keywords: ['oldies', 'classic hits', '60s', '70s', '80s', '90s'], normalized: 'oldies' },
            { keywords: ['alternative', 'indie'], normalized: 'alternative' }
        ];
        const typeRules = [
            { keywords: ['news'], normalized: 'news' },
            { keywords: ['talk'], normalized: 'talk' },
            { keywords: ['sport', 'espn'], normalized: 'sport' }
        ];
        for (const station of stations) {
            if (station.genre) {
                const genre = station.genre.toLowerCase();
                for (const rule of genreRules) {
                    if (rule.keywords.some(keyword => genre.includes(keyword)) && genre !== rule.normalized) {
                        const existingChange = pendingChanges.find(c => c.stationId === station.id && c.field === 'genre');
                        if (!existingChange) {
                            pendingChanges.push({
                                stationId: station.id,
                                field: 'genre',
                                original: station.genre,
                                suggested: rule.normalized,
                                status: 'pending'
                            });
                        }
                        break;
                    }
                }
            }
            if (station.type) {
                const type = station.type.toLowerCase();
                for (const rule of typeRules) {
                    if (rule.keywords.some(keyword => type.includes(keyword)) && type !== rule.normalized) {
                        const existingChange = pendingChanges.find(c => c.stationId === station.id && c.field === 'type');
                        if (!existingChange) {
                            pendingChanges.push({
                                stationId: station.id,
                                field: 'type',
                                original: station.type,
                                suggested: rule.normalized,
                                status: 'pending'
                            });
                        }
                        break;
                    }
                }
                if (!typeRules.some(rule => rule.keywords.some(keyword => type.includes(keyword))) && type !== 'music') {
                    const existingChange = pendingChanges.find(c => c.stationId === station.id && c.field === 'type');
                    if (!existingChange) {
                        pendingChanges.push({
                            stationId: station.id,
                            field: 'type',
                            original: station.type,
                            suggested: 'music',
                            status: 'pending'
                        });
                    }
                }
            }
            else {
                pendingChanges.push({
                    stationId: station.id,
                    field: 'type',
                    original: null,
                    suggested: 'music',
                    status: 'pending'
                });
            }
        }
        console.log(`🔍 Analysis complete: found ${pendingChanges.length} suggested changes`);
        return res.json({ pendingChanges });
    }
    catch (error) {
        console.error('❌ Error analyzing stations:', error);
        return res.status(500).json({ error: 'Failed to analyze stations' });
    }
});
router.post('/stations/apply-normalization', async (req, res) => {
    try {
        const { changes } = req.body;
        if (!Array.isArray(changes)) {
            return res.status(400).json({ error: 'Changes must be an array' });
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
        return res.json({ updated });
    }
    catch (error) {
        console.error('❌ Error applying normalization:', error);
        return res.status(500).json({ error: 'Failed to apply changes' });
    }
});
router.get('/normalization-rules', async (req, res) => {
    return res.json([]);
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
        return res.json({
            total: totalStations,
            withGenre: stationsWithGenre,
            withType: stationsWithType,
            countries: countryCounts.length,
            genres: genreCounts.length,
            types: typeCounts.length,
            topCountries: countryCounts.slice(0, 5),
            topGenres: genreCounts.slice(0, 10),
            topTypes: typeCounts.slice(0, 5)
        });
    }
    catch (error) {
        console.error('❌ Error fetching admin stats:', error);
        return res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});
router.patch('/stations/:id/toggle', async (req, res) => {
    try {
        const stationId = parseInt(req.params.id);
        const { isActive, adminNotes } = req.body;
        const station = await prisma.station.findUnique({
            where: { id: stationId }
        });
        if (!station) {
            return res.status(404).json({ error: 'Station not found' });
        }
        const updatedStation = await prisma.station.update({
            where: { id: stationId },
            data: {
                isActive: isActive !== undefined ? isActive : !station.isActive,
                adminNotes: adminNotes || station.adminNotes,
                userReports: 0,
                updatedAt: new Date()
            }
        });
        console.log(`🔧 Admin ${updatedStation.isActive ? 'enabled' : 'disabled'} station: ${station.name}`);
        return res.json({
            success: true,
            station: {
                id: updatedStation.id,
                name: updatedStation.name,
                isActive: updatedStation.isActive,
                adminNotes: updatedStation.adminNotes
            }
        });
    }
    catch (error) {
        console.error('❌ Error toggling station status:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to toggle station status'
        });
    }
});
router.patch('/stations/:id/notes', async (req, res) => {
    try {
        const stationId = parseInt(req.params.id);
        const { adminNotes } = req.body;
        const updatedStation = await prisma.station.update({
            where: { id: stationId },
            data: {
                adminNotes,
                updatedAt: new Date()
            }
        });
        return res.json({
            success: true,
            stationId,
            adminNotes: updatedStation.adminNotes
        });
    }
    catch (error) {
        console.error('❌ Error updating admin notes:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to update admin notes'
        });
    }
});
router.patch('/stations/:id/reset-reports', async (req, res) => {
    try {
        const stationId = parseInt(req.params.id);
        const updatedStation = await prisma.station.update({
            where: { id: stationId },
            data: {
                userReports: 0,
                updatedAt: new Date()
            }
        });
        return res.json({
            success: true,
            stationId,
            userReports: updatedStation.userReports
        });
    }
    catch (error) {
        console.error('❌ Error resetting user reports:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to reset user reports'
        });
    }
});
router.post('/stations/:id/report', async (req, res) => {
    try {
        const stationId = parseInt(req.params.id);
        const station = await prisma.station.findUnique({
            where: { id: stationId }
        });
        if (!station) {
            return res.status(404).json({ error: 'Station not found' });
        }
        const updatedStation = await prisma.station.update({
            where: { id: stationId },
            data: {
                userReports: station.userReports + 1,
                updatedAt: new Date()
            }
        });
        console.log(`📢 User reported station not working: ${station.name} (${updatedStation.userReports} reports)`);
        return res.json({
            success: true,
            message: 'Report submitted successfully',
            stationId,
            totalReports: updatedStation.userReports
        });
    }
    catch (error) {
        console.error('❌ Error submitting user report:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to submit report'
        });
    }
});
router.post('/scrape-url', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
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
        console.error('❌ Error scraping URL:', error);
        res.status(500).json({ error: 'Failed to scrape website' });
    }
});
router.post('/normalize-preview', async (req, res) => {
    try {
        const { genre, type, name } = req.body;
        const genreRules = [
            { keywords: ['rock'], normalized: 'rock' },
            { keywords: ['country'], normalized: 'country' },
            { keywords: ['pop'], normalized: 'pop' },
            { keywords: ['jazz'], normalized: 'jazz' },
            { keywords: ['blues'], normalized: 'blues' },
            { keywords: ['classical'], normalized: 'classical' },
            { keywords: ['electronic', 'dance', 'edm'], normalized: 'electronic' },
            { keywords: ['hip', 'rap'], normalized: 'hip-hop' },
            { keywords: ['folk'], normalized: 'folk' },
            { keywords: ['christian', 'religious', 'gospel'], normalized: 'christian' },
            { keywords: ['oldies', 'classic hits', '60s', '70s', '80s', '90s'], normalized: 'oldies' },
            { keywords: ['alternative', 'indie'], normalized: 'alternative' }
        ];
        const typeRules = [
            { keywords: ['news'], normalized: 'news' },
            { keywords: ['talk'], normalized: 'talk' },
            { keywords: ['sport', 'espn'], normalized: 'sport' }
        ];
        let suggestedGenre = null;
        let suggestedType = null;
        if (genre) {
            const genreText = genre.toLowerCase();
            for (const rule of genreRules) {
                if (rule.keywords.some(keyword => genreText.includes(keyword)) && genreText !== rule.normalized) {
                    suggestedGenre = rule.normalized;
                    break;
                }
            }
        }
        if (type) {
            const typeText = type.toLowerCase();
            for (const rule of typeRules) {
                if (rule.keywords.some(keyword => typeText.includes(keyword)) && typeText !== rule.normalized) {
                    suggestedType = rule.normalized;
                    break;
                }
            }
            if (!suggestedType && !typeRules.some(rule => rule.keywords.some(keyword => typeText.includes(keyword))) && typeText !== 'music') {
                suggestedType = 'music';
            }
        }
        else {
            suggestedType = 'music';
        }
        res.json({
            genre: suggestedGenre,
            type: suggestedType
        });
    }
    catch (error) {
        console.error('❌ Error getting normalization preview:', error);
        res.status(500).json({ error: 'Failed to get normalization suggestions' });
    }
});
exports.default = router;
