import { NextRequest, NextResponse } from 'next/server';
import { parseSearchQuery } from '@/lib/search/parser';
import { searchLinkedInProfiles } from '@/lib/brightdata/search';
import { cacheSearchResults, getCachedSearchResults } from '@/lib/redis/search-cache';
import { cacheProfileSummary } from '@/lib/redis/profile-cache';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 },
      );
    }

    if (query.length < 2 || query.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Query must be 2-100 characters' },
        { status: 400 },
      );
    }

    console.log('[Search API] Query:', query);

    const cachedResults = await getCachedSearchResults(query);

    if (cachedResults) {
      console.log('[Search API] Returning cached search results');
      return NextResponse.json({
        success: true,
        count: cachedResults.count,
        results: cachedResults.results,
        parsedQuery: cachedResults.parsedQuery,
        cached: true,
        timestamp: cachedResults.timestamp,
      });
    }

    const parsedQuery = await parseSearchQuery(query);
    console.log('[Search API] Parsed query:', parsedQuery);

    const summaries = await searchLinkedInProfiles(
      parsedQuery.googleQuery,
      parsedQuery.count,
      parsedQuery.countryCode,
    );

    await cacheSearchResults(query, parsedQuery, summaries);

    await Promise.all(summaries.map((summary) => cacheProfileSummary(summary)));

    console.log('[Search API] Returning fresh search results:', summaries.length);

    return NextResponse.json({
      success: true,
      count: summaries.length,
      results: summaries,
      parsedQuery,
      cached: false,
      timestamp: Date.now(),
    });
  } catch (error) {
    console.error('[Search API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Search failed',
      },
      { status: 500 },
    );
  }
}
