#!/usr/bin/env node

/**
 * Auto-fill Frequency Script
 * 
 * This script analyzes station names and automatically fills the frequency field
 * for stations that have obvious AM/FM frequency patterns in their names.
 * 
 * Usage: node scripts/auto-fill-frequency.js [--dry-run] [--limit=N]
 */

const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Parse command line arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitMatch = args.find(arg => arg.startsWith('--limit='));
const limit = limitMatch ? parseInt(limitMatch.split('=')[1]) : null;

// FM frequency patterns (87.5 - 108.0 MHz)
const FM_PATTERNS = [
  // Standard FM formats: 101.5, 95.7, 107.9, etc.
  /\b((8[7-9]|9[0-9]|10[0-8])\.[0-9])\b/g,
  
  // FM with explicit "FM": "101.5 FM", "95.7FM", "FM 101.5"
  /\b(?:FM\s*)?((8[7-9]|9[0-9]|10[0-8])\.[0-9])\s*(?:FM)?\b/gi,
  
  // FM prefix format: "FM 101.5"
  /\bFM\s+((8[7-9]|9[0-9]|10[0-8])\.[0-9])\b/gi
];

// AM frequency patterns (530 - 1700 kHz)
const AM_PATTERNS = [
  // Standard AM formats: 1010, 770, 1480, etc.
  /\b((5[3-9][0-9]|[6-9][0-9][0-9]|1[0-6][0-9][0-9]|1700))\b/g,
  
  // AM with explicit "AM": "1010 AM", "770AM", "AM 1010"
  /\b(?:AM\s*)?((5[3-9][0-9]|[6-9][0-9][0-9]|1[0-6][0-9][0-9]|1700))\s*(?:AM)?\b/gi,
  
  // AM prefix format: "AM 1010"
  /\bAM\s+((5[3-9][0-9]|[6-9][0-9][0-9]|1[0-6][0-9][0-9]|1700))\b/gi
];

/**
 * Extract frequency information from station name
 * @param {string} stationName - The station name to analyze
 * @returns {Object|null} - {type: 'FM'|'AM', frequency: string, confidence: number} or null
 */
function extractFrequency(stationName) {
  if (!stationName || typeof stationName !== 'string') {
    return null;
  }

  const name = stationName.trim();
  
  // Check for FM patterns
  for (const pattern of FM_PATTERNS) {
    pattern.lastIndex = 0; // Reset regex
    const match = pattern.exec(name);
    if (match) {
      const freq = match[1]; // First capture group contains the frequency
      const numFreq = parseFloat(freq);
      
      // Validate FM frequency range (87.5 - 108.0)
      if (numFreq >= 87.5 && numFreq <= 108.0) {
        let confidence = 0.8;
        
        // Higher confidence if explicitly mentions FM
        if (/\bFM\b/i.test(name)) confidence = 0.95;
        
        // Lower confidence for edge cases
        if (numFreq < 88.0 || numFreq > 107.9) confidence -= 0.1;
        
        return {
          type: 'FM',
          frequency: `${freq} FM`,
          confidence: Math.min(confidence, 1.0),
          originalMatch: match[0]
        };
      }
    }
  }
  
  // Check for AM patterns
  for (const pattern of AM_PATTERNS) {
    pattern.lastIndex = 0; // Reset regex
    const match = pattern.exec(name);
    if (match) {
      const freq = match[1]; // First capture group contains the frequency
      const numFreq = parseInt(freq);
      
      // Validate AM frequency range (530 - 1700)
      if (numFreq >= 530 && numFreq <= 1700) {
        let confidence = 0.7;
        
        // Higher confidence if explicitly mentions AM
        if (/\bAM\b/i.test(name)) confidence = 0.95;
        
        // Higher confidence for common AM frequencies
        if (numFreq % 10 === 0) confidence += 0.1; // 1010, 770, etc.
        
        // Lower confidence for unusual frequencies
        if (numFreq < 550 || numFreq > 1650) confidence -= 0.1;
        
        return {
          type: 'AM',
          frequency: `AM ${freq}`,
          confidence: Math.min(confidence, 1.0),
          originalMatch: match[0]
        };
      }
    }
  }
  
  return null;
}

/**
 * Test the frequency extraction with sample data
 */
function runTests() {
  const testCases = [
    { name: "101.5 The Bear", expected: "101.5 FM" },
    { name: "CKNW 980", expected: "AM 980" },
    { name: "Power 96.1", expected: "96.1 FM" },
    { name: "AM 1010", expected: "AM 1010" },
    { name: "FM 103.7", expected: "103.7 FM" },
    { name: "Talk Radio 770", expected: "AM 770" },
    { name: "95.7 The Ride", expected: "95.7 FM" },
    { name: "1480 CFAX", expected: "AM 1480" },
    { name: "BBC Radio 1", expected: null },
    { name: "Spotify Music", expected: null },
    { name: "106.7 Z-Rock", expected: "106.7 FM" },
    { name: "TALK 1010", expected: "AM 1010" }
  ];
  
  console.log("🧪 Running frequency extraction tests...\n");
  
  let passed = 0;
  let failed = 0;
  
  for (const test of testCases) {
    const result = extractFrequency(test.name);
    const extracted = result ? result.frequency : null;
    const success = extracted === test.expected;
    
    if (success) {
      passed++;
      console.log(`✅ "${test.name}" → "${extracted}" (confidence: ${result?.confidence?.toFixed(2) || 'N/A'})`);
    } else {
      failed++;
      console.log(`❌ "${test.name}" → "${extracted}" (expected: "${test.expected}")`);
    }
  }
  
  console.log(`\n📊 Test Results: ${passed} passed, ${failed} failed\n`);
  return failed === 0;
}

/**
 * Main function to process stations
 */
async function main() {
  try {
    console.log("🎵 Radio Station Frequency Auto-Fill Script");
    console.log("=" .repeat(50));
    
    // Run tests first
    if (!runTests()) {
      console.log("❌ Tests failed. Please check the extraction logic.");
      process.exit(1);
    }
    
    if (isDryRun) {
      console.log("🔍 DRY RUN MODE - No changes will be made\n");
    }
    
    // Get stations that don't have frequency set or have empty frequency
    const whereClause = {
      OR: [
        { frequency: null },
        { frequency: '' },
        { frequency: { equals: '' } }
      ]
    };
    
    const queryOptions = {
      where: whereClause,
      select: {
        id: true,
        nanoid: true,
        name: true,
        frequency: true,
        country: true
      },
      orderBy: { name: 'asc' }
    };
    
    if (limit) {
      queryOptions.take = limit;
    }
    
    const stations = await prisma.station.findMany(queryOptions);
    
    console.log(`📡 Found ${stations.length} stations without frequency data${limit ? ` (limited to ${limit})` : ''}\n`);
    
    if (stations.length === 0) {
      console.log("✅ No stations need frequency updates!");
      return;
    }
    
    let processed = 0;
    let updated = 0;
    let skipped = 0;
    const updates = [];
    
    // Process each station
    for (const station of stations) {
      processed++;
      
      const result = extractFrequency(station.name);
      
      if (result && result.confidence >= 0.7) {
        const stationId = station.nanoid || station.id;
        
        console.log(`🎯 Station: "${station.name}" (${stationId})`);
        console.log(`   Country: ${station.country || 'Unknown'}`);
        console.log(`   Detected: ${result.frequency} (confidence: ${(result.confidence * 100).toFixed(0)}%)`);
        console.log(`   Match: "${result.originalMatch}"`);
        
        if (!isDryRun) {
          try {
            await prisma.station.update({
              where: { id: station.id },
              data: { frequency: result.frequency }
            });
            console.log(`   ✅ Updated frequency field\n`);
            updated++;
          } catch (error) {
            console.log(`   ❌ Failed to update: ${error.message}\n`);
            skipped++;
          }
        } else {
          console.log(`   🔍 Would update frequency field\n`);
          updated++;
        }
        
        updates.push({
          id: station.id,
          nanoid: station.nanoid,
          name: station.name,
          oldFrequency: station.frequency,
          newFrequency: result.frequency,
          confidence: result.confidence
        });
      } else {
        const reason = result 
          ? `low confidence (${(result.confidence * 100).toFixed(0)}%)` 
          : 'no frequency detected';
        console.log(`⏭️  Skipped: "${station.name}" - ${reason}`);
        skipped++;
      }
    }
    
    // Summary
    console.log("\n" + "=".repeat(50));
    console.log("📊 SUMMARY");
    console.log("=".repeat(50));
    console.log(`Total stations processed: ${processed}`);
    console.log(`${isDryRun ? 'Would update' : 'Updated'}: ${updated}`);
    console.log(`Skipped: ${skipped}`);
    
    if (updates.length > 0) {
      console.log(`\n📋 ${isDryRun ? 'Planned' : 'Completed'} Updates:`);
      for (const update of updates.slice(0, 10)) { // Show first 10
        const id = update.nanoid || update.id;
        console.log(`   ${id}: "${update.name}" → "${update.newFrequency}"`);
      }
      if (updates.length > 10) {
        console.log(`   ... and ${updates.length - 10} more`);
      }
    }
    
    if (isDryRun) {
      console.log(`\n💡 To apply these changes, run: node scripts/auto-fill-frequency.js`);
    } else {
      console.log(`\n✅ Frequency auto-fill completed successfully!`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Handle script arguments
if (args.includes('--help') || args.includes('-h')) {
  console.log(`
🎵 Radio Station Frequency Auto-Fill Script

USAGE:
  node scripts/auto-fill-frequency.js [OPTIONS]

OPTIONS:
  --dry-run     Show what would be changed without making actual updates
  --limit=N     Limit processing to N stations (for testing)
  --help, -h    Show this help message

EXAMPLES:
  node scripts/auto-fill-frequency.js --dry-run
  node scripts/auto-fill-frequency.js --limit=50
  node scripts/auto-fill-frequency.js

FREQUENCY DETECTION:
  - FM: Detects frequencies like "101.5", "95.7 FM", "Power 96.1"
  - AM: Detects frequencies like "1010", "AM 770", "TALK 1480"
  - Only updates stations with confidence ≥ 70%
  - Validates frequency ranges (FM: 87.5-108.0, AM: 530-1700)

⚠️  IMPORTANT: Always run with --dry-run first to review changes!
`);
  process.exit(0);
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { extractFrequency, runTests };