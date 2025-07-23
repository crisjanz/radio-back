"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const client_1 = require("@prisma/client");
const express_2 = require("../types/express");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this';
const transporter = nodemailer_1.default.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});
const generateToken = (userId) => {
    return jsonwebtoken_1.default.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};
router.post('/signup', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            (0, express_2.handleValidationError)(res, 'Email and password are required');
            return;
        }
        if (password.length < 6) {
            (0, express_2.handleValidationError)(res, 'Password must be at least 6 characters');
            return;
        }
        const existingUser = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });
        if (existingUser) {
            (0, express_2.handleValidationError)(res, 'User already exists with this email');
            return;
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
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
        const token = generateToken(user.id);
        const data = {
            message: 'User created successfully',
            user,
            token
        };
        res.status(201).json(data);
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Signup failed');
    }
});
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            (0, express_2.handleValidationError)(res, 'Email and password are required');
            return;
        }
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });
        if (!user) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            res.status(401).json({ error: 'Invalid email or password' });
            return;
        }
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
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Login failed');
    }
});
router.post('/reset-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            (0, express_2.handleValidationError)(res, 'Email is required');
            return;
        }
        const user = await prisma.user.findUnique({
            where: { email: email.toLowerCase() }
        });
        if (!user) {
            const data = { message: 'If the email exists, a reset link has been sent' };
            res.json(data);
            return;
        }
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        const resetTokenExpiry = new Date(Date.now() + 3600000);
        await prisma.user.update({
            where: { id: user.id },
            data: {
                resetToken,
                resetTokenExpiry,
            }
        });
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
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Password reset failed');
    }
});
router.post('/reset-password/confirm', async (req, res) => {
    try {
        const { token, password } = req.body;
        if (!token || !password) {
            (0, express_2.handleValidationError)(res, 'Token and password are required');
            return;
        }
        if (password.length < 6) {
            (0, express_2.handleValidationError)(res, 'Password must be at least 6 characters');
            return;
        }
        const user = await prisma.user.findFirst({
            where: {
                resetToken: token,
                resetTokenExpiry: {
                    gt: new Date()
                }
            }
        });
        if (!user) {
            (0, express_2.handleValidationError)(res, 'Invalid or expired reset token');
            return;
        }
        const hashedPassword = await bcryptjs_1.default.hash(password, 12);
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
    }
    catch (error) {
        (0, express_2.handleError)(res, error, 'Password reset confirmation failed');
    }
});
router.get('/verify', async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1];
        if (!token) {
            res.status(401).json({ error: 'No token provided' });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
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
    }
    catch (error) {
        console.error('Token verification error:', error);
        res.status(401).json({ error: 'Invalid token' });
    }
});
exports.default = router;
