"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            return res.status(401).json({ error: 'Access token required' });
        }
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true }
        });
        if (!user) {
            return res.status(401).json({ error: 'Invalid token - user not found' });
        }
        req.user = { userId: decoded.userId };
        next();
    }
    catch (error) {
        console.error('Authentication error:', error);
        return res.status(401).json({ error: 'Invalid token' });
    }
};
router.get('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const favorites = await prisma.userFavorites.findMany({
            where: { userId },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true
                    }
                }
            },
            orderBy: {
                createdAt: 'desc'
            }
        });
        const favoritesWithStations = await Promise.all(favorites.map(async (favorite) => {
            const station = await prisma.station.findUnique({
                where: { id: favorite.stationId },
                select: {
                    id: true,
                    name: true,
                    country: true,
                    genre: true,
                    type: true,
                    streamUrl: true,
                    favicon: true,
                    logo: true,
                    homepage: true,
                    city: true,
                    state: true,
                    description: true,
                    language: true,
                    frequency: true,
                    bitrate: true,
                    codec: true,
                    isActive: true
                }
            });
            return {
                id: favorite.id,
                stationId: favorite.stationId,
                createdAt: favorite.createdAt,
                station: station
            };
        }));
        const validFavorites = favoritesWithStations.filter(fav => fav.station !== null);
        res.json({
            favorites: validFavorites,
            count: validFavorites.length
        });
    }
    catch (error) {
        console.error('Error fetching favorites:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.post('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { stationId } = req.body;
        if (!stationId || typeof stationId !== 'number') {
            return res.status(400).json({ error: 'Valid stationId is required' });
        }
        const station = await prisma.station.findUnique({
            where: { id: stationId },
            select: {
                id: true,
                name: true,
                country: true,
                genre: true,
                isActive: true
            }
        });
        if (!station) {
            return res.status(404).json({ error: 'Station not found' });
        }
        const existingFavorite = await prisma.userFavorites.findUnique({
            where: {
                userId_stationId: {
                    userId,
                    stationId
                }
            }
        });
        if (existingFavorite) {
            return res.status(409).json({ error: 'Station already in favorites' });
        }
        const favorite = await prisma.userFavorites.create({
            data: {
                userId,
                stationId
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true
                    }
                }
            }
        });
        res.status(201).json({
            message: 'Station added to favorites',
            favorite: {
                id: favorite.id,
                stationId: favorite.stationId,
                createdAt: favorite.createdAt,
                station: station
            }
        });
    }
    catch (error) {
        console.error('Error adding favorite:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
router.delete('/:stationId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const stationId = parseInt(req.params.stationId, 10);
        if (isNaN(stationId)) {
            return res.status(400).json({ error: 'Invalid stationId' });
        }
        const existingFavorite = await prisma.userFavorites.findUnique({
            where: {
                userId_stationId: {
                    userId,
                    stationId
                }
            }
        });
        if (!existingFavorite) {
            return res.status(404).json({ error: 'Favorite not found' });
        }
        await prisma.userFavorites.delete({
            where: {
                userId_stationId: {
                    userId,
                    stationId
                }
            }
        });
        res.json({ message: 'Station removed from favorites' });
    }
    catch (error) {
        console.error('Error removing favorite:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
exports.default = router;
