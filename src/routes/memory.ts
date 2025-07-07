import { Router, Request, Response } from 'express';
import { memoryMonitor } from '../middleware/memoryMonitor.js';

const router = Router();

// Get current memory usage statistics
router.get('/', async (req: Request, res: Response) => {
  try {
    const usage = memoryMonitor.getMemoryUsage();
    const processUptime = Math.floor(process.uptime());
    const isCritical = memoryMonitor.isMemoryCritical();
    
    // Calculate memory usage percentages (assuming 512MB free tier)
    const totalMemoryMB = 512;
    const usagePercentage = Math.round((usage.heapUsed / totalMemoryMB) * 100);
    
    // Determine status based on thresholds
    let status = 'healthy';
    let statusColor = 'green';
    
    if (usage.heapUsed > 400) {
      status = 'critical';
      statusColor = 'red';
    } else if (usage.heapUsed > 350) {
      status = 'warning';
      statusColor = 'orange';
    } else if (usage.heapUsed > 250) {
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
  } catch (error) {
    console.error('❌ Error fetching memory stats:', error);
    return res.status(500).json({ 
      success: false, 
      error: error instanceof Error ? error.message : 'Failed to fetch memory stats' 
    });
  }
});

// Format uptime in human readable format
function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  
  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);
  
  return parts.join(' ');
}

export default router;