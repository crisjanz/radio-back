import { Router, Request, Response } from 'express';

const router = Router();

// GET /api/test/ping - returns server status and timestamp
router.get('/ping', async (req: Request, res: Response) => {
  try {
    return res.json({
      message: "Local backend is working!",
      timestamp: Date.now(),
      server: "LOCAL"
    });
  } catch (error) {
    console.error('❌ Error in test ping endpoint:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Test ping failed' 
    });
  }
});

// GET /api/test/env - returns environment information
router.get('/env', async (req: Request, res: Response) => {
  try {
    return res.json({
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || '3001'
    });
  } catch (error) {
    console.error('❌ Error in test env endpoint:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Test env failed' 
    });
  }
});

export default router;