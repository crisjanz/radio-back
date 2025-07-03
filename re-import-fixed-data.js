const fs = require('fs');
const fetch = require('node-fetch');

const RENDER_URL = 'https://streemr-back.onrender.com';

async function reImportFixedData() {
  try {
    console.log('🔄 Re-importing stations with correct stream URLs...');
    
    // Step 1: Read the export data
    const rawData = fs.readFileSync('/Users/cristianjanz/radio-back/stations-export.json', 'utf8');
    const stations = JSON.parse(rawData);
    
    console.log(`✅ Found ${stations.length} stations in export`);
    
    // Step 2: Format stations for the import API
    const stationsWithUrls = stations.filter(s => s.streamUrl && s.streamUrl.trim() !== '');
    console.log(`📻 ${stationsWithUrls.length} stations have stream URLs`);
    
    // Step 3: Delete existing stations and re-import
    console.log('🗑️ This will replace existing data with corrected stream URLs');
    
    // Step 4: Import in batches using the existing import endpoint
    const BATCH_SIZE = 25; // Smaller batches to avoid timeouts
    let totalImported = 0;
    let errors = 0;
    
    console.log(`🚀 Starting re-import in batches of ${BATCH_SIZE}...`);
    
    for (let i = 0; i < stationsWithUrls.length; i += BATCH_SIZE) {
      const batch = stationsWithUrls.slice(i, i + BATCH_SIZE);
      
      console.log(`📦 Importing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(stationsWithUrls.length/BATCH_SIZE)} (${batch.length} stations)...`);
      
      try {
        // Use the existing import/stations endpoint
        const response = await fetch(`${RENDER_URL}/import/stations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            stations: batch.map(station => ({
              // Map the fields correctly for Radio Browser format
              name: station.name,
              url_resolved: station.streamUrl, // This is the key field!
              url: station.streamUrl,
              country: station.country,
              homepage: station.homepage,
              favicon: station.favicon,
              tags: station.genre,
              bitrate: station.bitrate,
              codec: station.codec,
              state: station.state,
              language: station.language,
              languagecodes: station.language,
              geo_lat: station.latitude,
              geo_long: station.longitude,
              clickcount: station.clickcount,
              votes: station.votes,
              stationuuid: station.radioBrowserUuid
            }))
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          totalImported += result.imported || 0;
          console.log(`   ✅ Batch complete: ${result.imported} imported, ${result.duplicates} duplicates`);
        } else {
          console.log(`   ❌ Batch failed: ${response.status}`);
          errors++;
        }
        
        // Delay between batches
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`   ❌ Batch error: ${error.message}`);
        errors++;
      }
    }
    
    console.log(`\\n🎉 Re-import complete!`);
    console.log(`   • Total imported: ${totalImported}`);
    console.log(`   • Batch errors: ${errors}`);
    
    // Verify the import
    console.log('\\n🔍 Verifying stream URLs...');
    try {
      const testResponse = await fetch(`${RENDER_URL}/stations`);
      if (testResponse.ok) {
        const testStations = await testResponse.json();
        const withUrls = testStations.filter(s => s.streamUrl && s.streamUrl.trim() !== '');
        console.log(`✅ ${withUrls.length} out of ${testStations.length} stations now have stream URLs`);
        
        if (withUrls.length > 0) {
          console.log(`🎵 Sample working station: ${withUrls[0].name} -> ${withUrls[0].streamUrl}`);
        }
      }
    } catch (error) {
      console.log('⚠️ Could not verify results');
    }
    
  } catch (error) {
    console.error('❌ Re-import failed:', error);
  }
}

reImportFixedData();