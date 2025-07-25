import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

// Import modular route handlers
import stationRoutes from './routes/stations.js';
import metadataRoutes from './routes/metadata.js';
import importRoutes from './routes/import.js';
import iheartRoutes from './routes/iheart.js';
import adminRoutes from './routes/admin.js';
import scrapingRoutes from './routes/scraping.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import favoritesRoutes from './routes/favorites.js';
import testRoutes from './routes/test.js';
import imageRoutes from './routes/images.js';
import imageProxyRoutes from './routes/image-proxy.js';
import memoryRoutes from './routes/memory.js';
import feedbackRoutes from './routes/feedback.js';
import tracksRoutes from './routes/tracks.js';
import musicLinksRoutes from './routes/music-links.js';
import { memoryMonitor } from './middleware/memoryMonitor.js';
import path from 'path';


const app = express();
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

app.use(express.static(path.join(__dirname, '..', 'public')));

// Middleware
app.use(cors());
app.use(express.json());
app.use(memoryMonitor.middleware());

// Serve static images and files
app.use('/station-images', express.static('public/station-images'));
app.use('/public', express.static('public'));
app.use('/js', express.static('public/js'));
app.use('/components', express.static('public/components'));

// Route handlers
app.use('/stations', stationRoutes);
app.use('/metadata', metadataRoutes);
app.use('/import', importRoutes);
app.use('/iheart', iheartRoutes);
app.use('/admin', adminRoutes);
app.use('/scrape', scrapingRoutes);
app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/test', testRoutes);
app.use('/images', imageRoutes);
app.use('/image-proxy', imageProxyRoutes);
app.use('/memory', memoryRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/tracks', tracksRoutes);
app.use('/api/music-links', musicLinksRoutes);

// Admin routes for static HTML pages
app.get('/admin/stations', (req: Request, res: Response) => {
  res.sendFile('admin-stations.html', { root: 'public' });
});

app.get('/admin/stations/edit', (req: Request, res: Response) => {
  res.sendFile('admin-stations-edit.html', { root: 'public' });
});

app.get('/admin/memory', (req: Request, res: Response) => {
  res.sendFile('admin-memory.html', { root: 'public' });
});

app.get('/admin/simple-image-editor', (req: Request, res: Response) => {
  res.sendFile('simple-image-editor.html', { root: 'public' });
});

app.get('/admin/stations/import', (req: Request, res: Response) => {
  res.sendFile('admin-stations-import.html', { root: 'public' });
});
app.get('/admin/iheart-import', (req: Request, res: Response) => {
  res.sendFile('admin-iheart-import.html', { root: 'public' });
});

app.get('/admin/cleanup', (req: Request, res: Response) => {
  res.sendFile('admin-cleanup.html', { root: 'public' });
});

app.get('/admin/logo-manager', (req: Request, res: Response) => {
  res.sendFile('admin-logo-manager.html', { root: 'public' });
});

app.get('/ping', async (req, res) => {
  try {
    // Simple ping without database access for keep-alive
    const uptime = process.uptime();
    const timestamp = new Date().toISOString();
    res.json({ 
      ok: true, 
      timestamp,
      uptime: Math.round(uptime),
      message: 'Backend is alive'
    });
  } catch (err) {
    console.error('Ping failed:', err);
    res.status(500).json({ ok: false, error: 'Ping error' });
  }
});


// Legacy route endpoints for backward compatibility
app.get('/stations/countries', async (req: Request, res: Response) => {
  try {
    const countries = await prisma.station.groupBy({
      by: ['country'],
      _count: true,
      orderBy: {
        _count: {
          country: 'desc'
        }
      }
    });

    const formattedCountries = countries.map(country => ({
      country: country.country,
      count: country._count
    }));

    res.json(formattedCountries);
  } catch (error) {
    console.error('❌ Error fetching countries:', error);
    res.status(500).json({ error: 'Failed to fetch countries' });
  }
});

app.get('/stations/genres', async (req: Request, res: Response) => {
  try {
    const genres = await prisma.station.groupBy({
      by: ['genre'],
      _count: true,
      where: {
        genre: {
          not: null
        }
      },
      orderBy: {
        _count: {
          genre: 'desc'
        }
      }
    });

    const formattedGenres = genres.map(genre => ({
      genre: genre.genre,
      count: genre._count
    }));

    res.json(formattedGenres);
  } catch (error) {
    console.error('❌ Error fetching genres:', error);
    res.status(500).json({ error: 'Failed to fetch genres' });
  }
});

// Health check endpoint
app.get("/", (req: Request, res: Response) => {
  res.send("Radio backend is working!");
});

// Graceful shutdown handler
const gracefulShutdown = async () => {
  console.log('🔄 Received shutdown signal, closing connections...');
  try {
    await prisma.$disconnect();
    console.log('✅ Prisma connection closed successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Error handling for unhandled promise rejections  
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  // In Express 5, we should handle these more gracefully
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  // Don't exit for EPIPE errors from child processes
  if (error.code === 'EPIPE') {
    console.log('🔧 EPIPE error caught and handled - continuing server operation');
    return;
  }
  // For other critical errors, still exit gracefully
  console.error('💥 Critical error - shutting down server gracefully');
  gracefulShutdown();
});

// Register cleanup callback for emergency memory situations
memoryMonitor.registerCleanupCallback(() => {
  console.log('🧹 Emergency cleanup: Clearing metadata request cache');
  // This will be imported and used to clear the cache
  try {
    // Import and clear the active requests map
    require('./services/metadata/extractors/icecast.js').clearActiveRequests?.();
  } catch (error) {
    console.log('⚠️ Could not clear metadata cache:', error);
  }
});

// Start server
const PORT = parseInt(process.env.PORT || '3001', 10);
const HOST = process.env.NODE_ENV === 'production' ? '0.0.0.0' : '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`✅ Server is running on http://${HOST}:${PORT}`);
  if (process.env.NODE_ENV !== 'production') {
    console.log("📱 Mobile access: http://192.168.1.69:3001");
  }
  console.log("🔗 Available routes:");
  console.log("   • /stations - Station CRUD operations");
  console.log("   • /metadata - Icecast metadata detection");
  console.log("   • /import - Radio Browser import endpoints");
  console.log("   • /iheart - iHeart Radio import endpoints");
  console.log("   • /admin - Admin dashboard and management");
  console.log("   • /health - Stream health checking endpoints");
  console.log("   • /auth - Authentication endpoints");
  console.log("   • /api/favorites - User favorites endpoints");
  console.log("   • /api/feedback - Station feedback and rating system");
  console.log("   • /images - Image management and processing endpoints");
  console.log("   • /memory - Memory monitoring endpoints");
  console.log("   • /station-images - Static image serving");
});
