import { testIcecastMetadata, IcecastMetadata } from './extractors/icecast';

export interface MetadataResult {
  success: boolean;
  hasMetadata: boolean;
  nowPlaying?: string;
  stationName?: string;
  message?: string;
  error?: string;
}

// Test metadata for a stream URL (simplified to only Icecast)
export async function detectStreamMetadata(streamUrl: string): Promise<MetadataResult> {
  console.log(`🔍 Testing Icecast metadata for: ${streamUrl}`);
  
  try {
    const result = await testIcecastMetadata(streamUrl);
    
    if (result.hasMetadata) {
      return {
        success: true,
        hasMetadata: true,
        nowPlaying: result.nowPlaying,
        stationName: result.stationName,
        message: result.nowPlaying 
          ? `Now playing: ${result.nowPlaying}`
          : 'Stream supports metadata but no current track'
      };
    } else {
      return {
        success: false,
        hasMetadata: false,
        error: result.error || 'No Icecast metadata support detected'
      };
    }
    
  } catch (error) {
    return {
      success: false,
      hasMetadata: false,
      error: error instanceof Error ? error.message : 'Failed to test metadata'
    };
  }
}

// Test existing saved metadata configuration
export async function testExistingMetadata(streamUrl: string): Promise<MetadataResult> {
  // For now, just use the same Icecast detection
  // In the future, we could add support for saved custom endpoints here
  return detectStreamMetadata(streamUrl);
}