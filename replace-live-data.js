const fs = require('fs');
const fetch = require('node-fetch');

const RENDER_URL = 'https://streemr-back.onrender.com';

async function replaceLiveData() {
  try {
    console.log('🔄 Replacing live database with complete SQLite data...');
    
    // Read the complete export
    const stations = JSON.parse(fs.readFileSync('/Users/cristianjanz/radio-back/complete-export.json', 'utf8'));
    console.log(`✅ Loaded ${stations.length} stations from SQLite export`);
    
    // Count enhanced stations
    const enhanced = stations.filter(s => 
      s.description || s.address || s.phone || s.email || 
      s.latitude || s.longitude || s.facebookUrl || s.twitterUrl || s.instagramUrl
    );
    console.log(`📊 ${enhanced.length} stations have enhanced data`);
    
    // Show sample enhanced station
    const sample = enhanced.find(s => s.name.toLowerCase().includes('yes'));
    if (sample) {
      console.log(`\n🎵 Sample: ${sample.name}`);
      console.log(`   Phone: ${sample.phone || 'none'}`);
      console.log(`   Address: ${sample.address || 'none'}`);
      console.log(`   Description: ${sample.description ? sample.description.substring(0, 80) + '...' : 'none'}`);
    }
    
    console.log('\n🗑️ This will COMPLETELY REPLACE the live database!');
    console.log('⚠️  All current live data will be lost!');
    console.log('✅ Your enhanced SQLite data will become the new live database');
    
    // Format for Radio Browser import API
    const formattedStations = stations.map(station => ({
      // Core fields for Radio Browser format
      name: station.name,
      url_resolved: station.streamUrl,
      url: station.streamUrl,
      country: station.country,
      homepage: station.homepage,
      favicon: station.favicon,
      tags: station.genre || station.tags,
      bitrate: station.bitrate,
      codec: station.codec,
      state: station.state,
      language: station.language,
      languagecodes: station.language,
      geo_lat: station.latitude,
      geo_long: station.longitude,
      clickcount: station.clickcount,
      votes: station.votes,
      stationuuid: station.radioBrowserUuid,
      
      // Enhanced fields (will be mapped on import)
      description: station.description,
      address: station.address,
      phone: station.phone,
      email: station.email,
      facebookUrl: station.facebookUrl,
      twitterUrl: station.twitterUrl,
      instagramUrl: station.instagramUrl,
      youtubeUrl: station.youtubeUrl,
      frequency: station.frequency,
      establishedYear: station.establishedYear,
      owner: station.owner,
      timezone: station.timezone,
      schedule: station.schedule,
      programs: station.programs,
      logo: station.logo,
      city: station.city
    }));
    
    console.log('\n🚀 Starting complete database replacement...');
    
    // Import in large batches since we're replacing everything
    const BATCH_SIZE = 50;
    let totalImported = 0;
    let errors = 0;
    
    for (let i = 0; i < formattedStations.length; i += BATCH_SIZE) {
      const batch = formattedStations.slice(i, i + BATCH_SIZE);
      
      console.log(`📦 Importing batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(formattedStations.length/BATCH_SIZE)} (${batch.length} stations)...`);
      
      try {
        const response = await fetch(`${RENDER_URL}/import/stations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ 
            stations: batch,
            replaceAll: true // This should trigger a complete replacement
          })
        });
        
        if (response.ok) {
          const result = await response.json();
          totalImported += result.imported || 0;
          console.log(`   ✅ Batch complete: ${result.imported || 0} imported`);
        } else {
          console.log(`   ❌ Batch failed: ${response.status}`);
          const errorText = await response.text();
          console.log(`   Error: ${errorText.substring(0, 100)}`);
          errors++;
        }
        
        // Delay between batches
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`   ❌ Batch error: ${error.message}`);
        errors++;
      }
    }
    
    console.log(`\n🎉 Database replacement complete!`);
    console.log(`   • Total imported: ${totalImported}`);
    console.log(`   • Batch errors: ${errors}`);
    
    // Verify the replacement
    console.log('\n🔍 Verifying replacement...');
    try {
      const verifyResponse = await fetch(`${RENDER_URL}/stations`);
      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        const withEnhanced = verifyData.stations.filter(s => 
          s.description || s.address || s.phone || s.facebookUrl
        );
        
        console.log(`✅ Live database now has ${verifyData.total} total stations`);
        console.log(`📊 ${withEnhanced.length} stations have enhanced data`);
        
        // Check for Yes.fm specifically
        const yesFm = verifyData.stations.find(s => s.name.toLowerCase().includes('yes.fm 89.3'));
        if (yesFm) {
          console.log(`🎵 Yes.fm 89.3 check: ${yesFm.phone ? 'HAS PHONE' : 'NO PHONE'} | ${yesFm.address ? 'HAS ADDRESS' : 'NO ADDRESS'}`);
        }
      }
    } catch (error) {
      console.log('⚠️ Could not verify results');
    }
    
  } catch (error) {
    console.error('❌ Replacement failed:', error);
  }
}

replaceLiveData();