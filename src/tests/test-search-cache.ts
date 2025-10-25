import 'dotenv/config';
import redis from '../lib/redis/client';
import { deleteCache, getTTL } from '../lib/redis/cache';
import { cacheSearchResults, getCachedSearchResults, getSearchCacheKey } from '../lib/redis/search-cache';
import type { ProfileSummary } from '@/types/linkedin';
import type { ParsedSearchQuery } from '@/lib/search/parser';

async function testSearchCache() {
  console.log('Testing search results cache...\n');

  const query = 'site:linkedin.com/in "AI Engineer" "Israel"';
  const parsedQuery: ParsedSearchQuery = {
    count: 2,
    role: 'AI Engineer',
    location: 'Israel',
    countryCode: 'IL',
    keywords: ['AI', 'Engineer'],
    googleQuery: query,
  };

  const results: ProfileSummary[] = [
    {
      linkedinUrl: 'https://www.linkedin.com/in/example-ai-engineer/',
      linkedinId: 'example-ai-engineer',
      title: 'Example Engineer - AI Engineer - Tech Corp | LinkedIn',
      snippet: 'Location: Tel Aviv · AI Engineer at Tech Corp',
      name: 'Example Engineer',
      headline: 'AI Engineer - Tech Corp',
      location: 'Tel Aviv',
    },
    {
      linkedinUrl: 'https://www.linkedin.com/in/second-ai-engineer/',
      linkedinId: 'second-ai-engineer',
      title: 'Second Engineer - Senior AI Engineer | LinkedIn',
      snippet: 'Location: Israel · Senior AI Engineer at Startup',
      name: 'Second Engineer',
      headline: 'Senior AI Engineer',
      location: 'Israel',
    },
  ];

  const cacheKey = getSearchCacheKey(parsedQuery.googleQuery);

  console.log('Caching sample search results...');
  const cached = await cacheSearchResults(parsedQuery.googleQuery, parsedQuery, results);
  console.log('Cache write success:', cached);

  console.log('\nFetching from cache...');
  const cachedResults = await getCachedSearchResults(parsedQuery.googleQuery);
  console.log('Cache hit:', Boolean(cachedResults));

  if (cachedResults) {
    console.log('Cached count:', cachedResults.count);
    console.log('First cached profile:', cachedResults.results[0]);
  }

  const ttl = await getTTL(cacheKey);
  console.log('Remaining TTL (seconds):', ttl);

  console.log('\nCleaning up cache key...');
  await deleteCache(cacheKey);
}

testSearchCache()
  .catch((error) => {
    console.error('[Search Cache Test] Encountered error:', error);
  })
  .finally(async () => {
    await redis.quit();
  });
