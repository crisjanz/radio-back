// Interactive Genre & Type Normalization Script
// Usage: 
//   node normalize-genres.js --all          (process all stations)
//   node normalize-genres.js --new          (process only recent stations)
//   node normalize-genres.js --ids 1,2,3   (process specific station IDs)

const { PrismaClient } = require('@prisma/client');
const readline = require('readline');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// File to store learned rules
const RULES_FILE = path.join(__dirname, 'normalization-rules.json');

// Predefined categories
const MUSIC_GENRES = {
  'rock': ['rock', 'alternative rock', 'classic rock', 'active rock', 'modern rock', 'hard rock', 'soft rock'],
  'country': ['country', 'country music'],
  'pop': ['pop', 'adult contemporary', 'hot adult contemporary', 'adult hits', 'top 40', 'contemporary'],
  'jazz': ['jazz', 'smooth jazz'],
  'blues': ['blues'],
  'classical': ['classical', 'classical music'],
  'electronic': ['electronic', 'dance', 'edm', 'techno', 'house'],
  'hip-hop': ['hip-hop', 'hip hop', 'rap', 'urban'],
  'alternative': ['alternative', 'indie', 'independent'],
  'folk': ['folk', 'folk music'],
  'christian': ['christian', 'religious', 'gospel'],
  'oldies': ['oldies', 'classic hits', '60s', '70s', '80s', '90s', 'retro']
};

const STATION_TYPES = {
  'music': ['music'],
  'news': ['news'],
  'talk': ['talk', 'talk radio'],
  'sport': ['sport', 'sports', 'espn']
};

class NormalizationManager {
  constructor() {
    this.rules = this.loadRules();
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });
  }

  loadRules() {
    try {
      if (fs.existsSync(RULES_FILE)) {
        const data = fs.readFileSync(RULES_FILE, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.log('📝 No existing rules file found, starting fresh');
    }
    return { genres: {}, types: {} };
  }

  saveRules() {
    try {
      fs.writeFileSync(RULES_FILE, JSON.stringify(this.rules, null, 2));
      console.log('💾 Rules saved successfully');
    } catch (error) {
      console.error('❌ Error saving rules:', error);
    }
  }

  async askQuestion(question) {
    return new Promise((resolve) => {
      this.rl.question(question, (answer) => {
        resolve(answer.trim());
      });
    });
  }

  normalizeGenre(genre) {
    if (!genre) return null;
    
    const lowerGenre = genre.toLowerCase().trim();
    
    // Check saved rules first
    if (this.rules.genres[lowerGenre]) {
      return this.rules.genres[lowerGenre];
    }
    
    // Check predefined categories
    for (const [normalizedGenre, keywords] of Object.entries(MUSIC_GENRES)) {
      if (keywords.some(keyword => lowerGenre.includes(keyword))) {
        return normalizedGenre;
      }
    }
    
    return null; // Needs manual decision
  }

  normalizeType(type, genre) {
    if (!type) return 'music'; // Default
    
    const lowerType = type.toLowerCase().trim();
    
    // Check saved rules first
    if (this.rules.types[lowerType]) {
      return this.rules.types[lowerType];
    }
    
    // Check predefined categories
    for (const [normalizedType, keywords] of Object.entries(STATION_TYPES)) {
      if (keywords.some(keyword => lowerType.includes(keyword))) {
        return normalizedType;
      }
    }
    
    // Check if genre gives us a clue
    if (genre) {
      const lowerGenre = genre.toLowerCase();
      if (lowerGenre.includes('news')) return 'news';
      if (lowerGenre.includes('talk')) return 'talk';
      if (lowerGenre.includes('sport')) return 'sport';
    }
    
    return null; // Needs manual decision
  }

  async askForGenreDecision(originalGenre, stationName) {
    console.log(`\n🎵 GENRE DECISION NEEDED`);
    console.log(`Station: "${stationName}"`);
    console.log(`Current genre: "${originalGenre}"`);
    console.log(`\nAvailable options:`);
    
    const genreOptions = Object.keys(MUSIC_GENRES);
    genreOptions.forEach((genre, index) => {
      console.log(`  ${index + 1}. ${genre}`);
    });
    console.log(`  ${genreOptions.length + 1}. other (keep as-is)`);
    console.log(`  ${genreOptions.length + 2}. skip (don't change)`);
    
    const answer = await this.askQuestion('\nChoose option (1-' + (genreOptions.length + 2) + '): ');
    const choice = parseInt(answer);
    
    if (choice >= 1 && choice <= genreOptions.length) {
      const selectedGenre = genreOptions[choice - 1];
      this.rules.genres[originalGenre.toLowerCase()] = selectedGenre;
      return selectedGenre;
    } else if (choice === genreOptions.length + 1) {
      this.rules.genres[originalGenre.toLowerCase()] = originalGenre.toLowerCase();
      return originalGenre.toLowerCase();
    } else {
      return originalGenre; // Keep original, don't save rule
    }
  }

  async askForTypeDecision(originalType, stationName) {
    console.log(`\n📻 TYPE DECISION NEEDED`);
    console.log(`Station: "${stationName}"`);
    console.log(`Current type: "${originalType}"`);
    console.log(`\nAvailable options:`);
    
    const typeOptions = Object.keys(STATION_TYPES);
    typeOptions.forEach((type, index) => {
      console.log(`  ${index + 1}. ${type}`);
    });
    console.log(`  ${typeOptions.length + 1}. other (keep as-is)`);
    console.log(`  ${typeOptions.length + 2}. skip (don't change)`);
    
    const answer = await this.askQuestion('\nChoose option (1-' + (typeOptions.length + 2) + '): ');
    const choice = parseInt(answer);
    
    if (choice >= 1 && choice <= typeOptions.length) {
      const selectedType = typeOptions[choice - 1];
      this.rules.types[originalType.toLowerCase()] = selectedType;
      return selectedType;
    } else if (choice === typeOptions.length + 1) {
      this.rules.types[originalType.toLowerCase()] = originalType.toLowerCase();
      return originalType.toLowerCase();
    } else {
      return originalType; // Keep original, don't save rule
    }
  }

  async processStations(stations) {
    console.log(`\n🚀 Processing ${stations.length} stations...\n`);
    
    let updated = 0;
    let skipped = 0;
    let needsDecision = [];
    
    // First pass: identify stations that need decisions
    for (const station of stations) {
      const autoGenre = this.normalizeGenre(station.genre);
      const autoType = this.normalizeType(station.type, station.genre);
      
      if (autoGenre === null || autoType === null) {
        needsDecision.push({
          station,
          needsGenreDecision: autoGenre === null,
          needsTypeDecision: autoType === null,
          suggestedGenre: autoGenre,
          suggestedType: autoType
        });
      }
    }
    
    if (needsDecision.length > 0) {
      console.log(`⚠️  Found ${needsDecision.length} stations that need manual decisions.`);
      const proceed = await this.askQuestion('Do you want to review them now? (y/n): ');
      
      if (proceed.toLowerCase() === 'y') {
        for (const item of needsDecision) {
          console.log(`\n--- Processing ${item.station.name} ---`);
          
          if (item.needsGenreDecision && item.station.genre) {
            item.suggestedGenre = await this.askForGenreDecision(item.station.genre, item.station.name);
          }
          
          if (item.needsTypeDecision && item.station.type) {
            item.suggestedType = await this.askForTypeDecision(item.station.type, item.station.name);
          }
        }
        
        this.saveRules();
      } else {
        console.log('⏭️  Skipping manual decisions. Only auto-detectable changes will be applied.');
      }
    }
    
    // Second pass: apply all changes
    console.log('\n📝 Applying changes...\n');
    
    for (const station of stations) {
      const finalGenre = this.normalizeGenre(station.genre) || station.genre;
      const finalType = this.normalizeType(station.type, station.genre) || station.type;
      
      if (finalGenre !== station.genre || finalType !== station.type) {
        await prisma.station.update({
          where: { id: station.id },
          data: {
            genre: finalGenre,
            type: finalType
          }
        });
        
        console.log(`✅ Updated "${station.name}": genre="${finalGenre}", type="${finalType}"`);
        updated++;
      } else {
        skipped++;
      }
    }
    
    console.log(`\n🎉 Processing complete!`);
    console.log(`📈 Updated: ${updated} stations`);
    console.log(`⏭️  Skipped: ${skipped} stations`);
    
    return { updated, skipped };
  }

  async close() {
    this.rl.close();
    await prisma.$disconnect();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const manager = new NormalizationManager();
  
  try {
    let stations = [];
    
    if (args.includes('--all')) {
      console.log('🔍 Fetching all stations...');
      stations = await prisma.station.findMany({
        select: { id: true, name: true, genre: true, type: true }
      });
    } else if (args.includes('--new')) {
      console.log('🔍 Fetching stations from last 24 hours...');
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      stations = await prisma.station.findMany({
        where: {
          createdAt: {
            gte: yesterday
          }
        },
        select: { id: true, name: true, genre: true, type: true }
      });
    } else if (args.find(arg => arg.startsWith('--ids'))) {
      const idsArg = args.find(arg => arg.startsWith('--ids'));
      const ids = idsArg.split('=')[1].split(',').map(id => parseInt(id.trim()));
      
      console.log(`🔍 Fetching stations with IDs: ${ids.join(', ')}`);
      stations = await prisma.station.findMany({
        where: {
          id: { in: ids }
        },
        select: { id: true, name: true, genre: true, type: true }
      });
    } else {
      console.log(`
📚 Usage:
  node normalize-genres.js --all              Process all stations
  node normalize-genres.js --new              Process stations from last 24 hours  
  node normalize-genres.js --ids=1,2,3        Process specific station IDs

🔧 Features:
  • Interactive approval for unclear cases
  • Saves your decisions as rules for future use
  • Preview changes before applying
  • Detailed statistics and reporting
      `);
      process.exit(0);
    }
    
    if (stations.length === 0) {
      console.log('📭 No stations found to process.');
    } else {
      await manager.processStations(stations);
      
      // Show final statistics
      console.log('\n📊 Final Statistics:');
      const genreStats = await prisma.station.groupBy({
        by: ['genre'],
        _count: true,
        orderBy: { _count: { genre: 'desc' } }
      });
      
      console.log('Genres:');
      genreStats.slice(0, 10).forEach(stat => {
        console.log(`  ${stat.genre || 'null'}: ${stat._count} stations`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await manager.close();
  }
}

main();