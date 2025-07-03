const fetch = require('node-fetch');

async function testStations() {
  try {
    const response = await fetch('https://streemr-back.onrender.com/stations?limit=5');
    const data = await response.json();
    
    console.log('📻 Sample stations:');
    data.forEach(station => {
      console.log(`  ${station.name} -> ${station.streamUrl || 'NO URL'}`);
    });
    
    // Count working vs broken URLs
    const withUrls = data.filter(s => s.streamUrl && s.streamUrl.trim() !== '');
    console.log(`\n✅ ${withUrls.length} out of ${data.length} sample stations have URLs`);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testStations();