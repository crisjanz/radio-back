import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const SUPABASE_URL = 'https://cjtfiazsvflqyyuzgbdb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNqdGZpYXpzdmZscXl5dXpnYmRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTE4NTk1NTAsImV4cCI6MjA2NzQzNTU1MH0.V7HFzf2SszA3wuwPmDDV6-XS9bTtkjNfeayVc2gp6nc';

// Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Storage bucket name
export const STORAGE_BUCKET = 'streemr';

// Helper functions
export const getSupabaseImageUrl = (fileName: string, options?: { width?: number; height?: number; quality?: number }): string => {
  const baseUrl = `${SUPABASE_URL}/storage/v1/object/public/${STORAGE_BUCKET}/station-images/${fileName}`;
  
  // Add image transformation parameters if provided
  if (options) {
    const params = new URLSearchParams();
    if (options.width) params.append('width', options.width.toString());
    if (options.height) params.append('height', options.height.toString());
    if (options.quality) params.append('quality', options.quality.toString());
    
    const queryString = params.toString();
    return queryString ? `${baseUrl}?${queryString}` : baseUrl;
  }
  
  return baseUrl;
};

export const getImageFileName = (stationIdentifier: number | string, extension: string = 'png'): string => {
  return `${stationIdentifier}.${extension}`;
};

export const getSupabaseImagePath = (stationIdentifier: number | string, extension: string = 'png'): string => {
  return `station-images/${getImageFileName(stationIdentifier, extension)}`;
};