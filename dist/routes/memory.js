"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const memoryMonitor_js_1 = require("../middleware/memoryMonitor.js");
const router = (0, express_1.Router)();
router.get('/', async (req, res) => {
    try {
        const usage = memoryMonitor_js_1.memoryMonitor.getMemoryUsage();
        const processUptime = Math.floor(process.uptime());
        const isCritical = memoryMonitor_js_1.memoryMonitor.isMemoryCritical();
        const totalMemoryMB = 512;
        const usagePercentage = Math.round((usage.heapUsed / totalMemoryMB) * 100);
        let status = 'healthy';
        let statusColor = 'green';
        if (usage.heapUsed > 400) {
            status = 'critical';
            statusColor = 'red';
        }
        else if (usage.heapUsed > 350) {
            status = 'warning';
            statusColor = 'orange';
        }
        else if (usage.heapUsed > 250) {
            status = 'elevated';
            statusColor = 'yellow';
        }
        return res.json({
            success: true,
            memory: {
                heapUsed: usage.heapUsed,
                heapTotal: usage.heapTotal,
                external: usage.external,
                rss: usage.rss,
                usagePercentage,
                totalMemoryMB,
                status,
                statusColor,
                isCritical
            },
            server: {
                uptime: processUptime,
                uptimeFormatted: formatUptime(processUptime),
                nodeVersion: process.version,
                platform: process.platform
            },
            thresholds: {
                healthy: '< 250 MB',
                elevated: '250-350 MB',
                warning: '350-400 MB',
                critical: '> 400 MB'
            }
        });
    }
    catch (error) {
        console.error('❌ Error fetching memory stats:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to fetch memory stats'
        });
    }
});
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    const parts = [];
    if (days > 0)
        parts.push(`${days}d`);
    if (hours > 0)
        parts.push(`${hours}h`);
    if (minutes > 0)
        parts.push(`${minutes}m`);
    if (secs > 0 || parts.length === 0)
        parts.push(`${secs}s`);
    return parts.join(' ');
}
exports.default = router;
