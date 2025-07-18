// Utility functions for metadata processing

// HTML entity decoder function
export function decodeHtmlEntities(text: string): string {
  if (!text) return text;
  
  return text
    // Named entities
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&hellip;/g, '...')
    // Numeric entities
    .replace(/&#(\d+);/g, (_, dec) => String.fromCharCode(dec))
    .replace(/&#x([a-fA-F0-9]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

// Parse "Artist - Title" format
export function parseTrackTitle(trackTitle: string): { artist?: string; title?: string } {
  if (!trackTitle || trackTitle.trim() === '') {
    return {};
  }
  
  // Decode HTML entities first
  const decodedTitle = decodeHtmlEntities(trackTitle.trim());
  const cleanTitle = decodedTitle;
  
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
  return decodeHtmlEntities(title)
    .trim()
    .replace(/\s+/g, ' ') // Collapse multiple spaces
    .replace(/^\s*-\s*|\s*-\s*$/g, '') // Remove leading/trailing dashes
    .substring(0, 200); // Limit length
}