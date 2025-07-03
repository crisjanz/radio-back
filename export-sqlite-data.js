const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

// Create Prisma client specifically for SQLite database
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./prisma/stations.db'
    }
  }
});

async function exportData() {
  try {
    console.log('📊 Exporting all stations from local SQLite database...');
    
    const stations = await prisma.station.findMany({
      orderBy: { id: 'asc' }
    });
    
    console.log(`✅ Found ${stations.length} stations to export`);
    
    if (stations.length === 0) {
      console.log('⚠️ No stations found in local database');
      return;
    }
    
    // Export to JSON file
    const exportData = {
      timestamp: new Date().toISOString(),
      totalStations: stations.length,
      stations: stations
    };
    
    fs.writeFileSync('/Users/cristianjanz/radio-back/stations-export.json', JSON.stringify(exportData, null, 2));
    console.log('💾 Data exported to /Users/cristianjanz/radio-back/stations-export.json');
    
    // Show summary
    const countries = [...new Set(stations.map(s => s.country))];
    const genres = [...new Set(stations.map(s => s.genre).filter(g => g))];
    const withRatings = stations.filter(s => s.votes || s.clickcount);
    
    console.log('\n📈 Export Summary:');
    console.log(`   • Total stations: ${stations.length}`);
    console.log(`   • Countries: ${countries.length}`);
    console.log(`   • Genres: ${genres.length}`);
    console.log(`   • With ratings: ${withRatings.length}`);
    console.log(`   • Top countries: ${countries.slice(0, 5).join(', ')}`);
    
    // Show sample station for verification
    if (stations.length > 0) {
      console.log('\n🎯 Sample station:');
      const sample = stations[0];
      console.log(`   • Name: ${sample.name}`);
      console.log(`   • Country: ${sample.country}`);
      console.log(`   • URL: ${sample.streamUrl}`);
      console.log(`   • Created: ${sample.createdAt}`);
    }
    
  } catch (error) {
    console.error('❌ Export failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportData();