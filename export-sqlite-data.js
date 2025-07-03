const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

async function exportSQLiteData() {
  return new Promise((resolve, reject) => {
    console.log('🔄 Exporting enhanced data from SQLite database...');
    
    // Connect to SQLite database
    const db = new sqlite3.Database('/Users/cristianjanz/radio-back/prisma/stations.db', (err) => {
      if (err) {
        console.error('❌ Failed to connect to SQLite database:', err);
        reject(err);
        return;
      }
      console.log('✅ Connected to SQLite database');
    });
    
    // Query for stations with enhanced data
    const query = `
      SELECT id, name, description, address, phone, email, latitude, longitude, 
             city, state, facebookUrl, twitterUrl, instagramUrl, youtubeUrl,
             favicon, logo, homepage, language, frequency, establishedYear,
             owner, bitrate, codec, timezone, schedule, programs, tags
      FROM Station 
      WHERE description IS NOT NULL 
         OR address IS NOT NULL 
         OR phone IS NOT NULL 
         OR email IS NOT NULL 
         OR latitude IS NOT NULL 
         OR longitude IS NOT NULL
         OR city IS NOT NULL 
         OR state IS NOT NULL
         OR facebookUrl IS NOT NULL 
         OR twitterUrl IS NOT NULL 
         OR instagramUrl IS NOT NULL 
         OR youtubeUrl IS NOT NULL
         OR favicon IS NOT NULL 
         OR logo IS NOT NULL
         OR language IS NOT NULL 
         OR frequency IS NOT NULL 
         OR establishedYear IS NOT NULL
         OR owner IS NOT NULL 
         OR timezone IS NOT NULL 
         OR schedule IS NOT NULL 
         OR programs IS NOT NULL 
         OR tags IS NOT NULL
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('❌ Query failed:', err);
        reject(err);
        return;
      }
      
      console.log(`✅ Found ${rows.length} stations with enhanced data`);
      
      // Process the data to create clean updates
      const updates = rows.map(station => {
        const { id, name, ...fields } = station;
        
        // Clean up null/empty values
        const cleanFields = {};
        Object.entries(fields).forEach(([key, value]) => {
          if (value !== null && value !== '' && value !== undefined) {
            cleanFields[key] = value;
          }
        });
        
        return {
          id,
          name,
          fields: cleanFields
        };
      }).filter(update => Object.keys(update.fields).length > 0);
      
      console.log(`📋 Prepared ${updates.length} stations for sync`);
      
      // Save to file
      const filename = '/Users/cristianjanz/radio-back/sync-payload.json';
      fs.writeFileSync(filename, JSON.stringify(updates, null, 2));
      
      console.log(`💾 Saved sync payload to: ${filename}`);
      
      // Show summary
      console.log('\n📊 Enhanced data summary:');
      const fieldCounts = {};
      
      updates.forEach(update => {
        Object.keys(update.fields).forEach(field => {
          fieldCounts[field] = (fieldCounts[field] || 0) + 1;
        });
      });
      
      Object.entries(fieldCounts)
        .sort(([,a], [,b]) => b - a)
        .forEach(([field, count]) => {
          console.log(`   • ${field}: ${count} stations`);
        });
      
      db.close((err) => {
        if (err) {
          console.error('❌ Error closing database:', err);
        } else {
          console.log('\n✅ SQLite database closed');
          console.log('🚀 Ready to sync to live database!');
        }
        resolve();
      });
    });
  });
}

exportSQLiteData().catch(console.error);