const fs = require('fs');
const fetch = require('node-fetch');

const RENDER_URL = 'https://streemr-back.onrender.com';

async function applySyncToLive() {
  try {
    console.log('🔄 Step 2: Applying sync to live database...');
    
    // Read the sync payload
    const payload = JSON.parse(fs.readFileSync('/Users/cristianjanz/radio-back/sync-payload.json', 'utf8'));
    console.log(`📋 Loaded ${payload.length} stations to sync`);
    
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    
    console.log('🚀 Starting conservative sync (only updating empty fields)...');
    
    // Process in small batches to avoid overwhelming the server
    const BATCH_SIZE = 5;
    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const batch = payload.slice(i, i + BATCH_SIZE);
      
      console.log(`📦 Processing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(payload.length/BATCH_SIZE)} (${batch.length} stations)...`);
      
      for (const station of batch) {
        try {
          console.log(`🔄 ${station.name} (ID: ${station.id})`);
          
          // First, get current station data from live database
          const getResponse = await fetch(`${RENDER_URL}/stations/${station.id}`);
          
          if (!getResponse.ok) {
            console.log(`   ⚠️ Station not found on live site, skipping`);
            skipped++;
            continue;
          }
          
          const liveStation = await getResponse.json();
          
          // Conservative merge: only update fields that are empty/null on live site
          const updatedFields = {};
          let hasUpdates = false;
          
          Object.entries(station.fields).forEach(([field, localValue]) => {
            const liveValue = liveStation[field];
            
            // Only update if live field is empty/null/undefined
            if (!liveValue || liveValue === '' || liveValue === null) {
              updatedFields[field] = localValue;
              hasUpdates = true;
              console.log(`     ✅ ${field}: "${localValue}"`);
            } else {
              console.log(`     ⏭️ ${field}: keeping live value`);
            }
          });
          
          if (!hasUpdates) {
            console.log(`   ⏭️ No empty fields to update`);
            skipped++;
            continue;
          }
          
          // Apply the conservative updates
          const updateResponse = await fetch(`${RENDER_URL}/stations/${station.id}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify(updatedFields)
          });
          
          if (updateResponse.ok) {
            updated++;
            console.log(`   ✅ Updated ${Object.keys(updatedFields).length} fields`);
          } else {
            console.log(`   ❌ Update failed: ${updateResponse.status}`);
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
      console.log('   ⏸️ Batch delay...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log(`\n🎉 Sync complete!`);
    console.log(`   • Updated: ${updated} stations`);
    console.log(`   • Skipped: ${skipped} stations`);
    console.log(`   • Errors: ${errors} stations`);
    console.log(`   • Success rate: ${Math.round((updated / payload.length) * 100)}%`);
    
    // Verify final state
    console.log('\n🔍 Verifying sync results...');
    try {
      const verifyResponse = await fetch(`${RENDER_URL}/stations`);
      if (verifyResponse.ok) {
        const allStations = await verifyResponse.json();
        const stationsWithEnhancedData = allStations.stations.filter(s => 
          s.description || s.address || s.phone || s.latitude || s.longitude
        );
        
        console.log(`✅ Live database now has ${stationsWithEnhancedData.length} stations with enhanced data`);
      }
    } catch (error) {
      console.log('⚠️ Could not verify results');
    }
    
  } catch (error) {
    console.error('❌ Sync failed:', error);
  }
}

applySyncToLive();