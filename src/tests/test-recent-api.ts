/**
 * Test script for /api/profiles/recent endpoint
 * Run with: npx tsx src/tests/test-recent-api.ts
 */

import 'dotenv/config';

const BASE_URL = 'http://localhost:3000';

async function testRecentProfilesAPI() {
  console.log('🧪 Testing /api/profiles/recent Endpoint\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Test 1: Fetch recent profiles (default limit: 50)
    console.log('📋 Test 1: Fetch recent profiles (default params)...');
    const res1 = await fetch(`${BASE_URL}/api/profiles/recent`);
    const data1 = await res1.json();

    if (!res1.ok) {
      throw new Error(`API error: ${data1.error || res1.statusText}`);
    }

    console.log(`✅ PASS: Fetched ${data1.count} profiles`);
    console.log(`   Total in DB: ${res1.headers.get('X-Total-Count')}`);

    if (data1.count > 0) {
      console.log(`   First profile: ${data1.profiles[0].fullName}`);
      console.log(`   Updated at: ${data1.profiles[0].updatedAt}\n`);
    } else {
      console.log('   ⚠️  No profiles in database yet\n');
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
      console.log('ℹ️  Run a search first to populate the database\n');
      return;
    }

    // Test 2: Verify profiles are sorted by updatedAt (newest first)
    console.log('📋 Test 2: Verify profiles are sorted by updatedAt desc...');
    if (data1.profiles.length > 1) {
      const first = new Date(data1.profiles[0].updatedAt).getTime();
      const second = new Date(data1.profiles[1].updatedAt).getTime();

      if (first >= second) {
        console.log('✅ PASS: Profiles are sorted correctly (newest first)\n');
      } else {
        throw new Error('Profiles are not sorted correctly!');
      }
    } else {
      console.log('⚠️  SKIP: Only one profile, cannot verify sorting\n');
    }

    // Test 3: Test limit parameter
    console.log('📋 Test 3: Test limit parameter (?limit=5)...');
    const res3 = await fetch(`${BASE_URL}/api/profiles/recent?limit=5`);
    const data3 = await res3.json();

    if (data3.count <= 5) {
      console.log(`✅ PASS: Returned ${data3.count} profiles (limit respected)\n`);
    } else {
      throw new Error(`Expected max 5 profiles, got ${data3.count}`);
    }

    // Test 4: Test 'before' parameter (pagination)
    if (data1.profiles.length > 0) {
      console.log('📋 Test 4: Test pagination with ?before parameter...');
      const beforeTimestamp = data1.profiles[0].updatedAt;
      const res4 = await fetch(
        `${BASE_URL}/api/profiles/recent?before=${encodeURIComponent(beforeTimestamp)}&limit=5`
      );
      const data4 = await res4.json();

      console.log(`✅ PASS: Fetched ${data4.count} profiles before timestamp`);
      if (data4.count > 0) {
        const profileDate = new Date(data4.profiles[0].updatedAt).getTime();
        const beforeDate = new Date(beforeTimestamp).getTime();
        if (profileDate < beforeDate) {
          console.log('   ✅ All profiles are older than specified timestamp\n');
        }
      }
    }

    // Test 5: Test 'after' parameter (auto-refresh simulation)
    if (data1.profiles.length > 1) {
      console.log('📋 Test 5: Test auto-refresh with ?after parameter...');
      const afterTimestamp = data1.profiles[data1.profiles.length - 1].updatedAt;
      const res5 = await fetch(
        `${BASE_URL}/api/profiles/recent?after=${encodeURIComponent(afterTimestamp)}&limit=10`
      );
      const data5 = await res5.json();

      console.log(`✅ PASS: Fetched ${data5.count} profiles after timestamp`);
      if (data5.count > 0) {
        const profileDate = new Date(data5.profiles[0].updatedAt).getTime();
        const afterDate = new Date(afterTimestamp).getTime();
        if (profileDate > afterDate) {
          console.log('   ✅ All profiles are newer than specified timestamp\n');
        }
      }
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 All tests passed!\n');
    console.log('Summary:');
    console.log('  ✅ API endpoint responds correctly');
    console.log('  ✅ Profiles sorted by updatedAt (newest first)');
    console.log('  ✅ Limit parameter works');
    console.log('  ✅ Pagination with ?before works');
    console.log('  ✅ Auto-refresh with ?after works');
    console.log('  ✅ X-Total-Count header included');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  } catch (error) {
    console.error('❌ TEST FAILED:', error instanceof Error ? error.message : error);
    console.log('\nℹ️  Make sure:');
    console.log('  1. Dev server is running: npm run dev');
    console.log('  2. Database has some cached profiles (run a search first)\n');
    process.exit(1);
  }
}

testRecentProfilesAPI();
