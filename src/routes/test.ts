import { Router, Request, Response } from 'express';
import { handleError } from '../types/express';

const router = Router();

// GET /api/test/ping - returns server status and timestamp
router.get('/ping', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = {
      message: "Local backend is working!",
      timestamp: Date.now(),
      server: "LOCAL"
    };
    
    res.json(data);
  } catch (error) {
    handleError(res, error, 'Test ping failed');
  }
});

// GET /api/test/env - returns environment information
router.get('/env', async (req: Request, res: Response): Promise<void> => {
  try {
    const data = {
      environment: process.env.NODE_ENV || 'development',
      port: process.env.PORT || '3001'
    };
    
    res.json(data);
  } catch (error) {
    handleError(res, error, 'Test env failed');
  }
});

export default router;