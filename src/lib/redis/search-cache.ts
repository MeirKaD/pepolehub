import type { ParsedSearchQuery } from '@/lib/search/parser';
import {
  CachePrefix,
  CacheTTL,
  getCache,
  getCacheKey,
  setCache,
} from './cache';
import type { CachedSearchResults, ProfileSummary } from '@/types/linkedin';

/**
 * Generate a normalized cache key for search queries.
 */
export function getSearchCacheKey(query: string): string {
  const normalized = query.trim().toLowerCase();
  return getCacheKey(CachePrefix.SEARCH_RESULTS, normalized);
}

/**
 * Retrieve cached search results for a query.
 */
export async function getCachedSearchResults(
  query: string,
): Promise<CachedSearchResults | null> {
  const key = getSearchCacheKey(query);
  console.log('[Search Cache] Checking cache for query:', query);

  const cached = await getCache<CachedSearchResults>(key);

  if (cached) {
    console.log('[Search Cache] HIT - Found cached results:', cached.count);
  } else {
    console.log('[Search Cache] MISS - No cached results');
  }

  return cached;
}

/**
 * Cache search results for a given query.
 */
export async function cacheSearchResults(
  query: string,
  parsedQuery: ParsedSearchQuery,
  results: ProfileSummary[],
): Promise<boolean> {
  const key = getSearchCacheKey(query);
  const payload: CachedSearchResults = {
    query,
    parsedQuery,
    results,
    count: results.length,
    timestamp: Date.now(),
  };

  console.log('[Search Cache] Caching results:', {
    query,
    count: payload.count,
    ttl: CacheTTL.SEARCH_RESULTS,
  });

  return setCache(key, payload, CacheTTL.SEARCH_RESULTS);
}
