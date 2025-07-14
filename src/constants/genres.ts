/**
 * Genre and Subgenre Classification System
 * Used for station categorization and recommendation algorithms
 */

export interface GenreInfo {
  name: string;
  subgenres: string[];
  description?: string;
}

export const GENRE_SYSTEM: Record<string, GenreInfo> = {
  rock: {
    name: "Rock",
    description: "Guitar-driven music with strong rhythm",
    subgenres: [
      "alternative-rock",
      "classic-rock", 
      "hard-rock",
      "heavy-metal",
      "punk-rock",
      "progressive-rock",
      "indie-rock",
      "grunge",
      "southern-rock",
      "garage-rock",
      "psychedelic-rock",
      "blues-rock",
      "folk-rock",
      "art-rock"
    ]
  },
  
  pop: {
    name: "Pop",
    description: "Popular mainstream music",
    subgenres: [
      "mainstream-pop",
      "indie-pop",
      "electro-pop",
      "k-pop",
      "teen-pop",
      "dance-pop",
      "synthpop",
      "pop-rock",
      "britpop",
      "power-pop",
      "bubblegum-pop"
    ]
  },
  
  electronic: {
    name: "Electronic",
    description: "Computer-generated and synthesized music",
    subgenres: [
      "house",
      "techno",
      "trance",
      "dubstep",
      "drum-and-bass",
      "ambient",
      "edm",
      "breakbeat",
      "chillout",
      "downtempo",
      "progressive-house",
      "deep-house",
      "garage",
      "jungle",
      "minimal",
      "electro"
    ]
  },
  
  hiphop: {
    name: "Hip-Hop",
    description: "Rhythmic spoken lyrics over beats",
    subgenres: [
      "rap",
      "trap",
      "old-school-hip-hop",
      "conscious-rap",
      "gangsta-rap",
      "east-coast-hip-hop",
      "west-coast-hip-hop",
      "southern-hip-hop",
      "boom-bap",
      "mumble-rap",
      "drill",
      "crunk"
    ]
  },
  
  jazz: {
    name: "Jazz",
    description: "Improvised music with complex harmonies",
    subgenres: [
      "smooth-jazz",
      "bebop",
      "swing",
      "fusion",
      "acid-jazz",
      "cool-jazz",
      "free-jazz",
      "contemporary-jazz",
      "latin-jazz",
      "big-band",
      "vocal-jazz",
      "avant-garde-jazz",
      "hard-bop"
    ]
  },
  
  country: {
    name: "Country",
    description: "American folk music with rural themes",
    subgenres: [
      "modern-country",
      "classic-country",
      "bluegrass",
      "americana",
      "alt-country",
      "country-rock",
      "outlaw-country",
      "honky-tonk",
      "country-pop",
      "western",
      "nashville-sound",
      "red-dirt"
    ]
  },
  
  rnb: {
    name: "R&B/Soul",
    description: "Rhythm and blues with soulful vocals",
    subgenres: [
      "contemporary-rnb",
      "classic-soul",
      "neo-soul",
      "funk",
      "motown",
      "gospel",
      "blues",
      "urban-contemporary",
      "quiet-storm",
      "new-jack-swing"
    ]
  },
  
  latin: {
    name: "Latin",
    description: "Music from Latin American cultures",
    subgenres: [
      "salsa",
      "bachata",
      "merengue",
      "reggaeton",
      "latin-pop",
      "mariachi",
      "cumbia",
      "tango",
      "bossa-nova",
      "flamenco",
      "tejano",
      "latin-rock",
      "banda",
      "ranchera"
    ]
  },
  
  world: {
    name: "World Music",
    description: "Traditional and contemporary international music",
    subgenres: [
      "african",
      "indian",
      "middle-eastern",
      "celtic",
      "folk",
      "traditional",
      "ethnic",
      "world-fusion",
      "bollywood",
      "reggae",
      "caribbean",
      "asian-pop",
      "klezmer",
      "aboriginal"
    ]
  },
  
  classical: {
    name: "Classical",
    description: "Traditional orchestral and art music",
    subgenres: [
      "orchestral",
      "chamber-music",
      "opera",
      "baroque",
      "romantic",
      "contemporary-classical",
      "piano",
      "choral",
      "symphony",
      "concerto",
      "medieval",
      "renaissance"
    ]
  },
  
  alternative: {
    name: "Alternative",
    description: "Non-mainstream and experimental music",
    subgenres: [
      "indie",
      "shoegaze",
      "post-rock",
      "experimental",
      "noise",
      "post-punk",
      "new-wave",
      "gothic",
      "industrial",
      "lo-fi",
      "math-rock",
      "emo"
    ]
  },

  reggae: {
    name: "Reggae",
    description: "Jamaican music with distinctive rhythm",
    subgenres: [
      "roots-reggae",
      "dancehall",
      "dub",
      "ska",
      "rocksteady",
      "ragga",
      "lovers-rock",
      "digital-reggae"
    ]
  },

  blues: {
    name: "Blues",
    description: "American folk music expressing melancholy",
    subgenres: [
      "chicago-blues",
      "delta-blues",
      "electric-blues",
      "acoustic-blues",
      "texas-blues",
      "british-blues",
      "contemporary-blues"
    ]
  }
};

// Helper functions for genre operations
export function getAllGenres(): string[] {
  return Object.keys(GENRE_SYSTEM);
}

export function getAllSubgenres(): string[] {
  return Object.values(GENRE_SYSTEM)
    .flatMap(genre => genre.subgenres);
}

export function getSubgenresForGenre(genre: string): string[] {
  return GENRE_SYSTEM[genre]?.subgenres || [];
}

export function getGenreForSubgenre(subgenre: string): string | null {
  for (const [genreKey, genreInfo] of Object.entries(GENRE_SYSTEM)) {
    if (genreInfo.subgenres.includes(subgenre)) {
      return genreKey;
    }
  }
  return null;
}

export function isValidGenre(genre: string): boolean {
  return genre in GENRE_SYSTEM;
}

export function isValidSubgenre(subgenre: string): boolean {
  return getAllSubgenres().includes(subgenre);
}

// Genre similarity for recommendations
export function calculateGenreSimilarity(genre1: string, genre2: string): number {
  if (genre1 === genre2) return 1.0;
  
  // Define genre similarity groups
  const similarityGroups = [
    ['rock', 'alternative', 'blues'],
    ['pop', 'rnb', 'electronic'],
    ['country', 'folk', 'americana'],
    ['jazz', 'blues', 'classical'],
    ['hiphop', 'rnb', 'electronic'],
    ['latin', 'world', 'reggae'],
    ['electronic', 'alternative', 'experimental']
  ];
  
  // Check if genres are in the same similarity group
  for (const group of similarityGroups) {
    if (group.includes(genre1) && group.includes(genre2)) {
      return 0.7; // High similarity
    }
  }
  
  return 0.1; // Low similarity
}