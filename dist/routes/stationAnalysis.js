"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const node_fetch_1 = __importDefault(require("node-fetch"));
const streamAnalyzer_js_1 = require("../utils/streamAnalyzer.js");
const googleBusinessSearch_js_1 = require("../utils/googleBusinessSearch.js");
const genres_js_1 = require("../constants/genres.js");
const collectionTags_js_1 = require("../constants/collectionTags.js");
const router = (0, express_1.Router)();
router.post('/analyze', async (req, res) => {
    try {
        const { name, description, streamUrl, website, location } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Station name is required' });
        }
        console.log(`🔍 Starting comprehensive analysis for: ${name}`);
        const result = {
            genres: [],
            subgenres: [],
            types: [],
            tags: [],
            confidence: 0,
            sources: [],
            details: {}
        };
        const analyses = [];
        if (name) {
            const nameAnalysis = analyzeStationName(name);
            if (nameAnalysis.genres.length > 0 || nameAnalysis.types.length > 0) {
                analyses.push(nameAnalysis);
                result.details.nameAnalysis = nameAnalysis;
                console.log(`   📛 Name analysis: ${nameAnalysis.genres.join(', ')}`);
            }
        }
        if (description) {
            const descAnalysis = analyzeDescription(description);
            if (descAnalysis.genres.length > 0 || descAnalysis.types.length > 0) {
                analyses.push(descAnalysis);
                result.details.descriptionAnalysis = descAnalysis;
                console.log(`   📝 Description analysis: ${descAnalysis.genres.join(', ')}`);
            }
        }
        if (streamUrl) {
            try {
                const streamAnalysis = await (0, streamAnalyzer_js_1.analyzeRadioStream)(streamUrl);
                if (streamAnalysis.genres.length > 0 || streamAnalysis.types.length > 0) {
                    analyses.push({
                        genres: streamAnalysis.genres,
                        types: streamAnalysis.types,
                        confidence: streamAnalysis.confidence,
                        source: 'stream-metadata'
                    });
                    result.details.streamAnalysis = streamAnalysis;
                    console.log(`   🎵 Stream analysis: ${streamAnalysis.genres.join(', ')}`);
                }
            }
            catch (error) {
                console.log(`   ⚠️ Stream analysis failed: ${error}`);
            }
        }
        if (website) {
            try {
                const protocol = req.protocol;
                const host = req.get('host');
                const baseUrl = `${protocol}://${host}`;
                const response = await (0, node_fetch_1.default)(`${baseUrl}/scrape/business`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: website })
                });
                if (response.ok) {
                    const scrapedData = await response.json();
                    if (scrapedData.success && scrapedData.suggestions) {
                        const webAnalysis = {
                            genres: scrapedData.suggestions.genre ? [scrapedData.suggestions.genre] : [],
                            types: scrapedData.suggestions.type ? [scrapedData.suggestions.type] : [],
                            confidence: scrapedData.suggestions.confidence || 50,
                            source: 'website-scraping'
                        };
                        if (webAnalysis.genres.length > 0 || webAnalysis.types.length > 0) {
                            analyses.push(webAnalysis);
                            result.details.webAnalysis = webAnalysis;
                            console.log(`   🌐 Website analysis: ${webAnalysis.genres.join(', ')}`);
                        }
                    }
                }
            }
            catch (error) {
                console.log(`   ⚠️ Website analysis failed: ${error}`);
            }
        }
        try {
            const apiAnalysis = await analyzeMusicBrainz(name, location);
            if (apiAnalysis.genres.length > 0) {
                analyses.push(apiAnalysis);
                result.details.apiAnalysis = apiAnalysis;
                console.log(`   🎼 MusicBrainz analysis: ${apiAnalysis.genres.join(', ')}`);
            }
        }
        catch (error) {
            console.log(`   ⚠️ MusicBrainz analysis failed: ${error}`);
        }
        const combined = combineAnalysisResults(analyses);
        result.genres = combined.genres;
        result.subgenres = combined.subgenres;
        result.types = combined.types;
        result.confidence = combined.confidence;
        result.sources = combined.sources;
        result.tags = (0, collectionTags_js_1.suggestTagsForStation)({
            name,
            description,
            genre: result.genres[0],
            subgenre: result.subgenres[0]
        });
        console.log(`   ✅ Analysis complete - Confidence: ${result.confidence}%`);
        res.json(result);
    }
    catch (error) {
        console.error('❌ Error in station analysis:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Analysis failed'
        });
    }
});
router.post('/test-stream', async (req, res) => {
    try {
        const { streamUrl } = req.body;
        if (!streamUrl) {
            return res.status(400).json({ error: 'Stream URL is required' });
        }
        const result = await (0, streamAnalyzer_js_1.testStreamConnectivity)(streamUrl);
        res.json(result);
    }
    catch (error) {
        console.error('❌ Error testing stream:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Stream test failed'
        });
    }
});
router.post('/search-google-business', async (req, res) => {
    try {
        const { name, location, additionalKeywords } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Station name is required' });
        }
        console.log(`🔍 Searching Google Business for: ${name}`);
        const result = await (0, googleBusinessSearch_js_1.searchGoogleBusiness)(name, location, additionalKeywords);
        res.json(result);
    }
    catch (error) {
        console.error('❌ Error searching Google Business:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Google Business search failed'
        });
    }
});
router.post('/check-google-business', async (req, res) => {
    try {
        const { name, location } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'Station name is required' });
        }
        const hasListing = await (0, googleBusinessSearch_js_1.hasGoogleBusinessListing)(name, location);
        res.json({ hasListing, name, location });
    }
    catch (error) {
        console.error('❌ Error checking Google Business:', error);
        res.status(500).json({
            error: error instanceof Error ? error.message : 'Google Business check failed'
        });
    }
});
function analyzeStationName(name) {
    const searchText = name.toLowerCase();
    const result = {
        genres: [],
        types: [],
        confidence: 0,
        source: 'name-analysis'
    };
    const nameGenreKeywords = {
        rock: ['rock', 'classic rock', 'hard rock', 'alternative'],
        pop: ['pop', 'hits', 'top 40', 'contemporary'],
        jazz: ['jazz', 'smooth jazz'],
        classical: ['classical', 'symphony', 'orchestral'],
        country: ['country', 'bluegrass', 'americana'],
        electronic: ['electronic', 'edm', 'dance'],
        hip_hop: ['hip hop', 'rap', 'urban'],
        latin: ['latin', 'spanish', 'latino'],
        news: ['news', 'talk', 'information'],
        sports: ['sports', 'espn', 'game'],
        oldies: ['oldies', 'classic', 'retro', '70s', '80s', '90s']
    };
    const nameTypeKeywords = {
        music: ['fm', 'music', 'radio', 'hits'],
        talk: ['talk', 'am', 'discussion'],
        news: ['news', 'information', 'current'],
        sports: ['sports', 'espn', 'game'],
        religious: ['christian', 'gospel', 'faith'],
        community: ['community', 'public', 'local']
    };
    for (const [genre, keywords] of Object.entries(nameGenreKeywords)) {
        for (const keyword of keywords) {
            if (searchText.includes(keyword)) {
                result.genres.push(genre);
                result.confidence += 30;
                break;
            }
        }
    }
    for (const [type, keywords] of Object.entries(nameTypeKeywords)) {
        for (const keyword of keywords) {
            if (searchText.includes(keyword)) {
                result.types.push(type);
                result.confidence += 20;
                break;
            }
        }
    }
    return result;
}
function analyzeDescription(description) {
    const searchText = description.toLowerCase();
    const result = {
        genres: [],
        types: [],
        confidence: 0,
        source: 'description-analysis'
    };
    const descGenreKeywords = {
        rock: ['rock', 'guitar', 'band', 'alternative', 'indie', 'metal', 'punk'],
        pop: ['pop', 'hits', 'chart', 'mainstream', 'contemporary', 'top 40'],
        jazz: ['jazz', 'smooth', 'bebop', 'swing', 'blues', 'instrumental'],
        classical: ['classical', 'symphony', 'orchestra', 'opera', 'baroque', 'chamber'],
        country: ['country', 'bluegrass', 'folk', 'americana', 'western', 'nashville'],
        electronic: ['electronic', 'techno', 'house', 'trance', 'edm', 'ambient'],
        hip_hop: ['hip hop', 'rap', 'urban', 'r&b', 'soul', 'funk'],
        latin: ['latin', 'salsa', 'reggaeton', 'bachata', 'spanish', 'latino'],
        world: ['world', 'ethnic', 'traditional', 'international', 'global'],
        oldies: ['oldies', 'classic', 'vintage', 'retro', '50s', '60s', '70s', '80s', '90s']
    };
    const descTypeKeywords = {
        music: ['music', 'songs', 'artists', 'albums', 'playlist'],
        talk: ['talk', 'discussion', 'interview', 'conversation', 'call-in'],
        news: ['news', 'current events', 'breaking', 'headlines', 'journalism'],
        sports: ['sports', 'games', 'teams', 'scores', 'athletics'],
        educational: ['educational', 'learning', 'university', 'academic'],
        religious: ['religious', 'spiritual', 'faith', 'ministry', 'worship'],
        community: ['community', 'local', 'public', 'civic', 'neighborhood']
    };
    for (const [genre, keywords] of Object.entries(descGenreKeywords)) {
        for (const keyword of keywords) {
            if (searchText.includes(keyword)) {
                result.genres.push(genre);
                result.confidence += 25;
                break;
            }
        }
    }
    for (const [type, keywords] of Object.entries(descTypeKeywords)) {
        for (const keyword of keywords) {
            if (searchText.includes(keyword)) {
                result.types.push(type);
                result.confidence += 20;
                break;
            }
        }
    }
    return result;
}
async function analyzeMusicBrainz(stationName, location) {
    const result = {
        genres: [],
        types: [],
        confidence: 0,
        source: 'musicbrainz-api'
    };
    try {
        const query = encodeURIComponent(stationName);
        const searchUrl = `https://musicbrainz.org/ws/2/label/?query=${query}&fmt=json&limit=5`;
        const response = await (0, node_fetch_1.default)(searchUrl, {
            headers: {
                'User-Agent': 'RadioStreamAnalyzer/1.0 (contact@example.com)'
            }
        });
        if (response.ok) {
            const data = await response.json();
            if (data.labels && data.labels.length > 0) {
                for (const label of data.labels) {
                    if (label.type === 'Production' || label.type === 'Original Production') {
                        result.genres.push('music');
                        result.confidence += 15;
                        break;
                    }
                }
            }
        }
    }
    catch (error) {
        console.log('MusicBrainz API error:', error);
    }
    return result;
}
function combineAnalysisResults(analyses) {
    const genreCounts = new Map();
    const typeCounts = new Map();
    const sources = new Set();
    let totalConfidence = 0;
    for (const analysis of analyses) {
        sources.add(analysis.source);
        for (const genre of analysis.genres) {
            const current = genreCounts.get(genre) || { count: 0, confidence: 0 };
            genreCounts.set(genre, {
                count: current.count + 1,
                confidence: current.confidence + (analysis.confidence || 50)
            });
        }
        for (const type of analysis.types) {
            const current = typeCounts.get(type) || { count: 0, confidence: 0 };
            typeCounts.set(type, {
                count: current.count + 1,
                confidence: current.confidence + (analysis.confidence || 50)
            });
        }
        totalConfidence += analysis.confidence || 50;
    }
    const sortedGenres = Array.from(genreCounts.entries())
        .sort((a, b) => (b[1].confidence + b[1].count * 10) - (a[1].confidence + a[1].count * 10))
        .map(([genre]) => genre);
    const sortedTypes = Array.from(typeCounts.entries())
        .sort((a, b) => (b[1].confidence + b[1].count * 10) - (a[1].confidence + a[1].count * 10))
        .map(([type]) => type);
    const subgenres = [];
    if (sortedGenres.length > 0) {
        const topGenre = sortedGenres[0];
        const availableSubgenres = (0, genres_js_1.getSubgenresForGenre)(topGenre);
        for (const analysis of analyses) {
            if (analysis.source === 'description-analysis' || analysis.source === 'website-scraping') {
                for (const subgenre of availableSubgenres) {
                    const subgenreName = subgenre.replace('-', ' ');
                    const searchTexts = [analysis.description, analysis.name].filter(Boolean);
                    for (const text of searchTexts) {
                        if (text && text.toLowerCase().includes(subgenreName)) {
                            if (!subgenres.includes(subgenre)) {
                                subgenres.push(subgenre);
                            }
                        }
                    }
                }
            }
        }
    }
    return {
        genres: sortedGenres.slice(0, 3),
        subgenres: subgenres.slice(0, 2),
        types: sortedTypes.slice(0, 2),
        confidence: Math.min(Math.round(totalConfidence / Math.max(analyses.length, 1)), 100),
        sources: Array.from(sources)
    };
}
exports.default = router;
