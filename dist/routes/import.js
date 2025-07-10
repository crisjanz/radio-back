"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const client_1 = require("@prisma/client");
const node_fetch_1 = __importDefault(require("node-fetch"));
const router = (0, express_1.Router)();
const prisma = new client_1.PrismaClient();
async function getNextAvailableStationId() {
    try {
        const existingIds = await prisma.station.findMany({
            select: { id: true },
            orderBy: { id: 'asc' }
        });
        let expectedId = 1;
        for (const station of existingIds) {
            if (station.id !== expectedId) {
                console.log(`🔢 Found ID gap: using ID ${expectedId} instead of next sequential ID`);
                return expectedId;
            }
            expectedId++;
        }
        console.log(`🔢 No ID gaps found: using next sequential ID ${expectedId}`);
        return expectedId;
    }
    catch (error) {
        console.error('❌ Error finding available station ID:', error);
        throw error;
    }
}
const decodeHtmlEntities = (text) => {
    if (!text)
        return text;
    return text
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
        .replace(/&#(\d+);/g, (match, num) => String.fromCharCode(parseInt(num, 10)))
        .replace(/&#x([0-9a-f]+);/gi, (match, hex) => String.fromCharCode(parseInt(hex, 16)))
        .replace(/\s+/g, ' ')
        .trim();
};
const extractCityFromState = (state) => {
    if (!state)
        return null;
    const cleaned = state.trim();
    if (cleaned.length > 2 && !/^[A-Z]{2}$/.test(cleaned)) {
        if (cleaned.includes(',')) {
            const parts = cleaned.split(',').map(p => p.trim());
            return parts[0];
        }
        const words = cleaned.split(/\s+/);
        if (words.length >= 2) {
            const lastWord = words[words.length - 1];
            if (lastWord.length === 2 && lastWord === lastWord.toUpperCase()) {
                return words.slice(0, -1).join(' ');
            }
        }
        return cleaned;
    }
    return null;
};
const extractCityFromName = (name) => {
    if (!name)
        return null;
    const parenthesesMatch = name.match(/\(([^)]+)\)$/);
    if (parenthesesMatch) {
        const cityCandidate = parenthesesMatch[1].trim();
        if (cityCandidate.length > 2) {
            return cityCandidate;
        }
    }
    const dashMatch = name.match(/[-–]\s*([A-Z][a-zA-Z\s]+)$/);
    if (dashMatch) {
        const cityCandidate = dashMatch[1].trim();
        if (cityCandidate.length > 2 && !cityCandidate.includes('FM') && !cityCandidate.includes('AM')) {
            return cityCandidate;
        }
    }
    const prefixMatch = name.match(/^([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+/);
    if (prefixMatch) {
        const cityCandidate = prefixMatch[1].trim();
        const radioTerms = ['Radio', 'FM', 'AM', 'Station', 'Music', 'News', 'BBC', 'CBC', 'NPR'];
        if (cityCandidate.length > 2 && !radioTerms.some(term => cityCandidate.includes(term))) {
            return cityCandidate;
        }
    }
    return null;
};
router.post('/radio-browser', async (req, res) => {
    try {
        const { countrycode = '', limit = 100, offset = 0, name = '', tag = '', language = '' } = req.body;
        console.log('🌐 Importing from Radio-Browser API...');
        console.log(`   📊 Parameters: country=${countrycode}, limit=${limit}, offset=${offset}`);
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
            hidebroken: 'true',
            order: 'clickcount',
            reverse: 'true'
        });
        if (countrycode)
            params.append('countrycode', countrycode);
        if (name)
            params.append('name', name);
        if (tag)
            params.append('tag', tag);
        if (language)
            params.append('language', language);
        const response = await (0, node_fetch_1.default)(`https://de1.api.radio-browser.info/json/stations/search?${params.toString()}`);
        if (!response.ok) {
            throw new Error(`Radio-Browser API returned ${response.status}`);
        }
        const stations = await response.json();
        console.log(`   📻 Fetched ${stations.length} stations from API`);
        let imported = 0;
        let skipped = 0;
        const errors = [];
        for (const station of stations) {
            try {
                const existing = await prisma.station.findFirst({
                    where: {
                        OR: [
                            { streamUrl: station.url || station.url_resolved },
                            { name: station.name, country: station.country }
                        ]
                    }
                });
                if (existing) {
                    skipped++;
                    continue;
                }
                let extractedCity = extractCityFromState(station.state) || extractCityFromName(station.name);
                const stationLanguage = station.languagecodes || station.language || null;
                const optimalId = await getNextAvailableStationId();
                await prisma.station.create({
                    data: {
                        id: optimalId,
                        name: decodeHtmlEntities(station.name) || 'Unknown Station',
                        streamUrl: station.url_resolved || station.url || '',
                        homepage: station.homepage || null,
                        favicon: station.favicon || null,
                        country: station.country || 'Unknown',
                        city: extractedCity,
                        state: station.state || null,
                        language: stationLanguage,
                        genre: station.tags || null,
                        type: 'music',
                        bitrate: station.bitrate || null,
                        codec: station.codec || null,
                        description: null,
                        frequency: null,
                        tags: station.tags || null,
                        latitude: station.geo_lat ? parseFloat(station.geo_lat) : null,
                        longitude: station.geo_long ? parseFloat(station.geo_long) : null,
                        clickcount: station.clickcount || null,
                        votes: station.votes || null,
                        radioBrowserUuid: station.stationuuid || null,
                    }
                });
                imported++;
            }
            catch (error) {
                console.error(`❌ Error importing station "${station.name}":`, error);
                errors.push(`${station.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        console.log(`✅ Import complete: ${imported} imported, ${skipped} skipped`);
        return res.json({
            success: true,
            imported,
            skipped,
            total: stations.length,
            errors: errors.slice(0, 10)
        });
    }
    catch (error) {
        console.error('❌ Error during Radio-Browser import:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Import failed'
        });
    }
});
router.post('/quick-start', async (req, res) => {
    try {
        console.log('🚀 Starting quick import...');
        const countries = ['CA', 'US', 'GB', 'AU', 'DE'];
        let totalImported = 0;
        let totalSkipped = 0;
        for (const countrycode of countries) {
            try {
                const protocol = req.protocol;
                const host = req.get('host');
                const baseUrl = `${protocol}://${host}`;
                const importResponse = await (0, node_fetch_1.default)(`${baseUrl}/import/radio-browser`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        countrycode,
                        limit: 50
                    })
                });
                if (importResponse.ok) {
                    const result = await importResponse.json();
                    totalImported += result.imported || 0;
                    totalSkipped += result.skipped || 0;
                    console.log(`   ✅ ${countrycode}: ${result.imported} imported, ${result.skipped} skipped`);
                }
            }
            catch (error) {
                console.error(`❌ Error importing from ${countrycode}:`, error);
            }
        }
        console.log(`🎉 Quick import complete: ${totalImported} total imported, ${totalSkipped} total skipped`);
        return res.json({
            success: true,
            imported: totalImported,
            skipped: totalSkipped,
            countries: countries.length
        });
    }
    catch (error) {
        console.error('❌ Error during quick import:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Quick import failed'
        });
    }
});
router.get('/countries', async (req, res) => {
    try {
        const response = await (0, node_fetch_1.default)('https://de1.api.radio-browser.info/json/countries');
        if (!response.ok) {
            throw new Error(`Radio-Browser API returned ${response.status}`);
        }
        const countries = await response.json();
        const countryNames = countries
            .filter(country => country.stationcount > 0)
            .map(country => country.name)
            .sort();
        return res.json({ countries: countryNames });
    }
    catch (error) {
        console.error('❌ Error fetching countries:', error);
        return res.status(500).json({ error: 'Failed to fetch countries' });
    }
});
router.get('/states/:country', async (req, res) => {
    try {
        const { country } = req.params;
        const response = await (0, node_fetch_1.default)(`https://de1.api.radio-browser.info/json/stations/search?country=${encodeURIComponent(country)}&limit=1000`);
        if (!response.ok) {
            throw new Error(`Radio-Browser API returned ${response.status}`);
        }
        const stations = await response.json();
        const stateSet = new Set();
        stations.forEach((station) => {
            if (station.state && station.state.trim()) {
                const cleanState = station.state.trim();
                if (cleanState !== country &&
                    cleanState !== 'Canada' &&
                    !cleanState.includes('Non ') &&
                    cleanState.length > 1) {
                    stateSet.add(cleanState);
                }
            }
        });
        const stateNames = Array.from(stateSet).sort();
        return res.json({ states: stateNames });
    }
    catch (error) {
        console.error('❌ Error fetching states:', error);
        return res.status(500).json({ error: 'Failed to fetch states' });
    }
});
router.get('/preview', async (req, res) => {
    try {
        console.log('📊 Preview request query params:', req.query);
        const { name = '', country = '', state = '', minVotes = '0', minBitrate = '0', hasGeo = 'false', hidebroken = 'true', order = 'clickcount', limit = '100' } = req.query;
        const params = new URLSearchParams({
            limit: limit.toString(),
            hidebroken: hidebroken.toString(),
            order: order.toString(),
            reverse: 'true'
        });
        if (name)
            params.append('name', name.toString());
        if (country)
            params.append('country', country.toString());
        if (state)
            params.append('state', state.toString());
        if (parseInt(minVotes.toString()) > 0)
            params.append('votes_min', minVotes.toString());
        if (parseInt(minBitrate.toString()) > 0)
            params.append('bitrate_min', minBitrate.toString());
        if (hasGeo === 'true')
            params.append('has_geo', 'true');
        const apiUrl = `https://de1.api.radio-browser.info/json/stations/search?${params.toString()}`;
        console.log('🌐 Radio Browser API URL:', apiUrl);
        const response = await (0, node_fetch_1.default)(apiUrl);
        if (!response.ok) {
            throw new Error(`Radio-Browser API returned ${response.status}`);
        }
        const allStations = await response.json();
        let filteredStations = allStations;
        filteredStations = filteredStations.filter(station => station.lastcheckok === 1);
        const minVotesNum = parseInt(minVotes.toString());
        if (minVotesNum > 0) {
            filteredStations = filteredStations.filter(station => (station.votes || 0) >= minVotesNum);
        }
        const minBitrateNum = parseInt(minBitrate.toString());
        if (minBitrateNum > 0) {
            filteredStations = filteredStations.filter(station => (station.bitrate || 0) >= minBitrateNum);
        }
        if (hasGeo === 'true') {
            filteredStations = filteredStations.filter(station => station.geo_lat && station.geo_long);
        }
        console.log(`🔍 Filtered ${allStations.length} -> ${filteredStations.length} stations`);
        return res.json({ stations: filteredStations });
    }
    catch (error) {
        console.error('❌ Error fetching preview stations:', error);
        return res.status(500).json({ error: 'Failed to fetch preview stations' });
    }
});
router.post('/stations', async (req, res) => {
    try {
        const { stations } = req.body;
        if (!Array.isArray(stations) || stations.length === 0) {
            return res.status(400).json({ error: 'No stations provided' });
        }
        let imported = 0;
        let duplicates = 0;
        const errors = [];
        console.log(`📦 Starting import of ${stations.length} stations...`);
        for (const station of stations) {
            try {
                const existing = await prisma.station.findFirst({
                    where: {
                        OR: [
                            { streamUrl: station.url || station.url_resolved },
                            { name: station.name, country: station.country }
                        ]
                    }
                });
                if (existing) {
                    console.log(`⚠️  Duplicate found: "${station.name}" (${existing.streamUrl})`);
                    duplicates++;
                    continue;
                }
                let extractedCity = extractCityFromState(station.state) || extractCityFromName(station.name);
                const stationLanguage = station.languagecodes || station.language || null;
                const optimalId = await getNextAvailableStationId();
                await prisma.station.create({
                    data: {
                        id: optimalId,
                        name: decodeHtmlEntities(station.name) || 'Unknown Station',
                        streamUrl: station.url_resolved || station.url || '',
                        homepage: station.homepage || null,
                        favicon: station.favicon || null,
                        country: station.country || 'Unknown',
                        city: extractedCity,
                        state: station.state || null,
                        language: stationLanguage,
                        genre: station.tags || null,
                        type: 'music',
                        bitrate: station.bitrate || null,
                        codec: station.codec || null,
                        description: null,
                        frequency: null,
                        tags: station.tags || null,
                        latitude: station.geo_lat ? parseFloat(station.geo_lat) : null,
                        longitude: station.geo_long ? parseFloat(station.geo_long) : null,
                        clickcount: station.clickcount || null,
                        votes: station.votes || null,
                        radioBrowserUuid: station.stationuuid || null,
                    }
                });
                console.log(`✅ Imported: "${station.name}"`);
                imported++;
            }
            catch (error) {
                console.error(`❌ Error importing station "${station.name}":`, error);
                errors.push(`${station.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }
        console.log(`🎉 Import complete: ${imported} imported, ${duplicates} duplicates, ${errors.length} errors`);
        return res.json({
            success: true,
            imported,
            duplicates,
            errors
        });
    }
    catch (error) {
        console.error('❌ Error importing stations:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Import failed'
        });
    }
});
router.get('/stats', async (req, res) => {
    try {
        const [totalStations, countryCounts, recentImports] = await Promise.all([
            prisma.station.count(),
            prisma.station.groupBy({
                by: ['country'],
                _count: true,
                orderBy: { _count: { country: 'desc' } }
            }),
            prisma.station.findMany({
                select: { id: true, name: true, country: true, createdAt: true },
                orderBy: { createdAt: 'desc' },
                take: 10
            })
        ]);
        return res.json({
            totalStations,
            countries: countryCounts.length,
            topCountries: countryCounts.slice(0, 10),
            recentImports
        });
    }
    catch (error) {
        console.error('❌ Error fetching import stats:', error);
        return res.status(500).json({ error: 'Failed to fetch import statistics' });
    }
});
router.get('/missing-ratings', async (req, res) => {
    try {
        const [missingVotes, missingClickcount, missingUuid, missingAny, totalStations] = await Promise.all([
            prisma.station.count({ where: { votes: null } }),
            prisma.station.count({ where: { clickcount: null } }),
            prisma.station.count({ where: { radioBrowserUuid: null } }),
            prisma.station.count({
                where: {
                    OR: [
                        { votes: null },
                        { clickcount: null },
                        { radioBrowserUuid: null }
                    ]
                }
            }),
            prisma.station.count()
        ]);
        return res.json({
            success: true,
            summary: {
                totalStations,
                missingVotes,
                missingClickcount,
                missingUuid,
                missingAny,
                percentageComplete: Math.round(((totalStations - missingAny) / totalStations) * 100)
            }
        });
    }
    catch (error) {
        console.error('❌ Error checking missing ratings:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Failed to check missing ratings'
        });
    }
});
router.post('/update-ratings', async (req, res) => {
    try {
        const { maxStations = 100, forceUpdate = false } = req.body;
        console.log('🔄 Starting bulk ratings update...');
        const stationsToUpdate = await prisma.station.findMany({
            where: forceUpdate ? {} : {
                OR: [
                    { votes: null },
                    { clickcount: null },
                    { radioBrowserUuid: null }
                ]
            },
            take: maxStations,
            orderBy: { createdAt: 'desc' }
        });
        console.log(`📊 Found ${stationsToUpdate.length} stations to update`);
        let updated = 0;
        let notFound = 0;
        let errors = 0;
        const results = [];
        for (const station of stationsToUpdate) {
            try {
                console.log(`🔍 Searching for: "${station.name}" - ${station.country}`);
                const searchParams = new URLSearchParams({
                    name: station.name,
                    country: station.country,
                    limit: '10'
                });
                const response = await (0, node_fetch_1.default)(`https://de1.api.radio-browser.info/json/stations/search?${searchParams}`);
                if (!response.ok) {
                    console.log(`❌ API error for ${station.name}`);
                    errors++;
                    continue;
                }
                const rbStations = await response.json();
                let match = rbStations.find(rb => rb.name.toLowerCase().trim() === station.name.toLowerCase().trim() &&
                    rb.country === station.country);
                if (!match && station.streamUrl) {
                    match = rbStations.find(rb => rb.url === station.streamUrl ||
                        rb.url_resolved === station.streamUrl);
                }
                if (!match) {
                    match = rbStations.find(rb => {
                        const rbName = rb.name.toLowerCase().replace(/[^\w\s]/g, '');
                        const stationName = station.name.toLowerCase().replace(/[^\w\s]/g, '');
                        return rbName.includes(stationName) || stationName.includes(rbName);
                    });
                }
                if (match) {
                    await prisma.station.update({
                        where: { id: station.id },
                        data: {
                            votes: match.votes || null,
                            clickcount: match.clickcount || null,
                            radioBrowserUuid: match.stationuuid || null,
                            favicon: station.favicon || match.favicon || null,
                            homepage: station.homepage || match.homepage || null,
                            bitrate: station.bitrate || match.bitrate || null,
                            codec: station.codec || match.codec || null,
                            updatedAt: new Date()
                        }
                    });
                    console.log(`✅ Updated: ${station.name} - votes: ${match.votes}, clicks: ${match.clickcount}`);
                    results.push({
                        stationId: station.id,
                        name: station.name,
                        country: station.country,
                        votes: match.votes,
                        clickcount: match.clickcount,
                        radioBrowserUuid: match.stationuuid,
                        status: 'updated'
                    });
                    updated++;
                }
                else {
                    console.log(`❌ No match found for: ${station.name}`);
                    results.push({
                        stationId: station.id,
                        name: station.name,
                        country: station.country,
                        status: 'not_found'
                    });
                    notFound++;
                }
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            catch (error) {
                console.error(`❌ Error updating ${station.name}:`, error);
                errors++;
                results.push({
                    stationId: station.id,
                    name: station.name,
                    error: error instanceof Error ? error.message : 'Unknown error',
                    status: 'error'
                });
            }
        }
        console.log(`🎉 Bulk update complete: ${updated} updated, ${notFound} not found, ${errors} errors`);
        return res.json({
            success: true,
            summary: {
                totalProcessed: stationsToUpdate.length,
                updated,
                notFound,
                errors
            },
            results
        });
    }
    catch (error) {
        console.error('❌ Error in bulk ratings update:', error);
        return res.status(500).json({
            success: false,
            error: error instanceof Error ? error.message : 'Bulk update failed'
        });
    }
});
exports.default = router;
