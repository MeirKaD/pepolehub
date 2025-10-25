import 'dotenv/config';
import { parseSearchQuery } from '@/lib/search/parser';
import { searchLinkedInProfiles } from '@/lib/brightdata/search';

async function testSearchFlow() {
  console.log('=== Testing Search Flow ===\n');

  const query = '5 AI Engineers in Israel';
  console.log(`Input Query: "${query}"\n`);

  try {
    // Step 1: Parse query with Gemini
    console.log('[1/2] Parsing query with Gemini...');
    const parsed = await parseSearchQuery(query);
    console.log('✓ Parsed Query:');
    console.log(`  - Count: ${parsed.count}`);
    console.log(`  - Role: ${parsed.role}`);
    console.log(`  - Location: ${parsed.location || 'N/A'}`);
    console.log(`  - Keywords: ${parsed.keywords.join(', ')}`);
    console.log(`  - Google Query: ${parsed.googleQuery}\n`);

    // Step 2: Search Google and extract LinkedIn profile summaries
    console.log('[2/2] Searching Google for LinkedIn profile summaries...');
    const summaries = await searchLinkedInProfiles(
      parsed.googleQuery,
      parsed.count,
      parsed.countryCode
    );
    console.log(`✓ Found ${summaries.length} profile summaries:\n`);

    summaries.forEach((summary, index) => {
      console.log(`  ${index + 1}. ${summary.linkedinUrl}`);
      if (summary.name) {
        console.log(`     Name: ${summary.name}`);
      }
      if (summary.headline) {
        console.log(`     Headline: ${summary.headline}`);
      }
      if (summary.location) {
        console.log(`     Location: ${summary.location}`);
      }
    });

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testSearchFlow();
