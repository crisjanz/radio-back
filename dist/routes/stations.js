"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
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
        const [stations, total] = await Promise.all([
            prisma.station.findMany({
                skip,
                take: limit,
                orderBy: { id: 'asc' }
            }),
            prisma.station.count()
        ]);
        if (req.query.page || req.query.limit) {
            res.json({
                stations,
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit)
            });
            return;
        }
        else {
            const allStations = await prisma.station.findMany();
            res.json(allStations);
            return;
        }
    }
    catch (error) {
        console.error('❌ Error fetching stations:', error);
        res.status(500).json({ error: 'Failed to fetch stations' });
        return;
    }
});
router.get('/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query || query.trim().length < 2) {
            res.status(400).json({ error: 'Search query must be at least 2 characters long' });
            return;
        }
        const searchTerm = query.trim();
        console.log(`🔍 Searching stations for: "${searchTerm}"`);
        const stations = await prisma.station.findMany({
            where: {
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
        console.error('❌ Error searching stations:', error);
        res.status(500).json({ error: 'Failed to search stations' });
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
        res.json({
            total,
            active: total,
            withImages,
            recentImports
        });
    }
    catch (error) {
        console.error('Error getting database stats:', error);
        res.status(500).json({ error: 'Failed to get database stats' });
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
        console.error('❌ Error fetching countries:', error);
        res.status(500).json({ error: 'Failed to fetch countries' });
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
        console.error('❌ Error fetching genres:', error);
        res.status(500).json({ error: 'Failed to fetch genres' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid station ID' });
            return;
        }
        const updateData = req.body;
        const cleanedData = Object.fromEntries(Object.entries(updateData).filter(([_, value]) => value !== undefined && value !== ''));
        const updatedStation = await prisma.station.update({
            where: { id },
            data: cleanedData
        });
        res.json(updatedStation);
    }
    catch (error) {
        console.error('❌ Error updating station:', error);
        res.status(500).json({ error: 'Failed to update station' });
    }
});
router.get('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid station ID' });
            return;
        }
        const station = await prisma.station.findUnique({
            where: { id }
        });
        if (!station) {
            res.status(404).json({ error: 'Station not found' });
            return;
        }
        res.json(station);
    }
    catch (error) {
        console.error('❌ Error fetching station:', error);
        res.status(500).json({ error: 'Failed to fetch station' });
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
                return res.status(409).json({
                    error: 'Station already exists',
                    duplicate: true,
                    existingStation: existing
                });
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
                console.error('❌ Fallback creation also failed:', fallbackError);
                res.status(500).json({ error: 'Failed to create station' });
                return;
            }
        }
        res.status(500).json({ error: 'Failed to create station' });
    }
});
router.put('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid station ID' });
            return;
        }
        const station = await prisma.station.update({
            where: { id },
            data: req.body
        });
        res.json(station);
    }
    catch (error) {
        console.error('❌ Error updating station:', error);
        res.status(500).json({ error: 'Failed to update station' });
    }
});
router.delete('/:id', async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (isNaN(id)) {
            res.status(400).json({ error: 'Invalid station ID' });
            return;
        }
        await prisma.station.delete({
            where: { id }
        });
        res.json({ success: true });
    }
    catch (error) {
        console.error('❌ Error deleting station:', error);
        res.status(500).json({ error: 'Failed to delete station' });
    }
});
exports.default = router;
