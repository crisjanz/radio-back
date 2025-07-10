"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.analyzeRadioStream = analyzeRadioStream;
exports.testStreamConnectivity = testStreamConnectivity;
const node_fetch_1 = __importDefault(require("node-fetch"));
const GENRE_KEYWORDS = {
    rock: ['rock', 'alternative', 'indie', 'grunge', 'punk', 'metal'],
    pop: ['pop', 'top 40', 'hits', 'contemporary', 'mainstream'],
    jazz: ['jazz', 'smooth', 'bebop', 'fusion', 'swing'],
    classical: ['classical', 'symphony', 'orchestra', 'opera', 'baroque'],
    country: ['country', 'bluegrass', 'americana', 'folk', 'western'],
    electronic: ['electronic', 'edm', 'techno', 'house', 'trance', 'ambient'],
    hip_hop: ['hip hop', 'rap', 'urban', 'r&b', 'soul'],
    latin: ['latin', 'salsa', 'reggaeton', 'bachata', 'merengue', 'spanish'],
    world: ['world', 'ethnic', 'traditional', 'international'],
    blues: ['blues', 'delta', 'chicago blues'],
    reggae: ['reggae', 'ska', 'dub', 'dancehall'],
    oldies: ['oldies', 'classic hits', 'retro', 'vintage', '50s', '60s', '70s', '80s', '90s'],
    news: ['news', 'talk', 'information', 'current affairs', 'politics'],
    sports: ['sports', 'espn', 'game', 'football', 'basketball', 'baseball']
};
const TYPE_KEYWORDS = {
    music: ['music', 'songs', 'hits', 'fm', 'playlist'],
    talk: ['talk', 'discussion', 'interview', 'chat', 'conversation'],
    news: ['news', 'information', 'current', 'breaking', 'headlines'],
    sports: ['sports', 'game', 'live sports', 'espn', 'athletic'],
    religious: ['religious', 'christian', 'gospel', 'spiritual', 'faith'],
    educational: ['educational', 'learning', 'university', 'college', 'academic'],
    community: ['community', 'local', 'public', 'civic'],
    commercial: ['commercial', 'advertising', 'business'],
    variety: ['variety', 'mixed', 'diverse', 'eclectic']
};
async function analyzeRadioStream(streamUrl) {
    const result = {
        genres: [],
        types: [],
        confidence: 0,
        metadata: { confidence: 0, source: 'icy-headers' }
    };
    try {
        console.log(`🎵 Analyzing stream: ${streamUrl}`);
        const metadata = await getICYMetadata(streamUrl);
        result.metadata = metadata;
        if (metadata.error) {
            result.error = metadata.error;
            return result;
        }
        const genres = analyzeGenreFromMetadata(metadata);
        const types = analyzeTypeFromMetadata(metadata);
        result.genres = genres;
        result.types = types;
        result.confidence = metadata.confidence;
        console.log(`   ✅ Analysis complete - Genres: ${genres.join(', ')}, Types: ${types.join(', ')}`);
    }
    catch (error) {
        console.error('❌ Error analyzing stream:', error);
        result.error = error instanceof Error ? error.message : 'Stream analysis failed';
    }
    return result;
}
async function getICYMetadata(streamUrl) {
    const metadata = { confidence: 0, source: 'icy-headers' };
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
        const response = await (0, node_fetch_1.default)(streamUrl, {
            method: 'GET',
            headers: {
                'Icy-MetaData': '1',
                'User-Agent': 'RadioStreamAnalyzer/1.0',
                'Accept': '*/*',
                'Connection': 'close'
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        if (!response.ok) {
            metadata.error = `Stream returned ${response.status}`;
            return metadata;
        }
        const headers = response.headers;
        const icyGenre = headers.get('icy-genre') || headers.get('ice-genre');
        if (icyGenre) {
            metadata.genre = icyGenre.trim();
            metadata.confidence += 30;
            console.log(`   🎯 ICY Genre: ${icyGenre}`);
        }
        const icyName = headers.get('icy-name') || headers.get('ice-name');
        if (icyName) {
            metadata.name = icyName.trim();
            metadata.confidence += 20;
            console.log(`   📻 ICY Name: ${icyName}`);
        }
        const icyDesc = headers.get('icy-description') || headers.get('ice-description');
        if (icyDesc) {
            metadata.description = icyDesc.trim();
            metadata.confidence += 15;
            console.log(`   📝 ICY Description: ${icyDesc}`);
        }
        const contentType = headers.get('content-type');
        if (contentType) {
            metadata.contentType = contentType;
            metadata.isMusic = contentType.includes('audio');
            metadata.confidence += 10;
        }
        const icyBitrate = headers.get('icy-br') || headers.get('ice-bitrate');
        if (icyBitrate) {
            metadata.bitrate = parseInt(icyBitrate);
            metadata.confidence += 5;
        }
        try {
            const reader = response.body?.getReader();
            if (reader) {
                const { value } = await reader.read();
                reader.releaseLock();
                if (value) {
                    const chunk = new TextDecoder('utf-8', { fatal: false }).decode(value);
                    const nowPlayingMatch = chunk.match(/StreamTitle='([^']+)'/);
                    if (nowPlayingMatch) {
                        metadata.nowPlaying = nowPlayingMatch[1];
                        metadata.confidence += 10;
                        console.log(`   🎵 Now Playing: ${nowPlayingMatch[1]}`);
                    }
                }
            }
        }
        catch (streamError) {
            console.log('   ⚠️ Could not read stream data for "Now Playing"');
        }
    }
    catch (error) {
        console.error('❌ Error getting ICY metadata:', error);
        metadata.error = error instanceof Error ? error.message : 'Failed to read stream metadata';
    }
    return metadata;
}
function analyzeGenreFromMetadata(metadata) {
    const genres = new Set();
    const searchText = [
        metadata.genre,
        metadata.name,
        metadata.description,
        metadata.nowPlaying
    ].filter(Boolean).join(' ').toLowerCase();
    if (!searchText)
        return [];
    for (const [genre, keywords] of Object.entries(GENRE_KEYWORDS)) {
        for (const keyword of keywords) {
            if (searchText.includes(keyword.toLowerCase())) {
                genres.add(genre);
                break;
            }
        }
    }
    return Array.from(genres);
}
function analyzeTypeFromMetadata(metadata) {
    const types = new Set();
    const searchText = [
        metadata.genre,
        metadata.name,
        metadata.description,
        metadata.nowPlaying
    ].filter(Boolean).join(' ').toLowerCase();
    if (!searchText) {
        if (metadata.isMusic) {
            return ['music'];
        }
        return [];
    }
    for (const [type, keywords] of Object.entries(TYPE_KEYWORDS)) {
        for (const keyword of keywords) {
            if (searchText.includes(keyword.toLowerCase())) {
                types.add(type);
                break;
            }
        }
    }
    if (types.size === 0) {
        if (metadata.isMusic || searchText.includes('music') || searchText.includes('fm')) {
            types.add('music');
        }
        else if (searchText.includes('talk') || searchText.includes('am')) {
            types.add('talk');
        }
    }
    return Array.from(types);
}
async function testStreamConnectivity(streamUrl) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await (0, node_fetch_1.default)(streamUrl, {
            method: 'HEAD',
            signal: controller.signal,
            headers: {
                'User-Agent': 'RadioStreamTester/1.0'
            }
        });
        clearTimeout(timeoutId);
        return {
            accessible: response.ok,
            contentType: response.headers.get('content-type') || undefined,
            error: response.ok ? undefined : `HTTP ${response.status}`
        };
    }
    catch (error) {
        return {
            accessible: false,
            error: error instanceof Error ? error.message : 'Connection failed'
        };
    }
}
