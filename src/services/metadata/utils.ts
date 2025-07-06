// Utility functions for metadata processing

// Parse "Artist - Title" format
export function parseTrackTitle(trackTitle: string): { artist?: string; title?: string } {
  if (!trackTitle || trackTitle.trim() === '') {
    return {};
  }
  
  const cleanTitle = trackTitle.trim();
  
  // Common separators
  const separators = [' - ', ' – ', ' — ', ' | '];
  
  for (const separator of separators) {
    if (cleanTitle.includes(separator)) {
      const [artist, title] = cleanTitle.split(separator, 2);
      return {
        artist: artist.trim(),
        title: title.trim()
      };
    }
  }
  
  // If no separator found, treat as title only
  return { title: cleanTitle };
}

// Clean and normalize song titles
export function normalizeSongTitle(title: string): string {
  return title
    .trim()
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .replace(/^\s*-\s*|\s*-\s*$/g, '') // Remove leading/trailing dashes
    .substring(0, 200); // Limit length
}