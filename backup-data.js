const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function backupData() {
  console.log('🔄 Creating data backup...');
  
  try {
    // Backup critical tables
    const stations = await prisma.station.findMany();
    const userFavorites = await prisma.userFavorites.findMany();
    const stationFeedback = await prisma.stationFeedback.findMany();
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        createdAt: true,
        updatedAt: true
        // Exclude password for security
      }
    });
    
    const backup = {
      timestamp: new Date().toISOString(),
      purpose: 'Before NanoID migration - Phase 1',
      data: {
        stations: stations,
        userFavorites: userFavorites,
        stationFeedback: stationFeedback,
        users: users
      },
      counts: {
        stations: stations.length,
        userFavorites: userFavorites.length,
        stationFeedback: stationFeedback.length,
        users: users.length
      }
    };
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `backup_data_before_nanoid_${timestamp}.json`;
    const filepath = path.join('/Users/cristianjanz/streemr', filename);
    
    fs.writeFileSync(filepath, JSON.stringify(backup, null, 2));
    
    console.log('✅ Data backup complete!');
    console.log(`📁 File: ${filepath}`);
    console.log(`📊 Backup includes:`);
    console.log(`   - ${backup.counts.stations} stations`);
    console.log(`   - ${backup.counts.userFavorites} user favorites`);
    console.log(`   - ${backup.counts.stationFeedback} feedback entries`);
    console.log(`   - ${backup.counts.users} users`);
    
    return filepath;
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  backupData().catch(console.error);
}

module.exports = { backupData };