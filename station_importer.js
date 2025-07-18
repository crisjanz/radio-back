#!/usr/bin/env node
/**
 * Station Importer for Streemr
 * Imports enhanced stations directly into database starting from ID 1200
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

class StationImporter {
    constructor() {
        this.prisma = new PrismaClient();
        this.startingId = 1200;
    }

    async loadEnhancedStations() {
        console.log('📁 Loading enhanced stations...');
        const data = fs.readFileSync('/Users/cristianjanz/streemr/stations_enhanced_all_365.json', 'utf8');
        const stations = JSON.parse(data);
        
        // Filter only stations with stream URLs (our successful matches)
        const withStreams = stations.filter(s => s.stream_url && s.stream_url.trim() !== '');
        console.log(`✅ Loaded ${withStreams.length} stations with stream URLs`);
        
        return withStreams;
    }

    async checkForDuplicates(stations) {
        console.log('🔍 Checking for duplicates against existing database...');
        const duplicates = [];
        const unique = [];

        for (const station of stations) {
            // Check for duplicates by name similarity and stream URL
            const existing = await this.prisma.station.findFirst({
                where: {
                    OR: [
                        { name: { contains: station.name, mode: 'insensitive' } },
                        { streamUrl: station.stream_url },
                        // Check for call sign matches
                        station.name.match(/^[A-Z]{3,4}/) ? {
                            name: { contains: station.name.match(/^[A-Z]{3,4}/)[0], mode: 'insensitive' }
                        } : {}
                    ]
                },
                select: { id: true, name: true, streamUrl: true }
            });

            if (existing) {
                duplicates.push({
                    enhanced: station,
                    existing: existing
                });
            } else {
                unique.push(station);
            }
        }

        console.log(`📊 Duplicate check results:`);
        console.log(`   Duplicates found: ${duplicates.length}`);
        console.log(`   Unique stations: ${unique.length}`);

        if (duplicates.length > 0) {
            console.log('\n🔄 Duplicates detected (will be imported anyway):');
            duplicates.slice(0, 5).forEach((dup, i) => {
                console.log(`   [${i+1}] "${dup.enhanced.name}" → Similar to "${dup.existing.name}" (ID: ${dup.existing.id})`);
            });
        }

        // Return ALL stations (no filtering)
        return { duplicates, unique: stations };
    }

    async getNextAvailableId() {
        const lastStation = await this.prisma.station.findFirst({
            orderBy: { id: 'desc' },
            select: { id: true }
        });

        const maxId = lastStation ? lastStation.id : 0;
        return Math.max(this.startingId, maxId + 1);
    }

    mapEnhancedToStation(enhanced, id) {
        // Format city as "City, State" or just "State" - all in city field
        const cityState = enhanced.city || '';
        let formattedCity = null;
        
        if (cityState) {
            // Check if it already has a comma (like "Ocean View, DE")
            if (cityState.includes(',')) {
                formattedCity = cityState;
            } else {
                // Check if it's "City ST" format
                const stateMatch = cityState.match(/^(.+)\s+([A-Z]{2})$/);
                if (stateMatch) {
                    const city = stateMatch[1].trim();
                    const state = stateMatch[2];
                    formattedCity = `${city}, ${state}`;
                } else {
                    // Just state name or other format
                    formattedCity = cityState;
                }
            }
        }

        return {
            id: id,
            name: enhanced.name,
            country: 'United States', // Normalize country name
            city: formattedCity,
            state: null, // Not using separate state field
            streamUrl: enhanced.stream_url,
            homepage: enhanced.website || null,
            description: enhanced.tagline || null,
            genre: this.extractGenre(enhanced.tagline || ''),
            type: this.extractType(enhanced.tagline || ''),
            language: enhanced.language || 'english',
            bitrate: enhanced.bitrate || null,
            codec: enhanced.codec || null,
            clickcount: enhanced.clickcount || 0,
            latitude: enhanced.geo_lat || null,
            longitude: enhanced.geo_long || null,
            favicon: enhanced.logo_url || null,
            isActive: true,
            metadataApiUrl: null,
            metadataApiType: null,
            qualityScore: this.calculateQualityScore(enhanced),
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    extractGenre(tagline) {
        const taglineLower = tagline.toLowerCase();
        
        // Common genre keywords
        if (taglineLower.includes('hip hop') || taglineLower.includes('r&b')) return 'hip-hop';
        if (taglineLower.includes('country')) return 'country';
        if (taglineLower.includes('rock')) return 'rock';
        if (taglineLower.includes('pop')) return 'pop';
        if (taglineLower.includes('jazz')) return 'jazz';
        if (taglineLower.includes('classical')) return 'classical';
        if (taglineLower.includes('news')) return 'news';
        if (taglineLower.includes('talk')) return 'talk';
        if (taglineLower.includes('sports')) return 'sports';
        if (taglineLower.includes('gospel')) return 'gospel';
        if (taglineLower.includes('oldies')) return 'oldies';
        
        return 'music'; // Default
    }

    extractType(tagline) {
        const taglineLower = tagline.toLowerCase();
        
        if (taglineLower.includes('news')) return 'news';
        if (taglineLower.includes('talk')) return 'talk';
        if (taglineLower.includes('sports')) return 'sports';
        
        return 'music'; // Default
    }

    calculateQualityScore(enhanced) {
        let score = 50; // Base score
        
        // Boost for higher bitrates
        if (enhanced.bitrate >= 128) score += 20;
        else if (enhanced.bitrate >= 64) score += 10;
        
        // Boost for good confidence match
        if (enhanced.rb_confidence >= 0.8) score += 15;
        else if (enhanced.rb_confidence >= 0.6) score += 10;
        
        // Boost for having website
        if (enhanced.website) score += 10;
        
        // Boost for having tagline
        if (enhanced.tagline) score += 5;
        
        return Math.min(score, 100); // Cap at 100
    }

    async importStations(stations, limit = 10) {
        console.log(`\n🚀 Starting import of ${Math.min(limit, stations.length)} stations...`);
        
        let currentId = await this.getNextAvailableId();
        console.log(`📝 Starting from ID: ${currentId}`);
        
        const imported = [];
        
        for (let i = 0; i < Math.min(limit, stations.length); i++) {
            const enhanced = stations[i];
            const stationData = this.mapEnhancedToStation(enhanced, currentId);
            
            try {
                console.log(`\n[${i+1}/${Math.min(limit, stations.length)}] Importing: ${enhanced.name}`);
                console.log(`   ID: ${currentId}`);
                console.log(`   Stream: ${enhanced.stream_url}`);
                console.log(`   Quality: ${enhanced.bitrate}kbps ${enhanced.codec}`);
                console.log(`   Location: ${stationData.city || 'Unknown'}`);
                
                const result = await this.prisma.station.create({
                    data: stationData
                });
                
                imported.push(result);
                console.log(`   ✅ Successfully imported (DB ID: ${result.id})`);
                
                currentId++;
                
            } catch (error) {
                console.log(`   ❌ Failed to import: ${error.message}`);
            }
        }
        
        console.log(`\n📊 Import Summary:`);
        console.log(`   Successfully imported: ${imported.length}`);
        console.log(`   Failed: ${Math.min(limit, stations.length) - imported.length}`);
        console.log(`   Next available ID: ${currentId}`);
        
        return imported;
    }

    async verifyImports(imported) {
        console.log('\n🔍 Verifying imported stations...');
        
        for (const station of imported) {
            const verified = await this.prisma.station.findUnique({
                where: { id: station.id },
                select: { 
                    id: true, 
                    name: true, 
                    streamUrl: true, 
                    createdAt: true 
                }
            });
            
            if (verified) {
                console.log(`   ✅ ID ${verified.id}: ${verified.name} - Stream: ${verified.streamUrl ? 'Yes' : 'No'}`);
            } else {
                console.log(`   ❌ ID ${station.id}: Not found in database`);
            }
        }
    }

    async run() {
        try {
            console.log('🎯 Streemr Station Importer Starting...\n');
            
            // Load enhanced stations
            const enhanced = await this.loadEnhancedStations();
            
            // Check for duplicates (but import all)
            const { duplicates, unique } = await this.checkForDuplicates(enhanced);
            
            // Import ALL stations (including duplicates)
            const imported = await this.importStations(unique, unique.length);
            
            // Verify imports
            if (imported.length > 0) {
                await this.verifyImports(imported);
            }
            
            console.log('\n🎉 Import process completed!');
            
        } catch (error) {
            console.error('❌ Import failed:', error);
        } finally {
            await this.prisma.$disconnect();
        }
    }
}

// Run the importer
const importer = new StationImporter();
importer.run().catch(console.error);