import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import { PrismaClient } from '@prisma/client';

// Import modular route handlers
import stationRoutes from './routes/stations.js';
import metadataRoutes from './routes/metadata.js';
import importRoutes from './routes/import.js';
import adminRoutes from './routes/admin.js';
import scrapingRoutes from './routes/scraping.js';
import healthRoutes from './routes/health.js';
import authRoutes from './routes/auth.js';
import favoritesRoutes from './routes/favorites.js';
import testRoutes from './routes/test.js';

const app = express();
const prisma = new PrismaClient();

// Middleware
app.use(cors());
app.use(express.json());

// Route handlers
app.use('/stations', stationRoutes);
app.use('/metadata', metadataRoutes);
app.use('/import', importRoutes);
app.use('/admin', adminRoutes);
app.use('/scrape', scrapingRoutes);
app.use('/health', healthRoutes);
app.use('/auth', authRoutes);
app.use('/api/favorites', favoritesRoutes);
app.use('/api/test', testRoutes);

app.get('/ping', async (req, res) => {
  try {
    const count = await prisma.station.count(); // ✅ FIXED
    res.json({ ok: true, stations: count });
  } catch (err) {
    console.error('Ping DB failed:', err);
    res.status(500).json({ ok: false, error: 'DB error' });
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

// Error handling for unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught Exception:', error);
  process.exit(1);
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
  console.log("   • /metadata - Stream metadata endpoints");
  console.log("   • /import - Radio Browser import endpoints");
  console.log("   • /admin - Admin and normalization endpoints");
  console.log("   • /scrape - Web scraping endpoints");
  console.log("   • /health - Stream health checking endpoints");
  console.log("   • /auth - Authentication endpoints");
  console.log("   • /api/favorites - User favorites endpoints");
  console.log("   • /api/test - Test endpoints for development");
  console.log("   • /favicon/:stationId - Favicon proxy for HTTPS compatibility");
});
