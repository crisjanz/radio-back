import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import multer from 'multer';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { supabase, getSupabaseImageUrl, getImageFileName, getSupabaseImagePath } from '../config/supabase';
import { findStationByEitherId, parseStationIdParam } from '../utils/station-lookup';
import { handleError, handleNotFound, handleValidationError } from '../types/express';

const router = Router();
const prisma = new PrismaClient();

// Configure mul for file uploads
const upload = multer({ 
  dest: 'uploads/',
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});

// Helper function to upload image buffer to Supabase
const uploadImageToSupabase = async (imageBuffer: Buffer, stationId: number, stationNanoid: string | null, extension: string = 'png'): Promise<string> => {
  // Use NanoID if available, otherwise fall back to numeric ID
  const identifier = stationNanoid || stationId;
  const fileName = getImageFileName(identifier, extension);
  const filePath = getSupabaseImagePath(identifier, extension);
  
  console.log(`🔄 Uploading to Supabase - Station: ${stationId} (${stationNanoid || 'no nanoid'}), Path: ${filePath}, Size: ${imageBuffer.length} bytes`);
  
  // Upload to Supabase storage
  const { data, error } = await supabase.storage
    .from('streemr')
    .upload(filePath, imageBuffer, {
      contentType: `image/${extension}`,
      upsert: true // Overwrite if exists
    });

  if (error) {
    console.error('❌ Supabase upload error:', {
      message: error.message,
      name: error.name,
      stack: error.stack,
      stationId,
      filePath,
      bufferSize: imageBuffer.length
    });
    throw new Error(`Failed to upload to Supabase: ${error.message}`);
  }

  console.log('✅ Supabase upload successful:', data?.path);
  
  // Return the public URL
  const publicUrl = getSupabaseImageUrl(fileName);
  console.log('🔗 Generated public URL:', publicUrl);
  return publicUrl;
};

// Generic image download endpoint (for import preview)
router.post('/download', async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, size = 512 } = req.body;
    
    if (!url) {
      res.status(400).json({ error: 'Image URL is required' });
      return;
    }

    console.log(`Downloading image for preview: ${url}`);

    // Download the image
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
      timeout: 10000,
    });

    if (!response.ok) {
      res.status(400).json({ error: `Failed to download image: ${response.statusText}` });
      return;
    }

    const buffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(buffer);

    // Get size parameter
    const maxSize = Math.min(parseInt(size), 1024); // Cap at 1024px
    
    // Check if this is an ICO file and handle it specially
    let processableBuffer = imageBuffer;
    
    // Detect ICO files by checking the content-type or file signature
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('image/x-icon') || contentType?.includes('image/vnd.microsoft.icon') || 
        url.toLowerCase().endsWith('.ico')) {
      console.log('🔍 ICO file detected in preview, converting to PNG format first');
      
      try {
        // Try to process as ICO
        const icoMetadata = await sharp(imageBuffer, { failOn: 'none' }).metadata();
        if (icoMetadata.format === 'ico') {
          // Convert ICO to PNG
          processableBuffer = await sharp(imageBuffer, { failOn: 'none' })
            .png()
            .toBuffer();
          console.log('✅ Successfully converted ICO to PNG for preview');
        }
      } catch (icoError) {
        console.log('⚠️ ICO conversion failed for preview, will use original buffer');
      }
    }
    
    // Check original image dimensions
    const metadata = await sharp(processableBuffer).metadata();
    console.log(`Original image: ${metadata.width}x${metadata.height}, requested: ${maxSize}x${maxSize}`);
    
    // Process image and return as base64 for preview
    const processedImageBuffer = await sharp(processableBuffer)
      .png({ quality: 90 })
      .resize(maxSize, maxSize, { 
        fit: 'inside',
        withoutEnlargement: false 
      })
      .toBuffer();

    // Convert to base64 for frontend preview
    const base64Image = `data:image/png;base64,${processedImageBuffer.toString('base64')}`;
    
    res.json({ 
      success: true, 
      imageData: base64Image,
      originalUrl: url,
      dimensions: {
        width: Math.min(metadata.width || maxSize, maxSize),
        height: Math.min(metadata.height || maxSize, maxSize),
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

// Download and store favicon for a station (supports both numeric and nanoid)
router.post('/download/:stationId', async (req: Request, res: Response) => {
  try {
    const { stationIdParam, idType } = parseStationIdParam({ params: { id: req.params.stationId } });
    
    if (idType === 'invalid') {
      res.status(400).json({ error: 'Invalid station ID format' });
      return;
    }

    const { url: bodyUrl, size = 512 } = req.body; // Accept URL from request body
    const queryUrl = req.query.url as string; // Also accept URL from query parameters
    const url = queryUrl || bodyUrl; // Query parameters take precedence

    const station = await findStationByEitherId(stationIdParam, {
      select: { id: true, nanoid: true, name: true, favicon: true, logo: true, local_image_url: true }
    });

    if (!station) {
      res.status(404).json({ error: 'Station not found' });
      return;
    }

    // Use provided URL or fall back to database URLs with priority
    let imageUrl = url;
    if (!imageUrl) {
      // Priority: logo -> favicon (skip local_image_url as that's our processed image)
      if (station.logo) {
        imageUrl = station.logo;
      } else if (station.favicon) {
        imageUrl = station.favicon;
      }
    }

    if (!imageUrl) {
      res.status(400).json({ error: 'No favicon or logo URL found for station' });
      return;
    }

    const isForceRedownload = req.query.force === 'true';
    console.log(`${isForceRedownload ? 'Re-downloading' : 'Downloading'} image for station ${station.id}: ${imageUrl}`);

    // Download the image
    const response = await fetch(imageUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
      },
      redirect: 'follow',
      timeout: 10000,
    });

    if (!response.ok) {
      res.status(400).json({ error: `Failed to download image: ${response.statusText}` });
      return;
    }

    const buffer = await response.arrayBuffer();
    const imageBuffer = Buffer.from(buffer);

    // Get size parameter
    const maxSize = Math.min(parseInt(size), 1024); // Cap at 1024px
    
    // Check if this is an ICO file and handle it specially
    let processableBuffer = imageBuffer;
    let isIcoFile = false;
    
    // Detect ICO files by checking the content-type or file signature
    const contentType = response.headers.get('content-type');
    if (contentType?.includes('image/x-icon') || contentType?.includes('image/vnd.microsoft.icon') || 
        imageUrl.toLowerCase().endsWith('.ico')) {
      isIcoFile = true;
      console.log('🔍 ICO file detected, converting to PNG format first');
      
      // For ICO files, we'll try to extract the largest size or convert to PNG
      try {
        // Try to process as ICO - Sharp can sometimes handle ICO in newer versions
        const icoMetadata = await sharp(imageBuffer, { failOn: 'none' }).metadata();
        if (icoMetadata.format === 'ico') {
          // Convert ICO to PNG
          processableBuffer = await sharp(imageBuffer, { failOn: 'none' })
            .png()
            .toBuffer();
          console.log('✅ Successfully converted ICO to PNG');
        }
      } catch (icoError) {
        console.log('⚠️ ICO conversion failed, will use original buffer and hope for the best');
        // If ICO conversion fails, we'll still try with the original buffer
        // Some ICO files might work directly with Sharp
      }
    }
    
    // Check original image dimensions
    const metadata = await sharp(processableBuffer).metadata();
    console.log(`Original image: ${metadata.width}x${metadata.height}, requested: ${maxSize}x${maxSize}`);
    
    // Process image with Sharp - convert to PNG and optimize
    const shouldResize = (metadata.width && metadata.width > maxSize) || 
                        (metadata.height && metadata.height > maxSize) || 
                        req.query.resize === 'true';
    
    let processedImageBuffer: Buffer;
    if (shouldResize) {
      processedImageBuffer = await sharp(processableBuffer)
        .png({ quality: 90 })
        .resize(maxSize, maxSize, { 
          fit: 'inside',
          withoutEnlargement: false 
        })
        .toBuffer();
    } else {
      // Keep original size, just convert to PNG
      processedImageBuffer = await sharp(processableBuffer)
        .png({ quality: 90 })
        .toBuffer();
    }

    // Upload to Supabase
    console.log(`📸 About to upload image for station ${station.id}, buffer size: ${processedImageBuffer.length}`);
    const supabaseImageUrl = await uploadImageToSupabase(processedImageBuffer, station.id, station.nanoid, 'png');
    console.log(`🎯 Upload completed, URL: ${supabaseImageUrl}`);
    
    // Update local_image_url with Supabase URL, preserve original URLs
    await prisma.station.update({
      where: { id: station.id },
      data: { 
        local_image_url: supabaseImageUrl
        // Keep original favicon and logo URLs intact for fallback
      }
    });

    // Get final image metadata
    const finalMetadata = await sharp(processedImageBuffer).metadata();
    
    res.json({ 
      success: true, 
      imageUrl: supabaseImageUrl,
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

// Upload edited image for a station (supports both numeric and nanoid)
router.post('/upload/:stationId', upload.single('image'), async (req: Request, res: Response) => {
  try {
    console.log(`📥 Upload request for station ${req.params.stationId}`);
    const { stationIdParam, idType } = parseStationIdParam({ params: { id: req.params.stationId } });
    
    if (idType === 'invalid') {
      console.log('❌ Invalid station ID format');
      res.status(400).json({ error: 'Invalid station ID format' });
      return;
    }

    if (!req.file) {
      console.log('❌ No image file provided');
      res.status(400).json({ error: 'No image file provided' });
      return;
    }

    console.log(`📄 File info: ${req.file.filename}, size: ${req.file.size}, path: ${req.file.path}`);

    const station = await findStationByEitherId(stationIdParam, {
      select: { id: true, nanoid: true, name: true }
    });

    if (!station) {
      res.status(404).json({ error: 'Station not found' });
      return;
    }

    // Get metadata of uploaded file before processing
    const originalMetadata = await sharp(req.file.path).metadata();
    console.log(`📋 Original uploaded file: ${originalMetadata.width}x${originalMetadata.height}, format: ${originalMetadata.format}, hasAlpha: ${originalMetadata.hasAlpha}`);
    
    // Process uploaded image with Sharp - preserve original size for editor uploads
    const processedImageBuffer = await sharp(req.file.path)
      .png({ quality: 90 })
      .toBuffer();
      
    // Get metadata of processed image
    const processedMetadata = await sharp(processedImageBuffer).metadata();
    console.log(`📋 Processed image: ${processedMetadata.width}x${processedMetadata.height}, format: ${processedMetadata.format}, hasAlpha: ${processedMetadata.hasAlpha}`);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    // Upload to Supabase
    console.log(`📤 Uploading processed image to Supabase for station ${station.id}`);
    const supabaseImageUrl = await uploadImageToSupabase(processedImageBuffer, station.id, station.nanoid, 'png');
    console.log(`✅ Supabase upload successful: ${supabaseImageUrl}`);

    // Update database with Supabase image URL
    console.log(`📝 Updating database for station ${station.id}`);
    await prisma.station.update({
      where: { id: station.id },
      data: { local_image_url: supabaseImageUrl }
    });
    console.log(`✅ Database updated successfully`);

    res.json({ 
      success: true, 
      imageUrl: supabaseImageUrl,
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
      res.status(400).json({ error: 'Invalid or empty station IDs array' });
      return;
    }

    const results = [];
    
    for (const stationId of stationIds) {
      try {
        const station = await prisma.station.findUnique({
          where: { id: parseInt(stationId) },
          select: { id: true, nanoid: true, name: true, favicon: true, logo: true }
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
        const processedImageBuffer = await sharp(imageBuffer)
          .png({ quality: 90 })
          .resize(256, 256, { 
            fit: 'inside',
            withoutEnlargement: false 
          })
          .toBuffer();

        // Upload to Supabase
        const supabaseImageUrl = await uploadImageToSupabase(processedImageBuffer, station.id, station.nanoid, 'png');
        
        // Update database
        await prisma.station.update({
          where: { id: station.id },
          data: { local_image_url: supabaseImageUrl }
        });

        results.push({ 
          stationId, 
          success: true, 
          imageUrl: supabaseImageUrl,
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

// Get image info for a station (supports both numeric and nanoid)
router.get('/info/:stationId', async (req: Request, res: Response) => {
  try {
    const { stationIdParam, idType } = parseStationIdParam({ params: { id: req.params.stationId } });
    
    if (idType === 'invalid') {
      res.status(400).json({ error: 'Invalid station ID format' });
      return;
    }

    const station = await findStationByEitherId(stationIdParam, {
      select: { id: true, nanoid: true, name: true, favicon: true, logo: true, local_image_url: true }
    });

    if (!station) {
      res.status(404).json({ error: 'Station not found' });
      return;
    }

    // Implement image priority: local_image_url -> logo -> favicon
    let primaryImageUrl = null;
    let hasLocalImage = false;
    
    if (station.local_image_url) {
      primaryImageUrl = station.local_image_url;
      hasLocalImage = true;
    } else if (station.logo) {
      primaryImageUrl = station.logo;
    } else if (station.favicon) {
      primaryImageUrl = station.favicon;
    }

    res.json({
      station: {
        id: station.id,
        name: station.name,
        favicon: station.favicon,
        logo: station.logo,
        local_image_url: station.local_image_url
      },
      hasLocalImage, // True if we have a local/processed image
      localImageUrl: primaryImageUrl, // The image to display (priority order)
      imageUrls: {
        local: station.local_image_url,
        logo: station.logo,
        favicon: station.favicon
      }
    });
  } catch (error) {
    console.error('Error fetching image info:', error);
    res.status(500).json({ error: 'Failed to fetch image info' });
  }
});

export default router;