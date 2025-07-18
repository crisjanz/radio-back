#!/usr/bin/env node
/**
 * Process Manual Decisions
 * Reads your reviewed CSV and updates database with approved matches
 */

const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const csv = require('csv-parser');

class ManualDecisionProcessor {
    constructor() {
        this.prisma = new PrismaClient();
        this.decisions = [];
    }

    async loadDecisions() {
        console.log('📁 Loading your manual decisions...');
        
        return new Promise((resolve, reject) => {
            const results = [];
            
            fs.createReadStream('/Users/cristianjanz/streemr/station_review_manual.csv')
                .pipe(csv())
                .on('data', (row) => {
                    // Only process rows with decisions
                    if (row.accept_match && row.accept_match.trim() !== '') {
                        results.push({
                            original_name: row.original_name,
                            original_website: row.original_website,
                            original_tagline: row.original_tagline,
                            original_logo: row.original_logo,
                            rb_name: row.rb_name,
                            rb_stream_url: row.rb_stream_url,
                            rb_quality: row.rb_quality,
                            rb_location: row.rb_location,
                            rb_language: row.rb_language,
                            rb_clickcount: parseInt(row.rb_clickcount) || 0,
                            confidence_score: parseFloat(row.confidence_score) || 0,
                            match_reasons: row.match_reasons,
                            decision: row.accept_match.trim().toUpperCase(),
                            notes: row.notes || ''
                        });
                    }
                })
                .on('end', () => {
                    this.decisions = results;
                    resolve(results);
                })
                .on('error', reject);
        });
    }

    analyzeDecisions() {
        console.log('📊 Analyzing your decisions...');
        
        const approved = this.decisions.filter(d => d.decision === 'YES');
        const rejected = this.decisions.filter(d => d.decision === 'NO');
        const toTest = this.decisions.filter(d => d.decision === 'TEST');
        const other = this.decisions.filter(d => !['YES', 'NO', 'TEST'].includes(d.decision));
        
        console.log(`   Total decisions: ${this.decisions.length}`);
        console.log(`   ✅ Approved (YES): ${approved.length}`);
        console.log(`   ❌ Rejected (NO): ${rejected.length}`);
        console.log(`   🧪 To test (TEST): ${toTest.length}`);
        console.log(`   ❓ Other/unclear: ${other.length}`);
        
        if (other.length > 0) {
            console.log(`\n⚠️  Unclear decisions found:`);
            other.forEach(d => {
                console.log(`   "${d.original_name}" → Decision: "${d.decision}"`);
            });
        }
        
        return { approved, rejected, toTest, other };
    }

    async getNextAvailableId() {
        const lastStation = await this.prisma.station.findFirst({
            orderBy: { id: 'desc' },
            select: { id: true }
        });
        
        return lastStation ? lastStation.id + 1 : 1450;
    }

    mapDecisionToStation(decision, id) {
        // Parse quality info
        const qualityMatch = decision.rb_quality.match(/(\d+)kbps\s+(\w+)/);
        const bitrate = qualityMatch ? parseInt(qualityMatch[1]) : null;
        const codec = qualityMatch ? qualityMatch[2] : null;

        // Extract genre from tagline
        const genre = this.extractGenre(decision.original_tagline);
        const type = this.extractType(decision.original_tagline);

        return {
            id: id,
            name: decision.original_name,
            country: 'United States',
            city: decision.rb_location || null,
            state: null,
            streamUrl: decision.rb_stream_url,
            homepage: decision.original_website || null,
            description: decision.original_tagline || null,
            genre: genre,
            type: type,
            language: decision.rb_language || 'english',
            bitrate: bitrate,
            codec: codec,
            clickcount: decision.rb_clickcount || 0,
            latitude: null,
            longitude: null,
            favicon: decision.original_logo || null,
            isActive: true,
            metadataApiUrl: null,
            metadataApiType: null,
            qualityScore: this.calculateQualityScore(decision),
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }

    extractGenre(tagline) {
        if (!tagline) return 'music';
        const taglineLower = tagline.toLowerCase();
        
        if (taglineLower.includes('hip hop') || taglineLower.includes('r&b')) return 'hip-hop';
        if (taglineLower.includes('country')) return 'country';
        if (taglineLower.includes('rock')) return 'rock';
        if (taglineLower.includes('pop')) return 'pop';
        if (taglineLower.includes('jazz')) return 'jazz';
        if (taglineLower.includes('classical')) return 'classical';
        if (taglineLower.includes('alternative')) return 'alternative';
        if (taglineLower.includes('news')) return 'news';
        if (taglineLower.includes('talk')) return 'talk';
        if (taglineLower.includes('sports')) return 'sports';
        if (taglineLower.includes('gospel')) return 'gospel';
        if (taglineLower.includes('oldies') || taglineLower.includes('classic')) return 'oldies';
        
        return 'music';
    }

    extractType(tagline) {
        if (!tagline) return 'music';
        const taglineLower = tagline.toLowerCase();
        
        if (taglineLower.includes('news')) return 'news';
        if (taglineLower.includes('talk')) return 'talk';
        if (taglineLower.includes('sports')) return 'sports';
        
        return 'music';
    }

    calculateQualityScore(decision) {
        let score = 50; // Base score
        
        // Extract bitrate
        const qualityMatch = decision.rb_quality.match(/(\d+)kbps/);
        const bitrate = qualityMatch ? parseInt(qualityMatch[1]) : 0;
        
        if (bitrate >= 128) score += 20;
        else if (bitrate >= 64) score += 10;
        
        if (decision.confidence_score >= 0.8) score += 15;
        else if (decision.confidence_score >= 0.6) score += 10;
        
        if (decision.original_website) score += 10;
        if (decision.original_tagline) score += 5;
        
        return Math.min(score, 100);
    }

    async importApprovedStations(approved) {
        if (approved.length === 0) {
            console.log('⚠️  No approved stations to import');
            return [];
        }

        console.log(`\n🚀 Importing ${approved.length} approved stations...`);
        
        let currentId = await this.getNextAvailableId();
        console.log(`📝 Starting from ID: ${currentId}`);
        
        const imported = [];
        
        for (let i = 0; i < approved.length; i++) {
            const decision = approved[i];
            const stationData = this.mapDecisionToStation(decision, currentId);
            
            try {
                console.log(`\n[${i+1}/${approved.length}] Importing: ${decision.original_name}`);
                console.log(`   ID: ${currentId}`);
                console.log(`   Stream: ${decision.rb_stream_url}`);
                console.log(`   Quality: ${decision.rb_quality}`);
                console.log(`   Location: ${decision.rb_location || 'Unknown'}`);
                console.log(`   Confidence: ${decision.confidence_score.toFixed(3)}`);
                
                const result = await this.prisma.station.create({
                    data: stationData
                });
                
                imported.push(result);
                console.log(`   ✅ Successfully imported (DB ID: ${result.id})`);
                
                currentId++;
                
            } catch (error) {
                console.log(`   ❌ Failed to import: ${error.message}`);
                console.log(`   📋 Station data:`, JSON.stringify(stationData, null, 2));
            }
        }
        
        return imported;
    }

    async createTestFile(toTest) {
        if (toTest.length === 0) {
            console.log('ℹ️  No stations marked for testing');
            return;
        }

        console.log(`\n🧪 Creating test file for ${toTest.length} stations...`);
        
        let testContent = 'STATIONS TO TEST\n';
        testContent += '=================\n\n';
        
        toTest.forEach((station, i) => {
            testContent += `${i+1}. ${station.original_name}\n`;
            testContent += `   Original: ${station.original_tagline}\n`;
            testContent += `   Matched: ${station.rb_name}\n`;
            testContent += `   Stream URL: ${station.rb_stream_url}\n`;
            testContent += `   Quality: ${station.rb_quality}\n`;
            testContent += `   Location: ${station.rb_location}\n`;
            testContent += `   Confidence: ${station.confidence_score.toFixed(3)}\n`;
            testContent += `   Notes: ${station.notes}\n`;
            testContent += `   Test: Open ${station.rb_stream_url} in your browser/media player\n`;
            testContent += '\n' + '-'.repeat(50) + '\n\n';
        });
        
        fs.writeFileSync('/Users/cristianjanz/streemr/stations_to_test.txt', testContent);
        console.log('📄 Test file created: stations_to_test.txt');
    }

    async run() {
        try {
            console.log('🎯 Processing Manual Decisions...\n');
            
            // Load decisions
            await this.loadDecisions();
            
            if (this.decisions.length === 0) {
                console.log('⚠️  No decisions found in CSV file');
                console.log('   Make sure you filled in the "accept_match" column');
                return;
            }
            
            // Analyze decisions
            const { approved, rejected, toTest, other } = this.analyzeDecisions();
            
            // Import approved stations
            const imported = await this.importApprovedStations(approved);
            
            // Create test file
            await this.createTestFile(toTest);
            
            // Summary
            console.log(`\n📊 Final Summary:`);
            console.log(`   ✅ Stations imported: ${imported.length}`);
            console.log(`   ❌ Stations rejected: ${rejected.length}`);
            console.log(`   🧪 Stations to test: ${toTest.length}`);
            console.log(`   ❓ Unclear decisions: ${other.length}`);
            
            if (imported.length > 0) {
                const totalStations = await this.prisma.station.count();
                console.log(`   📈 Total stations in database: ${totalStations}`);
            }
            
            console.log('\n🎉 Processing complete!');
            
        } catch (error) {
            console.error('❌ Error:', error);
        } finally {
            await this.prisma.$disconnect();
        }
    }
}

// Check if csv module is available
try {
    require('csv-parser');
} catch (error) {
    console.error('❌ Missing csv-parser module. Install it with:');
    console.error('   npm install csv-parser');
    process.exit(1);
}

// Run the processor
const processor = new ManualDecisionProcessor();
processor.run();