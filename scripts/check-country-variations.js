const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkCountryVariations() {
  try {
    console.log('🔍 Analyzing country name variations in the database...');
    
    // Get all unique countries and their counts
    const allCountries = await prisma.$queryRaw`
      SELECT country, COUNT(*) as count 
      FROM "Station" 
      GROUP BY country 
      ORDER BY count DESC
    `;
    
    console.log(`\n📊 Found ${allCountries.length} unique country entries:\n`);
    
    // Group potential variations
    const potentialVariations = new Map();
    
    allCountries.forEach(row => {
      const country = row.country.toLowerCase().trim();
      const count = parseInt(row.count);
      
      // Look for potential variations by checking similar words
      const baseWords = country.split(/[\s,.-]+/).filter(word => word.length > 2);
      
      baseWords.forEach(word => {
        if (!potentialVariations.has(word)) {
          potentialVariations.set(word, []);
        }
        potentialVariations.get(word).push({
          original: row.country,
          count: count
        });
      });
    });
    
    // Find countries with multiple variations
    console.log('🚨 Potential variations that might need standardization:\n');
    
    let foundVariations = false;
    
    potentialVariations.forEach((countries, baseWord) => {
      if (countries.length > 1 && baseWord.length > 3) {
        const totalStations = countries.reduce((sum, c) => sum + c.count, 0);
        
        if (totalStations > 5) { // Only show if significant number of stations
          console.log(`🔤 "${baseWord}" appears in:`);
          countries.forEach(country => {
            console.log(`  "${country.original}": ${country.count} stations`);
          });
          console.log(`  Total: ${totalStations} stations\n`);
          foundVariations = true;
        }
      }
    });
    
    if (!foundVariations) {
      console.log('✅ No significant country variations found that need standardization.\n');
    }
    
    // Show top countries for reference
    console.log('📈 Top 20 countries by station count:');
    allCountries.slice(0, 20).forEach((row, index) => {
      console.log(`${(index + 1).toString().padStart(2)}.  ${row.country.padEnd(30)} ${row.count} stations`);
    });
    
    // Check for obvious formatting issues
    console.log('\n🔍 Checking for formatting issues...');
    
    const formattingIssues = allCountries.filter(row => {
      const country = row.country;
      return country !== country.trim() || // Leading/trailing spaces
             country.includes('  ') || // Double spaces
             /[^\w\s\-\.]/.test(country) || // Special characters
             country.toLowerCase() === country || // All lowercase
             country.toUpperCase() === country; // All uppercase
    });
    
    if (formattingIssues.length > 0) {
      console.log('⚠️  Countries with potential formatting issues:');
      formattingIssues.forEach(row => {
        console.log(`  "${row.country}": ${row.count} stations`);
      });
    } else {
      console.log('✅ No obvious formatting issues found.');
    }
    
  } catch (error) {
    console.error('❌ Error checking country variations:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
checkCountryVariations();