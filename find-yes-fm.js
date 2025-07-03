const fetch = require('node-fetch');

async function findYesFM() {
  try {
    const response = await fetch('https://streemr-back.onrender.com/stations');
    const data = await response.json();
    
    console.log(`Total stations: ${data.total || data.length}`);
    
    const stations = data.stations || data;
    const yesStations = stations.filter(s => s.name.toLowerCase().includes('yes'));
    
    console.log(`\nFound ${yesStations.length} stations with "yes" in name:`);
    yesStations.forEach(s => {
      console.log(`${s.id}: ${s.name}`);
      if (s.phone || s.address || s.description) {
        console.log(`  Enhanced data: ${s.phone ? 'phone, ' : ''}${s.address ? 'address, ' : ''}${s.description ? 'description' : ''}`);
      }
    });
    
    // Also check the sqlite database for Yes FM
    console.log('\n--- Checking SQLite database ---');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

findYesFM();