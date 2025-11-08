/**
 * Test script for the Bright Data research helpers.
 * Run with: npx tsx src/tests/test-brightdata-research.ts
 */

import 'dotenv/config';
import { scrapeUrls, searchGoogleForPerson } from '@/lib/brightdata/research';

const SAMPLE_PERSON = {
  name: 'Satya Nadella',
  linkedinUrl: 'https://www.linkedin.com/in/satyanadella',
  context: 'Microsoft CEO',
};

async function run() {
  if (!process.env.BRIGHTDATA_API_TOKEN) {
    console.log('⚠️  BRIGHTDATA_API_TOKEN is not set. Skipping research client test.');
    return;
  }

  console.log('🧪 Testing Bright Data research helpers\n');

  try {
    console.log(`🔍 Searching for "${SAMPLE_PERSON.name}"...`);
    const searchResults = await searchGoogleForPerson(SAMPLE_PERSON.name, SAMPLE_PERSON.linkedinUrl, {
      context: SAMPLE_PERSON.context,
      maxResults: 12,
    });
    console.log(`✅ Found ${searchResults.length} non-LinkedIn results.`);
    searchResults.slice(0, 5).forEach((result, idx) => {
      console.log(`  ${idx + 1}. ${result.title} (${result.source})`);
      console.log(`     ${result.url}`);
    });

    const urlsToScrape = searchResults.slice(0, 3).map((result) => result.url);
    if (urlsToScrape.length === 0) {
      console.log('⚠️  No URLs available to scrape. Exiting early.');
      return;
    }

    console.log('\n🕸️  Scraping top URLs via Bright Data scrape_batch...');
    const scraped = await scrapeUrls(urlsToScrape);
    scraped.forEach((entry, idx) => {
      const excerpt = entry.content.slice(0, 200).replace(/\s+/g, ' ');
      console.log(`  [${idx + 1}] ${entry.url}`);
      console.log(`     status=${entry.status ?? 'n/a'} bytes=${entry.bytes}`);
      console.log(`     excerpt="${excerpt}${entry.content.length > 200 ? '…' : ''}"`);
    });

    console.log('\n🎉 Bright Data research client test completed successfully.');
  } catch (error) {
    console.error('\n❌ Test failed:', error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

run();
