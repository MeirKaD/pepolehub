import { NextRequest, NextResponse } from 'next/server';
import { getCachedFullProfile, cacheFullProfile } from '@/lib/redis/profile-cache';
import { getCachedProfile, saveProfile } from '@/lib/cache';
import { fetchLinkedInProfile } from '@/lib/brightdata/linkedin';

function normalizeLinkedinId(id: string): string {
  return id.trim().replace(/\/+$/, '');
}

function buildLinkedinUrl(linkedinId: string): string {
  return `https://www.linkedin.com/in/${linkedinId}`;
}

type RouteContext = {
  params: Promise<{ linkedinId: string }>;
};

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const params = await context.params;
    const rawId = params.linkedinId ?? '';
    const linkedinId = normalizeLinkedinId(decodeURIComponent(rawId));

    if (!linkedinId) {
      return NextResponse.json(
        { success: false, error: 'linkedinId is required' },
        { status: 400 },
      );
    }

    console.log('[Profile API] Fetching profile:', linkedinId);

    const redisProfile = await getCachedFullProfile(linkedinId);
    if (redisProfile) {
      console.log('[Profile API] Found in Redis cache');
      return NextResponse.json({
        success: true,
        profile: redisProfile,
        source: redisProfile.source,
      });
    }

    const linkedinUrl = buildLinkedinUrl(linkedinId);
    const postgresProfile = await getCachedProfile(linkedinUrl);

    if (postgresProfile) {
      console.log('[Profile API] Found in PostgreSQL cache');
      try {
        await cacheFullProfile(postgresProfile);
      } catch (cacheError) {
        console.error('[Profile API] Failed to cache PostgreSQL profile in Redis:', cacheError);
      }

      return NextResponse.json({
        success: true,
        profile: {
          ...postgresProfile,
          source: 'postgres' as const,
          cachedAt: Date.now(),
        },
        source: 'postgres',
      });
    }

    console.log('[Profile API] Fetching from Bright Data API');
    const freshProfile = await fetchLinkedInProfile(linkedinUrl);

    await saveProfile(freshProfile);

    try {
      await cacheFullProfile(freshProfile);
    } catch (cacheError) {
      console.error('[Profile API] Failed to cache fresh profile in Redis:', cacheError);
    }

    console.log('[Profile API] Returning fresh profile from API');

    return NextResponse.json({
      success: true,
      profile: {
        ...freshProfile,
        source: 'api' as const,
        cachedAt: Date.now(),
      },
      source: 'api',
    });
  } catch (error) {
    console.error('[Profile API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch profile',
      },
      { status: 500 },
    );
  }
}
