const sqlite3 = require('sqlite3').verbose();
const fs = require('fs');

function exportAllSQLiteData() {
  return new Promise((resolve, reject) => {
    console.log('🔄 Exporting ALL data from SQLite database...');
    
    const db = new sqlite3.Database('/Users/cristianjanz/radio-back/prisma/stations.db', (err) => {
      if (err) {
        console.error('❌ Failed to connect to SQLite database:', err);
        reject(err);
        return;
      }
      console.log('✅ Connected to SQLite database');
    });
    
    // Export all stations data
    const query = `SELECT * FROM Station ORDER BY id`;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('❌ Query failed:', err);
        reject(err);
        return;
      }
      
      console.log(`✅ Found ${rows.length} total stations in SQLite`);
      
      // Count enhanced stations
      const enhanced = rows.filter(s => 
        s.description || s.address || s.phone || s.email || 
        s.latitude || s.longitude || s.facebookUrl || s.twitterUrl || s.instagramUrl
      );
      
      console.log(`📊 ${enhanced.length} stations have enhanced data`);
      
      // Save all data for import
      const filename = '/Users/cristianjanz/radio-back/complete-export.json';
      fs.writeFileSync(filename, JSON.stringify(rows, null, 2));
      
      console.log(`💾 Exported complete database to: ${filename}`);
      console.log('\n📋 Sample enhanced station:');
      
      const sample = enhanced[0];
      if (sample) {
        console.log(`  Name: ${sample.name}`);
        console.log(`  Phone: ${sample.phone || 'null'}`);
        console.log(`  Address: ${sample.address || 'null'}`);
        console.log(`  Description: ${sample.description ? sample.description.substring(0, 100) + '...' : 'null'}`);
        console.log(`  Social: ${sample.facebookUrl ? 'Facebook, ' : ''}${sample.twitterUrl ? 'Twitter, ' : ''}${sample.instagramUrl ? 'Instagram' : ''}`);
      }
      
      db.close((err) => {
        if (err) {
          console.error('❌ Error closing database:', err);
        } else {
          console.log('\n✅ SQLite export complete!');
          console.log('🚀 Ready to replace live database!');
        }
        resolve();
      });
    });
  });
}

exportAllSQLiteData().catch(console.error);