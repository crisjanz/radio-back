// scraping.ts
import { Router, Request, Response } from 'express';
import fetch from 'node-fetch';

const router = Router();

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
      socialMedia: {},
      coordinates: null
    };

    // Extract business name (improved patterns for modern Google Maps)
    const namePatterns = [
      // Google Maps URL patterns - extract from URL path
      /\/place\/([^\/\?%]+)/,
      /\/maps\/place\/([^\/\?%]+)/,
      // Title patterns - but not generic "Google Maps"
      /<title[^>]*>([^<]+?)\s*[-|–]\s*Google\s*Maps/i,
      // JSON data patterns for Google Maps
      /\["([^"]{3,})",null,\[\[null,null,[0-9.-]+,[0-9.-]+\]/,
      /"([^"]{3,})".*?(?:place_id|place-id)/i,
      /window\.APP_INITIALIZATION_STATE.*?"([^"]{3,})",.*?place_id/i,
      // Structured data patterns
      /"name":"([^"]{3,})"/,
      /property="og:title"[^>]*content="([^"]{3,})"/,
      // Header patterns
      /<h1[^>]*[^>]*>([^<]{3,})</,
      // Data attributes
      /data-value="([^"]{3,})"/,
      /aria-label="([^"]{3,})"/
    ];
    
    for (const pattern of namePatterns) {
      const match = html.match(pattern);
      if (match && match[1] && !businessInfo.name) {
        let name = decodeHtmlEntities(match[1].trim().replace(/\+/g, ' '));
        
        // Skip generic names
        if (name.toLowerCase() === 'google maps' || name.toLowerCase() === 'maps' || name.length < 3) {
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
          
          // Filter out invalid/weird phone numbers
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
              phone.includes('123456')) {
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

    // Extract email addresses
    const emailPattern = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    const emailMatch = html.match(emailPattern);
    if (emailMatch && emailMatch[0] && !emailMatch[0].includes('noreply') && !emailMatch[0].includes('example')) {
      businessInfo.email = emailMatch[0];
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
                         Object.keys(businessInfo.socialMedia).length > 0;

    if (!hasUsefulData && (finalUrl.includes('google.com/maps') || finalUrl.includes('maps.google.com'))) {
      console.log('⚠️ Google Maps scraping failed - likely due to JavaScript rendering');
      res.json({
        success: false,
        error: 'Google Maps pages require JavaScript to load content. Try using the business\'s official website instead, or copy information manually.',
        suggestion: 'For Google Maps: 1) Right-click on the place → "What\'s here?" to get coordinates, 2) Check if the business has a website link, 3) Use the business name to search for their official website.'
      });
      return;
    }

    console.log(`✅ Scraping successful from ${source}:`, businessInfo);

    res.json({
      success: true,
      data: businessInfo,
      source: source
    });

  } catch (error) {
    console.error('❌ Scraping failed:', error);
    res.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to scrape business information'
    });
  }
});

export default router;