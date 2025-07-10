"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryMonitor = exports.MemoryMonitor = void 0;
class MemoryMonitor {
    static getInstance() {
        if (!MemoryMonitor.instance) {
            MemoryMonitor.instance = new MemoryMonitor();
        }
        return MemoryMonitor.instance;
    }
    constructor() {
        this.isMonitoring = false;
        this.monitoringInterval = null;
        this.emergencyCleanupCallbacks = [];
        this.WARNING_THRESHOLD = 350;
        this.CRITICAL_THRESHOLD = 400;
        this.EMERGENCY_THRESHOLD = 450;
        this.startMonitoring();
    }
    registerCleanupCallback(callback) {
        this.emergencyCleanupCallbacks.push(callback);
    }
    getMemoryUsage() {
        const usage = process.memoryUsage();
        return {
            heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
            heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
            external: Math.round(usage.external / 1024 / 1024),
            rss: Math.round(usage.rss / 1024 / 1024)
        };
    }
    isMemoryCritical() {
        const usage = this.getMemoryUsage();
        return usage.heapUsed > this.CRITICAL_THRESHOLD;
    }
    forceGarbageCollection() {
        if (global.gc) {
            console.log('🗑️ Forcing garbage collection...');
            global.gc();
        }
        else {
            console.log('⚠️ Garbage collection not available (start with --expose-gc)');
        }
    }
    performEmergencyCleanup() {
        console.log('🚨 EMERGENCY: Memory usage critical, performing cleanup...');
        this.emergencyCleanupCallbacks.forEach((callback, index) => {
            try {
                callback();
                console.log(`✅ Emergency cleanup ${index + 1} completed`);
            }
            catch (error) {
                console.error(`❌ Emergency cleanup ${index + 1} failed:`, error);
            }
        });
        this.forceGarbageCollection();
        setTimeout(() => {
            const afterUsage = this.getMemoryUsage();
            console.log(`🩺 Memory after emergency cleanup: ${afterUsage.heapUsed}MB`);
        }, 1000);
    }
    startMonitoring() {
        if (this.isMonitoring)
            return;
        this.isMonitoring = true;
        console.log('🩺 Memory monitoring started');
        this.monitoringInterval = setInterval(() => {
            const usage = this.getMemoryUsage();
            if (usage.heapUsed > this.EMERGENCY_THRESHOLD) {
                this.performEmergencyCleanup();
            }
            else if (usage.heapUsed > this.CRITICAL_THRESHOLD) {
                console.log(`⚠️ Memory usage critical: ${usage.heapUsed}MB (threshold: ${this.CRITICAL_THRESHOLD}MB)`);
                this.forceGarbageCollection();
            }
            else if (usage.heapUsed > this.WARNING_THRESHOLD) {
                console.log(`📊 Memory usage high: ${usage.heapUsed}MB`);
            }
        }, 30000);
    }
    stopMonitoring() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.isMonitoring = false;
        console.log('🩺 Memory monitoring stopped');
    }
    middleware() {
        return (req, res, next) => {
            const usage = this.getMemoryUsage();
            if (req.path.includes('/metadata') && usage.heapUsed > this.WARNING_THRESHOLD) {
                console.log(`📊 Memory during metadata request: ${usage.heapUsed}MB - ${req.path}`);
            }
            if (req.path.includes('/metadata') && usage.heapUsed > this.EMERGENCY_THRESHOLD) {
                console.log('🚫 Blocking metadata request due to critical memory usage');
                return res.status(503).json({
                    error: 'Service temporarily unavailable due to high memory usage',
                    retryAfter: 60
                });
            }
            next();
        };
    }
}
exports.MemoryMonitor = MemoryMonitor;
exports.memoryMonitor = MemoryMonitor.getInstance();
