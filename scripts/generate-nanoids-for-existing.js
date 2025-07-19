const { PrismaClient } = require('@prisma/client');
const { customAlphabet } = require('nanoid');

const prisma = new PrismaClient();

// Create the same NanoID generator as in our utility
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const generateStationId = customAlphabet(alphabet, 8);

// Validation function
const isValidNanoId = (id) => /^[0-9A-Za-z]{8}$/.test(id);

async function generateNanoIdsForExisting() {
  console.log('🚀 Starting NanoID generation for existing stations...\n');
  
  try {
    // Get all stations that don't have a nanoid yet
    const stationsWithoutNanoid = await prisma.station.findMany({
      where: { nanoid: null },
      select: { id: true, name: true }
    });

    if (stationsWithoutNanoid.length === 0) {
      console.log('✅ All stations already have NanoIDs!');
      return;
    }

    console.log(`📊 Found ${stationsWithoutNanoid.length} stations needing NanoIDs`);
    console.log('🔄 Generating unique NanoIDs...\n');

    let successCount = 0;
    let failureCount = 0;
    const failures = [];

    for (let i = 0; i < stationsWithoutNanoid.length; i++) {
      const station = stationsWithoutNanoid[i];
      let attempts = 0;
      let success = false;

      while (attempts < 5 && !success) {
        try {
          // Generate a new NanoID
          const nanoid = generateStationId();
          attempts++;

          // Validate format
          if (!isValidNanoId(nanoid)) {
            console.log(`   ⚠️  Invalid NanoID format: ${nanoid}, retrying...`);
            continue;
          }

          // Check if this NanoID already exists (extremely unlikely)
          const existing = await prisma.station.findUnique({
            where: { nanoid }
          });

          if (existing) {
            console.log(`   ⚠️  Collision detected for ${nanoid}, retrying... (attempt ${attempts})`);
            continue;
          }

          // Update the station with the new NanoID
          await prisma.station.update({
            where: { id: station.id },
            data: { nanoid }
          });

          successCount++;
          success = true;

          // Progress indicator
          if (i % 50 === 0 || i === stationsWithoutNanoid.length - 1) {
            const progress = ((i + 1) / stationsWithoutNanoid.length * 100).toFixed(1);
            console.log(`   ✅ Progress: ${i + 1}/${stationsWithoutNanoid.length} (${progress}%) - Latest: "${station.name}" -> ${nanoid}`);
          }

        } catch (error) {
          console.error(`   ❌ Failed to update station ${station.id} (${station.name}):`, error.message);
          
          if (attempts >= 5) {
            failureCount++;
            failures.push({
              stationId: station.id,
              stationName: station.name,
              error: error.message
            });
            break;
          }
        }
      }

      // Small delay every 100 operations to avoid overwhelming the database
      if (i % 100 === 0 && i > 0) {
        console.log('   💤 Brief pause...');
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log('\n📈 Generation Summary:');
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failureCount}`);

    if (failures.length > 0) {
      console.log('\n❌ Failures:');
      failures.forEach(failure => {
        console.log(`   - Station ${failure.stationId} (${failure.stationName}): ${failure.error}`);
      });
    }

    // Verify final state
    console.log('\n🔍 Verification:');
    const totalStations = await prisma.station.count();
    const stationsWithNanoid = await prisma.station.count({
      where: { nanoid: { not: null } }
    });
    
    console.log(`   📊 Total stations: ${totalStations}`);
    console.log(`   🆔 Stations with NanoID: ${stationsWithNanoid}`);
    console.log(`   📋 Coverage: ${(stationsWithNanoid / totalStations * 100).toFixed(1)}%`);

    if (stationsWithNanoid === totalStations) {
      console.log('\n🎉 All stations now have NanoIDs!');
    } else {
      console.log(`\n⚠️  ${totalStations - stationsWithNanoid} stations still need NanoIDs`);
    }

  } catch (error) {
    console.error('💥 Fatal error during NanoID generation:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Collision check function (optional verification)
async function checkForCollisions() {
  console.log('\n🔍 Checking for NanoID collisions...');
  
  const allNanoids = await prisma.station.findMany({
    where: { nanoid: { not: null } },
    select: { nanoid: true }
  });

  const nanoidsArray = allNanoids.map(s => s.nanoid);
  const uniqueNanoids = new Set(nanoidsArray);

  if (nanoidsArray.length === uniqueNanoids.size) {
    console.log('✅ No collisions detected - all NanoIDs are unique!');
  } else {
    console.log(`❌ Collision detected! ${nanoidsArray.length} total vs ${uniqueNanoids.size} unique`);
    
    // Find duplicates
    const duplicates = nanoidsArray.filter((item, index) => nanoidsArray.indexOf(item) !== index);
    console.log('Duplicate NanoIDs:', [...new Set(duplicates)]);
  }
}

// Sample generation test
async function testGeneration() {
  console.log('🧪 Testing NanoID generation...');
  
  const samples = [];
  for (let i = 0; i < 10; i++) {
    const id = generateStationId();
    samples.push(id);
    console.log(`  Sample ${i + 1}: ${id} (valid: ${isValidNanoId(id)})`);
  }
  
  // Check for duplicates in sample
  const uniqueSamples = new Set(samples);
  console.log(`  Uniqueness: ${samples.length}/${uniqueSamples.size} (${samples.length === uniqueSamples.size ? 'PASS' : 'FAIL'})`);
}

// Main execution
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.includes('--test')) {
    testGeneration().catch(console.error);
  } else {
    generateNanoIdsForExisting()
      .then(() => checkForCollisions())
      .catch(console.error);
  }
}

module.exports = { generateNanoIdsForExisting, checkForCollisions, testGeneration };