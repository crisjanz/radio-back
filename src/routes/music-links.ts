import express, { Request, Response } from 'express';

const router = express.Router();

// iTunes Search API endpoint
router.get('/itunes', async (req: Request, res: Response): Promise<void> => {
  try {
    const { artist, title } = req.query;

    if (!artist || !title) {
      res.status(400).json({ error: 'Artist and title parameters are required' });
      return;
    }

    // Search iTunes API
    const query = encodeURIComponent(`${artist} ${title}`);
    const itunesUrl = `https://itunes.apple.com/search?term=${query}&media=music&limit=1&entity=song`;
    
    console.log(`🍎 Searching iTunes for: "${artist}" - "${title}"`);
    
    const response = await fetch(itunesUrl);
    
    if (!response.ok) {
      throw new Error(`iTunes API returned ${response.status}`);
    }

    const data = await response.json();
    
    if (data.results && data.results.length > 0) {
      const track = data.results[0];
      console.log(`✅ Found iTunes track: ${track.trackName} by ${track.artistName}`);
      
      // Convert iTunes URL to Apple Music app deep link
      const appleMusicUrl = track.trackViewUrl.replace('https://itunes.apple.com/', 'https://music.apple.com/');
      
      // Extract track ID for universal link that works better with apps
      const trackId = track.trackId;
      const universalUrl = `https://music.apple.com/us/album/track/${trackId}`;
      
      res.json({
        found: true,
        trackViewUrl: track.trackViewUrl, // Original iTunes URL (web)
        appleMusicUrl: appleMusicUrl, // Apple Music web URL
        universalUrl: universalUrl, // Universal link for better app opening
        previewUrl: track.previewUrl,
        trackId: track.trackId,
        trackName: track.trackName,
        artistName: track.artistName,
        collectionName: track.collectionName,
        artworkUrl100: track.artworkUrl100
      });
    } else {
      console.log(`❌ No iTunes results for: "${artist}" - "${title}"`);
      res.json({
        found: false,
        searchUrl: `https://music.apple.com/search?term=${encodeURIComponent(`${artist} ${title}`)}`
      });
    }

  } catch (error) {
    console.error('❌ iTunes Search API error:', error);
    res.status(500).json({ 
      error: 'Failed to search iTunes',
      searchUrl: `https://music.apple.com/search?term=${encodeURIComponent(`${req.query.artist} ${req.query.title}`)}`
    });
  }
});

// Spotify search endpoint (placeholder for future)
router.get('/spotify', async (req: Request, res: Response): Promise<void> => {
  try {
    const { artist, title } = req.query;

    if (!artist || !title) {
      res.status(400).json({ error: 'Artist and title parameters are required' });
      return;
    }

    // For now, return search URL - Spotify API requires authentication
    const searchUrl = `https://open.spotify.com/search/${encodeURIComponent(`${artist} ${title}`)}`;
    
    res.json({
      found: false,
      searchUrl
    });

  } catch (error) {
    console.error('❌ Spotify search error:', error);
    res.status(500).json({ 
      error: 'Failed to search Spotify',
      searchUrl: `https://open.spotify.com/search/${encodeURIComponent(`${req.query.artist} ${req.query.title}`)}`
    });
  }
});

export default router;