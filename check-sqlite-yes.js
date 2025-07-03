const sqlite3 = require('sqlite3').verbose();

function checkSQLiteYes() {
  return new Promise((resolve, reject) => {
    console.log('🔍 Checking SQLite database for Yes.fm data...');
    
    const db = new sqlite3.Database('/Users/cristianjanz/radio-back/prisma/stations.db', (err) => {
      if (err) {
        console.error('❌ Failed to connect to SQLite database:', err);
        reject(err);
        return;
      }
      console.log('✅ Connected to SQLite database');
    });
    
    // Search for Yes.fm stations
    const query = `
      SELECT id, name, phone, address, description, facebookUrl, email, twitterUrl, instagramUrl
      FROM Station 
      WHERE name LIKE '%yes%' 
      ORDER BY name
    `;
    
    db.all(query, [], (err, rows) => {
      if (err) {
        console.error('❌ Query failed:', err);
        reject(err);
        return;
      }
      
      console.log(`\n📻 Found ${rows.length} Yes.fm stations in SQLite:`);
      
      rows.forEach(station => {
        console.log(`\nID: ${station.id} - ${station.name}`);
        console.log(`  Phone: ${station.phone || 'null'}`);
        console.log(`  Address: ${station.address || 'null'}`);
        console.log(`  Description: ${station.description || 'null'}`);
        console.log(`  Facebook: ${station.facebookUrl || 'null'}`);
        console.log(`  Email: ${station.email || 'null'}`);
        console.log(`  Twitter: ${station.twitterUrl || 'null'}`);
        console.log(`  Instagram: ${station.instagramUrl || 'null'}`);
      });
      
      db.close((err) => {
        if (err) {
          console.error('❌ Error closing database:', err);
        } else {
          console.log('\n✅ SQLite database closed');
        }
        resolve();
      });
    });
  });
}

checkSQLiteYes().catch(console.error);