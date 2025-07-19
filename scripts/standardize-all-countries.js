const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function standardizeAllCountries() {
  try {
    console.log('🔍 Starting comprehensive country name standardization...');
    
    // Define additional standardizations (optional - run only if you want these changes)
    const standardizations = [
      // Remove "The" prefixes for consistency
      { from: 'The Netherlands', to: 'Netherlands' },
      { from: 'The Russian Federation', to: 'Russia' },
      { from: 'The Falkland Islands Malvinas', to: 'Falkland Islands' },
      
      // You can add more standardizations here if needed
      // { from: 'Deutschland', to: 'Germany' },
      // { from: 'Brasil', to: 'Brazil' },
    ];
    
    console.log('\n🔄 Optional country standardizations available:');
    standardizations.forEach((std, index) => {
      console.log(`${index + 1}. "${std.from}" → "${std.to}"`);
    });
    
    console.log('\n⚠️  This script is ready but not executed automatically.');
    console.log('To run these standardizations, uncomment the execution code below.\n');
    
    // Uncomment the following code block if you want to run these standardizations:
    
    /*
    let totalUpdated = 0;
    
    for (const std of standardizations) {
      const result = await prisma.station.updateMany({
        where: {
          country: std.from
        },
        data: {
          country: std.to
        }
      });
      
      if (result.count > 0) {
        console.log(`✅ Updated ${result.count} stations from "${std.from}" to "${std.to}"`);
        totalUpdated += result.count;
      }
    }
    
    console.log(`\n🎉 Total stations updated: ${totalUpdated}`);
    */
    
    console.log('💡 To enable these changes, edit this script and uncomment the execution block.');
    
  } catch (error) {
    console.error('❌ Error standardizing countries:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
standardizeAllCountries();