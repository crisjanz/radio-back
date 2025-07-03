const fetch = require('node-fetch');

async function checkProgress() {
  try {
    const response = await fetch('https://streemr-back.onrender.com/stations');
    const data = await response.json();
    
    const withUrls = data.filter(s => s.streamUrl && s.streamUrl.trim() !== '');
    console.log(`✅ ${withUrls.length} out of ${data.length} stations now have stream URLs`);
    
    if (withUrls.length > 0) {
      console.log(`🎵 Sample working station: ${withUrls[0].name} -> ${withUrls[0].streamUrl}`);
    }
  } catch (error) {
    console.error('Error checking progress:', error);
  }
}

checkProgress();