/**
 * Station Types Classification System
 * Used for categorizing radio stations by their primary content format
 */

export interface StationTypeInfo {
  name: string;
  description: string;
  category: 'music' | 'talk' | 'news' | 'educational' | 'entertainment' | 'specialized' | 'format';
  keywords: string[]; // For automatic classification
}

export const STATION_TYPES: Record<string, StationTypeInfo> = {
  // Music-focused stations
  'music': {
    name: 'Music',
    description: 'General music programming',
    category: 'music',
    keywords: ['music', 'songs', 'hits', 'radio', 'fm']
  },

  'top40': {
    name: 'Top 40',
    description: 'Current popular hits and chart toppers',
    category: 'music',
    keywords: ['top 40', 'hits', 'charts', 'popular', 'current']
  },

  'hits': {
    name: 'Hit Music',
    description: 'Popular songs and chart hits',
    category: 'music',
    keywords: ['hits', 'popular music', 'chart', 'mainstream']
  },

  'variety': {
    name: 'Variety Music',
    description: 'Mix of different music genres and eras',
    category: 'music',
    keywords: ['variety', 'mix', 'diverse', 'eclectic', 'mixed']
  },

  'oldies': {
    name: 'Oldies',
    description: 'Classic hits from past decades',
    category: 'music',
    keywords: ['oldies', 'classic', 'retro', 'vintage', '60s', '70s', '80s', '90s']
  },

  'adult-contemporary': {
    name: 'Adult Contemporary',
    description: 'Mature audience music programming',
    category: 'music',
    keywords: ['adult contemporary', 'ac', 'soft rock', 'easy listening']
  },

  // Talk & Information
  'news': {
    name: 'News',
    description: 'Current events and news programming',
    category: 'news',
    keywords: ['news', 'current events', 'breaking news', 'headlines', 'journalism']
  },

  'talk': {
    name: 'Talk Radio',
    description: 'Discussion and talk show programming',
    category: 'talk',
    keywords: ['talk', 'discussion', 'call-in', 'chat', 'conversation']
  },

  'sports': {
    name: 'Sports',
    description: 'Sports news, analysis, and live coverage',
    category: 'talk',
    keywords: ['sports', 'espn', 'football', 'basketball', 'baseball', 'athletics']
  },

  'business': {
    name: 'Business',
    description: 'Business news and financial information',
    category: 'news',
    keywords: ['business', 'finance', 'economy', 'market', 'financial']
  },

  'politics': {
    name: 'Politics',
    description: 'Political discussion and analysis',
    category: 'talk',
    keywords: ['politics', 'political', 'government', 'election', 'policy']
  },

  'current-affairs': {
    name: 'Current Affairs',
    description: 'Analysis of current events and social issues',
    category: 'talk',
    keywords: ['current affairs', 'analysis', 'social issues', 'commentary']
  },

  // Educational & Cultural
  'educational': {
    name: 'Educational',
    description: 'Educational content and learning programs',
    category: 'educational',
    keywords: ['educational', 'learning', 'academic', 'knowledge', 'teaching']
  },

  'public-radio': {
    name: 'Public Radio',
    description: 'Non-commercial public broadcasting',
    category: 'educational',
    keywords: ['public radio', 'npr', 'pbs', 'non-commercial', 'public broadcasting']
  },

  'cultural': {
    name: 'Cultural',
    description: 'Arts, culture, and humanities programming',
    category: 'educational',
    keywords: ['cultural', 'arts', 'culture', 'humanities', 'literature']
  },

  'documentary': {
    name: 'Documentary',
    description: 'Documentary and investigative programming',
    category: 'educational',
    keywords: ['documentary', 'investigation', 'documentary series', 'factual']
  },

  'university': {
    name: 'University Radio',
    description: 'College and university radio stations',
    category: 'educational',
    keywords: ['university', 'college', 'student radio', 'campus', 'academic']
  },

  // Entertainment
  'comedy': {
    name: 'Comedy',
    description: 'Comedy shows and humorous content',
    category: 'entertainment',
    keywords: ['comedy', 'humor', 'funny', 'jokes', 'stand-up']
  },

  'entertainment': {
    name: 'Entertainment',
    description: 'General entertainment programming',
    category: 'entertainment',
    keywords: ['entertainment', 'variety show', 'celebrity', 'pop culture']
  },

  'celebrity': {
    name: 'Celebrity',
    description: 'Celebrity news and gossip',
    category: 'entertainment',
    keywords: ['celebrity', 'gossip', 'hollywood', 'stars', 'entertainment news']
  },

  'lifestyle': {
    name: 'Lifestyle',
    description: 'Lifestyle topics and advice',
    category: 'entertainment',
    keywords: ['lifestyle', 'health', 'wellness', 'advice', 'living']
  },

  // Specialized
  'religious': {
    name: 'Religious',
    description: 'Religious and spiritual programming',
    category: 'specialized',
    keywords: ['religious', 'spiritual', 'christian', 'gospel', 'faith', 'church']
  },

  'community': {
    name: 'Community',
    description: 'Local community-focused programming',
    category: 'specialized',
    keywords: ['community', 'local', 'neighborhood', 'regional', 'hometown']
  },

  'ethnic': {
    name: 'Ethnic/Cultural',
    description: 'Specific ethnic or cultural community programming',
    category: 'specialized',
    keywords: ['ethnic', 'cultural', 'heritage', 'immigrant', 'diaspora']
  },

  'language-learning': {
    name: 'Language Learning',
    description: 'Foreign language instruction and practice',
    category: 'educational',
    keywords: ['language learning', 'language instruction', 'foreign language', 'esl']
  },

  'health-wellness': {
    name: 'Health & Wellness',
    description: 'Health, fitness, and wellness programming',
    category: 'specialized',
    keywords: ['health', 'wellness', 'fitness', 'medical', 'nutrition']
  },

  // Format-specific
  'commercial': {
    name: 'Commercial Radio',
    description: 'Advertisement-supported commercial radio',
    category: 'format',
    keywords: ['commercial', 'advertising', 'sponsored', 'mainstream radio']
  },

  'non-commercial': {
    name: 'Non-Commercial',
    description: 'Non-profit or listener-supported radio',
    category: 'format',
    keywords: ['non-commercial', 'non-profit', 'listener supported', 'donation']
  },

  'internet-only': {
    name: 'Internet Only',
    description: 'Stations that broadcast only online',
    category: 'format',
    keywords: ['internet only', 'online radio', 'web radio', 'streaming only']
  },

  'am': {
    name: 'AM Radio',
    description: 'AM frequency radio stations',
    category: 'format',
    keywords: ['am radio', 'am', 'amplitude modulation']
  },

  'fm': {
    name: 'FM Radio',
    description: 'FM frequency radio stations',
    category: 'format',
    keywords: ['fm radio', 'fm', 'frequency modulation']
  },

  'dab': {
    name: 'Digital Radio',
    description: 'Digital audio broadcasting stations',
    category: 'format',
    keywords: ['dab', 'digital radio', 'digital audio', 'hd radio']
  },

  // Additional specialized types
  'jazz': {
    name: 'Jazz Radio',
    description: 'Dedicated jazz music programming',
    category: 'music',
    keywords: ['jazz', 'smooth jazz', 'contemporary jazz', 'traditional jazz']
  },

  'classical': {
    name: 'Classical Radio',
    description: 'Classical music and orchestral programming',
    category: 'music',
    keywords: ['classical', 'orchestra', 'symphony', 'opera', 'chamber music']
  },

  'country': {
    name: 'Country Radio',
    description: 'Country music programming',
    category: 'music',
    keywords: ['country', 'country music', 'nashville', 'bluegrass', 'americana']
  },

  'rock': {
    name: 'Rock Radio',
    description: 'Rock music programming',
    category: 'music',
    keywords: ['rock', 'classic rock', 'alternative rock', 'hard rock']
  },

  'hip-hop': {
    name: 'Hip-Hop Radio',
    description: 'Hip-hop and rap music programming',
    category: 'music',
    keywords: ['hip-hop', 'rap', 'urban', 'r&b', 'hip hop']
  },

  'electronic': {
    name: 'Electronic Radio',
    description: 'Electronic and dance music programming',
    category: 'music',
    keywords: ['electronic', 'dance', 'edm', 'techno', 'house']
  }
};

// Helper functions for station type operations
export function getAllStationTypes(): string[] {
  return Object.keys(STATION_TYPES);
}

export function getStationTypesByCategory(category: StationTypeInfo['category']): StationTypeInfo[] {
  return Object.values(STATION_TYPES).filter(type => type.category === category);
}

export function getStationTypeInfo(type: string): StationTypeInfo | null {
  return STATION_TYPES[type] || null;
}

export function isValidStationType(type: string): boolean {
  return type in STATION_TYPES;
}

export function getStationTypeCategories(): StationTypeInfo['category'][] {
  return ['music', 'talk', 'news', 'educational', 'entertainment', 'specialized', 'format'];
}

// Function to suggest station type based on station metadata
export function suggestStationTypeForStation(station: {
  name: string;
  description?: string;
  genre?: string;
  subgenre?: string;
}): string[] {
  const suggestions: string[] = [];
  const searchText = `${station.name} ${station.description || ''} ${station.genre || ''} ${station.subgenre || ''}`.toLowerCase();

  Object.entries(STATION_TYPES).forEach(([typeKey, typeInfo]) => {
    const hasKeyword = typeInfo.keywords.some(keyword => 
      searchText.includes(keyword.toLowerCase())
    );
    
    if (hasKeyword) {
      suggestions.push(typeKey);
    }
  });

  // Default to 'music' if no specific type found
  if (suggestions.length === 0) {
    suggestions.push('music');
  }

  return suggestions;
}

// Function to get music-specific station types
export function getMusicStationTypes(): string[] {
  return Object.entries(STATION_TYPES)
    .filter(([_, type]) => type.category === 'music')
    .map(([key, _]) => key);
}

// Function to get talk/news station types
export function getTalkNewsStationTypes(): string[] {
  return Object.entries(STATION_TYPES)
    .filter(([_, type]) => type.category === 'talk' || type.category === 'news')
    .map(([key, _]) => key);
}

// Function to determine if a station type is music-focused
export function isMusicStationType(type: string): boolean {
  const typeInfo = STATION_TYPES[type];
  return typeInfo?.category === 'music' || false;
}

// Function to determine if a station type is talk/news-focused
export function isTalkNewsStationType(type: string): boolean {
  const typeInfo = STATION_TYPES[type];
  return typeInfo?.category === 'talk' || typeInfo?.category === 'news' || false;
}