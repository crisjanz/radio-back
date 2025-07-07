import express from 'express';
import { Request, Response } from 'express';

const router = express.Router();

// Stream proxy endpoint to handle HTTP streams over HTTPS
router.get('/stream', async (req: Request, res: Response) => {
  try {
    const streamUrl = req.query.url as string;
    
    if (!streamUrl) {
      return res.status(400).json({ error: 'Stream URL is required' });
    }

    // Validate URL format
    try {
      const url = new URL(streamUrl);
      if (!['http:', 'https:'].includes(url.protocol)) {
        return res.status(400).json({ error: 'Invalid stream URL protocol' });
      }
    } catch {
      return res.status(400).json({ error: 'Invalid stream URL format' });
    }

    console.log('📡 Proxying stream:', streamUrl);

    // Fetch the stream
    const response = await fetch(streamUrl, {
      headers: {
        'User-Agent': 'Streemr/1.0',
        'Accept': 'audio/*,*/*',
      },
      // Disable redirect following to handle them manually if needed
      redirect: 'follow'
    });

    if (!response.ok) {
      console.error('Stream fetch failed:', response.status, response.statusText);
      return res.status(response.status).json({ 
        error: `Stream not available: ${response.statusText}` 
      });
    }

    // Set appropriate headers for audio streaming
    res.setHeader('Content-Type', response.headers.get('Content-Type') || 'audio/mpeg');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'range');

    // If the response has content-length, forward it
    const contentLength = response.headers.get('Content-Length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    // Handle range requests for seeking
    const range = req.headers.range;
    if (range && response.headers.get('Accept-Ranges') === 'bytes') {
      res.setHeader('Accept-Ranges', 'bytes');
      // Note: For live streams, range requests might not be applicable
    }

    // Pipe the stream response to the client
    if (response.body) {
      const reader = response.body.getReader();
      
      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            
            if (!res.writableEnded) {
              res.write(Buffer.from(value));
            } else {
              break;
            }
          }
          if (!res.writableEnded) {
            res.end();
          }
        } catch (error) {
          console.error('Stream proxy error:', error);
          if (!res.writableEnded) {
            res.status(500).end();
          }
        }
      };

      // Handle client disconnect
      req.on('close', () => {
        reader.cancel();
      });

      pump();
    } else {
      res.status(500).json({ error: 'No stream data available' });
    }

  } catch (error) {
    console.error('Stream proxy error:', error);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to proxy stream' });
    }
  }
});

export default router;