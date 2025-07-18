"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.clearActiveRequests = clearActiveRequests;
exports.testIcecastMetadata = testIcecastMetadata;
const node_fetch_1 = __importDefault(require("node-fetch"));
const icecast_parser_1 = require("icecast-parser");
const utils_1 = require("../utils");
const activeRequests = new Map();
const metadataCache = new Map();
const REQUEST_CACHE_DURATION = 45000;
const METADATA_CACHE_DURATION = 30000;
function clearActiveRequests() {
    console.log(`🧹 Clearing ${activeRequests.size} active requests and ${metadataCache.size} cached entries`);
    activeRequests.clear();
    metadataCache.clear();
}
async function testIcecastMetadata(streamUrl) {
    const cached = metadataCache.get(streamUrl);
    if (cached && (Date.now() - cached.timestamp) < METADATA_CACHE_DURATION) {
        console.log('💾 Using cached metadata for:', streamUrl.slice(-20));
        return cached.data;
    }
    const existingRequest = activeRequests.get(streamUrl);
    if (existingRequest) {
        console.log('🔄 Reusing active metadata request for:', streamUrl.slice(-20));
        return existingRequest;
    }
    const requestPromise = performMetadataRequest(streamUrl);
    activeRequests.set(streamUrl, requestPromise);
    requestPromise.then((result) => {
        metadataCache.set(streamUrl, {
            data: result,
            timestamp: Date.now()
        });
        if (metadataCache.size > 100) {
            const entries = Array.from(metadataCache.entries());
            const oldEntries = entries.filter(([, data]) => (Date.now() - data.timestamp) > METADATA_CACHE_DURATION);
            oldEntries.forEach(([key]) => metadataCache.delete(key));
        }
        return result;
    }).finally(() => {
        setTimeout(() => {
            activeRequests.delete(streamUrl);
        }, REQUEST_CACHE_DURATION);
    });
    return requestPromise;
}
async function performMetadataRequest(streamUrl) {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        const response = await (0, node_fetch_1.default)(streamUrl, {
            method: 'GET',
            headers: {
                'Icy-Metadata': '1',
                'User-Agent': 'Streemr/1.0 (Metadata Detector)'
            },
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        const headers = response.headers;
        const metaint = headers.get('icy-metaint') || headers.get('ice-metaint');
        const stationName = headers.get('icy-name') || headers.get('ice-name');
        if (!metaint) {
            return {
                hasMetadata: false,
                error: 'No Icecast metadata headers found'
            };
        }
        console.log(`✅ Icecast metadata found - MetaInt: ${metaint}, Station: ${stationName}`);
        const nowPlaying = await extractCurrentTrack(streamUrl);
        return {
            hasMetadata: true,
            nowPlaying,
            stationName: stationName || undefined,
            metaint: parseInt(metaint)
        };
    }
    catch (error) {
        return {
            hasMetadata: false,
            error: error instanceof Error ? error.message : 'Connection failed'
        };
    }
}
async function extractCurrentTrack(streamUrl) {
    return new Promise((resolve) => {
        console.log(`🎵 Extracting current track from: ${streamUrl}`);
        let resolved = false;
        let radioStation = null;
        let timeoutId = null;
        const safeResolve = (value) => {
            if (!resolved) {
                resolved = true;
                if (timeoutId) {
                    clearTimeout(timeoutId);
                    timeoutId = null;
                }
                if (radioStation) {
                    try {
                        radioStation.removeAllListeners();
                        if (typeof radioStation.quitParsing === 'function') {
                            radioStation.quitParsing();
                        }
                    }
                    catch (e) {
                        console.log('🎵 Parser cleanup warning:', e instanceof Error ? e.message : 'Unknown error');
                    }
                    finally {
                        radioStation = null;
                    }
                }
                resolve(value);
            }
        };
        try {
            radioStation = new icecast_parser_1.Parser({
                url: streamUrl,
                autoUpdate: false
            });
            timeoutId = setTimeout(() => {
                console.log('🎵 Track extraction timeout');
                safeResolve(undefined);
            }, 6000);
            radioStation.on('metadata', (metadata) => {
                const streamTitle = metadata.get('StreamTitle');
                if (streamTitle && streamTitle.trim().length > 0) {
                    const decodedTitle = (0, utils_1.decodeHtmlEntities)(streamTitle.trim());
                    console.log(`🎵 Found track: ${decodedTitle}`);
                    safeResolve(decodedTitle);
                }
                else {
                    console.log('🎵 No current track (likely between songs)');
                    safeResolve(undefined);
                }
            });
            radioStation.on('error', (error) => {
                console.log('🎵 Parser error:', error.message);
                safeResolve(undefined);
            });
            radioStation.on('close', () => {
                console.log('🎵 Parser connection closed');
                if (!resolved) {
                    safeResolve(undefined);
                }
            });
        }
        catch (error) {
            console.log('🎵 Failed to create parser:', error instanceof Error ? error.message : 'Unknown error');
            safeResolve(undefined);
        }
    });
}
