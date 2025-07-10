"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const locationDetection_1 = require("../utils/locationDetection");
const router = (0, express_1.Router)();
router.get('/detect', async (req, res) => {
    try {
        const startTime = Date.now();
        const ipAddress = (0, locationDetection_1.getClientIP)(req);
        console.log(`🌍 Detecting location for IP: ${ipAddress}`);
        const locationInfo = await (0, locationDetection_1.detectUserLocation)(req);
        const processingTime = Date.now() - startTime;
        console.log(`   ✅ Location detected: ${locationInfo.country} (${locationInfo.countryCode}) - ${processingTime}ms - Confidence: ${locationInfo.confidence}`);
        const nearbyCountries = (0, locationDetection_1.getNearbyCountries)(locationInfo.countryCode);
        res.json({
            success: true,
            location: locationInfo,
            nearbyCountries,
            processingTime,
            ip: ipAddress,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('❌ Error detecting location:', error);
        res.json({
            success: false,
            location: {
                country: 'United States',
                countryCode: 'US',
                confidence: 0.1,
                error: 'Location detection failed'
            },
            nearbyCountries: ['CA', 'MX'],
            processingTime: 0,
            ip: 'unknown',
            timestamp: new Date().toISOString()
        });
    }
});
router.get('/country/:code', async (req, res) => {
    try {
        const countryCode = req.params.code.toUpperCase();
        if (!countryCode || countryCode.length !== 2) {
            res.status(400).json({ error: 'Invalid country code. Must be 2 characters.' });
            return;
        }
        const nearbyCountries = (0, locationDetection_1.getNearbyCountries)(countryCode);
        res.json({
            countryCode,
            nearbyCountries,
            timestamp: new Date().toISOString()
        });
    }
    catch (error) {
        console.error('❌ Error getting country info:', error);
        res.status(500).json({ error: 'Failed to get country information' });
    }
});
router.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'location-detection',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
exports.default = router;
