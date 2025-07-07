import { Request, Response, NextFunction } from 'express';

// Memory monitoring and emergency cleanup
export class MemoryMonitor {
  private static instance: MemoryMonitor;
  private isMonitoring = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private emergencyCleanupCallbacks: (() => void)[] = [];
  
  // Memory thresholds (in MB)
  private readonly WARNING_THRESHOLD = 350; // 68% of 512MB
  private readonly CRITICAL_THRESHOLD = 400; // 78% of 512MB
  private readonly EMERGENCY_THRESHOLD = 450; // 88% of 512MB
  
  static getInstance(): MemoryMonitor {
    if (!MemoryMonitor.instance) {
      MemoryMonitor.instance = new MemoryMonitor();
    }
    return MemoryMonitor.instance;
  }
  
  private constructor() {
    this.startMonitoring();
  }
  
  // Register cleanup callback for emergency situations
  registerCleanupCallback(callback: () => void) {
    this.emergencyCleanupCallbacks.push(callback);
  }
  
  // Get current memory usage in MB
  getMemoryUsage() {
    const usage = process.memoryUsage();
    return {
      heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
      heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
      external: Math.round(usage.external / 1024 / 1024),
      rss: Math.round(usage.rss / 1024 / 1024)
    };
  }
  
  // Check if memory usage is critical
  isMemoryCritical(): boolean {
    const usage = this.getMemoryUsage();
    return usage.heapUsed > this.CRITICAL_THRESHOLD;
  }
  
  // Force garbage collection if available
  private forceGarbageCollection() {
    if (global.gc) {
      console.log('🗑️ Forcing garbage collection...');
      global.gc();
    } else {
      console.log('⚠️ Garbage collection not available (start with --expose-gc)');
    }
  }
  
  // Emergency cleanup when memory is critically high
  private performEmergencyCleanup() {
    console.log('🚨 EMERGENCY: Memory usage critical, performing cleanup...');
    
    // Run all registered cleanup callbacks
    this.emergencyCleanupCallbacks.forEach((callback, index) => {
      try {
        callback();
        console.log(`✅ Emergency cleanup ${index + 1} completed`);
      } catch (error) {
        console.error(`❌ Emergency cleanup ${index + 1} failed:`, error);
      }
    });
    
    // Force garbage collection
    this.forceGarbageCollection();
    
    // Log memory after cleanup
    setTimeout(() => {
      const afterUsage = this.getMemoryUsage();
      console.log(`🩺 Memory after emergency cleanup: ${afterUsage.heapUsed}MB`);
    }, 1000);
  }
  
  // Start monitoring memory usage
  private startMonitoring() {
    if (this.isMonitoring) return;
    
    this.isMonitoring = true;
    console.log('🩺 Memory monitoring started');
    
    // Check memory every 30 seconds
    this.monitoringInterval = setInterval(() => {
      const usage = this.getMemoryUsage();
      
      if (usage.heapUsed > this.EMERGENCY_THRESHOLD) {
        this.performEmergencyCleanup();
      } else if (usage.heapUsed > this.CRITICAL_THRESHOLD) {
        console.log(`⚠️ Memory usage critical: ${usage.heapUsed}MB (threshold: ${this.CRITICAL_THRESHOLD}MB)`);
        this.forceGarbageCollection();
      } else if (usage.heapUsed > this.WARNING_THRESHOLD) {
        console.log(`📊 Memory usage high: ${usage.heapUsed}MB`);
      }
    }, 30000);
  }
  
  // Stop monitoring
  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    this.isMonitoring = false;
    console.log('🩺 Memory monitoring stopped');
  }
  
  // Middleware for memory logging on high usage requests
  middleware() {
    return (req: Request, res: Response, next: NextFunction) => {
      const usage = this.getMemoryUsage();
      
      // Log memory usage for metadata requests when high
      if (req.path.includes('/metadata') && usage.heapUsed > this.WARNING_THRESHOLD) {
        console.log(`📊 Memory during metadata request: ${usage.heapUsed}MB - ${req.path}`);
      }
      
      // Block new metadata requests if memory is critical
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

// Export singleton instance
export const memoryMonitor = MemoryMonitor.getInstance();