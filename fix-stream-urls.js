const fs = require('fs');
const fetch = require('node-fetch');

const RENDER_URL = 'https://streemr-back.onrender.com';

async function fixStreamUrls() {
  try {
    console.log('🔧 Reading exported stations data to fix stream URLs...');
    
    const rawData = fs.readFileSync('/Users/cristianjanz/radio-back/stations-export.json', 'utf8');
    const stations = JSON.parse(rawData);
    
    console.log(`✅ Found ${stations.length} stations in export`);
    
    // Check how many have stream URLs
    const withUrls = stations.filter(s => s.streamUrl && s.streamUrl.trim() !== '');
    console.log(`📻 ${withUrls.length} stations have stream URLs`);
    
    if (withUrls.length === 0) {
      console.log('❌ No stream URLs found in export data');
      return;
    }
    
    // Update stations with missing stream URLs
    let updated = 0;
    let errors = 0;
    
    console.log('🚀 Starting stream URL fixes...');
    
    for (const station of withUrls) {
      try {
        console.log(`📡 Fixing: ${station.name} -> ${station.streamUrl}`);
        
        const response = await fetch(`${RENDER_URL}/stations/${station.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            streamUrl: station.streamUrl,
            // Also restore other fields that might be missing
            genre: station.genre,
            type: station.type,
            latitude: station.latitude,
            longitude: station.longitude,
            city: station.city,
            state: station.state,
            description: station.description,
            language: station.language,
            frequency: station.frequency,
            bitrate: station.bitrate,
            codec: station.codec,
            clickcount: station.clickcount,
            votes: station.votes,
            radioBrowserUuid: station.radioBrowserUuid
          })
        });
        
        if (response.ok) {
          updated++;
          console.log(`   ✅ Updated ${station.name}`);
        } else {
          console.log(`   ❌ Failed to update ${station.name}: ${response.status}`);
          errors++;
        }
        
        // Small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        console.error(`❌ Error updating ${station.name}:`, error.message);
        errors++;
      }
    }
    
    console.log(`\\n🎉 Stream URL fix complete!`);
    console.log(`   • Updated: ${updated} stations`);
    console.log(`   • Errors: ${errors}`);
    console.log(`   • Success rate: ${Math.round((updated / withUrls.length) * 100)}%`);
    
  } catch (error) {
    console.error('❌ Fix failed:', error);
  }
}

fixStreamUrls();