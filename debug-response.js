const fetch = require('node-fetch');

async function debugResponse() {
  try {
    const response = await fetch('https://streemr-back.onrender.com/stations?limit=5');
    const data = await response.json();
    
    console.log('Response type:', typeof data);
    console.log('Response structure:', Object.keys(data));
    console.log('Full response:', JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugResponse();