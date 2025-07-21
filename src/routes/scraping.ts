// scraping.ts
import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';
import { handleError } from '../types/express';

const router = Router();

// Base scraping endpoint
router.get('/', async (req: Request, res: Response): Promise<void> => {
  const data = {
    success: true,
    message: 'Web scraping service is running',
    description: 'Extract business information from websites and Google Maps URLs',
    endpoints: {
      '/scrape/business': 'POST - Scrape business information from a URL'
    },
    supportedSources: [
      'Website content extraction',
      'Google Maps business information',
      'Social media links detection',
      'Contact information extraction',
      'Business hours and descriptions'
    ],
    usage: {
      method: 'POST',
      endpoint: '/scrape/business',
      body: {
        url: 'https://example.com or Google Maps URL'
      }
    }
  };
  
  res.json(data);
});

// HTML entity decoder function
const decodeHtmlEntities = (text: string): string => {
  if (!text) return text;
  
  return text
    // Named entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&hellip;/g, '…')
    // Numeric entities (decimal)
    .replace(/&#(\d+);/g, (match, num) => String.fromCharCode(parseInt(num, 10)))
    // Hex entities
    .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
    // Clean up extra whitespace
    .replace(/\s+/g, ' ')
    .trim();
};

// Web scraping endpoint for business information
router.post('/business', async (req: Request, res: Response): Promise<void> => {
  const { url } = req.body;
  
  console.log(`🕷️ Scraping business info from: ${url}`);
  
  if (!url) {
    res.status(400).json({ success: false, error: 'URL is required' });
    return;
  }

  try {
    let finalUrl = url;
    
    // Handle shortened Google Maps URLs by following redirects
    if (url.includes('maps.app.goo.gl') || url.includes('goo.gl/maps') || url.includes('g.page')) {
      console.log('🔗 Following shortened URL redirects...');
      
      try {
        const redirectResponse = await fetch(url, {
          method: 'HEAD',
          redirect: 'follow',
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        finalUrl = redirectResponse.url;
        console.log(`🎯 Resolved to: ${finalUrl}`);
      } catch (redirectError) {
        console.log('⚠️ Redirect failed, using original URL');
      }
    }

    // For Google Maps, try to extract place ID and use a more direct approach
    let placeId = null;
    if (finalUrl.includes('google.com/maps') || finalUrl.includes('maps.google.com')) {
      const placeIdMatch = finalUrl.match(/place\/([^\/]+)/) || finalUrl.match(/data=([^&]+)/);
      if (placeIdMatch) {
        console.log('📍 Found Google Maps place, extracting info...');
      }
    }
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 second timeout
    
    const response = await fetch(finalUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Ch-Ua': '"Not_A Brand";v="8", "Chromium";v="120", "Google Chrome";v="120"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"'
      }
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const html = await response.text();
    console.log(`📄 Downloaded ${html.length} characters of HTML`);

    // Log some of the HTML for debugging (first 500 chars)
    console.log('🔍 HTML Preview:', html.substring(0, 500));
    
    // Extract business information using regex patterns
    const businessInfo: any = {
      name: null,
      description: null,
      address: null,
      phone: null,
      email: null,
      website: null,
      favicon: null,
      logo: null,
      socialMedia: {},
      coordinates: null
    };

    // Extract business name (improved patterns for radio stations and businesses)
    const namePatterns = [
      // Google Maps URL patterns - extract from URL path
      /\/place\/([^\/\?%]+)/,
      /\/maps\/place\/([^\/\?%]+)/,
      // Title patterns - but not generic "Google Maps"
      /<title[^>]*>([^<]+?)\s*[-|–]\s*Google\s*Maps/i,
      // Title patterns for radio stations and general websites
      /<title[^>]*>([^<]{3,}?)(?:\s*[-|–]\s*(?:Home|Listen|Live|Radio|FM|AM|Online|Stream|Broadcasting|Music|News).*?)?<\/title>/i,
      /<title[^>]*>([^<]{3,}?)\s*[-|–].*?(?:FM|AM|Radio|Station|Broadcasting)/i,
      /<title[^>]*>([^<]{3,}?)\s*[-|–].*?<\/title>/i,
      /<title[^>]*>([^<]{3,}?)<\/title>/i,
      // JSON data patterns for Google Maps
      /\["([^"]{3,})",null,\[\[null,null,[0-9.-]+,[0-9.-]+\]/,
      /"([^"]{3,})".*?(?:place_id|place-id)/i,
      /window\.APP_INITIALIZATION_STATE.*?"([^"]{3,})",.*?place_id/i,
      // Structured data patterns
      /"name":"([^"]{3,})"/,
      /property="og:title"[^>]*content="([^"]{3,})"/,
      /property="og:site_name"[^>]*content="([^"]{3,})"/,
      // Header patterns (improved for radio stations)
      /<h1[^>]*class="[^"]*(?:logo|brand|station|title)[^"]*"[^>]*>([^<]{3,})<\/h1>/i,
      /<h1[^>]*>([^<]{3,}?(?:FM|AM|Radio|Station|Broadcasting)[^<]*)<\/h1>/i,
      /<h1[^>]*>([^<]{3,})<\/h1>/i,
      // Logo and brand images alt text
      /<img[^>]*(?:class="[^"]*(?:logo|brand)[^"]*"|alt="[^"]*(?:logo|brand)[^"]*")[^>]*alt="([^"]{3,})"/i,
      /<img[^>]*alt="([^"]{3,})"[^>]*(?:class="[^"]*(?:logo|brand)[^"]*"|src="[^"]*(?:logo|brand)[^"]*")/i,
      // Radio-specific patterns
      /(?:listen(?:\s+live)?(?:\s+to)?|now\s+playing(?:\s+on)?)[:\s]*([^<\n\r]{3,}?(?:FM|AM|Radio)[^<\n\r]*)/i,
      /(\w+(?:\s+\w+)*\s+(?:FM|AM|Radio|Station|Broadcasting))/i,
      // Data attributes
      /data-(?:name|title|station)="([^"]{3,})"/,
      /data-value="([^"]{3,})"/,
      /aria-label="([^"]{3,})"/
    ];
    
    for (const pattern of namePatterns) {
      const match = html.match(pattern);
      if (match && match[1] && !businessInfo.name) {
        let name = decodeHtmlEntities(match[1].trim().replace(/\+/g, ' '));
        
        // Skip generic names but be more permissive for radio stations
        const lowerName = name.toLowerCase();
        if (lowerName === 'google maps' || 
            lowerName === 'maps' || 
            lowerName === 'home' ||
            lowerName === 'live' ||
            lowerName === 'listen' ||
            lowerName === 'online' ||
            lowerName === 'streaming' ||
            name.length < 2 ||
            /^[^a-zA-Z0-9]*$/.test(name)) { // Only punctuation/symbols
          continue;
        }
        
        // URL decode if needed
        try {
          name = decodeURIComponent(name);
        } catch (e) {
          // Keep original if decoding fails
        }
        
        businessInfo.name = name;
        console.log(`📛 Found business name: ${name}`);
        break;
      }
    }

    // Extract description
    const descPatterns = [
      /property="og:description"[^>]*content="([^"]+)"/,
      /<meta[^>]*name="description"[^>]*content="([^"]+)"/,
      /"description":"([^"]+)"/
    ];
    
    for (const pattern of descPatterns) {
      const match = html.match(pattern);
      if (match && match[1] && match[1].length > 20) {
        businessInfo.description = decodeHtmlEntities(match[1].trim());
        break;
      }
    }

    // Extract phone numbers with comprehensive patterns
    const phonePatterns = [
      // Contact/phone labels with numbers (more flexible length)
      /(?:phone|tel|call|contact|telephone):\s*([+]?[\d\s\-\(\)\.\/]{7,25})/gi,
      /(?:phone|tel|call|contact|telephone)\s*[:\-]?\s*([+]?[\d\s\-\(\)\.\/]{7,25})/gi,
      // Link patterns (more flexible)
      /href="tel:([+]?[\d\s\-\(\)\.\/]{7,25})"/gi,
      // Structured data
      /"telephone":"([^"]+)"/gi,
      /"phone":"([^"]+)"/gi,
      // International patterns (more comprehensive)
      /(\+\d{1,4}[-.\s\/]?\d{1,4}[-.\s\/]?\d{1,4}[-.\s\/]?\d{1,10})/g,
      /(\+\d{1,4}[-.\s\/]?\d{2,4}[-.\s\/]?\d{2,4}[-.\s\/]?\d{2,6})/g,
      // Standard US phone patterns
      /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/g,
      // European patterns (common formats)
      /(\+\d{2,3}[-.\s\/]?\d{1,4}[-.\s\/]?\d{2,4}[-.\s\/]?\d{2,4})/g,
      // Long international patterns (to capture complete numbers)
      /(\+\d{1,4}[-.\s\/]?\d{2,5}[-.\s\/]?\d{2,5}[-.\s\/]?\d{2,5}[-.\s\/]?\d{2,5})/g,
      /(\+\d{10,18})/g,  // Long number with + prefix
      /(00\d{8,16})/g,   // International format starting with 00
      // Generic patterns
      /(\(\d{3}\)\s?\d{3}[-.\s]?\d{4})/g,
      /(\d{3}[-.\s]\d{3}[-.\s]\d{4})/g,
      // Numbers in quotes or specific contexts (to avoid truncation)
      /"([+]?[\d\s\-\(\)\.\/]{8,25})"/g,
      /'([+]?[\d\s\-\(\)\.\/]{8,25})'/g,
      // Fallback broader pattern (more inclusive)
      /([+]?[\d\s\-\(\)\.\/]{8,25})/g
    ];
    
    const foundPhones = [];
    
    for (const pattern of phonePatterns) {
      const matches = [...html.matchAll(pattern)];
      for (const match of matches) {
        if (match && match[1]) {
          let phone = match[1].trim();
          
          // Clean up the phone number (more gentle cleaning)
          phone = phone.replace(/[^\d\+\-\(\)\.\s\/]/g, '');
          
          // Count actual digits first
          const digitCount = (phone.match(/\d/g) || []).length;
          
          // Filter out invalid/weird phone numbers and CSS classes
          if (phone.includes('999999') || 
              phone.includes('000000') || 
              phone.match(/^\.[\d.]+$/) ||
              phone.length < 8 ||  // More lenient minimum
              phone.length > 30 ||  // More lenient maximum
              digitCount < 7 ||     // More lenient digit minimum
              digitCount > 18 ||    // More lenient digit maximum
              phone.match(/^\d{1,3}$/) ||  // Too short
              phone.match(/^[.\-\s\(\)\/]+$/) ||  // Only punctuation
              phone.includes('111111') ||
              phone.includes('123456') ||
              phone.startsWith('-') ||  // Starts with dash (likely CSS class)
              phone.startsWith('.') ||  // Starts with dot (likely CSS class)
              phone.match(/^\d{10,}$/) && phone.length > 15) { // Very long number string (likely not phone)
            continue;
          }
          
          foundPhones.push(phone);
        }
      }
    }
    
    // Choose the best phone number (prefer ones with country codes or proper formatting)
    if (foundPhones.length > 0) {
      const scoredPhones = foundPhones.map(phone => {
        let score = 0;
        const digitCount = (phone.match(/\d/g) || []).length;
        
        // International format bonus
        if (phone.includes('+')) score += 6;
        
        // Good formatting bonuses
        if (phone.includes('(') && phone.includes(')')) score += 3;  // Area code formatting
        if (phone.match(/\d{3}[-.\s]\d{3}[-.\s]\d{4}/)) score += 4;  // Standard US format
        if (phone.match(/\+\d{2,4}[-.\s\/]\d+[-.\s\/]\d+/)) score += 5;  // International format
        
        // Length scoring (prefer complete numbers)
        if (digitCount >= 10 && digitCount <= 15) score += 3;  // Standard international range
        if (digitCount >= 7 && digitCount <= 9) score += 1;   // Shorter but valid
        if (digitCount >= 16) score -= 2;  // Too long, might be truncated
        
        // Bonus for numbers that don't look truncated
        if (!phone.match(/\d{4,}$/)) score += 1;  // Doesn't end with 4+ consecutive digits (less likely to be cut off)
        
        console.log(`📞 Phone candidate: "${phone}" (${digitCount} digits, score: ${score})`);
        return { phone, score };
      });
      
      scoredPhones.sort((a, b) => b.score - a.score);
      businessInfo.phone = scoredPhones[0].phone;
      console.log(`📞 Found phone: ${businessInfo.phone} (score: ${scoredPhones[0].score})`);
    }

    // Extract email addresses (improved filtering)
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const emailMatches = [...html.matchAll(emailPattern)];
    
    for (const match of emailMatches) {
      if (match && match[1]) {
        const email = match[1].toLowerCase();
        
        // Skip common non-business emails and image file references
        if (email.includes('noreply') || 
            email.includes('example') || 
            email.includes('test') ||
            email.includes('no-reply') ||
            email.includes('donotreply') ||
            email.includes('@2x.png') ||
            email.includes('.png') ||
            email.includes('.jpg') ||
            email.includes('.jpeg') ||
            email.includes('.gif') ||
            email.includes('.svg') ||
            email.includes('.webp') ||
            email.includes('.ico') ||
            email.includes('_') && email.includes('@') && email.includes('.png')) {
          continue;
        }
        
        businessInfo.email = match[1]; // Use original case
        console.log(`📧 Found email: ${businessInfo.email}`);
        break;
      }
    }

    // Extract address (Enhanced Google Maps patterns)
    const addressPatterns = [
      // JSON structured data patterns
      /"address":"([^"]+)"/g,
      /"formattedAddress":"([^"]+)"/g,
      /"streetAddress":"([^"]+)"/g,
      /"addressLocality":"([^"]+)"/g,
      /"postalAddress":"([^"]+)"/g,
      
      // Google Maps specific patterns
      /data-value="([^"]*(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Plaza|Square|Lane|Ln|Way|Court|Ct|Circle|Cir)[^"]*)"/gi,
      /"ludocid":"[^"]*","laddr":"([^"]+)"/gi,
      /,"laddr":"([^"]+)"/gi,
      /"2":"([^"]*(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Plaza|Square|Lane|Ln|Way|Court|Ct|Circle|Cir)[^"]*)"/gi,
      
      // Address in data attributes
      /data-address="([^"]+)"/gi,
      /address="([^"]+)"/gi,
      
      // Microdata patterns
      /itemprop="address"[^>]*>([^<]+)</gi,
      /itemprop="streetAddress"[^>]*>([^<]+)</gi,
      
      // Schema.org patterns
      /@type":"PostalAddress"[^}]*"streetAddress":"([^"]+)"/gi,
      /@type":"Place"[^}]*"address":"([^"]+)"/gi,
      
      // Google Maps URL patterns (place names in URLs)
      /place\/([^\/]+\+[^\/]+\+[^\/,@]+)/gi,
      
      // Generic address patterns (more restrictive to avoid JavaScript)
      /\b([0-9]+\s+[A-Za-z\s]{2,30}(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Plaza|Square|Lane|Ln|Way|Court|Ct|Circle|Cir)[^,\n\r]{0,30}(?:,\s*[A-Za-z\s]{2,20})*)\b/gi,
      
      // International address patterns (more restrictive)
      /\b([A-Za-z0-9\s\-]{3,40}(?:Straße|Strasse|Str|Rue|Via|Calle|Avenida|Rua)\s*[0-9A-Za-z\s\-]{0,20})\b/gi
    ];
    
    const foundAddresses = [];
    
    for (const pattern of addressPatterns) {
      const matches = [...html.matchAll(pattern)];
      for (const match of matches) {
        if (match && match[1]) {
          let address = match[1].trim();
          
          // Clean up URL encoding and escape sequences (safely)
          try {
            address = decodeURIComponent(address.replace(/\+/g, ' '));
          } catch (e) {
            // If URI decoding fails, just replace + with spaces
            address = address.replace(/\+/g, ' ');
          }
          
          address = address
            .replace(/\\u[\dA-F]{4}/gi, '')
            .replace(/\\n/g, ' ')
            .replace(/\\r/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          
          // Skip if too short or looks invalid
          if (address.length < 10 || 
              address.toLowerCase().includes('google') ||
              address.toLowerCase().includes('maps') ||
              address.match(/^[\d\s\-,\.]+$/) ||  // Only numbers and punctuation
              address.match(/^[A-Z\s]+$/) ||      // Only uppercase letters (likely not real address)
              address.includes('function') ||     // JavaScript code
              address.includes('return') ||       // JavaScript code
              address.includes('typeof') ||       // JavaScript code
              address.includes('instanceof') ||   // JavaScript code
              address.includes('constructor') ||  // JavaScript code
              address.includes('Error()') ||      // JavaScript code
              address.includes('_.') ||           // Google Maps internal code
              address.includes('void 0') ||       // JavaScript code
              address.includes('null') ||         // JavaScript literals
              address.includes('===') ||          // JavaScript operators
              address.includes('!==') ||          // JavaScript operators
              address.includes('||') ||           // JavaScript operators
              address.includes('&&') ||           // JavaScript operators
              address.includes('navbar') ||       // CSS class names
              address.includes('sticky-top') ||   // CSS class names
              address.includes('navbar-expand') || // CSS class names
              address.includes('class=') ||       // HTML attributes
              address.includes('id=') ||          // HTML attributes
              address.includes('data-') ||        // HTML attributes
              address.match(/[{}();]/)) {         // JavaScript syntax characters
            continue;
          }
          
          foundAddresses.push(address);
        }
      }
    }
    
    // Choose the best address (prefer longer, more complete ones)
    if (foundAddresses.length > 0) {
      const scoredAddresses = foundAddresses.map(address => {
        let score = 0;
        
        // Length bonus (longer addresses are usually more complete)
        if (address.length > 30) score += 3;
        if (address.length > 50) score += 2;
        
        // Contains numbers (street numbers are good)
        if (address.match(/\d+/)) score += 2;
        
        // Contains typical address components
        if (address.match(/(?:Street|St|Avenue|Ave|Road|Rd|Boulevard|Blvd|Drive|Dr|Plaza|Square|Lane|Ln|Way|Court|Ct|Circle|Cir)/i)) score += 3;
        
        // Contains comma (usually separates address parts)
        if (address.includes(',')) score += 2;
        
        // Contains postal code patterns
        if (address.match(/\b\d{5}(-\d{4})?\b/)) score += 2;  // US ZIP
        if (address.match(/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/)) score += 2;  // Canadian postal
        if (address.match(/\b\d{4,6}\b/)) score += 1;  // Generic postal code
        
        // International address components
        if (address.match(/(?:Straße|Strasse|Str|Rue|Via|Calle|Avenida|Rua)/i)) score += 3;
        
        console.log(`🏠 Address candidate: "${address}" (score: ${score})`);
        return { address, score };
      });
      
      scoredAddresses.sort((a, b) => b.score - a.score);
      businessInfo.address = decodeHtmlEntities(scoredAddresses[0].address);
      console.log(`🏠 Found address: ${businessInfo.address} (score: ${scoredAddresses[0].score})`);
    }

    // Extract coordinates (Google Maps - improved patterns)
    const coordPatterns = [
      // URL-based coordinates
      /@(-?\d+\.\d+),(-?\d+\.\d+)/,
      /!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/,
      // JSON-based coordinates
      /"lat":(-?\d+\.\d+),"lng":(-?\d+\.\d+)/,
      /"latitude":(-?\d+\.\d+),"longitude":(-?\d+\.\d+)/,
      /\[null,null,(-?\d+\.\d+),(-?\d+\.\d+)\]/,
      // Google Maps specific patterns
      /\[(-?\d+\.\d+),(-?\d+\.\d+),\d+\]/,
      /center=(-?\d+\.\d+),(-?\d+\.\d+)/,
      // New Google Maps format
      /\],\[(-?\d+\.\d+),(-?\d+\.\d+)\],/
    ];
    
    for (const pattern of coordPatterns) {
      const match = html.match(pattern);
      if (match && match[1] && match[2]) {
        businessInfo.coordinates = {
          latitude: parseFloat(match[1]),
          longitude: parseFloat(match[2])
        };
        console.log(`📍 Found coordinates: ${match[1]}, ${match[2]}`);
        break;
      }
    }

    // Extract social media links
    const socialPatterns = {
      facebook: /(?:facebook\.com|fb\.com)\/([a-zA-Z0-9.]+)/i,
      twitter: /(?:twitter\.com|x\.com)\/([a-zA-Z0-9_]+)/i,
      instagram: /instagram\.com\/([a-zA-Z0-9_.]+)/i,
      youtube: /youtube\.com\/(?:channel\/|user\/|c\/)?([a-zA-Z0-9_-]+)/i
    };

    for (const [platform, pattern] of Object.entries(socialPatterns)) {
      const match = html.match(pattern);
      if (match && match[0]) {
        businessInfo.socialMedia[platform] = match[0].startsWith('http') ? match[0] : `https://${match[0]}`;
      }
    }

    // Extract website URL
    const websitePatterns = [
      /"website":"([^"]+)"/,
      /property="og:url"[^>]*content="([^"]+)"/,
      /<link[^>]*rel="canonical"[^>]*href="([^"]+)"/
    ];
    
    for (const pattern of websitePatterns) {
      const match = html.match(pattern);
      if (match && match[1] && match[1] !== url) {
        businessInfo.website = match[1];
        break;
      }
    }

    // Extract favicon and logo images
    console.log('🖼️ Searching for favicon and logo images...');
    
    // Get base URL for relative path resolution
    const urlObj = new URL(finalUrl);
    const baseUrl = `${urlObj.protocol}//${urlObj.host}`;
    
    const logoPatterns = [
      // Favicon patterns (prioritize higher quality formats)
      /<link[^>]*rel="icon"[^>]*href="([^"]+)"/gi,
      /<link[^>]*rel="shortcut icon"[^>]*href="([^"]+)"/gi,
      /<link[^>]*rel="apple-touch-icon"[^>]*href="([^"]+)"/gi,
      /<link[^>]*rel="apple-touch-icon-precomposed"[^>]*href="([^"]+)"/gi,
      /<link[^>]*rel="mask-icon"[^>]*href="([^"]+)"/gi,
      
      // Open Graph and Twitter Card images
      /property="og:image"[^>]*content="([^"]+)"/gi,
      /property="og:image:url"[^>]*content="([^"]+)"/gi,
      /name="twitter:image"[^>]*content="([^"]+)"/gi,
      
      // Common logo image patterns in HTML
      /<img[^>]*src="([^"]*logo[^"]*\.(png|jpg|jpeg|svg|gif|webp))"[^>]*/gi,
      /<img[^>]*src="([^"]*brand[^"]*\.(png|jpg|jpeg|svg|gif|webp))"[^>]*/gi,
      /<img[^>]*src="([^"]*header[^"]*\.(png|jpg|jpeg|svg|gif|webp))"[^>]*/gi,
      /<img[^>]*class="[^"]*logo[^"]*"[^>]*src="([^"]+)"/gi,
      /<img[^>]*id="[^"]*logo[^"]*"[^>]*src="([^"]+)"/gi,
      /<img[^>]*alt="[^"]*logo[^"]*"[^>]*src="([^"]+)"/gi,
      
      // CSS background images
      /background-image:\s*url\(['"]?([^'")\s]+logo[^'")\s]*\.(png|jpg|jpeg|svg|gif|webp))['"]?\)/gi,
      
      // JSON-LD structured data
      /"logo":"([^"]+\.(png|jpg|jpeg|svg|gif|webp))"/gi,
      /"image":"([^"]+logo[^"]*\.(png|jpg|jpeg|svg|gif|webp))"/gi,
      
      // Common website patterns
      /src="([^"]*\/logo\.(png|jpg|jpeg|svg|gif|webp))"/gi,
      /src="([^"]*\/images\/logo[^"]*\.(png|jpg|jpeg|svg|gif|webp))"/gi,
      /href="([^"]*\/favicon\.(ico|png|svg))"/gi,
    ];
    
    const foundLogos = [];
    
    for (const pattern of logoPatterns) {
      const matches = [...html.matchAll(pattern)];
      for (const match of matches) {
        if (match && (match[1] || match[2])) {
          let logoUrl = match[1] || match[2];
          
          // Skip data URLs, empty URLs, and obvious placeholders
          if (!logoUrl || 
              logoUrl.startsWith('data:') || 
              logoUrl.includes('placeholder') ||
              logoUrl.includes('default') ||
              logoUrl.includes('example') ||
              logoUrl.length < 4) {
            continue;
          }
          
          // Convert relative URLs to absolute
          if (logoUrl.startsWith('/')) {
            logoUrl = baseUrl + logoUrl;
          } else if (logoUrl.startsWith('./')) {
            logoUrl = baseUrl + logoUrl.substring(1);
          } else if (!logoUrl.startsWith('http')) {
            logoUrl = baseUrl + '/' + logoUrl;
          }
          
          // Clean up URL
          logoUrl = logoUrl.split('?')[0]; // Remove query parameters
          logoUrl = logoUrl.split('#')[0]; // Remove fragments
          
          foundLogos.push({
            url: logoUrl,
            type: logoUrl.includes('favicon') || logoUrl.includes('icon') ? 'favicon' : 'logo',
            quality: 0 // Will be scored below
          });
        }
      }
    }
    
    // Score and prioritize logos/favicons
    const scoredLogos = foundLogos.map(logo => {
      let score = 0;
      const url = logo.url.toLowerCase();
      
      // Format preferences (higher quality formats get more points)
      if (url.endsWith('.svg')) score += 8;  // Vector, best quality
      if (url.endsWith('.png')) score += 6;  // Good for logos
      if (url.endsWith('.webp')) score += 5; // Modern format
      if (url.endsWith('.jpg') || url.endsWith('.jpeg')) score += 3; // Acceptable
      if (url.endsWith('.gif')) score += 2;  // Usually animated or low quality
      if (url.endsWith('.ico')) score += 4;  // Standard favicon
      
      // Size hints in filename/path (bigger is usually better for logos)
      if (url.includes('192x192') || url.includes('256x256')) score += 6;
      if (url.includes('180x180') || url.includes('152x152')) score += 5;
      if (url.includes('144x144') || url.includes('120x120')) score += 4;
      if (url.includes('96x96') || url.includes('72x72')) score += 3;
      if (url.includes('48x48') || url.includes('32x32')) score += 2;
      if (url.includes('16x16')) score += 1;
      
      // Logo-specific scoring
      if (logo.type === 'logo') {
        if (url.includes('logo')) score += 5;
        if (url.includes('brand')) score += 4;
        if (url.includes('header')) score += 3;
        if (url.includes('/images/')) score += 2;
        if (url.includes('/assets/')) score += 2;
      }
      
      // Favicon-specific scoring
      if (logo.type === 'favicon') {
        if (url.includes('favicon')) score += 5;
        if (url.includes('apple-touch-icon')) score += 4;
        if (url.includes('icon')) score += 3;
      }
      
      // Path quality (shorter paths usually better)
      const pathParts = url.split('/').length;
      if (pathParts <= 4) score += 3; // Direct path
      if (pathParts <= 6) score += 1; // Reasonable path
      
      // Penalize suspicious URLs
      if (url.includes('cdn') && !url.includes('amazonaws')) score -= 2; // External CDNs might not work
      if (url.includes('temp') || url.includes('tmp')) score -= 5;
      if (url.includes('cache')) score -= 2;
      
      console.log(`🖼️ Logo candidate: "${logo.url}" (type: ${logo.type}, score: ${score})`);
      return { ...logo, quality: score };
    });
    
    // Sort by quality and extract best favicon and logo
    scoredLogos.sort((a, b) => b.quality - a.quality);
    
    // Find best favicon
    const bestFavicon = scoredLogos.find(logo => logo.type === 'favicon');
    if (bestFavicon) {
      businessInfo.favicon = bestFavicon.url;
      console.log(`🔖 Found favicon: ${bestFavicon.url} (score: ${bestFavicon.quality})`);
    }
    
    // Find best logo (that's not the same as favicon)
    const bestLogo = scoredLogos.find(logo => 
      logo.type === 'logo' && 
      logo.url !== businessInfo.favicon
    );
    if (bestLogo) {
      businessInfo.logo = bestLogo.url;
      console.log(`🎨 Found logo: ${bestLogo.url} (score: ${bestLogo.quality})`);
    }
    
    // Fallback: if no favicon found, use the best overall image
    if (!businessInfo.favicon && scoredLogos.length > 0) {
      businessInfo.favicon = scoredLogos[0].url;
      console.log(`🔖 Using best image as favicon: ${scoredLogos[0].url}`);
    }

    // Clean up extracted data
    Object.keys(businessInfo).forEach(key => {
      if (typeof businessInfo[key] === 'string') {
        businessInfo[key] = decodeHtmlEntities(businessInfo[key]
          .replace(/\\"/g, '"')
          .replace(/\\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim());
      }
    });

    // Determine source
    let source = 'Website';
    if (url.includes('google.com/maps') || url.includes('maps.google.com')) {
      source = 'Google Maps';
    } else if (url.includes('facebook.com')) {
      source = 'Facebook';
    } else if (url.includes('twitter.com') || url.includes('x.com')) {
      source = 'Twitter';
    }

    // Check if we got useful data
    const hasUsefulData = businessInfo.name || businessInfo.description || businessInfo.phone || 
                         businessInfo.email || businessInfo.address || businessInfo.coordinates ||
                         Object.keys(businessInfo.socialMedia).length > 0 || businessInfo.favicon || businessInfo.logo;

    if (!hasUsefulData) {
      if (finalUrl.includes('google.com/maps') || finalUrl.includes('maps.google.com')) {
        console.log('⚠️ Google Maps scraping failed - likely due to JavaScript rendering');
        const data = {
          success: false,
          error: 'Google Maps pages require JavaScript to load content. Try using the business\'s official website instead, or copy information manually.',
          suggestion: 'For Google Maps: 1) Right-click on the place → "What\'s here?" to get coordinates, 2) Check if the business has a website link, 3) Use the business name to search for their official website.'
        };
        res.json(data);
        return;
      } else {
        console.log('⚠️ Website scraping found no useful business information');
        const data = {
          success: false,
          error: 'No useful business information found on this page. The page may not contain structured data or may require JavaScript to load content.',
          suggestion: 'Try: 1) A different page on the same website (like an "About" or "Contact" page), 2) The business\'s Google Maps listing, 3) Copy information manually from the website.'
        };
        res.json(data);
        return;
      }
    }

    console.log(`✅ Scraping successful from ${source}:`, businessInfo);

    const data = {
      success: true,
      data: businessInfo,
      source: source
    };
    
    res.json(data);

  } catch (error) {
    handleError(res, error, 'Failed to scrape business information');
  }
});

export default router;