import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';
import sharp from 'sharp';

const router = Router();

// In-memory cache for images (in production, use Redis or file cache)
const imageCache = new Map<string, { buffer: Buffer; contentType: string; timestamp: number }>();
const CACHE_DURATION = 24 * 60 * 60 * 1000; // 24 hours

// Image proxy route
router.get('/proxy', async (req: Request, res: Response): Promise<void> => {
  try {
    const { url, w, h, q } = req.query;
    
    if (!url || typeof url !== 'string') {
      res.status(400).json({ error: 'URL parameter is required' });
      return;
    }

    // Validate URL
    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      res.status(400).json({ error: 'Invalid URL' });
      return;
    }

    // Security: Only allow HTTP/HTTPS
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      res.status(400).json({ error: 'Only HTTP/HTTPS URLs allowed' });
      return;
    }

    // Security: Block internal networks (prevent SSRF)
    const hostname = parsedUrl.hostname.toLowerCase();
    if (hostname === 'localhost' || 
        hostname.startsWith('127.') || 
        hostname.startsWith('10.') ||
        hostname.startsWith('172.') ||
        hostname.startsWith('192.168.') ||
        hostname === '0.0.0.0') {
      res.status(400).json({ error: 'Internal URLs not allowed' });
      return;
    }

    // Skip proxy for Supabase URLs (already optimized)
    if (url.includes('supabase.co')) {
      return res.redirect(url);
    }

    const cacheKey = `${url}_${w || 'auto'}_${h || 'auto'}_${q || '80'}`;
    
    // Check cache first
    const cached = imageCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      res.set('Content-Type', cached.contentType);
      res.set('Cache-Control', 'public, max-age=86400'); // 24 hours
      res.send(cached.buffer);
      return;
    }


    // Fetch the image
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; StreamrBot/1.0)',
      },
      timeout: 10000,
    });

    if (!response.ok) {
      res.status(404).json({ error: 'Image not found' });
      return;
    }

    // Validate content type before processing
    let contentType = response.headers.get('content-type');
    if (!contentType || !contentType.startsWith('image/')) {
      console.warn(`Invalid content type for image URL ${url}: ${contentType}`);
      res.status(400).json({ error: 'URL does not point to an image' });
      return;
    }

    // Check content length to prevent huge downloads
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength) > 2 * 1024 * 1024) { // 2MB limit
      res.status(413).json({ error: 'Image too large' });
      return;
    }

    const buffer = await response.arrayBuffer();
    let imageBuffer = Buffer.from(buffer);

    // Double-check size after download
    if (imageBuffer.length > 2 * 1024 * 1024) {
      res.status(413).json({ error: 'Image too large' });
      return;
    }

    // Optimize image with Sharp if parameters provided
    const width = w ? parseInt(w as string) : undefined;
    const height = h ? parseInt(h as string) : undefined;
    const quality = q ? parseInt(q as string) : 80;

    if (width || height || quality !== 80) {
      try {
        // Validate image format before processing
        let sharpImage = sharp(imageBuffer);
        const metadata = await sharpImage.metadata();
        
        if (!metadata.format) {
          throw new Error('Unsupported image format');
        }

        // Resize if dimensions provided
        if (width || height) {
          sharpImage = sharpImage.resize(width, height, { 
            fit: 'inside',
            withoutEnlargement: true 
          });
        }

        // Convert to WebP for better compression (if supported)
        const acceptHeader = req.headers.accept || '';
        if (acceptHeader.includes('image/webp')) {
          imageBuffer = await sharpImage.webp({ quality }).toBuffer();
          contentType = 'image/webp';
        } else {
          imageBuffer = await sharpImage.jpeg({ quality }).toBuffer();
          contentType = 'image/jpeg';
        }
      } catch (error) {
        console.warn(`Image optimization failed for ${url}:`, error.message);
        // Return the original image without processing
      }
    }

    // Cache the result
    imageCache.set(cacheKey, {
      buffer: imageBuffer,
      contentType,
      timestamp: Date.now()
    });

    // Clean up old cache entries (simple cleanup)
    if (imageCache.size > 1000) {
      const entries = Array.from(imageCache.entries());
      const oldEntries = entries.filter(([, data]) => 
        (Date.now() - data.timestamp) > CACHE_DURATION
      );
      oldEntries.forEach(([key]) => imageCache.delete(key));
    }

    // Send the image
    res.set('Content-Type', contentType);
    res.set('Cache-Control', 'public, max-age=86400'); // 24 hours
    res.send(imageBuffer);

  } catch (error) {
    console.error('Image proxy error:', error);
    res.status(500).json({ error: 'Failed to proxy image' });
  }
});

export default router;