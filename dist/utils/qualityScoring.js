"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateStationQualityScore = calculateStationQualityScore;
exports.getQualityTier = getQualityTier;
exports.getQualityTierInfo = getQualityTierInfo;
exports.shouldHideStation = shouldHideStation;
exports.qualifiesForEditorsPick = qualifiesForEditorsPick;
exports.qualifiesForFeatured = qualifiesForFeatured;
function calculateStationQualityScore(feedbackSummary, station) {
    const { total, streamBroken, poorQuality, wrongInfo, greatStation, missingMetadata } = feedbackSummary;
    if (total === 0) {
        return calculateBaseQualityScore(station);
    }
    const streamReliability = total > 0
        ? Math.max(0, 100 - ((streamBroken / total) * 100))
        : 80;
    const audioQuality = total > 0
        ? Math.max(0, 100 - ((poorQuality / total) * 100))
        : 80;
    const informationAccuracy = total > 0
        ? Math.max(0, 100 - ((wrongInfo / total) * 100))
        : 85;
    const userSatisfaction = total > 0
        ? (greatStation / total) * 100
        : 70;
    const metadataRichness = calculateMetadataRichness(station);
    const weights = {
        streamReliability: 0.30,
        audioQuality: 0.25,
        informationAccuracy: 0.20,
        userSatisfaction: 0.15,
        metadataRichness: 0.10
    };
    const overall = (streamReliability * weights.streamReliability) +
        (audioQuality * weights.audioQuality) +
        (informationAccuracy * weights.informationAccuracy) +
        (userSatisfaction * weights.userSatisfaction) +
        (metadataRichness * weights.metadataRichness);
    return {
        overall: Math.round(overall * 100) / 100,
        breakdown: {
            streamReliability,
            audioQuality,
            informationAccuracy,
            userSatisfaction,
            metadataRichness
        },
        feedbackCount: total,
        lastCalculated: new Date()
    };
}
function calculateBaseQualityScore(station) {
    let streamReliability = 75;
    let audioQuality = 70;
    let informationAccuracy = 80;
    let userSatisfaction = 65;
    if (station.clickcount && station.votes) {
        const popularityScore = Math.min(100, (station.clickcount + station.votes * 2) / 10);
        streamReliability += popularityScore * 0.2;
        userSatisfaction += popularityScore * 0.3;
    }
    if (station.bitrate) {
        if (station.bitrate >= 128) {
            audioQuality += 20;
        }
        else if (station.bitrate >= 96) {
            audioQuality += 10;
        }
        else if (station.bitrate < 64) {
            audioQuality -= 20;
        }
    }
    const metadataRichness = calculateMetadataRichness(station);
    streamReliability = Math.max(0, Math.min(100, streamReliability));
    audioQuality = Math.max(0, Math.min(100, audioQuality));
    informationAccuracy = Math.max(0, Math.min(100, informationAccuracy));
    userSatisfaction = Math.max(0, Math.min(100, userSatisfaction));
    const weights = {
        streamReliability: 0.30,
        audioQuality: 0.25,
        informationAccuracy: 0.20,
        userSatisfaction: 0.15,
        metadataRichness: 0.10
    };
    const overall = (streamReliability * weights.streamReliability) +
        (audioQuality * weights.audioQuality) +
        (informationAccuracy * weights.informationAccuracy) +
        (userSatisfaction * weights.userSatisfaction) +
        (metadataRichness * weights.metadataRichness);
    return {
        overall: Math.round(overall * 100) / 100,
        breakdown: {
            streamReliability,
            audioQuality,
            informationAccuracy,
            userSatisfaction,
            metadataRichness
        },
        feedbackCount: 0,
        lastCalculated: new Date()
    };
}
function calculateMetadataRichness(station) {
    let score = 0;
    if (station.metadataApiUrl && station.metadataApiType) {
        score += 40;
    }
    if (station.local_image_url || station.logo || station.favicon) {
        score += 25;
    }
    if (station.description && station.description.length > 50) {
        score += 20;
    }
    else if (station.description && station.description.length > 10) {
        score += 10;
    }
    if (station.language) {
        score += 10;
    }
    return Math.min(100, score);
}
function getQualityTier(score) {
    if (score >= 90)
        return 'premium';
    if (score >= 80)
        return 'high';
    if (score >= 70)
        return 'good';
    if (score >= 60)
        return 'fair';
    return 'poor';
}
function getQualityTierInfo(tier) {
    const tierInfo = {
        premium: {
            name: 'Premium Quality',
            description: 'Exceptional stations with excellent reliability and rich features',
            color: '#10b981',
            badge: '🏆'
        },
        high: {
            name: 'High Quality',
            description: 'Reliable stations with good audio and metadata',
            color: '#3b82f6',
            badge: '⭐'
        },
        good: {
            name: 'Good Quality',
            description: 'Solid stations with decent reliability',
            color: '#6366f1',
            badge: '✓'
        },
        fair: {
            name: 'Fair Quality',
            description: 'Basic stations that work most of the time',
            color: '#f59e0b',
            badge: '○'
        },
        poor: {
            name: 'Poor Quality',
            description: 'Stations with known issues or limited reliability',
            color: '#ef4444',
            badge: '⚠️'
        }
    };
    return tierInfo[tier] || tierInfo.fair;
}
function shouldHideStation(qualityScore, feedbackCount) {
    if (feedbackCount >= 5 && qualityScore < 40) {
        return true;
    }
    if (feedbackCount >= 3 && qualityScore < 30) {
        return true;
    }
    return false;
}
function qualifiesForEditorsPick(qualityScore, feedbackCount) {
    return qualityScore >= 85 && feedbackCount >= 3;
}
function qualifiesForFeatured(qualityScore) {
    return qualityScore >= 70;
}
