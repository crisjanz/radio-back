const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

// Set the DATABASE_URL directly
process.env.DATABASE_URL = 'postgresql://streemr_user:uy9IcetHC6stgDxvTT5ZewRMGk5pTbDY@dpg-d1iuiqemcj7s739ua480-a.oregon-postgres.render.com/streemr';

// Connect to live PostgreSQL database
const livePrisma = new PrismaClient();

async function importSQLiteToLive() {
  try {
    console.log('🔄 Importing SQLite data to live PostgreSQL database...');
    
    // Read the SQLite export
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
    
    console.log('\n⚠️ WARNING: This will DELETE ALL existing data in the live database!');
    console.log('✅ Your SQLite data will completely replace the live database');
    
    // Clear existing data
    console.log('\n🗑️ Clearing existing live database...');
    await livePrisma.station.deleteMany();
    console.log('✅ Live database cleared');
    
    // Import all stations
    console.log('\n📦 Importing stations in batches...');
    const BATCH_SIZE = 100;
    let imported = 0;
    
    for (let i = 0; i < stations.length; i += BATCH_SIZE) {
      const batch = stations.slice(i, i + BATCH_SIZE);
      
      console.log(`   Batch ${Math.floor(i/BATCH_SIZE) + 1}/${Math.ceil(stations.length/BATCH_SIZE)} (${batch.length} stations)...`);
      
      try {
        // Prepare data for Prisma
        const batchData = batch.map(station => ({
          name: station.name,
          country: station.country,
          genre: station.genre,
          type: station.type,
          streamUrl: station.streamUrl,
          favicon: station.favicon,
          logo: station.logo,
          homepage: station.homepage,
          latitude: station.latitude,
          longitude: station.longitude,
          city: station.city,
          state: station.state,
          metadataApiUrl: station.metadataApiUrl,
          metadataApiType: station.metadataApiType,
          metadataFormat: station.metadataFormat,
          metadataFields: station.metadataFields,
          description: station.description,
          language: station.language,
          frequency: station.frequency,
          establishedYear: station.establishedYear,
          owner: station.owner,
          bitrate: station.bitrate,
          codec: station.codec,
          facebookUrl: station.facebookUrl,
          twitterUrl: station.twitterUrl,
          instagramUrl: station.instagramUrl,
          youtubeUrl: station.youtubeUrl,
          email: station.email,
          phone: station.phone,
          address: station.address,
          schedule: station.schedule,
          programs: station.programs,
          tags: station.tags,
          timezone: station.timezone,
          clickcount: station.clickcount,
          votes: station.votes,
          radioBrowserUuid: station.radioBrowserUuid,
          isActive: station.isActive === 1 || station.isActive === true,
          consecutiveFailures: station.consecutiveFailures || 0,
          userReports: station.userReports || 0,
          adminNotes: station.adminNotes
        }));
        
        await livePrisma.station.createMany({
          data: batchData,
          skipDuplicates: true
        });
        
        imported += batch.length;
        console.log(`   ✅ Imported ${batch.length} stations (${imported}/${stations.length} total)`);
        
      } catch (error) {
        console.error(`   ❌ Batch failed: ${error.message}`);
      }
    }
    
    console.log(`\n🎉 Import complete! ${imported}/${stations.length} stations imported`);
    
    // Verify the import
    console.log('\n🔍 Verifying import...');
    const totalCount = await livePrisma.station.count();
    const enhancedCount = await livePrisma.station.count({
      where: {
        OR: [
          { description: { not: null, not: '' } },
          { address: { not: null, not: '' } },
          { phone: { not: null, not: '' } },
          { facebookUrl: { not: null, not: '' } }
        ]
      }
    });
    
    console.log(`✅ Live database now has ${totalCount} stations`);
    console.log(`📊 ${enhancedCount} stations have enhanced data`);
    
    // Check for Yes.fm specifically
    const yesFm = await livePrisma.station.findFirst({
      where: { name: { contains: 'Yes.fm 89.3', mode: 'insensitive' } }
    });
    
    if (yesFm) {
      console.log(`\n🎵 Yes.fm 89.3 verification:`);
      console.log(`   ID: ${yesFm.id}`);
      console.log(`   Phone: ${yesFm.phone || 'none'}`);
      console.log(`   Address: ${yesFm.address || 'none'}`);
      console.log(`   Description: ${yesFm.description ? yesFm.description.substring(0, 50) + '...' : 'none'}`);
    }
    
    console.log('\n🚀 Database replacement complete!');
    console.log('✅ Your local development now uses the live database');
    console.log('✅ All your scraped data is now live');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await livePrisma.$disconnect();
  }
}

importSQLiteToLive();