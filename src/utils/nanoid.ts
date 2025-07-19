import { customAlphabet } from 'nanoid';

// Custom alphabet: 0-9, A-Z, a-z (62 characters, no special characters)
// This gives us URL-safe, copy-paste friendly IDs
const alphabet = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

// Generate 8-character NanoIDs
// 62^8 = ~218 trillion possible combinations
export const generateStationId = customAlphabet(alphabet, 8);

/**
 * Validate if a string is a valid NanoID format
 * @param id - String to validate
 * @returns true if valid NanoID format (8 chars, alphanumeric only)
 */
export const isValidNanoId = (id: string): boolean => {
  return /^[0-9A-Za-z]{8}$/.test(id);
};

/**
 * Determine if an ID parameter is a NanoID or legacy numeric ID
 * @param idParam - ID parameter from request
 * @returns 'nanoid' | 'numeric' | 'invalid'
 */
export const getIdType = (idParam: string): 'nanoid' | 'numeric' | 'invalid' => {
  if (isValidNanoId(idParam)) {
    return 'nanoid';
  }
  
  const numericId = parseInt(idParam, 10);
  if (!isNaN(numericId) && numericId > 0) {
    return 'numeric';
  }
  
  return 'invalid';
};

/**
 * Generate a batch of unique NanoIDs
 * Useful for bulk operations or testing
 * @param count - Number of IDs to generate
 * @returns Array of unique NanoIDs
 */
export const generateBatchIds = (count: number): string[] => {
  const ids = new Set<string>();
  
  while (ids.size < count) {
    ids.add(generateStationId());
  }
  
  return Array.from(ids);
};

// Example usage and testing
if (require.main === module) {
  console.log('🧪 Testing NanoID utilities...\n');
  
  // Generate some sample IDs
  console.log('Sample NanoIDs:');
  for (let i = 0; i < 5; i++) {
    const id = generateStationId();
    console.log(`  ${id} (valid: ${isValidNanoId(id)})`);
  }
  
  // Test validation
  console.log('\nValidation tests:');
  console.log(`  "abc12345" -> ${getIdType('abc12345')}`);
  console.log(`  "123" -> ${getIdType('123')}`);
  console.log(`  "invalid!" -> ${getIdType('invalid!')}`);
  console.log(`  "abc123" -> ${getIdType('abc123')} (too short)`);
  
  // Test batch generation
  console.log('\nBatch generation (3 IDs):');
  const batch = generateBatchIds(3);
  batch.forEach(id => console.log(`  ${id}`));
  
  console.log('\n✅ All tests completed!');
}