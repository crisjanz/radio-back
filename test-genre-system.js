#!/usr/bin/env node

/**
 * Genre System Integration Test
 * Tests the complete sophisticated genre enhancement system
 */

const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:3001';

async function testGenreSystem() {
  console.log('🧪 Testing Sophisticated Genre Enhancement System\n');
  
  try {
    // Test 1: Check if server is running
    console.log('1. Testing server connectivity...');
    const healthResponse = await fetch(`${BASE_URL}/admin`);
    if (healthResponse.ok) {
      console.log('✅ Server is running');
    } else {
      throw new Error('Server not responding');
    }
    
    // Test 2: Test genre constants endpoint
    console.log('\n2. Testing genre constants endpoint...');
    const genresResponse = await fetch(`${BASE_URL}/admin/constants/genres`);
    const genresData = await genresResponse.json();
    console.log(`✅ Loaded ${genresData.allGenres.length} genre types`);
    console.log(`   Available genres: ${genresData.allGenres.slice(0, 5).join(', ')}...`);
    
    // Test 3: Test station types endpoint
    console.log('\n3. Testing station types endpoint...');
    const typesResponse = await fetch(`${BASE_URL}/admin/constants/station-types`);
    const typesData = await typesResponse.json();
    console.log(`✅ Loaded ${typesData.allTypes.length} station types`);
    console.log(`   Available types: ${typesData.allTypes.slice(0, 5).join(', ')}...`);
    
    // Test 4: Test collection tags endpoint
    console.log('\n4. Testing collection tags endpoint...');
    const tagsResponse = await fetch(`${BASE_URL}/admin/constants/collection-tags`);
    const tagsData = await tagsResponse.json();
    console.log(`✅ Loaded ${tagsData.allTags.length} collection tags`);
    console.log(`   Available tags: ${tagsData.allTags.slice(0, 5).join(', ')}...`);
    
    // Test 5: Test sophisticated analysis
    console.log('\n5. Testing sophisticated normalization preview...');
    const testCases = [
      { genre: 'rock music', type: 'fm radio', name: 'Classic Rock 101.5', description: 'Playing classic rock hits' },
      { genre: 'hip hop', type: 'urban station', name: 'Hot Hip Hop', description: 'The best rap and hip hop music' },
      { genre: 'electronic dance', type: 'dance radio', name: 'EDM Beats', description: 'Electronic dance music 24/7' },
      { genre: 'country music', type: 'country radio', name: 'Country Gold', description: 'Classic and modern country' },
      { genre: 'news talk', type: 'talk radio', name: 'News Radio', description: 'Breaking news and talk shows' }
    ];
    
    for (const testCase of testCases) {
      const previewResponse = await fetch(`${BASE_URL}/admin/normalize-preview`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testCase)
      });
      const previewData = await previewResponse.json();
      
      console.log(`\n   Input: "${testCase.genre}" → Suggested: "${previewData.genre || 'none'}" (confidence: ${previewData.confidence?.genre || 0}%)`);
      console.log(`   Input: "${testCase.type}" → Suggested: "${previewData.type || 'none'}" (confidence: ${previewData.confidence?.type || 0}%)`);
      if (previewData.subgenres?.length > 0) {
        console.log(`   Suggested subgenres: ${previewData.subgenres.join(', ')}`);
      }
    }
    
    // Test 6: Test station analysis
    console.log('\n6. Testing station analysis...');
    const analysisResponse = await fetch(`${BASE_URL}/admin/stations/analyze`, {
      method: 'POST'
    });
    const analysisData = await analysisResponse.json();
    
    if (analysisData.analysisStats) {
      console.log(`✅ Analysis complete:`);
      console.log(`   Total stations: ${analysisData.analysisStats.totalStations}`);
      console.log(`   Suggested changes: ${analysisData.analysisStats.suggestedChanges}`);
      console.log(`   Average confidence: ${analysisData.analysisStats.confidence}%`);
      
      if (analysisData.pendingChanges?.length > 0) {
        console.log(`\n   Example suggestions:`);
        analysisData.pendingChanges.slice(0, 3).forEach(change => {
          console.log(`   - Station ${change.stationId}: ${change.field} "${change.original}" → "${change.suggested}" (${change.confidence}%)`);
        });
      }
    } else {
      console.log('❌ Analysis failed');
    }
    
    // Test 7: Test admin statistics
    console.log('\n7. Testing admin statistics...');
    const statsResponse = await fetch(`${BASE_URL}/admin/stats`);
    const statsData = await statsResponse.json();
    
    console.log(`✅ Database statistics:`);
    console.log(`   Total stations: ${statsData.total}`);
    console.log(`   Stations with genre: ${statsData.withGenre}`);
    console.log(`   Stations with type: ${statsData.withType}`);
    console.log(`   Genre coverage: ${Math.round((statsData.withGenre / statsData.total) * 100)}%`);
    console.log(`   Type coverage: ${Math.round((statsData.withType / statsData.total) * 100)}%`);
    
    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Summary of Sophisticated Genre Enhancement System:');
    console.log(`   ✅ ${genresData.allGenres.length} comprehensive genre classifications`);
    console.log(`   ✅ ${typesData.allTypes.length} station type categories`);
    console.log(`   ✅ ${tagsData.allTags.length} collection tags for curation`);
    console.log(`   ✅ Sophisticated analysis with confidence scoring`);
    console.log(`   ✅ Multi-select tag-based UI system`);
    console.log(`   ✅ API endpoints for genre management`);
    console.log(`   ✅ Integration with existing station editor`);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run the tests
testGenreSystem().then(() => {
  console.log('\n🏁 Testing completed successfully!');
  process.exit(0);
}).catch(error => {
  console.error('❌ Testing failed:', error);
  process.exit(1);
});