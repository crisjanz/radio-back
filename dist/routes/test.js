"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
router.get('/ping', async (req, res) => {
    try {
        return res.json({
            message: "Local backend is working!",
            timestamp: Date.now(),
            server: "LOCAL"
        });
    }
    catch (error) {
        console.error('❌ Error in test ping endpoint:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Test ping failed'
        });
    }
});
router.get('/env', async (req, res) => {
    try {
        return res.json({
            environment: process.env.NODE_ENV || 'development',
            port: process.env.PORT || '3001'
        });
    }
    catch (error) {
        console.error('❌ Error in test env endpoint:', error);
        return res.status(500).json({
            error: error instanceof Error ? error.message : 'Test env failed'
        });
    }
});
exports.default = router;
