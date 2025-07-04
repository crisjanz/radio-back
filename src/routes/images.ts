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

    // For re-downloads, prefer external URLs over local paths
    let imageUrl;
    
    // Try to find an external URL (not starting with /station-images)
    if (station.favicon && !station.favicon.startsWith('/station-images/')) {
      imageUrl = station.favicon;
    } else if (station.logo && !station.logo.startsWith('/station-images/')) {
      imageUrl = station.logo;
    } else {
      // If both are local paths or empty, use the favicon (might be local)
      imageUrl = station.favicon || station.logo;
    }
    
    if (!imageUrl) {
      return res.status(400).json({ error: 'No favicon or logo URL found for station' });
    }
    
    // If we still have a local path and this is a force re-download, show helpful error
    if (imageUrl.startsWith('/station-images/') && req.query.force === 'true') {
      return res.status(400).json({ 
        error: 'No original external URL available for re-download. The original URL was overwritten when the image was first downloaded.' 
      });
    }

    const isForceRedownload = req.query.force === 'true';
    console.log(`${isForceRedownload ? 'Re-downloading' : 'Downloading'} image for station ${stationId}: ${imageUrl}`);

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

    // Get size parameter (default to 512 for better quality)
    const requestedSize = parseInt(req.query.size as string) || 512;
    const maxSize = Math.min(requestedSize, 1024); // Cap at 1024px for performance
    
    // Check original image dimensions
    const metadata = await sharp(imageBuffer).metadata();
    console.log(`Original image: ${metadata.width}x${metadata.height}, requested: ${maxSize}x${maxSize}`);
    
    // Process image with Sharp - convert to PNG and optimize
    const outputPath = getImagePath(stationId, 'png');
    
    // Only resize if original is larger than requested, or if explicitly requested
    const shouldResize = (metadata.width && metadata.width > maxSize) || 
                        (metadata.height && metadata.height > maxSize) || 
                        req.query.resize === 'true';
    
    if (shouldResize) {
      await sharp(imageBuffer)
        .png({ quality: 90 })
        .resize(maxSize, maxSize, { 
          fit: 'inside',
          withoutEnlargement: false 
        })
        .toFile(outputPath);
    } else {
      // Keep original size, just convert to PNG
      await sharp(imageBuffer)
        .png({ quality: 90 })
        .toFile(outputPath);
    }

    // Update database with local image path
    const imageUrl_local = getImageUrl(stationId, 'png');
    
    // Preserve original URL in logo field if logo is empty and this is the original URL
    const updateData: { favicon: string; logo?: string } = { favicon: imageUrl_local };
    if (!station.logo && imageUrl !== imageUrl_local) {
      updateData.logo = imageUrl; // Store original URL in logo field as backup
    }
    
    await prisma.station.update({
      where: { id: stationId },
      data: updateData
    });

    // Get final image metadata
    const finalMetadata = await sharp(outputPath).metadata();
    
    res.json({ 
      success: true, 
      imageUrl: imageUrl_local,
      originalUrl: imageUrl,
      stationName: station.name,
      dimensions: {
        width: finalMetadata.width,
        height: finalMetadata.height,
        original: {
          width: metadata.width,
          height: metadata.height
        }
      }
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