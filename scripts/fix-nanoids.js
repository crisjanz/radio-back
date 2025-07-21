const { PrismaClient } = require('@prisma/client');
const { customAlphabet } = require('nanoid');

// Recreate the generateStationId function
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const generateStationId = customAlphabet(alphabet, 8);

const prisma = new PrismaClient();

async function fixNanoIds() {
  try {
    console.log('🔄 Fixing NanoIDs to use proper alphanumeric format...');
    
    // Get all stations with invalid NanoIDs (containing special characters)
    const stations = await prisma.station.findMany({
      select: {
        id: true,
        nanoid: true,
        name: true
      }
    });
    
    console.log(`📊 Found ${stations.length} stations to check`);
    
    let fixed = 0;
    let alreadyValid = 0;
    const invalidNanoIds = [];
    
    for (const station of stations) {
      // Check if NanoID contains special characters
      const hasSpecialChars = /[^0-9A-Za-z]/.test(station.nanoid);
      
      if (hasSpecialChars) {
        invalidNanoIds.push({
          id: station.id,
          name: station.name,
          oldNanoid: station.nanoid
        });
      } else {
        alreadyValid++;
      }
    }
    
    console.log(`📊 Invalid NanoIDs with special characters: ${invalidNanoIds.length}`);
    console.log(`📊 Already valid NanoIDs: ${alreadyValid}`);
    
    if (invalidNanoIds.length === 0) {
      console.log('✅ All NanoIDs are already valid! No changes needed.');
      return;
    }
    
    // Generate new valid NanoIDs and update database
    console.log('\n🔄 Generating new alphanumeric NanoIDs...');
    
    const usedNanoIds = new Set();
    
    // First, collect all valid existing NanoIDs to avoid duplicates
    stations.forEach(station => {
      if (!/[^0-9A-Za-z]/.test(station.nanoid)) {
        usedNanoIds.add(station.nanoid);
      }
    });
    
    for (const station of invalidNanoIds) {
      // Generate a unique alphanumeric NanoID
      let newNanoid;
      do {
        newNanoid = generateStationId();
      } while (usedNanoIds.has(newNanoid));
      
      usedNanoIds.add(newNanoid);
      
      // Update the station in database
      await prisma.station.update({
        where: { id: station.id },
        data: { nanoid: newNanoid }
      });
      
      console.log(`✅ Station ${station.id} (${station.name}): ${station.oldNanoid} → ${newNanoid}`);
      fixed++;
    }
    
    console.log(`\n🎉 NanoID fix completed!`);
    console.log(`✅ Fixed: ${fixed} stations`);
    console.log(`✅ Already valid: ${alreadyValid} stations`);
    
    // Verify all NanoIDs are now valid
    const verifyStations = await prisma.station.findMany({
      select: { nanoid: true }
    });
    
    const stillInvalid = verifyStations.filter(s => /[^0-9A-Za-z]/.test(s.nanoid));
    
    if (stillInvalid.length === 0) {
      console.log('✅ Verification passed: All NanoIDs are now alphanumeric only!');
    } else {
      console.log(`❌ Verification failed: ${stillInvalid.length} NanoIDs still have special characters`);
    }
    
    return invalidNanoIds.map(station => ({
      stationId: station.id,
      oldNanoid: station.oldNanoid,
      newNanoid: usedNanoIds // This would need to be tracked properly, but for Rogers mapping we'll regenerate
    }));
    
  } catch (error) {
    console.error('💥 Error fixing NanoIDs:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the fix
fixNanoIds();