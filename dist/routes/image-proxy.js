"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const node_fetch_1 = __importDefault(require("node-fetch"));
const sharp_1 = __importDefault(require("sharp"));
const router = (0, express_1.Router)();
const imageCache = new Map();
const CACHE_DURATION = 24 * 60 * 60 * 1000;
router.get('/proxy', async (req, res) => {
    try {
        const { url, w, h, q } = req.query;
        if (!url || typeof url !== 'string') {
            return res.status(400).json({ error: 'URL parameter is required' });
        }
        let parsedUrl;
        try {
            parsedUrl = new URL(url);
        }
        catch {
            return res.status(400).json({ error: 'Invalid URL' });
        }
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return res.status(400).json({ error: 'Only HTTP/HTTPS URLs allowed' });
        }
        const hostname = parsedUrl.hostname.toLowerCase();
        if (hostname === 'localhost' ||
            hostname.startsWith('127.') ||
            hostname.startsWith('10.') ||
            hostname.startsWith('172.') ||
            hostname.startsWith('192.168.') ||
            hostname === '0.0.0.0') {
            return res.status(400).json({ error: 'Internal URLs not allowed' });
        }
        if (url.includes('supabase.co')) {
            return res.redirect(url);
        }
        const cacheKey = `${url}_${w || 'auto'}_${h || 'auto'}_${q || '80'}`;
        const cached = imageCache.get(cacheKey);
        if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
            res.set('Content-Type', cached.contentType);
            res.set('Cache-Control', 'public, max-age=86400');
            return res.send(cached.buffer);
        }
        const response = await (0, node_fetch_1.default)(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; StreamrBot/1.0)',
            },
            timeout: 10000,
        });
        if (!response.ok) {
            return res.status(404).json({ error: 'Image not found' });
        }
        let contentType = response.headers.get('content-type');
        if (!contentType || !contentType.startsWith('image/')) {
            console.warn(`Invalid content type for image URL ${url}: ${contentType}`);
            return res.status(400).json({ error: 'URL does not point to an image' });
        }
        const contentLength = response.headers.get('content-length');
        if (contentLength && parseInt(contentLength) > 2 * 1024 * 1024) {
            return res.status(413).json({ error: 'Image too large' });
        }
        const buffer = await response.arrayBuffer();
        let imageBuffer = Buffer.from(buffer);
        if (imageBuffer.length > 2 * 1024 * 1024) {
            return res.status(413).json({ error: 'Image too large' });
        }
        const width = w ? parseInt(w) : undefined;
        const height = h ? parseInt(h) : undefined;
        const quality = q ? parseInt(q) : 80;
        if (width || height || quality !== 80) {
            try {
                let sharpImage = (0, sharp_1.default)(imageBuffer);
                const metadata = await sharpImage.metadata();
                if (!metadata.format) {
                    throw new Error('Unsupported image format');
                }
                if (width || height) {
                    sharpImage = sharpImage.resize(width, height, {
                        fit: 'inside',
                        withoutEnlargement: true
                    });
                }
                const acceptHeader = req.headers.accept || '';
                if (acceptHeader.includes('image/webp')) {
                    imageBuffer = await sharpImage.webp({ quality }).toBuffer();
                    contentType = 'image/webp';
                }
                else {
                    imageBuffer = await sharpImage.jpeg({ quality }).toBuffer();
                    contentType = 'image/jpeg';
                }
            }
            catch (error) {
                console.warn(`Image optimization failed for ${url}:`, error.message);
            }
        }
        imageCache.set(cacheKey, {
            buffer: imageBuffer,
            contentType,
            timestamp: Date.now()
        });
        if (imageCache.size > 1000) {
            const entries = Array.from(imageCache.entries());
            const oldEntries = entries.filter(([, data]) => (Date.now() - data.timestamp) > CACHE_DURATION);
            oldEntries.forEach(([key]) => imageCache.delete(key));
        }
        res.set('Content-Type', contentType);
        res.set('Cache-Control', 'public, max-age=86400');
        res.send(imageBuffer);
    }
    catch (error) {
        console.error('Image proxy error:', error);
        res.status(500).json({ error: 'Failed to proxy image' });
    }
});
exports.default = router;
