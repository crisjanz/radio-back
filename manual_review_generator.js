#!/usr/bin/env node
/**
 * Manual Review Generator
 * Creates CSV file comparing original stations with Radio Browser matches
 */

const fs = require('fs');
const path = require('path');

class ManualReviewGenerator {
    constructor() {
        this.originalStations = [];
        this.enhancedStations = [];
    }

    parseOriginalStations() {
        console.log('📁 Loading original station list...');
        const data = fs.readFileSync('/Users/cristianjanz/streemr/station_list_deduplicated.txt', 'utf8');
        
        const stations = [];
        let currentStation = {};
        
        const lines = data.split('\n');
        for (const line of lines) {
            const trimmed = line.trim();
            
            if (trimmed.startsWith('Name: ')) {
                if (currentStation.name) {
                    stations.push(currentStation);
                }
                currentStation = { name: trimmed.substring(6) };
            } else if (trimmed.startsWith('URL: ')) {
                currentStation.website = trimmed.substring(5);
            } else if (trimmed.startsWith('Tagline: ')) {
                currentStation.tagline = trimmed.substring(9);
            } else if (trimmed.startsWith('Logo: ')) {
                currentStation.logo = trimmed.substring(6);
            }
        }
        
        // Don't forget the last station
        if (currentStation.name) {
            stations.push(currentStation);
        }
        
        this.originalStations = stations;
        console.log(`✅ Loaded ${stations.length} original stations`);
    }

    parseEnhancedStations() {
        console.log('📁 Loading enhanced stations with Radio Browser matches...');
        const data = fs.readFileSync('/Users/cristianjanz/streemr/stations_enhanced_all_365_fixed.json', 'utf8');
        this.enhancedStations = JSON.parse(data);
        console.log(`✅ Loaded ${this.enhancedStations.length} enhanced stations`);
    }

    createComparisonData() {
        console.log('🔍 Creating comparison data...');
        const comparisons = [];
        
        // Create a map of enhanced stations by name for quick lookup
        const enhancedMap = new Map();
        this.enhancedStations.forEach(station => {
            enhancedMap.set(station.name, station);
        });
        
        // Match each original station with its enhanced version
        for (const original of this.originalStations) {
            const enhanced = enhancedMap.get(original.name);
            
            if (enhanced && enhanced.stream_url) {
                // Station has a Radio Browser match
                comparisons.push({
                    // Original data
                    original_name: original.name || '',
                    original_website: original.website || '',
                    original_tagline: original.tagline || '',
                    original_logo: original.logo || '',
                    
                    // Radio Browser match data
                    rb_name: enhanced.rb_name || '',
                    rb_stream_url: enhanced.stream_url || '',
                    rb_quality: `${enhanced.bitrate || 'Unknown'}kbps ${enhanced.codec || 'Unknown'}`,
                    rb_location: enhanced.city || 'Unknown',
                    rb_language: enhanced.language || '',
                    rb_clickcount: enhanced.clickcount || 0,
                    
                    // Matching metadata
                    confidence_score: enhanced.rb_confidence ? enhanced.rb_confidence.toFixed(3) : 'N/A',
                    match_reasons: enhanced.rb_reasons || '',
                    
                    // Review columns (empty for user to fill)
                    accept_match: '',
                    notes: '',
                    
                    // For reference
                    enhanced_data: enhanced
                });
            } else {
                // Station has no Radio Browser match
                comparisons.push({
                    // Original data
                    original_name: original.name || '',
                    original_website: original.website || '',
                    original_tagline: original.tagline || '',
                    original_logo: original.logo || '',
                    
                    // No Radio Browser match
                    rb_name: 'NO MATCH FOUND',
                    rb_stream_url: '',
                    rb_quality: '',
                    rb_location: '',
                    rb_language: '',
                    rb_clickcount: '',
                    
                    // No matching metadata
                    confidence_score: '0.000',
                    match_reasons: 'No match found',
                    
                    // Review columns (empty for user to fill)
                    accept_match: '',
                    notes: '',
                    
                    // For reference
                    enhanced_data: null
                });
            }
        }
        
        console.log(`📊 Created ${comparisons.length} comparisons`);
        
        // Sort by confidence score (highest first) to show best matches first
        comparisons.sort((a, b) => {
            const aScore = parseFloat(a.confidence_score) || 0;
            const bScore = parseFloat(b.confidence_score) || 0;
            return bScore - aScore;
        });
        
        return comparisons;
    }

    generateCSV(comparisons) {
        console.log('📄 Generating CSV file...');
        
        // CSV headers
        const headers = [
            'original_name',
            'original_website', 
            'original_tagline',
            'original_logo',
            'rb_name',
            'rb_stream_url',
            'rb_quality',
            'rb_location',
            'rb_language',
            'rb_clickcount',
            'confidence_score',
            'match_reasons',
            'accept_match',
            'notes'
        ];
        
        // Create CSV content
        let csvContent = headers.join(',') + '\n';
        
        for (const row of comparisons) {
            const csvRow = headers.map(header => {
                let value = row[header] || '';
                // Escape quotes and wrap in quotes if contains comma, quote, or newline
                if (typeof value === 'string' && (value.includes(',') || value.includes('"') || value.includes('\n'))) {
                    value = '"' + value.replace(/"/g, '""') + '"';
                }
                return value;
            });
            csvContent += csvRow.join(',') + '\n';
        }
        
        // Write CSV file
        const outputPath = '/Users/cristianjanz/streemr/station_review_manual.csv';
        fs.writeFileSync(outputPath, csvContent, 'utf8');
        
        console.log(`✅ CSV file created: ${outputPath}`);
        return outputPath;
    }

    generateSummary(comparisons) {
        console.log('\n📊 Summary Statistics:');
        
        const withMatches = comparisons.filter(c => c.rb_stream_url);
        const withoutMatches = comparisons.filter(c => !c.rb_stream_url);
        
        console.log(`   Total stations: ${comparisons.length}`);
        console.log(`   With Radio Browser matches: ${withMatches.length}`);
        console.log(`   Without matches: ${withoutMatches.length}`);
        
        // Confidence distribution
        const highConfidence = withMatches.filter(c => parseFloat(c.confidence_score) >= 0.8);
        const mediumConfidence = withMatches.filter(c => parseFloat(c.confidence_score) >= 0.5 && parseFloat(c.confidence_score) < 0.8);
        const lowConfidence = withMatches.filter(c => parseFloat(c.confidence_score) < 0.5);
        
        console.log(`\n📈 Confidence Distribution:`);
        console.log(`   High confidence (≥0.8): ${highConfidence.length} stations`);
        console.log(`   Medium confidence (0.5-0.8): ${mediumConfidence.length} stations`);
        console.log(`   Low confidence (<0.5): ${lowConfidence.length} stations`);
        
        // Top matches for reference
        console.log(`\n🎯 Top 5 highest confidence matches:`);
        withMatches.slice(0, 5).forEach((match, i) => {
            console.log(`   ${i+1}. ${match.original_name} → ${match.rb_name} (${match.confidence_score})`);
        });
        
        console.log(`\n📋 Instructions:`);
        console.log(`   1. Open station_review_manual.csv in Excel/Google Sheets`);
        console.log(`   2. Review each match (sorted by confidence - best first)`);
        console.log(`   3. In 'accept_match' column, put:`);
        console.log(`      - YES for good matches`);
        console.log(`      - NO for bad matches`);
        console.log(`      - TEST for uncertain ones you want to test`);
        console.log(`   4. Add notes if needed`);
        console.log(`   5. Save and send back to me`);
    }

    async run() {
        try {
            console.log('🎯 Manual Review Generator Starting...\n');
            
            // Load data
            this.parseOriginalStations();
            this.parseEnhancedStations();
            
            // Create comparison data
            const comparisons = this.createComparisonData();
            
            // Generate CSV
            const csvPath = this.generateCSV(comparisons);
            
            // Show summary
            this.generateSummary(comparisons);
            
            console.log('\n🎉 Manual review file ready!');
            console.log(`📁 File location: ${csvPath}`);
            
        } catch (error) {
            console.error('❌ Error:', error);
        }
    }
}

// Run the generator
const generator = new ManualReviewGenerator();
generator.run();