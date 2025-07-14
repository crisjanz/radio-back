/**
 * Collection Tags System
 * Used for curating themed station collections and user recommendations
 */

export interface CollectionTagInfo {
  name: string;
  slug: string;
  description: string;
  iconEmoji: string;
  category: 'time' | 'activity' | 'mood' | 'seasonal' | 'special';
  keywords: string[]; // For automatic tagging suggestions
}

export const COLLECTION_TAGS: Record<string, CollectionTagInfo> = {
  // Time-based collections
  'morning-boost': {
    name: 'Morning Boost',
    slug: 'morning-boost',
    description: 'Energizing stations to start your day right',
    iconEmoji: '🌅',
    category: 'time',
    keywords: ['morning', 'wake up', 'energy', 'coffee', 'sunrise']
  },

  'afternoon-energy': {
    name: 'Afternoon Energy',
    slug: 'afternoon-energy', 
    description: 'Beat the afternoon slump with upbeat music',
    iconEmoji: '☀️',
    category: 'time',
    keywords: ['afternoon', 'energy', 'upbeat', 'motivating']
  },

  'evening-unwind': {
    name: 'Evening Unwind',
    slug: 'evening-unwind',
    description: 'Relaxing stations for winding down',
    iconEmoji: '🌆',
    category: 'time',
    keywords: ['evening', 'relax', 'unwind', 'chill', 'sunset']
  },

  'late-night-vibes': {
    name: 'Late Night Vibes',
    slug: 'late-night-vibes',
    description: 'Smooth sounds for late night listening',
    iconEmoji: '🌙',
    category: 'time',
    keywords: ['late night', 'smooth', 'ambient', 'quiet', 'insomnia']
  },

  'weekend-party': {
    name: 'Weekend Party',
    slug: 'weekend-party',
    description: 'High-energy stations for weekend celebrations',
    iconEmoji: '🎉',
    category: 'time',
    keywords: ['weekend', 'party', 'dance', 'celebration', 'fun']
  },

  'workday-focus': {
    name: 'Workday Focus',
    slug: 'workday-focus',
    description: 'Background music for productivity and concentration',
    iconEmoji: '💼',
    category: 'time',
    keywords: ['work', 'focus', 'productivity', 'concentration', 'office']
  },

  // Activity-based collections
  'workout-power': {
    name: 'Workout Power',
    slug: 'workout-power',
    description: 'High-energy stations to fuel your workout',
    iconEmoji: '💪',
    category: 'activity',
    keywords: ['workout', 'exercise', 'gym', 'fitness', 'energy', 'running']
  },

  'study-focus': {
    name: 'Study Focus',
    slug: 'study-focus',
    description: 'Instrumental and ambient music for studying',
    iconEmoji: '📚',
    category: 'activity',
    keywords: ['study', 'focus', 'instrumental', 'ambient', 'concentration']
  },

  'road-trip': {
    name: 'Road Trip',
    slug: 'road-trip',
    description: 'Perfect stations for long drives and adventures',
    iconEmoji: '🚗',
    category: 'activity',
    keywords: ['driving', 'road trip', 'travel', 'adventure', 'journey']
  },

  'cooking-vibes': {
    name: 'Cooking Vibes',
    slug: 'cooking-vibes',
    description: 'Upbeat music to make cooking more enjoyable',
    iconEmoji: '👨‍🍳',
    category: 'activity',
    keywords: ['cooking', 'kitchen', 'food', 'upbeat', 'fun']
  },

  'cleaning-energy': {
    name: 'Cleaning Energy',
    slug: 'cleaning-energy',
    description: 'Motivating music for household chores',
    iconEmoji: '🧹',
    category: 'activity',
    keywords: ['cleaning', 'chores', 'housework', 'motivating', 'energy']
  },

  'gaming-background': {
    name: 'Gaming Background',
    slug: 'gaming-background',
    description: 'Perfect background music for gaming sessions',
    iconEmoji: '🎮',
    category: 'activity',
    keywords: ['gaming', 'background', 'electronic', 'instrumental', 'ambient']
  },

  // Mood-based collections
  'chill-out': {
    name: 'Chill Out',
    slug: 'chill-out',
    description: 'Relaxed and mellow stations for peaceful moments',
    iconEmoji: '😌',
    category: 'mood',
    keywords: ['chill', 'relax', 'mellow', 'peaceful', 'calm']
  },

  'feel-good': {
    name: 'Feel Good',
    slug: 'feel-good',
    description: 'Uplifting music to boost your mood',
    iconEmoji: '😊',
    category: 'mood',
    keywords: ['happy', 'uplifting', 'positive', 'good mood', 'joy']
  },

  'throwback-hits': {
    name: 'Throwback Hits',
    slug: 'throwback-hits',
    description: 'Classic hits that bring back memories',
    iconEmoji: '📻',
    category: 'mood',
    keywords: ['throwback', 'classic', 'hits', 'nostalgia', 'retro', 'memories']
  },

  'romantic-mood': {
    name: 'Romantic Mood',
    slug: 'romantic-mood',
    description: 'Romantic stations for special moments',
    iconEmoji: '💕',
    category: 'mood',
    keywords: ['romantic', 'love', 'valentine', 'intimate', 'slow']
  },

  'party-mode': {
    name: 'Party Mode',
    slug: 'party-mode',
    description: 'High-energy dance music for celebrations',
    iconEmoji: '🕺',
    category: 'mood',
    keywords: ['party', 'dance', 'celebration', 'high energy', 'club']
  },

  'relaxation': {
    name: 'Relaxation',
    slug: 'relaxation',
    description: 'Soothing stations for meditation and stress relief',
    iconEmoji: '🧘‍♀️',
    category: 'mood',
    keywords: ['relaxation', 'meditation', 'stress relief', 'calm', 'soothing']
  },

  // Seasonal/Holiday collections
  'christmas-spirit': {
    name: 'Christmas Spirit',
    slug: 'christmas-spirit',
    description: 'Festive Christmas music and holiday classics',
    iconEmoji: '🎄',
    category: 'seasonal',
    keywords: ['christmas', 'holiday', 'festive', 'xmas', 'winter']
  },

  'summer-hits': {
    name: 'Summer Hits',
    slug: 'summer-hits',
    description: 'Hot summer tracks and beach vibes',
    iconEmoji: '🏖️',
    category: 'seasonal',
    keywords: ['summer', 'beach', 'hot', 'vacation', 'sunny']
  },

  'valentine-love': {
    name: "Valentine's Love",
    slug: 'valentine-love',
    description: 'Romantic music for Valentine\'s Day',
    iconEmoji: '💝',
    category: 'seasonal',
    keywords: ['valentine', 'love', 'romantic', 'february', 'heart']
  },

  'halloween-spooky': {
    name: 'Halloween Spooky',
    slug: 'halloween-spooky',
    description: 'Spooky sounds and Halloween-themed music',
    iconEmoji: '🎃',
    category: 'seasonal',
    keywords: ['halloween', 'spooky', 'scary', 'october', 'horror']
  },

  'new-year-celebration': {
    name: 'New Year Celebration',
    slug: 'new-year-celebration',
    description: 'Party music for New Year celebrations',
    iconEmoji: '🎊',
    category: 'seasonal',
    keywords: ['new year', 'celebration', 'party', 'january', 'resolution']
  },

  'spring-fresh': {
    name: 'Spring Fresh',
    slug: 'spring-fresh',
    description: 'Fresh and uplifting music for spring',
    iconEmoji: '🌸',
    category: 'seasonal',
    keywords: ['spring', 'fresh', 'renewal', 'bloom', 'nature']
  },

  'autumn-cozy': {
    name: 'Autumn Cozy',
    slug: 'autumn-cozy',
    description: 'Warm and cozy music for fall season',
    iconEmoji: '🍂',
    category: 'seasonal',
    keywords: ['autumn', 'fall', 'cozy', 'warm', 'leaves']
  },

  // Special interest collections
  'discovery-mix': {
    name: 'Discovery Mix',
    slug: 'discovery-mix',
    description: 'Explore new stations and genres',
    iconEmoji: '🔍',
    category: 'special',
    keywords: ['discovery', 'new', 'explore', 'unknown', 'variety']
  },

  'underground-gems': {
    name: 'Underground Gems',
    slug: 'underground-gems',
    description: 'Hidden gems and lesser-known stations',
    iconEmoji: '💎',
    category: 'special',
    keywords: ['underground', 'hidden', 'gems', 'indie', 'unknown']
  },

  'local-favorites': {
    name: 'Local Favorites',
    slug: 'local-favorites',
    description: 'Popular stations in your area',
    iconEmoji: '📍',
    category: 'special',
    keywords: ['local', 'regional', 'area', 'nearby', 'community']
  },

  'international-sounds': {
    name: 'International Sounds',
    slug: 'international-sounds',
    description: 'Music from around the world',
    iconEmoji: '🌍',
    category: 'special',
    keywords: ['international', 'world', 'global', 'foreign', 'culture']
  },

  'retro-classics': {
    name: 'Retro Classics',
    slug: 'retro-classics',
    description: 'Classic hits from decades past',
    iconEmoji: '📼',
    category: 'special',
    keywords: ['retro', 'classic', 'vintage', 'old', 'decades']
  },

  'rising-artists': {
    name: 'Rising Artists',
    slug: 'rising-artists',
    description: 'Stations featuring up-and-coming artists',
    iconEmoji: '⭐',
    category: 'special',
    keywords: ['rising', 'new artists', 'emerging', 'indie', 'fresh']
  }
};

// Helper functions for collection tag operations
export function getAllCollectionTags(): CollectionTagInfo[] {
  return Object.values(COLLECTION_TAGS);
}

export function getCollectionTagsByCategory(category: CollectionTagInfo['category']): CollectionTagInfo[] {
  return Object.values(COLLECTION_TAGS).filter(tag => tag.category === category);
}

export function getCollectionTagBySlug(slug: string): CollectionTagInfo | null {
  return Object.values(COLLECTION_TAGS).find(tag => tag.slug === slug) || null;
}

export function isValidCollectionTag(slug: string): boolean {
  return slug in COLLECTION_TAGS;
}

export function getCollectionTagSlugs(): string[] {
  return Object.keys(COLLECTION_TAGS);
}

export function getCollectionTagCategories(): CollectionTagInfo['category'][] {
  return ['time', 'activity', 'mood', 'seasonal', 'special'];
}

// Function to suggest tags based on station metadata
export function suggestTagsForStation(station: {
  name: string;
  description?: string;
  genre?: string;
  subgenre?: string;
}): string[] {
  const suggestions: string[] = [];
  const searchText = `${station.name} ${station.description || ''} ${station.genre || ''} ${station.subgenre || ''}`.toLowerCase();

  Object.entries(COLLECTION_TAGS).forEach(([slug, tag]) => {
    const hasKeyword = tag.keywords.some(keyword => 
      searchText.includes(keyword.toLowerCase())
    );
    
    if (hasKeyword) {
      suggestions.push(slug);
    }
  });

  return suggestions;
}

// Function to get seasonal tags based on current date
export function getCurrentSeasonalTags(): string[] {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const seasonalTags: string[] = [];

  // Winter/Christmas (December, January)
  if (month === 12 || month === 1) {
    seasonalTags.push('christmas-spirit', 'new-year-celebration');
  }
  
  // Spring (March, April, May)
  if (month >= 3 && month <= 5) {
    seasonalTags.push('spring-fresh');
  }
  
  // Summer (June, July, August)
  if (month >= 6 && month <= 8) {
    seasonalTags.push('summer-hits');
  }
  
  // Fall/Autumn (September, October, November)
  if (month >= 9 && month <= 11) {
    seasonalTags.push('autumn-cozy');
    if (month === 10) {
      seasonalTags.push('halloween-spooky');
    }
  }
  
  // Valentine's Day (February)
  if (month === 2) {
    seasonalTags.push('valentine-love');
  }

  return seasonalTags;
}