import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import { findStationByEitherId, parseStationIdParam, createStationFeedback, getStationFeedback, getStationReferenceFields } from '../utils/station-lookup';

const router = Router();
const prisma = new PrismaClient();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Optional authentication middleware - doesn't require login but extracts user if present
const optionalAuth = async (req: any, res: any, next: any) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (token) {
      const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, email: true }
      });
      if (user) {
        req.user = user;
      }
    }
  } catch (error) {
    // Ignore token errors for optional auth
  }
  next();
};

// Rate limiting for feedback submissions
const feedbackLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Limit each IP to 10 feedback submissions per windowMs
  message: { error: 'Too many feedback submissions, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for anonymous feedback (stricter)
const anonymousFeedbackLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit anonymous users to 5 submissions per hour
  message: { error: 'Too many feedback submissions, please register or try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Submit feedback for a station
router.post('/stations/:stationId', optionalAuth, feedbackLimiter, async (req, res) => {
  try {
    const { stationId } = req.params;
    const { feedbackType, details } = req.body;
    const userId = (req as any).user?.id; // From auth middleware if logged in

    // Validate feedback type
    const validTypes = [
      'stream_not_working',
      'poor_audio_quality', 
      'wrong_information',
      'great_station',
      'song_info_missing'
    ];

    if (!validTypes.includes(feedbackType)) {
      return res.status(400).json({ error: 'Invalid feedback type' });
    }

    // Check if station exists using dual lookup
    const station = await findStationByEitherId(stationId);

    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    // For anonymous users, apply stricter rate limiting
    if (!userId) {
      anonymousFeedbackLimiter(req, res, async () => {
        await submitFeedback();
      });
    } else {
      await submitFeedback();
    }

    async function submitFeedback() {
      // Check for duplicate feedback from same user/IP within last hour
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const clientIp = req.ip || req.connection.remoteAddress || 'unknown';
      
      // Get station reference fields for database operations
      const stationRefs = await getStationReferenceFields(stationId);
      if (!stationRefs) {
        return res.status(404).json({ error: 'Station not found' });
      }

      const existingFeedback = await prisma.stationFeedback.findFirst({
        where: {
          OR: [
            { stationId: stationRefs.stationId },
            ...(stationRefs.stationNanoid ? [{ stationNanoid: stationRefs.stationNanoid }] : [])
          ],
          feedbackType,
          createdAt: { gte: oneHourAgo },
          ...(userId ? { userId } : { ipAddress: clientIp })
        }
      });

      if (existingFeedback) {
        return res.status(429).json({ 
          error: 'You have already submitted this type of feedback for this station recently' 
        });
      }

      // Create feedback entry using dual reference utility
      const feedback = await createStationFeedback(stationId, {
        userId: userId || null,
        feedbackType,
        details: details || null,
        ipAddress: userId ? null : clientIp, // Only store IP for anonymous users
      });

      // Update station quality metrics
      await updateStationQualityScore(station.id);

      res.status(201).json({ 
        success: true, 
        message: 'Feedback submitted successfully',
        feedbackId: feedback.id 
      });
    }

  } catch (error) {
    console.error('Error submitting feedback:', error);
    res.status(500).json({ error: 'Failed to submit feedback' });
  }
});

// Get station feedback summary (for admin or public stats) - supports both numeric and nanoid
router.get('/stations/:stationId/summary', async (req, res) => {
  try {
    const { stationId } = req.params;

    // Find station using dual lookup
    const station = await findStationByEitherId(stationId, {
      select: {
        id: true,
        nanoid: true,
        qualityScore: true,
        feedbackCount: true
      }
    });

    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    // Get feedback using dual reference lookup
    const feedbackList = await getStationFeedback(stationId);
    
    // Group feedback by type
    const feedbackSummary = feedbackList.reduce((acc, feedback) => {
      acc[feedback.feedbackType] = (acc[feedback.feedbackType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    res.json({
      feedbackSummary,
      qualityScore: station.qualityScore,
      totalFeedback: station.feedbackCount || 0
    });

  } catch (error) {
    console.error('Error fetching feedback summary:', error);
    res.status(500).json({ error: 'Failed to fetch feedback summary' });
  }
});

// Quality scoring algorithm
async function updateStationQualityScore(stationId: number) {
  try {
    // Get all feedback for this station
    const feedbackCounts = await prisma.stationFeedback.groupBy({
      by: ['feedbackType'],
      where: { stationId },
      _count: { feedbackType: true }
    });

    const counts = feedbackCounts.reduce((acc, item) => {
      acc[item.feedbackType] = item._count.feedbackType;
      return acc;
    }, {} as Record<string, number>);

    // Calculate total feedback count
    const totalFeedback = Object.values(counts).reduce((sum, count) => sum + count, 0);
    
    if (totalFeedback === 0) {
      return; // No feedback yet, don't update score
    }

    // Get station metadata info
    const station = await prisma.station.findUnique({
      where: { id: stationId },
      select: { metadataApiUrl: true }
    });

    // Calculate quality score based on your algorithm
    const streamReliability = ((counts.great_station || 0) / totalFeedback) * 30;
    const audioQuality = (1 - ((counts.poor_audio_quality || 0) / totalFeedback)) * 25;
    const informationAccuracy = (1 - ((counts.wrong_information || 0) / totalFeedback)) * 20;
    const userSatisfaction = ((counts.great_station || 0) / totalFeedback) * 15;
    const metadataRichness = (station?.metadataApiUrl || (counts.song_info_missing || 0) === 0) ? 10 : 0;

    const qualityScore = Math.max(0, Math.min(100, 
      streamReliability + audioQuality + informationAccuracy + userSatisfaction + metadataRichness
    ));

    // Update station with new quality score
    await prisma.station.update({
      where: { id: stationId },
      data: {
        qualityScore: Math.round(qualityScore * 100) / 100, // Round to 2 decimal places
        feedbackCount: totalFeedback,
        // Auto-hide stations with very low scores and significant feedback
        isActive: qualityScore >= 60 || totalFeedback < 5 // Keep active unless score < 60% with 5+ feedback
      }
    });

  } catch (error) {
    console.error('Error updating station quality score:', error);
  }
}

// Get user's feedback history (for logged-in users)
router.get('/user/history', async (req, res) => {
  try {
    const userId = (req as any).user?.id;
    
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userFeedback = await prisma.stationFeedback.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50 // Limit to last 50 feedback items
    });

    // Get station info separately using dual lookup
    const feedbackWithStations = await Promise.all(
      userFeedback.map(async (feedback) => {
        let station = null;
        
        // Try nanoid first, fallback to stationId
        if (feedback.stationNanoid) {
          station = await prisma.station.findUnique({
            where: { nanoid: feedback.stationNanoid },
            select: { id: true, nanoid: true, name: true }
          });
        }
        
        if (!station && feedback.stationId) {
          station = await prisma.station.findUnique({
            where: { id: feedback.stationId },
            select: { id: true, nanoid: true, name: true }
          });
        }
        
        return { ...feedback, station };
      })
    );

    res.json(feedbackWithStations);

  } catch (error) {
    console.error('Error fetching user feedback history:', error);
    res.status(500).json({ error: 'Failed to fetch feedback history' });
  }
});

// Admin: Get feedback for moderation
router.get('/admin/pending', async (req, res) => {
  try {
    // This would need admin authentication middleware
    const pendingFeedback = await prisma.stationFeedback.findMany({
      where: { 
        resolved: false,
        feedbackType: { in: ['stream_not_working', 'wrong_information'] }
      },
      include: {
        user: {
          select: { email: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Get station info separately using dual lookup
    const feedbackWithStations = await Promise.all(
      pendingFeedback.map(async (feedback) => {
        let station = null;
        
        // Try nanoid first, fallback to stationId
        if (feedback.stationNanoid) {
          station = await prisma.station.findUnique({
            where: { nanoid: feedback.stationNanoid },
            select: { id: true, nanoid: true, name: true, isActive: true }
          });
        }
        
        if (!station && feedback.stationId) {
          station = await prisma.station.findUnique({
            where: { id: feedback.stationId },
            select: { id: true, nanoid: true, name: true, isActive: true }
          });
        }
        
        return { ...feedback, station };
      })
    );

    res.json(feedbackWithStations);

  } catch (error) {
    console.error('Error fetching pending feedback:', error);
    res.status(500).json({ error: 'Failed to fetch pending feedback' });
  }
});

// Admin: Mark feedback as resolved
router.patch('/admin/:feedbackId/resolve', async (req, res) => {
  try {
    const { feedbackId } = req.params;
    
    await prisma.stationFeedback.update({
      where: { id: parseInt(feedbackId) },
      data: { resolved: true }
    });

    res.json({ success: true });

  } catch (error) {
    console.error('Error resolving feedback:', error);
    res.status(500).json({ error: 'Failed to resolve feedback' });
  }
});

export default router;