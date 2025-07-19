/**
 * Country name standardization utility
 * Ensures consistent country names across the database
 */

// Mapping of various country name formats to standardized versions
const COUNTRY_MAPPINGS: Record<string, string> = {
  // United States variations
  'united states': 'USA',
  'united states of america': 'USA',
  'the united states of america': 'USA',
  'us': 'USA',
  'u.s.': 'USA',
  'u.s.a.': 'USA',
  'america': 'USA',
  'united states of america': 'USA',
  
  // Add other common variations as needed
  'uk': 'United Kingdom',
  'u.k.': 'United Kingdom',
  'great britain': 'United Kingdom',
  'england': 'United Kingdom',
  
  // Germany variations  
  'deutschland': 'Germany',
  
  // France variations
  'france': 'France',
  'république française': 'France',
  
  // Add more as you discover them...
};

/**
 * Standardizes a country name to the preferred format
 * @param countryName - The country name to standardize
 * @returns The standardized country name
 */
export function standardizeCountryName(countryName: string): string {
  if (!countryName || typeof countryName !== 'string') {
    return countryName;
  }
  
  // Convert to lowercase for comparison
  const normalized = countryName.trim().toLowerCase();
  
  // Check if we have a mapping for this country
  const standardized = COUNTRY_MAPPINGS[normalized];
  
  if (standardized) {
    console.log(`📍 Standardized country: "${countryName}" → "${standardized}"`);
    return standardized;
  }
  
  // If no mapping found, return the original with proper capitalization
  return countryName.trim();
}

/**
 * Standardizes an array of station objects
 * @param stations - Array of station objects with country property
 * @returns Array with standardized country names
 */
export function standardizeStationCountries<T extends { country: string }>(stations: T[]): T[] {
  return stations.map(station => ({
    ...station,
    country: standardizeCountryName(station.country)
  }));
}

/**
 * Gets all current country mappings for reference
 * @returns Object with all country mappings
 */
export function getCountryMappings(): Record<string, string> {
  return { ...COUNTRY_MAPPINGS };
}

/**
 * Adds a new country mapping
 * @param from - The source country name
 * @param to - The standardized country name  
 */
export function addCountryMapping(from: string, to: string): void {
  COUNTRY_MAPPINGS[from.toLowerCase().trim()] = to;
}