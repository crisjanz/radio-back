const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Import nanoid
const { nanoid } = require('nanoid');

const prisma = new PrismaClient();

async function restoreData() {
  try {
    console.log('🔄 Starting data restoration...');
    
    // Read the backup file
    const backupPath = path.join(__dirname, '../../backup_data_before_nanoid_2025-07-19T19-59-49-212Z.json');
    const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
    
    console.log(`📊 Found ${backupData.data.stations.length} stations to restore`);
    
    let restored = 0;
    let errors = 0;
    
    // Restore stations with generated NanoIDs
    for (const station of backupData.data.stations) {
      try {
        // Generate a unique 8-character NanoID
        const stationNanoid = nanoid(8);
        
        // Prepare station data for insertion
        const stationData = {
          id: station.id, // Keep original ID
          nanoid: stationNanoid, // Add generated NanoID
          name: station.name,
          country: station.country,
          genre: station.genre,
          subgenre: station.subgenre,
          type: station.type,
          streamUrl: station.streamUrl,
          favicon: station.favicon,
          logo: station.logo,
          local_image_url: station.local_image_url,
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
          isActive: station.isActive !== false, // Default to true if not specified
          lastPingCheck: station.lastPingCheck ? new Date(station.lastPingCheck) : null,
          lastPingSuccess: station.lastPingSuccess,
          consecutiveFailures: station.consecutiveFailures || 0,
          userReports: station.userReports || 0,
          adminNotes: station.adminNotes,
          qualityScore: station.qualityScore,
          feedbackCount: station.feedbackCount || 0,
          editorsPick: station.editorsPick || false,
          featured: station.featured || false,
          createdAt: station.createdAt ? new Date(station.createdAt) : new Date(),
          updatedAt: station.updatedAt ? new Date(station.updatedAt) : new Date()
        };
        
        // Remove null/undefined values to avoid Prisma issues
        Object.keys(stationData).forEach(key => {
          if (stationData[key] === null || stationData[key] === undefined) {
            delete stationData[key];
          }
        });
        
        await prisma.station.create({
          data: stationData
        });
        
        restored++;
        
        if (restored % 100 === 0) {
          console.log(`✅ Restored ${restored} stations...`);
        }
        
      } catch (error) {
        console.error(`❌ Error restoring station ${station.id} (${station.name}):`, error.message);
        errors++;
      }
    }
    
    // Restore other data if it exists in backup
    if (backupData.data.users && backupData.data.users.length > 0) {
      console.log(`📊 Restoring ${backupData.data.users.length} users...`);
      for (const user of backupData.data.users) {
        try {
          await prisma.user.create({
            data: {
              id: user.id,
              email: user.email,
              password: user.password,
              resetToken: user.resetToken,
              resetTokenExpiry: user.resetTokenExpiry ? new Date(user.resetTokenExpiry) : null,
              createdAt: user.createdAt ? new Date(user.createdAt) : new Date(),
              updatedAt: user.updatedAt ? new Date(user.updatedAt) : new Date()
            }
          });
        } catch (error) {
          console.error(`❌ Error restoring user ${user.id}:`, error.message);
        }
      }
    }
    
    if (backupData.data.userFavorites && backupData.data.userFavorites.length > 0) {
      console.log(`📊 Restoring ${backupData.data.userFavorites.length} user favorites...`);
      for (const favorite of backupData.data.userFavorites) {
        try {
          await prisma.userFavorites.create({
            data: {
              id: favorite.id,
              userId: favorite.userId,
              stationId: favorite.stationId,
              createdAt: favorite.createdAt ? new Date(favorite.createdAt) : new Date()
            }
          });
        } catch (error) {
          console.error(`❌ Error restoring favorite ${favorite.id}:`, error.message);
        }
      }
    }
    
    console.log('\n🎉 Data restoration completed!');
    console.log(`✅ Successfully restored: ${restored} stations`);
    console.log(`❌ Errors: ${errors} stations`);
    
    // Show some sample restored data
    const sampleStations = await prisma.station.findMany({
      take: 3,
      select: { id: true, nanoid: true, name: true, country: true }
    });
    
    console.log('\n📋 Sample restored stations:');
    sampleStations.forEach(station => {
      console.log(`  ID: ${station.id}, NanoID: ${station.nanoid}, Name: ${station.name}, Country: ${station.country}`);
    });
    
    // Get total count
    const totalCount = await prisma.station.count();
    console.log(`\n📊 Total stations in database: ${totalCount}`);
    
  } catch (error) {
    console.error('💥 Fatal error during restoration:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the restoration
restoreData();