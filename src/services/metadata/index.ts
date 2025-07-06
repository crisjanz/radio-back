// Simplified metadata service - only Icecast support
export { detectStreamMetadata, testExistingMetadata } from './detection';
export { testIcecastMetadata } from './extractors/icecast';
export type { MetadataResult } from './detection';
export type { IcecastMetadata } from './extractors/icecast';