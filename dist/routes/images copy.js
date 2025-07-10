"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const multer_1 = __importDefault(require("multer"));
const sharp_1 = __importDefault(require("sharp"));
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const node_fetch_1 = __importDefault(require("node-fetch"));
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
const upload = (0, multer_1.default)({
    dest: 'uploads/',
    limits: { fileSize: 5 * 1024 * 1024 }
});
const getImagePath = (stationId, extension = 'png') => {
    return path_1.default.join('public/station-images', `${stationId}.${extension}`);
};
const getImageUrl = (stationId, extension = 'png') => {
    return `/station-images/${stationId}.${extension}`;
};
router.post('/download', async (req, res) => {
    try {
        const { url, size = 512 } = req.body;
        if (!url) {
            return res.status(400).json({ error: 'Image URL is required' });
        }
        console.log(`Downloading image for preview: ${url}`);
        const response = await (0, node_fetch_1.default)(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            },
            redirect: 'follow',
            timeout: 10000,
        });
        if (!response.ok) {
            return res.status(400).json({ error: `Failed to download image: ${response.statusText}` });
        }
        const buffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(buffer);
        const maxSize = Math.min(parseInt(size), 1024);
        const metadata = await (0, sharp_1.default)(imageBuffer).metadata();
        console.log(`Original image: ${metadata.width}x${metadata.height}, requested: ${maxSize}x${maxSize}`);
        const processedImageBuffer = await (0, sharp_1.default)(imageBuffer)
            .png({ quality: 90 })
            .resize(maxSize, maxSize, {
            fit: 'inside',
            withoutEnlargement: false
        })
            .toBuffer();
        const base64Image = `data:image/png;base64,${processedImageBuffer.toString('base64')}`;
        res.json({
            success: true,
            imageData: base64Image,
            originalUrl: url,
            dimensions: {
                width: Math.min(metadata.width || maxSize, maxSize),
                height: Math.min(metadata.height || maxSize, maxSize),
                original: {
                    width: metadata.width,
                    height: metadata.height
                }
            }
        });
    }
    catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to download and process image' });
    }
});
router.post('/download/:stationId', async (req, res) => {
    try {
        const stationId = parseInt(req.params.stationId);
        if (isNaN(stationId)) {
            return res.status(400).json({ error: 'Invalid station ID' });
        }
        const station = await prisma.station.findUnique({
            where: { id: stationId },
            select: { id: true, name: true, favicon: true, logo: true }
        });
        if (!station) {
            return res.status(404).json({ error: 'Station not found' });
        }
        let imageUrl;
        if (station.favicon && !station.favicon.startsWith('/station-images/')) {
            imageUrl = station.favicon;
        }
        else if (station.logo && !station.logo.startsWith('/station-images/')) {
            imageUrl = station.logo;
        }
        else {
            imageUrl = station.favicon || station.logo;
        }
        if (!imageUrl) {
            return res.status(400).json({ error: 'No favicon or logo URL found for station' });
        }
        if (imageUrl.startsWith('/station-images/') && req.query.force === 'true') {
            return res.status(400).json({
                error: 'No original external URL available for re-download. The original URL was overwritten when the image was first downloaded.'
            });
        }
        const isForceRedownload = req.query.force === 'true';
        console.log(`${isForceRedownload ? 'Re-downloading' : 'Downloading'} image for station ${stationId}: ${imageUrl}`);
        const response = await (0, node_fetch_1.default)(imageUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
            },
            redirect: 'follow',
            timeout: 10000,
        });
        if (!response.ok) {
            return res.status(400).json({ error: `Failed to download image: ${response.statusText}` });
        }
        const buffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(buffer);
        const requestedSize = parseInt(req.query.size) || 512;
        const maxSize = Math.min(requestedSize, 1024);
        const metadata = await (0, sharp_1.default)(imageBuffer).metadata();
        console.log(`Original image: ${metadata.width}x${metadata.height}, requested: ${maxSize}x${maxSize}`);
        const outputPath = getImagePath(stationId, 'png');
        const shouldResize = (metadata.width && metadata.width > maxSize) ||
            (metadata.height && metadata.height > maxSize) ||
            req.query.resize === 'true';
        if (shouldResize) {
            await (0, sharp_1.default)(imageBuffer)
                .png({ quality: 90 })
                .resize(maxSize, maxSize, {
                fit: 'inside',
                withoutEnlargement: false
            })
                .toFile(outputPath);
        }
        else {
            await (0, sharp_1.default)(imageBuffer)
                .png({ quality: 90 })
                .toFile(outputPath);
        }
        const imageUrl_local = getImageUrl(stationId, 'png');
        const updateData = { favicon: imageUrl_local };
        if (!station.logo && imageUrl !== imageUrl_local) {
            updateData.logo = imageUrl;
        }
        await prisma.station.update({
            where: { id: stationId },
            data: updateData
        });
        const finalMetadata = await (0, sharp_1.default)(outputPath).metadata();
        res.json({
            success: true,
            imageUrl: imageUrl_local,
            originalUrl: imageUrl,
            stationName: station.name,
            dimensions: {
                width: finalMetadata.width,
                height: finalMetadata.height,
                original: {
                    width: metadata.width,
                    height: metadata.height
                }
            }
        });
    }
    catch (error) {
        console.error('Download error:', error);
        res.status(500).json({ error: 'Failed to download and process image' });
    }
});
router.post('/upload/:stationId', upload.single('image'), async (req, res) => {
    try {
        const stationId = parseInt(req.params.stationId);
        if (isNaN(stationId)) {
            return res.status(400).json({ error: 'Invalid station ID' });
        }
        if (!req.file) {
            return res.status(400).json({ error: 'No image file provided' });
        }
        const station = await prisma.station.findUnique({
            where: { id: stationId },
            select: { id: true, name: true }
        });
        if (!station) {
            return res.status(404).json({ error: 'Station not found' });
        }
        const outputPath = getImagePath(stationId, 'png');
        await (0, sharp_1.default)(req.file.path)
            .png({ quality: 90 })
            .resize(256, 256, {
            fit: 'inside',
            withoutEnlargement: false
        })
            .toFile(outputPath);
        fs_1.default.unlinkSync(req.file.path);
        const imageUrl = getImageUrl(stationId, 'png');
        await prisma.station.update({
            where: { id: stationId },
            data: { favicon: imageUrl }
        });
        res.json({
            success: true,
            imageUrl: imageUrl,
            stationName: station.name
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        if (req.file && fs_1.default.existsSync(req.file.path)) {
            fs_1.default.unlinkSync(req.file.path);
        }
        res.status(500).json({ error: 'Failed to upload and process image' });
    }
});
router.get('/broken', async (req, res) => {
    try {
        const stations = await prisma.station.findMany({
            where: {
                OR: [
                    { favicon: null },
                    { favicon: '' },
                    { favicon: { startsWith: 'http://' } }
                ]
            },
            select: {
                id: true,
                name: true,
                country: true,
                favicon: true,
                logo: true
            },
            orderBy: { name: 'asc' }
        });
        res.json(stations);
    }
    catch (error) {
        console.error('Error fetching broken favicons:', error);
        res.status(500).json({ error: 'Failed to fetch stations with broken favicons' });
    }
});
router.post('/batch-download', async (req, res) => {
    try {
        const { stationIds } = req.body;
        if (!Array.isArray(stationIds) || stationIds.length === 0) {
            return res.status(400).json({ error: 'Invalid or empty station IDs array' });
        }
        const results = [];
        for (const stationId of stationIds) {
            try {
                const station = await prisma.station.findUnique({
                    where: { id: parseInt(stationId) },
                    select: { id: true, name: true, favicon: true, logo: true }
                });
                if (!station) {
                    results.push({ stationId, success: false, error: 'Station not found' });
                    continue;
                }
                const imageUrl = station.favicon || station.logo;
                if (!imageUrl) {
                    results.push({ stationId, success: false, error: 'No favicon or logo URL' });
                    continue;
                }
                const response = await (0, node_fetch_1.default)(imageUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                    },
                    redirect: 'follow',
                    timeout: 10000,
                });
                if (!response.ok) {
                    results.push({ stationId, success: false, error: `Download failed: ${response.statusText}` });
                    continue;
                }
                const buffer = await response.arrayBuffer();
                const imageBuffer = Buffer.from(buffer);
                const outputPath = getImagePath(station.id, 'png');
                await (0, sharp_1.default)(imageBuffer)
                    .png({ quality: 90 })
                    .resize(256, 256, {
                    fit: 'inside',
                    withoutEnlargement: false
                })
                    .toFile(outputPath);
                const localImageUrl = getImageUrl(station.id, 'png');
                await prisma.station.update({
                    where: { id: station.id },
                    data: { favicon: localImageUrl }
                });
                results.push({
                    stationId,
                    success: true,
                    imageUrl: localImageUrl,
                    stationName: station.name
                });
            }
            catch (error) {
                console.error(`Error processing station ${stationId}:`, error);
                results.push({ stationId, success: false, error: 'Processing failed' });
            }
        }
        res.json({ results });
    }
    catch (error) {
        console.error('Batch download error:', error);
        res.status(500).json({ error: 'Failed to process batch download' });
    }
});
router.get('/info/:stationId', async (req, res) => {
    try {
        const stationId = parseInt(req.params.stationId);
        if (isNaN(stationId)) {
            return res.status(400).json({ error: 'Invalid station ID' });
        }
        const station = await prisma.station.findUnique({
            where: { id: stationId },
            select: { id: true, name: true, favicon: true, logo: true }
        });
        if (!station) {
            return res.status(404).json({ error: 'Station not found' });
        }
        const localImagePath = getImagePath(stationId, 'png');
        const hasLocalImage = fs_1.default.existsSync(localImagePath);
        res.json({
            station: {
                id: station.id,
                name: station.name,
                favicon: station.favicon,
                logo: station.logo
            },
            hasLocalImage,
            localImageUrl: hasLocalImage ? getImageUrl(stationId, 'png') : null
        });
    }
    catch (error) {
        console.error('Error fetching image info:', error);
        res.status(500).json({ error: 'Failed to fetch image info' });
    }
});
exports.default = router;
