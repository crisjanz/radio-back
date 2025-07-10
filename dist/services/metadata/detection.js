"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectStreamMetadata = detectStreamMetadata;
exports.testExistingMetadata = testExistingMetadata;
const icecast_1 = require("./extractors/icecast");
async function detectStreamMetadata(streamUrl) {
    console.log(`🔍 Testing Icecast metadata for: ${streamUrl}`);
    try {
        const result = await (0, icecast_1.testIcecastMetadata)(streamUrl);
        if (result.hasMetadata) {
            return {
                success: true,
                hasMetadata: true,
                nowPlaying: result.nowPlaying,
                stationName: result.stationName,
                message: result.nowPlaying
                    ? `Now playing: ${result.nowPlaying}`
                    : 'Stream supports metadata but no current track'
            };
        }
        else {
            return {
                success: false,
                hasMetadata: false,
                error: result.error || 'No Icecast metadata support detected'
            };
        }
    }
    catch (error) {
        return {
            success: false,
            hasMetadata: false,
            error: error instanceof Error ? error.message : 'Failed to test metadata'
        };
    }
}
async function testExistingMetadata(streamUrl) {
    return detectStreamMetadata(streamUrl);
}
