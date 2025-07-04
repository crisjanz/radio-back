import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const router = Router();
const prisma = new PrismaClient();

// Configure multer for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Helper function to get image path
const getImagePath = (stationId: number, extension: string = 'png') => {
  return path.join('public/station-images', `${stationId}.${extension}`);
};

// Helper function to get public URL for image
const getImageUrl = (stationId: number, extension: string = 'png') => {
  return `/station-images/${stationId}.${extension}`;
};

// Download and store favicon for a station
router.post('/download/:stationId', async (req: Request, res: Response) => {
  try {
    const stationId = parseInt(req.params.stationId);
    if (isNaN(stationId)) {
      return res.status(400).json({ error: 'Invalid station ID' });
    }

    const station = await prisma.station.findUnique({
      where: { id: stationId },
      select: { id: true, name: true, favicon: true, logo: true }
    });

    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    const imageUrl = station.favicon || station.logo;
    if (!imageUrl) {
      return res.status(400).json({ error: 'No favicon or logo URL found for station' });
    }

    console.log(`Downloading image for station ${stationId}: ${imageUrl}`);

    // Download the image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
      timeout: 10000,
    });

    if (!response.ok) {
      return res.status(400).json({ error: `Failed to download image: ${response.statusText}` });
    }

    const buffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(buffer);

    // Process image with Sharp - convert to PNG and optimize
    const outputPath = getImagePath(stationId, 'png');
    await sharp(imageBuffer)
      .png({ quality: 90 })
      .resize(256, 256, { 
        fit: 'inside',
        withoutEnlargement: false 
      })
      .toFile(outputPath);

    // Update database with local image path
    const imageUrl_local = getImageUrl(stationId, 'png');
    await prisma.station.update({
      where: { id: stationId },
      data: { favicon: imageUrl_local }
    });

    res.json({ 
      success: true, 
      imageUrl: imageUrl_local,
      originalUrl: imageUrl,
      stationName: station.name
    });
  } catch (error) {
    console.error('Download error:', error);
    res.status(500).json({ error: 'Failed to download and process image' });
  }
});

// Upload edited image for a station
router.post('/upload/:stationId', upload.single('image'), async (req: Request, res: Response) => {
  try {
    const stationId = parseInt(req.params.stationId);
    if (isNaN(stationId)) {
      return res.status(400).json({ error: 'Invalid station ID' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const station = await prisma.station.findUnique({
      where: { id: stationId },
      select: { id: true, name: true }
    });

    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    // Process uploaded image with Sharp
    const outputPath = getImagePath(stationId, 'png');
    await sharp(req.file.path)
      .png({ quality: 90 })
      .resize(256, 256, { 
        fit: 'inside',
        withoutEnlargement: false 
      })
      .toFile(outputPath);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Update database with local image path
    const imageUrl = getImageUrl(stationId, 'png');
    await prisma.station.update({
      where: { id: stationId },
      data: { favicon: imageUrl }
    });

    res.json({ 
      success: true, 
      imageUrl: imageUrl,
      stationName: station.name
    });
  } catch (error) {
    console.error('Upload error:', error);
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to upload and process image' });
  }
});

// Get stations with broken or missing favicons
router.get('/broken', async (req: Request, res: Response) => {
  try {
    const stations = await prisma.station.findMany({
      where: {
        OR: [
          { favicon: null },
          { favicon: '' },
          { favicon: { startsWith: 'http://' } } // HTTP URLs that might be broken on HTTPS sites
        ]
      },
      select: {
        id: true,
        name: true,
        country: true,
        favicon: true,
        logo: true
      },
      orderBy: { name: 'asc' }
    });

    res.json(stations);
  } catch (error) {
    console.error('Error fetching broken favicons:', error);
    res.status(500).json({ error: 'Failed to fetch stations with broken favicons' });
  }
});

// Batch download favicons for multiple stations
router.post('/batch-download', async (req: Request, res: Response) => {
  try {
    const { stationIds } = req.body;
    
    if (!Array.isArray(stationIds) || stationIds.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty station IDs array' });
    }

    const results = [];
    
    for (const stationId of stationIds) {
      try {
        const station = await prisma.station.findUnique({
          where: { id: parseInt(stationId) },
          select: { id: true, name: true, favicon: true, logo: true }
        });

        if (!station) {
          results.push({ stationId, success: false, error: 'Station not found' });
          continue;
        }

        const imageUrl = station.favicon || station.logo;
        if (!imageUrl) {
          results.push({ stationId, success: false, error: 'No favicon or logo URL' });
          continue;
        }

        // Download and process image
        const response = await fetch(imageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          },
          redirect: 'follow',
          timeout: 10000,
        });

        if (!response.ok) {
          results.push({ stationId, success: false, error: `Download failed: ${response.statusText}` });
          continue;
        }

        const buffer = await response.arrayBuffer();
        const imageBuffer = Buffer.from(buffer);

        // Process with Sharp
        const outputPath = getImagePath(station.id, 'png');
        await sharp(imageBuffer)
          .png({ quality: 90 })
          .resize(256, 256, { 
            fit: 'inside',
            withoutEnlargement: false 
          })
          .toFile(outputPath);

        // Update database
        const localImageUrl = getImageUrl(station.id, 'png');
        await prisma.station.update({
          where: { id: station.id },
          data: { favicon: localImageUrl }
        });

        results.push({ 
          stationId, 
          success: true, 
          imageUrl: localImageUrl,
          stationName: station.name 
        });
        
      } catch (error) {
        console.error(`Error processing station ${stationId}:`, error);
        results.push({ stationId, success: false, error: 'Processing failed' });
      }
    }

    res.json({ results });
  } catch (error) {
    console.error('Batch download error:', error);
    res.status(500).json({ error: 'Failed to process batch download' });
  }
});

// Get image info for a station
router.get('/info/:stationId', async (req: Request, res: Response) => {
  try {
    const stationId = parseInt(req.params.stationId);
    if (isNaN(stationId)) {
      return res.status(400).json({ error: 'Invalid station ID' });
    }

    const station = await prisma.station.findUnique({
      where: { id: stationId },
      select: { id: true, name: true, favicon: true, logo: true }
    });

    if (!station) {
      return res.status(404).json({ error: 'Station not found' });
    }

    // Check if local image exists
    const localImagePath = getImagePath(stationId, 'png');
    const hasLocalImage = fs.existsSync(localImagePath);

    res.json({
      station: {
        id: station.id,
        name: station.name,
        favicon: station.favicon,
        logo: station.logo
      },
      hasLocalImage,
      localImageUrl: hasLocalImage ? getImageUrl(stationId, 'png') : null
    });
  } catch (error) {
    console.error('Error fetching image info:', error);
    res.status(500).json({ error: 'Failed to fetch image info' });
  }
});

export default router;