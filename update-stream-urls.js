const fs = require('fs');
const fetch = require('node-fetch');

const RENDER_URL = 'https://streemr-back.onrender.com';

async function updateStreamUrls() {
  try {
    console.log('🔧 Updating existing stations with correct stream URLs...');
    
    // Step 1: Get current stations from the database
    const response = await fetch(`${RENDER_URL}/stations`);
    if (!response.ok) {
      throw new Error(`Failed to fetch stations: ${response.status}`);
    }
    const currentStations = await response.json();
    console.log(`✅ Found ${currentStations.length} stations in database`);
    
    // Step 2: Read the export data with correct URLs
    const rawData = fs.readFileSync('/Users/cristianjanz/radio-back/stations-export.json', 'utf8');
    const exportedStations = JSON.parse(rawData);
    console.log(`✅ Found ${exportedStations.length} stations in export`);
    
    // Step 3: Find stations that need URL updates
    const stationsToUpdate = [];
    for (const current of currentStations) {
      // Skip if already has a URL
      if (current.streamUrl && current.streamUrl.trim() !== '') {
        continue;
      }
      
      // Find matching station in export data by name
      const exported = exportedStations.find(exp => 
        exp.name.toLowerCase().trim() === current.name.toLowerCase().trim()
      );
      
      if (exported && exported.streamUrl && exported.streamUrl.trim() !== '') {
        stationsToUpdate.push({
          id: current.id,
          name: current.name,
          currentUrl: current.streamUrl,
          newUrl: exported.streamUrl
        });
      }
    }
    
    console.log(`📻 ${stationsToUpdate.length} stations need URL updates`);
    
    if (stationsToUpdate.length === 0) {
      console.log('✅ No stations need URL updates');
      return;
    }
    
    // Step 4: Update stations in small batches
    let updated = 0;
    let errors = 0;
    const BATCH_SIZE = 10;
    
    for (let i = 0; i < stationsToUpdate.length; i += BATCH_SIZE) {
      const batch = stationsToUpdate.slice(i, i + BATCH_SIZE);
      
      console.log(`📦 Updating batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(stationsToUpdate.length/BATCH_SIZE)} (${batch.length} stations)...`);
      
      for (const station of batch) {
        try {
          console.log(`🔄 ${station.name} -> ${station.newUrl}`);
          
          const updateResponse = await fetch(`${RENDER_URL}/stations/${station.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              streamUrl: station.newUrl
            })
          });
          
          if (updateResponse.ok) {
            updated++;
            console.log(`   ✅ Updated`);
          } else {
            console.log(`   ❌ Failed: ${updateResponse.status}`);
            errors++;
          }
          
          // Small delay to avoid overwhelming the server
          await new Promise(resolve => setTimeout(resolve, 200));
          
        } catch (error) {
          console.error(`   ❌ Error: ${error.message}`);
          errors++;
        }
      }
      
      // Delay between batches
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n🎉 Update complete!`);
    console.log(`   • Updated: ${updated} stations`);
    console.log(`   • Errors: ${errors}`);
    console.log(`   • Success rate: ${Math.round((updated / stationsToUpdate.length) * 100)}%`);
    
    // Step 5: Verify the updates
    console.log('\n🔍 Verifying updates...');
    try {
      const verifyResponse = await fetch(`${RENDER_URL}/stations`);
      if (verifyResponse.ok) {
        const verifyStations = await verifyResponse.json();
        const withUrls = verifyStations.filter(s => s.streamUrl && s.streamUrl.trim() !== '');
        console.log(`✅ ${withUrls.length} out of ${verifyStations.length} stations now have stream URLs`);
        
        if (withUrls.length > 0) {
          console.log(`🎵 Sample working station: ${withUrls[0].name} -> ${withUrls[0].streamUrl}`);
        }
      }
    } catch (error) {
      console.log('⚠️ Could not verify results');
    }
    
  } catch (error) {
    console.error('❌ Update failed:', error);
  }
}

updateStreamUrls();