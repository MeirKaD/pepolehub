import 'dotenv/config';
import { parseSearchQuery } from '@/lib/search/parser';
import { findLinkedInProfiles } from '@/lib/brightdata/search';

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

    // Step 2: Search Google and extract LinkedIn URLs
    console.log('[2/2] Searching Google for LinkedIn profiles...');
    const linkedInUrls = await findLinkedInProfiles(
      parsed.googleQuery,
      parsed.count
    );
    console.log(`✓ Found ${linkedInUrls.length} LinkedIn URLs:\n`);

    linkedInUrls.forEach((url, index) => {
      console.log(`  ${index + 1}. ${url}`);
    });

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  }
}

testSearchFlow();
