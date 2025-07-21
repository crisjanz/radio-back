"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const express_2 = require("../types/express");
const router = (0, express_1.Router)();
router.get('/ping', async (req, res) => {
    try {
        const data = {
            message: "Local backend is working!",
            timestamp: Date.now(),
            server: "LOCAL"
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Test ping failed');
    }
});
router.get('/env', async (req, res) => {
    try {
        const data = {
            environment: process.env.NODE_ENV || 'development',
            port: process.env.PORT || '3001'
        };
        res.json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Test env failed');
    }
});
exports.default = router;
