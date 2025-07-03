const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

// Local SQLite database connection
const localPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:/Users/cristianjanz/radio-back/prisma/stations.db'
    }
  }
});

async function syncToLive() {
  try {
    console.log('🔄 Step 1: Exporting enhanced data from local database...');
    
    // Export stations with scraped/enhanced data
    const localStations = await localPrisma.station.findMany({
      where: {
        OR: [
          { description: { not: null, not: '' } },
          { address: { not: null, not: '' } },
          { phone: { not: null, not: '' } },
          { email: { not: null, not: '' } },
          { latitude: { not: null } },
          { longitude: { not: null } },
          { city: { not: null, not: '' } },
          { state: { not: null, not: '' } },
          { facebookUrl: { not: null, not: '' } },
          { twitterUrl: { not: null, not: '' } },
          { instagramUrl: { not: null, not: '' } },
          { youtubeUrl: { not: null, not: '' } },
          { favicon: { not: null, not: '' } },
          { logo: { not: null, not: '' } },
          { language: { not: null, not: '' } },
          { frequency: { not: null, not: '' } },
          { establishedYear: { not: null } },
          { owner: { not: null, not: '' } },
          { timezone: { not: null, not: '' } },
          { schedule: { not: null, not: '' } },
          { programs: { not: null, not: '' } },
          { tags: { not: null, not: '' } }
        ]
      },
      select: {
        id: true,
        name: true,
        description: true,
        address: true,
        phone: true,
        email: true,
        latitude: true,
        longitude: true,
        city: true,
        state: true,
        facebookUrl: true,
        twitterUrl: true,
        instagramUrl: true,
        youtubeUrl: true,
        favicon: true,
        logo: true,
        homepage: true,
        language: true,
        frequency: true,
        establishedYear: true,
        owner: true,
        bitrate: true,
        codec: true,
        timezone: true,
        schedule: true,
        programs: true,
        tags: true
      }
    });
    
    console.log(`✅ Found ${localStations.length} stations with enhanced data`);
    
    // Create update payloads for each station
    const updates = localStations.map(station => {
      const { id, name, ...enhancedFields } = station;
      
      // Only include fields that have actual values
      const cleanedFields = {};
      Object.entries(enhancedFields).forEach(([key, value]) => {
        if (value !== null && value !== '' && value !== undefined) {
          cleanedFields[key] = value;
        }
      });
      
      return {
        id,
        name,
        fields: cleanedFields
      };
    }).filter(update => Object.keys(update.fields).length > 0);
    
    console.log(`📋 Prepared ${updates.length} stations for sync`);
    
    // Save update payload
    const filename = '/Users/cristianjanz/radio-back/sync-payload.json';
    fs.writeFileSync(filename, JSON.stringify(updates, null, 2));
    
    console.log(`💾 Saved sync payload to: ${filename}`);
    
    // Show summary of what will be synced
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
    
    console.log('\n🚀 Ready to sync to live database!');
    console.log('Next: Run the import script to apply these changes to production.');
    
  } catch (error) {
    console.error('❌ Export failed:', error);
  } finally {
    await localPrisma.$disconnect();
  }
}

syncToLive();