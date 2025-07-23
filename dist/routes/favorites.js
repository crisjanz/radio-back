"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_1 = require("@prisma/client");
const station_lookup_1 = require("../utils/station-lookup");
const express_2 = require("../types/express");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const authenticateToken = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        const token = authHeader && authHeader.split(' ')[1];
        if (!token) {
            res.status(401).json({ error: 'Access token required' });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        const user = await prisma.user.findUnique({
            where: { id: decoded.userId },
            select: { id: true }
        });
        if (!user) {
            res.status(401).json({ error: 'Invalid token - user not found' });
            return;
        }
        req.user = { userId: decoded.userId };
        next();
    }
    catch (error) {
        console.error('Authentication error:', error);
        res.status(401).json({ error: 'Invalid token' });
        return;
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
            let station = null;
            if (favorite.stationNanoid) {
                station = await prisma.station.findUnique({
                    where: { nanoid: favorite.stationNanoid },
                    select: {
                        id: true,
                        nanoid: true,
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
            }
            if (!station && favorite.stationId) {
                station = await prisma.station.findUnique({
                    where: { id: favorite.stationId },
                    select: {
                        id: true,
                        nanoid: true,
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
            }
            return {
                id: favorite.id,
                stationId: favorite.stationId,
                stationNanoid: favorite.stationNanoid,
                createdAt: favorite.createdAt,
                station: station
            };
        }));
        const validFavorites = favoritesWithStations.filter(fav => fav.station !== null);
        const data = {
            favorites: validFavorites,
            count: validFavorites.length
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to fetch favorites');
    }
});
router.post('/', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const { stationId } = req.body;
        if (!stationId) {
            (0, express_2.handleValidationError)(res, 'stationId is required');
            return;
        }
        const stationIdParam = stationId.toString();
        const station = await (0, station_lookup_1.findStationByEitherId)(stationIdParam, {
            select: {
                id: true,
                nanoid: true,
                name: true,
                country: true,
                genre: true,
                isActive: true
            }
        });
        if (!station) {
            (0, express_2.handleNotFound)(res, 'Station');
            return;
        }
        const existingFavorite = await (0, station_lookup_1.findUserFavoriteByStationId)(userId, stationIdParam);
        if (existingFavorite) {
            res.status(409).json({ error: 'Station already in favorites' });
            return;
        }
        const favorite = await (0, station_lookup_1.toggleUserFavorite)(userId, stationIdParam, 'add');
        const data = {
            message: 'Station added to favorites',
            favorite: {
                id: favorite.id,
                stationId: favorite.stationId,
                stationNanoid: favorite.stationNanoid,
                createdAt: favorite.createdAt,
                station: station
            }
        };
        res.status(201).json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to add favorite');
    }
});
router.delete('/:stationId', authenticateToken, async (req, res) => {
    try {
        const userId = req.user.userId;
        const stationIdParam = req.params.stationId;
        const { idType } = (0, station_lookup_1.parseStationIdParam)({ params: { id: stationIdParam } });
        if (idType === 'invalid') {
            (0, express_2.handleValidationError)(res, 'Invalid stationId format');
            return;
        }
        const existingFavorite = await (0, station_lookup_1.findUserFavoriteByStationId)(userId, stationIdParam);
        if (!existingFavorite) {
            (0, express_2.handleNotFound)(res, 'Favorite');
            return;
        }
        await (0, station_lookup_1.toggleUserFavorite)(userId, stationIdParam, 'remove');
        const data = { message: 'Station removed from favorites' };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Failed to remove favorite');
    }
});
exports.default = router;
