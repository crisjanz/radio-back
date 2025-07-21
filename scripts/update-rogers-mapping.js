const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function updateRogersMapping() {
  try {
    console.log('🔄 Updating Rogers station mapping with new NanoIDs...');
    
    // Original mapping with integer station IDs
    const oldMapping = {
      "CFAC": "816",
      "CFFR": "821",
      "CFGP": "822",
      "CFLT": "23",
      "CFRV": "828",
      "CFTR": "25",
      "CHAS": "26",
      "CHBN": "836",
      "CHDI": "838",
      "CHEZ": "810",
      "CHFI": "27",
      "CHFM": "840",
      "CHMN": "844",
      "CHST": "28",
      "CHTT": "29",
      "CHUR": "30",
      "CHYM": "31",
      "CIKR": "32",
      "CIKZ": "33",
      "CIOC": "610",
      "CISL": "614",
      "CISQ": "615",
      "CISS": "34",
      "CITI": "35",
      "CJAQ": "862",
      "CJAX": "619",
      "CJCL": "36",
      "CJCY": "865",
      "CJDL": "37",
      "CJET": "696",
      "CJMJ": "40",
      "CJNI": "41",
      "CJOK": "870",
      "CJQM": "42",
      "CJQQ": "43",
      "CJRQ": "44",
      "CJRX": "872",
      "CKAT": "59",
      "CKBY": "60",
      "CKFX": "61",
      "CKGB": "62",
      "CKGL": "692",
      "CKIS": "63",
      "CKKS": "642",
      "CKMH": "897",
      "CKOT": "64",
      "CKQC": "649",
      "CKSR": "654",
      "CKWX": "658",
      "CKY": "65",
      "CKYX": "919"
    };
    
    const newMapping = {};
    let found = 0;
    let notFound = 0;
    const missingStations = [];
    
    // Get all station IDs we need to look up
    const stationIds = Object.values(oldMapping).map(id => parseInt(id));
    
    // Query database for these stations
    console.log(`📊 Looking up ${stationIds.length} station IDs in database...`);
    
    const stations = await prisma.station.findMany({
      where: {
        id: { in: stationIds }
      },
      select: {
        id: true,
        nanoid: true,
        name: true,
        country: true
      }
    });
    
    console.log(`📊 Found ${stations.length} matching stations in database`);
    
    // Create a lookup map of stationId -> nanoid
    const stationLookup = {};
    stations.forEach(station => {
      stationLookup[station.id] = {
        nanoid: station.nanoid,
        name: station.name,
        country: station.country
      };
    });
    
    // Build new mapping with NanoIDs
    for (const [callLetters, stationId] of Object.entries(oldMapping)) {
      const numericId = parseInt(stationId);
      const station = stationLookup[numericId];
      
      if (station && station.nanoid) {
        newMapping[callLetters] = station.nanoid;
        found++;
        console.log(`✅ ${callLetters}: ID ${stationId} → NanoID ${station.nanoid} (${station.name})`);
      } else {
        notFound++;
        missingStations.push({ callLetters, stationId: numericId });
        console.log(`❌ ${callLetters}: Station ID ${stationId} not found in database`);
      }
    }
    
    // Handle the special case: CJMJ should be CJMX (based on previous error message)
    if ('CJMJ' in oldMapping && !newMapping['CJMJ']) {
      console.log('🔄 Converting CJMJ to CJMX (known correction)...');
      const cjmjStationId = parseInt(oldMapping['CJMJ']);
      const cjmjStation = stationLookup[cjmjStationId];
      if (cjmjStation && cjmjStation.nanoid) {
        delete newMapping['CJMJ']; // Remove if it exists
        newMapping['CJMX'] = cjmjStation.nanoid;
        console.log(`✅ CJMX: ID ${cjmjStationId} → NanoID ${cjmjStation.nanoid} (${cjmjStation.name})`);
      }
    }
    
    // Create the new Rogers mapping file
    const rogersConfig = {
      "description": "Rogers Digital Media Station Mapping",
      "instructions": [
        "1. Find your Streemr station IDs from your stations database",
        "2. Map Rogers call letters to your Streemr station NanoIDs in the 'mappings' section below",
        "3. Restart the metadata server or call /admin/reload-rogers-mappings",
        "4. Remove the Rogers URL and call letters from individual station configs - they're handled automatically now",
        "5. Set station metadata type to 'rogers-auto' in the station editor (coming soon)"
      ],
      "format": "rogers_call_letters: streemr_station_nanoid",
      "examples": {
        "CIOC": "pVMGtpH4",
        "CFAC": "2oEQrxn1"
      },
      "available_rogers_stations": [
        "CFAC", "CFFR", "CFGP", "CFLT", "CFRV", "CFTR", "CHAS", "CHBN", 
        "CHDI", "CHEZ", "CHFI", "CHFM", "CHMN", "CHST", "CHTT", "CHUR", 
        "CHYM", "CIKR", "CIKZ", "CIOC", "CISL", "CISQ", "CISS", "CITI", 
        "CJAQ", "CJAX", "CJCL", "CJCY", "CJDL", "CJET", "CJMX", "CJNI", 
        "CJOK", "CJQM", "CJQQ", "CJRQ", "CJRX", "CKAT", "CKBY", "CKFX", 
        "CKGB", "CKGL", "CKIS", "CKKS", "CKMH", "CKOT", "CKQC", "CKSR", 
        "CKWX", "CKXC", "CKY", "CKYX", "ROKT"
      ],
      "mappings": newMapping
    };
    
    // Write the updated mapping file
    const outputPath = path.join(__dirname, '../../streemr-local-metadata/config/rogers-stations.json');
    fs.writeFileSync(outputPath, JSON.stringify(rogersConfig, null, 2));
    
    console.log('\n🎉 Rogers mapping update completed!');
    console.log(`✅ Successfully mapped: ${found} stations`);
    console.log(`❌ Not found: ${notFound} stations`);
    console.log(`📁 Updated file: ${outputPath}`);
    
    if (missingStations.length > 0) {
      console.log('\n❌ Missing stations (these Rogers call letters won\'t work):');
      missingStations.forEach(({ callLetters, stationId }) => {
        console.log(`  ${callLetters}: Station ID ${stationId} not found in database`);
      });
    }
    
    console.log('\n📋 Sample mappings:');
    const sampleEntries = Object.entries(newMapping).slice(0, 5);
    sampleEntries.forEach(([callLetters, nanoid]) => {
      const station = Object.values(stationLookup).find(s => s.nanoid === nanoid);
      console.log(`  ${callLetters} → ${nanoid} (${station?.name || 'Unknown'})`);
    });
    
  } catch (error) {
    console.error('💥 Error updating Rogers mapping:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateRogersMapping();