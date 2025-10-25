import { NextRequest, NextResponse } from 'next/server';
import { batchGetCachedProfiles, batchCacheProfiles } from '@/lib/redis/profile-cache';
import { getCachedProfiles, saveProfile } from '@/lib/cache';
import { fetchLinkedInProfiles } from '@/lib/brightdata/linkedin';
import type { ProfileData } from '@/types/linkedin';

const MAX_BATCH_SIZE = 50;

function normalizeInputId(id: unknown): string | null {
  if (typeof id !== 'string') {
    return null;
  }

  const trimmed = id.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith('http')) {
    try {
      const url = new URL(trimmed);
      const segments = url.pathname.split('/').filter(Boolean);
      const inIndex = segments.findIndex((segment) => segment === 'in');
      const candidate = inIndex >= 0 ? segments[inIndex + 1] : segments[0];
      if (candidate) {
        return candidate.replace(/\/+$/, '');
      }
    } catch {
      return null;
    }
  }

  return trimmed.replace(/\/+$/, '');
}

function buildLinkedinUrl(linkedinId: string): string {
  return `https://www.linkedin.com/in/${linkedinId}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rawIds = body?.linkedinIds;

    if (!Array.isArray(rawIds) || rawIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'linkedinIds array is required' },
        { status: 400 },
      );
    }

    if (rawIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { success: false, error: `Maximum ${MAX_BATCH_SIZE} profiles per batch` },
        { status: 400 },
      );
    }

    const normalizedIds = Array.from(
      new Set(
        rawIds
          .map((id) => normalizeInputId(id))
          .filter((id): id is string => Boolean(id)),
      ),
    );

    if (normalizedIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid linkedinIds provided' },
        { status: 400 },
      );
    }

    console.log('[Batch Profile API] Fetching profiles:', normalizedIds.length);

    // STEP 1: Check Redis cache
    const redisProfiles = await batchGetCachedProfiles(normalizedIds);
    const redisIds = Object.keys(redisProfiles);

    // STEP 2: Check PostgreSQL for Redis misses
    const redisMisses = normalizedIds.filter((id) => !redisProfiles[id]);
    const postgresUrls = redisMisses.map((id) => buildLinkedinUrl(id));

    const postgresProfilesMap = await getCachedProfiles(postgresUrls);
    const postgresIds = Object.keys(postgresProfilesMap);

    if (postgresIds.length > 0) {
      await batchCacheProfiles(Object.values(postgresProfilesMap));
    }

    // STEP 3: Fetch remaining from Bright Data
    const satisfiedIds = new Set([...redisIds, ...postgresIds]);
    const apiMisses = normalizedIds.filter((id) => !satisfiedIds.has(id));

    let apiProfiles: ProfileData[] = [];

    if (apiMisses.length > 0) {
      const apiUrls = apiMisses.map((id) => buildLinkedinUrl(id));

      console.log('[Batch Profile API] Fetching from Bright Data:', apiMisses.length);
      apiProfiles = await fetchLinkedInProfiles(apiUrls);

      for (const profile of apiProfiles) {
        await saveProfile(profile);
      }

      if (apiProfiles.length > 0) {
        await batchCacheProfiles(apiProfiles);
      }
    }

    // STEP 4: Combine all results
    const now = Date.now();
    const allProfiles = [
      ...redisIds.map((id) => redisProfiles[id]),
      ...postgresIds.map((id) => ({
        ...postgresProfilesMap[id],
        source: 'postgres' as const,
        cachedAt: now,
      })),
      ...apiProfiles.map((profile) => ({
        ...profile,
        source: 'api' as const,
        cachedAt: now,
      })),
    ];

    console.log('[Batch Profile API] Results:', {
      total: allProfiles.length,
      redis: redisIds.length,
      postgres: postgresIds.length,
      api: apiProfiles.length,
    });

    return NextResponse.json({
      success: true,
      count: allProfiles.length,
      profiles: allProfiles,
      stats: {
        redis: redisIds.length,
        postgres: postgresIds.length,
        api: apiProfiles.length,
      },
    });
  } catch (error) {
    console.error('[Batch Profile API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Batch fetch failed',
      },
      { status: 500 },
    );
  }
}
