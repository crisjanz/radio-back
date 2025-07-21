"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const express_2 = require("../types/express");
const router = express_1.default.Router();
router.get('/stream', async (req, res) => {
    try {
        const streamUrl = req.query.url;
        if (!streamUrl) {
            (0, express_2.handleValidationError)(res, 'Stream URL is required');
            return;
        }
        try {
            const url = new URL(streamUrl);
            if (!['http:', 'https:'].includes(url.protocol)) {
                (0, express_2.handleValidationError)(res, 'Invalid stream URL protocol');
                return;
            }
        }
        catch {
            (0, express_2.handleValidationError)(res, 'Invalid stream URL format');
            return;
        }
        console.log('📡 Proxying stream:', streamUrl);
        const response = await fetch(streamUrl, {
            headers: {
                'User-Agent': 'Streemr/1.0',
                'Accept': 'audio/*,*/*',
            },
            redirect: 'follow'
        });
        if (!response.ok) {
            console.error('Stream fetch failed:', response.status, response.statusText);
            res.status(response.status).json({
                error: `Stream not available: ${response.statusText}`
            });
            return;
        }
        res.setHeader('Content-Type', response.headers.get('Content-Type') || 'audio/mpeg');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'range');
        const contentLength = response.headers.get('Content-Length');
        if (contentLength) {
            res.setHeader('Content-Length', contentLength);
        }
        const range = req.headers.range;
        if (range && response.headers.get('Accept-Ranges') === 'bytes') {
            res.setHeader('Accept-Ranges', 'bytes');
        }
        if (response.body) {
            const reader = response.body.getReader();
            const pump = async () => {
                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done)
                            break;
                        if (!res.writableEnded) {
                            res.write(Buffer.from(value));
                        }
                        else {
                            break;
                        }
                    }
                    if (!res.writableEnded) {
                        res.end();
                    }
                }
                catch (error) {
                    console.error('Stream proxy error:', error);
                    if (!res.writableEnded) {
                        res.status(500).end();
                    }
                }
            };
            req.on('close', () => {
                reader.cancel();
            });
            pump();
        }
        else {
            res.status(500).json({ error: 'No stream data available' });
            return;
        }
    }
    catch (error) {
        console.error('Stream proxy error:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to proxy stream' });
        }
    }
});
exports.default = router;
