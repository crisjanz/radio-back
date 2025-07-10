"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchGoogleBusiness = searchGoogleBusiness;
exports.hasGoogleBusinessListing = hasGoogleBusinessListing;
async function searchGoogleBusiness(stationName, location, additionalKeywords) {
    const result = {
        found: false,
        results: []
    };
    try {
        console.log(`🔍 Searching Google Business for: ${stationName}`);
        const searchQueries = buildSearchQueries(stationName, location, additionalKeywords);
        for (const query of searchQueries) {
            try {
                const searchResult = await performGoogleSearch(query);
                if (searchResult.results.length > 0) {
                    result.results.push(...searchResult.results);
                }
            }
            catch (error) {
                console.log(`⚠️ Search failed for query: ${query}`);
            }
        }
        if (result.results.length > 0) {
            result.found = true;
            result.bestMatch = findBestMatch(result.results, stationName);
            console.log(`✅ Found ${result.results.length} results, best match: ${result.bestMatch?.name}`);
        }
        else {
            console.log(`❌ No Google Business listings found for: ${stationName}`);
        }
    }
    catch (error) {
        console.error('❌ Error in Google Business search:', error);
        result.error = error instanceof Error ? error.message : 'Search failed';
    }
    return result;
}
function buildSearchQueries(stationName, location, additionalKeywords = []) {
    const queries = [];
    const cleanName = cleanStationName(stationName);
    const baseTerms = [cleanName, 'radio station'];
    if (location) {
        const cleanLocation = location.replace(/,.*$/, '').trim();
        baseTerms.push(cleanLocation);
    }
    if (additionalKeywords && additionalKeywords.length > 0) {
        baseTerms.push(...additionalKeywords);
    }
    queries.push(`"${cleanName}" radio station ${location || ''}`.trim());
    queries.push(`"${cleanName}" ${location || ''} site:maps.google.com`.trim());
    queries.push(`"${cleanName}" radio`.trim());
    queries.push(`${cleanName} radio station ${location || ''}`.trim());
    const callSignMatch = stationName.match(/\b[KCWV][A-Z]{2,3}\b/);
    if (callSignMatch) {
        queries.push(`"${callSignMatch[0]}" radio station ${location || ''}`.trim());
    }
    return queries.filter(q => q.length > 0);
}
function cleanStationName(name) {
    return name
        .replace(/\b(FM|AM|Radio|Station)\b/gi, '')
        .replace(/\b\d+\.\d+\b/g, '')
        .replace(/\b\d+\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}
function extractStationNameFromQuery(query) {
    return query
        .replace(/radio station/gi, '')
        .replace(/\b(FM|AM|Radio|Station)\b/gi, '')
        .replace(/google business/gi, '')
        .replace(/\s+/g, ' ')
        .trim();
}
async function performGoogleSearch(query) {
    const results = [];
    try {
        const mapsSearchUrl = `https://www.google.com/maps/search/${encodeURIComponent(query)}`;
        results.push({
            businessUrl: mapsSearchUrl,
            name: extractStationNameFromQuery(query),
            confidence: 70,
            source: 'google-search'
        });
        const locationMatch = query.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),?\s*([A-Z]{2,})\b/);
        if (locationMatch) {
            const [, city, state] = locationMatch;
            const stationName = query.replace(locationMatch[0], '').replace(/radio station/gi, '').trim();
            if (stationName) {
                const specificUrl = `https://www.google.com/maps/search/${encodeURIComponent(stationName + ' ' + city + ' ' + state)}`;
                results.push({
                    businessUrl: specificUrl,
                    name: stationName,
                    address: `${city}, ${state}`,
                    confidence: 85,
                    source: 'google-search'
                });
            }
        }
        const businessSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(query + ' google business')}&tbm=lcl`;
        results.push({
            businessUrl: businessSearchUrl,
            name: extractStationNameFromQuery(query),
            confidence: 60,
            source: 'google-search'
        });
        console.log(`✅ Generated ${results.length} Google Maps URLs for: ${query}`);
        return { results };
    }
    catch (error) {
        console.error(`❌ Error generating Google URLs for "${query}":`, error);
        return { results: [] };
    }
}
function extractGoogleBusinessUrls(html, originalQuery) {
    const results = [];
    const urlPatterns = [
        /https:\/\/(?:www\.)?google\.com\/maps\/place\/[^"'\s>]+/g,
        /https:\/\/maps\.app\.goo\.gl\/[^"'\s>]+/g,
        /https:\/\/(?:www\.)?google\.com\/search\?q=[^"'\s>]*maps[^"'\s>]*/g
    ];
    for (const pattern of urlPatterns) {
        const matches = html.match(pattern);
        if (matches) {
            for (const url of matches) {
                const cleanUrl = url.replace(/[&"'>]+$/, '');
                if (results.find(r => r.businessUrl === cleanUrl))
                    continue;
                const businessName = extractBusinessNameFromUrl(cleanUrl) || extractBusinessNameFromContext(html, cleanUrl);
                results.push({
                    businessUrl: cleanUrl,
                    name: businessName,
                    confidence: calculateUrlConfidence(cleanUrl, originalQuery),
                    source: 'google-search'
                });
            }
        }
    }
    const structuredData = extractStructuredBusinessData(html);
    results.push(...structuredData);
    return results.slice(0, 5);
}
function extractBusinessNameFromUrl(url) {
    const placeMatch = url.match(/\/place\/([^\/]+)/);
    if (placeMatch) {
        const placeName = decodeURIComponent(placeMatch[1]);
        return placeName.replace(/\+/g, ' ').trim();
    }
    return undefined;
}
function extractBusinessNameFromContext(html, url) {
    const urlIndex = html.indexOf(url);
    if (urlIndex === -1)
        return undefined;
    const contextStart = Math.max(0, urlIndex - 200);
    const contextEnd = Math.min(html.length, urlIndex + 200);
    const context = html.substring(contextStart, contextEnd);
    const namePatterns = [
        /<h3[^>]*>([^<]+)<\/h3>/,
        /"title":"([^"]+)"/,
        /aria-label="([^"]+)"/
    ];
    for (const pattern of namePatterns) {
        const match = context.match(pattern);
        if (match && match[1] && match[1].length > 3) {
            return match[1].trim();
        }
    }
    return undefined;
}
function extractStructuredBusinessData(html) {
    const results = [];
    const jsonLdPattern = /<script type="application\/ld\+json"[^>]*>(.*?)<\/script>/gs;
    const jsonMatches = html.match(jsonLdPattern);
    if (jsonMatches) {
        for (const match of jsonMatches) {
            try {
                const jsonContent = match.replace(/<script[^>]*>/, '').replace(/<\/script>/, '');
                const data = JSON.parse(jsonContent);
                if (data['@type'] === 'LocalBusiness' || data['@type'] === 'Organization') {
                    results.push({
                        name: data.name,
                        address: data.address?.streetAddress || data.address,
                        phone: data.telephone,
                        website: data.url,
                        confidence: 70,
                        source: 'google-search'
                    });
                }
            }
            catch (error) {
            }
        }
    }
    return results;
}
function calculateUrlConfidence(url, originalQuery) {
    let confidence = 50;
    if (url.includes('maps.google.com') || url.includes('maps.app.goo.gl')) {
        confidence += 30;
    }
    const queryTerms = originalQuery.toLowerCase().split(' ').filter(term => term.length > 2);
    for (const term of queryTerms) {
        if (url.toLowerCase().includes(term)) {
            confidence += 10;
        }
    }
    if (url.includes('/place/')) {
        confidence += 20;
    }
    return Math.min(confidence, 100);
}
function findBestMatch(results, originalStationName) {
    if (results.length === 1)
        return results[0];
    const scoredResults = results.map(result => {
        let score = result.confidence;
        if (result.name) {
            const similarity = calculateNameSimilarity(result.name, originalStationName);
            score += similarity * 30;
        }
        if (result.address)
            score += 10;
        if (result.phone)
            score += 10;
        if (result.website)
            score += 10;
        return { ...result, score };
    });
    return scoredResults.reduce((best, current) => current.score > best.score ? current : best);
}
function calculateNameSimilarity(name1, name2) {
    const clean1 = name1.toLowerCase().replace(/[^a-z0-9]/g, '');
    const clean2 = name2.toLowerCase().replace(/[^a-z0-9]/g, '');
    if (clean1 === clean2)
        return 1.0;
    const longer = clean1.length > clean2.length ? clean1 : clean2;
    const shorter = clean1.length > clean2.length ? clean2 : clean1;
    if (longer.includes(shorter))
        return 0.8;
    const words1 = name1.toLowerCase().split(/\s+/);
    const words2 = name2.toLowerCase().split(/\s+/);
    const commonWords = words1.filter(word => words2.includes(word) && word.length > 2);
    return Math.min(commonWords.length / Math.max(words1.length, words2.length), 1.0);
}
async function hasGoogleBusinessListing(stationName, location) {
    try {
        const result = await searchGoogleBusiness(stationName, location);
        return result.found && (result.bestMatch?.confidence || 0) > 60;
    }
    catch (error) {
        return false;
    }
}
