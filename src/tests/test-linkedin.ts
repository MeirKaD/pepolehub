/**
 * Simple test script for LinkedIn profile fetching
 * Run with: npx tsx src/lib/brightdata/test-linkedin.ts
 */

import 'dotenv/config';
import { fetchLinkedInProfile } from '@/lib/brightdata/linkedin';

async function testLinkedInFetch() {
  const testUrl = 'https://www.linkedin.com/in/meir-kadosh-7bb5b7224';

  console.log('🔍 Testing LinkedIn profile fetch...');
  console.log(`📌 Target URL: ${testUrl}\n`);

  try {
    console.log('⏳ Fetching profile (this may take 10-60 seconds)...\n');

    const profile = await fetchLinkedInProfile(testUrl);

    console.log('✅ SUCCESS! Profile fetched:\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`Name: ${profile.fullName}`);
    console.log(`LinkedIn ID: ${profile.linkedinId}`);
    console.log(`Headline: ${profile.headline || 'N/A'}`);
    console.log(`Location: ${profile.location || 'N/A'}`);
    console.log(`City: ${profile.city || 'N/A'}`);
    console.log(`Connections: ${profile.connections || 'N/A'}`);
    console.log(`Followers: ${profile.followers || 'N/A'}`);
    console.log(`Experience entries: ${profile.experience?.length || 0}`);
    console.log(`Education entries: ${profile.education?.length || 0}`);
    console.log(`Languages: ${profile.languages?.length || 0}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    // Show full data
    console.log('📄 Full profile data:');
    console.log(JSON.stringify(profile, null, 2));

  } catch (error) {
    console.error('❌ ERROR:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

testLinkedInFetch();
