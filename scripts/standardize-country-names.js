const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function standardizeCountryNames() {
  try {
    console.log('🔍 Starting country name standardization...');
    
    // First, let's see what variations we have
    console.log('\n📊 Checking current US country variations...');
    
    const usVariations = await prisma.$queryRaw`
      SELECT country, COUNT(*) as count 
      FROM "Station" 
      WHERE country ILIKE '%united%' 
         OR country ILIKE '%usa%' 
         OR country ILIKE '%america%'
         OR country = 'US'
         OR country = 'U.S.'
         OR country = 'U.S.A.'
      GROUP BY country 
      ORDER BY count DESC
    `;
    
    console.log('Current US variations found:');
    usVariations.forEach(row => {
      console.log(`  "${row.country}": ${row.count} stations`);
    });
    
    // Define all US variations to standardize
    const usVariationsToUpdate = [
      'United States',
      'United States of America', 
      'The United States Of America',
      'US',
      'U.S.',
      'U.S.A.',
      'America',
      'United States Of America'
    ];
    
    console.log('\n🔄 Standardizing to "USA"...');
    
    let totalUpdated = 0;
    
    // Update each variation
    for (const variation of usVariationsToUpdate) {
      const result = await prisma.station.updateMany({
        where: {
          country: {
            equals: variation,
            mode: 'insensitive'
          }
        },
        data: {
          country: 'USA'
        }
      });
      
      if (result.count > 0) {
        console.log(`  ✅ Updated ${result.count} stations from "${variation}" to "USA"`);
        totalUpdated += result.count;
      }
    }
    
    console.log(`\n🎉 Successfully standardized ${totalUpdated} stations to "USA"`);
    
    // Verify the results
    console.log('\n📊 Verification - checking final counts...');
    const finalCount = await prisma.station.count({
      where: {
        country: 'USA'
      }
    });
    
    console.log(`Total stations with country "USA": ${finalCount}`);
    
    // Check if any variations still exist
    const remainingVariations = await prisma.$queryRaw`
      SELECT country, COUNT(*) as count 
      FROM "Station" 
      WHERE country ILIKE '%united%' 
         OR country ILIKE '%america%'
         OR country = 'US'
         OR country = 'U.S.'
         OR country = 'U.S.A.'
      GROUP BY country 
      ORDER BY count DESC
    `;
    
    if (remainingVariations.length > 0) {
      console.log('\n⚠️  Remaining variations that might need manual review:');
      remainingVariations.forEach(row => {
        console.log(`  "${row.country}": ${row.count} stations`);
      });
    } else {
      console.log('\n✅ All US variations have been standardized!');
    }
    
  } catch (error) {
    console.error('❌ Error standardizing country names:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
standardizeCountryNames();