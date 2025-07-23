import express, { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import nodemailer from 'nodemailer';
import { PrismaClient } from '@prisma/client';
import { handleError, handleNotFound, handleValidationError } from '../types/express';

const router = express.Router();
const prisma = new PrismaClient();

// JWT Secret (in production, use a proper secret from environment)
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';

// Email configuration (you'll need to set these environment variables)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// Helper function to generate JWT token
const generateToken = (userId: number) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

// Signup endpoint
router.post('/signup', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      handleValidationError(res, 'Email and password are required');
      return;
    }

    if (password.length < 6) {
      handleValidationError(res, 'Password must be at least 6 characters');
      return;
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (existingUser) {
      handleValidationError(res, 'User already exists with this email');
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create user
    const user = await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: hashedPassword,
      },
      select: {
        id: true,
        email: true,
        createdAt: true,
      }
    });

    // Generate token
    const token = generateToken(user.id);

    const data = {
      message: 'User created successfully',
      user,
      token
    };
    res.status(201).json(data);

  } catch (error) {
    handleError(res, error, 'Signup failed');
  }
});

// Login endpoint
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      handleValidationError(res, 'Email and password are required');
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    // Generate token
    const token = generateToken(user.id);

    const data = {
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        createdAt: user.createdAt,
      },
      token
    };
    res.json(data);

  } catch (error) {
    handleError(res, error, 'Login failed');
  }
});

// Password reset request
router.post('/reset-password', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email } = req.body;

    if (!email) {
      handleValidationError(res, 'Email is required');
      return;
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() }
    });

    if (!user) {
      // Don't reveal if email exists or not
      const data = { message: 'If the email exists, a reset link has been sent' };
      res.json(data);
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

    // Save reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      }
    });

    // Send email (only if SMTP is configured)
    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/reset-password?token=${resetToken}`;
      
      await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: user.email,
        subject: 'Streemr - Password Reset',
        html: `
          <h2>Password Reset Request</h2>
          <p>You requested a password reset for your Streemr account.</p>
          <p>Click the link below to reset your password:</p>
          <a href="${resetUrl}">Reset Password</a>
          <p>This link will expire in 1 hour.</p>
          <p>If you didn't request this, please ignore this email.</p>
        `
      });
    }

    const data = { message: 'If the email exists, a reset link has been sent' };
    res.json(data);

  } catch (error) {
    handleError(res, error, 'Password reset failed');
  }
});

// Confirm password reset
router.post('/reset-password/confirm', async (req: Request, res: Response): Promise<void> => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      handleValidationError(res, 'Token and password are required');
      return;
    }

    if (password.length < 6) {
      handleValidationError(res, 'Password must be at least 6 characters');
      return;
    }

    // Find user with valid reset token
    const user = await prisma.user.findFirst({
      where: {
        resetToken: token,
        resetTokenExpiry: {
          gt: new Date()
        }
      }
    });

    if (!user) {
      handleValidationError(res, 'Invalid or expired reset token');
      return;
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Update password and clear reset token
    await prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      }
    });

    const data = { message: 'Password reset successful' };
    res.json(data);

  } catch (error) {
    handleError(res, error, 'Password reset confirmation failed');
  }
});

// Verify token endpoint (for checking if user is logged in)
router.get('/verify', async (req: Request, res: Response): Promise<void> => {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      res.status(401).json({ error: 'No token provided' });
      return;
    }

    const decoded = jwt.verify(token, JWT_SECRET) as { userId: number };
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        createdAt: true,
      }
    });

    if (!user) {
      res.status(401).json({ error: 'Invalid token' });
      return;
    }

    const data = { user };
    res.json(data);

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({ error: 'Invalid token' });
  }
});

export default router;