const fs = require('fs');
const fetch = require('node-fetch');

const RENDER_URL = 'https://streemr-back.onrender.com';

async function importToRender() {
  try {
    console.log('📊 Reading exported stations data...');
    
    const rawData = fs.readFileSync('/Users/cristianjanz/radio-back/stations-export.json', 'utf8');
    const stations = JSON.parse(rawData);
    
    console.log(`✅ Found ${stations.length} stations to import`);
    
    if (stations.length === 0) {
      console.log('⚠️ No stations to import');
      return;
    }
    
    // Test connection to Render API
    console.log('🔗 Testing connection to Render API...');
    try {
      const healthCheck = await fetch(`${RENDER_URL}/health/schedule`);
      if (!healthCheck.ok) {
        throw new Error(`Health check failed: ${healthCheck.status}`);
      }
      console.log('✅ Connection to Render API successful');
    } catch (error) {
      console.error('❌ Cannot connect to Render API:', error.message);
      console.log('💡 Make sure to replace RENDER_URL with your actual app URL');
      return;
    }
    
    // Import stations in batches
    const BATCH_SIZE = 50;
    let imported = 0;
    let errors = 0;
    
    console.log(`🚀 Starting import in batches of ${BATCH_SIZE}...`);
    
    for (let i = 0; i < stations.length; i += BATCH_SIZE) {
      const batch = stations.slice(i, i + BATCH_SIZE);
      
      console.log(`📦 Importing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(stations.length/BATCH_SIZE)} (${batch.length} stations)...`);
      
      try {
        const response = await fetch(`${RENDER_URL}/import/stations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ stations: batch })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        imported += result.imported || 0;
        
        console.log(`   ✅ Batch complete: ${result.imported} imported, ${result.duplicates} duplicates`);
        
        // Small delay between batches
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`   ❌ Batch error: ${error.message}`);
        errors++;
      }
    }
    
    console.log(`\\n🎉 Import complete!`);
    console.log(`   • Total imported: ${imported}`);
    console.log(`   • Batch errors: ${errors}`);
    console.log(`   • Success rate: ${Math.round((imported / stations.length) * 100)}%`);
    
    // Verify import
    console.log('\\n🔍 Verifying import...');
    try {
      const statsResponse = await fetch(`${RENDER_URL}/import/stats`);
      if (statsResponse.ok) {
        const stats = await statsResponse.json();
        console.log(`✅ Render database now has ${stats.totalStations} stations`);
      }
    } catch (error) {
      console.log('⚠️ Could not verify stats, but import likely succeeded');
    }
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  }
}

// Instructions for the user
console.log('🚀 Radio Station Data Import to Render');
console.log('');
console.log('📝 SETUP REQUIRED:');
console.log('   1. Open this file: /Users/cristianjanz/radio-back/import-to-render.js');
console.log('   2. Replace RENDER_URL with your actual Render app URL');
console.log('   3. Example: https://radio-back-abc123.onrender.com');
console.log('   4. Run this script again with: node import-to-render.js');
console.log('');

// Run the import
importToRender();