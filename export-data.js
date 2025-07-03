const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./dev.db' // Your local SQLite database
    }
  }
});

async function exportData() {
  try {
    console.log('📊 Exporting all stations from local database...');
    
    const stations = await prisma.station.findMany({
      orderBy: { id: 'asc' }
    });
    
    console.log(`✅ Found ${stations.length} stations to export`);
    
    // Export to JSON file
    const exportData = {
      timestamp: new Date().toISOString(),
      totalStations: stations.length,
      stations: stations
    };
    
    fs.writeFileSync('stations-export.json', JSON.stringify(exportData, null, 2));
    console.log('💾 Data exported to stations-export.json');
    
    // Show summary
    const countries = [...new Set(stations.map(s => s.country))];
    const genres = [...new Set(stations.map(s => s.genre).filter(g => g))];
    
    console.log('\n📈 Export Summary:');
    console.log(`   • Total stations: ${stations.length}`);
    console.log(`   • Countries: ${countries.length}`);
    console.log(`   • Genres: ${genres.length}`);
    console.log(`   • Top countries: ${countries.slice(0, 5).join(', ')}`);
    
  } catch (error) {
    console.error('❌ Export failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportData();