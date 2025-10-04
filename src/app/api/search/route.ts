import { NextRequest, NextResponse } from 'next/server';
import { parseSearchQuery } from '@/lib/search/parser';
import { findLinkedInProfiles } from '@/lib/brightdata/search';
import { fetchLinkedInProfiles } from '@/lib/brightdata/linkedin';
import { getCachedProfiles, saveProfile } from '@/lib/cache';
import type { ProfileData } from '@/types/linkedin';

function extractLinkedInId(url: string): string | null {
  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (pathParts[0] === 'in' && pathParts[1]) {
      return pathParts[1];
    }
    return null;
  } catch {
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    // Validate request
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    if (query.length < 2) {
      return NextResponse.json(
        { success: false, error: 'Query must be at least 2 characters' },
        { status: 400 }
      );
    }

    if (query.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Query must be at most 100 characters' },
        { status: 400 }
      );
    }

    // Step 1: Parse the search query
    const parsed = await parseSearchQuery(query);

    // Step 2: Find LinkedIn URLs from Google with geolocation
    const linkedInUrls = await findLinkedInProfiles(
      parsed.googleQuery,
      parsed.count,
      parsed.countryCode
    );

    if (linkedInUrls.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        profiles: [],
      });
    }

    // Step 3: Batch check cache for all URLs
    const cachedProfilesMap = await getCachedProfiles(linkedInUrls);

    // Step 4: Separate cached vs uncached URLs
    const cachedProfiles: ProfileData[] = [];
    const uncachedUrls: string[] = [];

    for (const url of linkedInUrls) {
      const linkedinId = extractLinkedInId(url);
      if (linkedinId && cachedProfilesMap[linkedinId]) {
        cachedProfiles.push(cachedProfilesMap[linkedinId]);
      } else {
        uncachedUrls.push(url);
      }
    }

    // Step 5: Batch fetch uncached profiles from Bright Data (if any)
    const fetchedProfiles: ProfileData[] = [];
    if (uncachedUrls.length > 0) {
      try {
        console.log(`[Search API] Fetching ${uncachedUrls.length} uncached profiles in batch`);
        const newProfiles = await fetchLinkedInProfiles(uncachedUrls);

        // Save all new profiles
        for (const profile of newProfiles) {
          await saveProfile(profile);
          fetchedProfiles.push(profile);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`[Search API] Batch fetch error: ${errorMsg}`);
      }
    }

    const allProfiles = [...cachedProfiles, ...fetchedProfiles];

    return NextResponse.json({
      success: true,
      count: allProfiles.length,
      profiles: allProfiles,
      cached: cachedProfiles.length,
      fetched: fetchedProfiles.length,
    });
  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { success: false, error: 'Search failed' },
      { status: 500 }
    );
  }
}
