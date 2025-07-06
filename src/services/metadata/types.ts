// Simplified types for Icecast-only metadata detection

export interface ParsedMetadata {
  success: boolean;
  title?: string;
  artist?: string;
  song?: string;
  message?: string;
  error?: string;
}