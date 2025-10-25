import {
  CachePrefix,
  CacheTTL,
  batchGetCache,
  getCache,
  getCacheKey,
  setCache,
} from './cache';
import type { CachedProfile, ProfileData, ProfileSummary } from '@/types/linkedin';

/**
 * Generate cache key for profile summary.
 */
export function getProfileSummaryCacheKey(linkedinId: string): string {
  return getCacheKey(CachePrefix.PROFILE_SUMMARY, linkedinId);
}

/**
 * Generate cache key for full profile.
 */
export function getProfileFullCacheKey(linkedinId: string): string {
  return getCacheKey(CachePrefix.PROFILE_FULL, linkedinId);
}

/**
 * Retrieve a cached profile summary by LinkedIn ID.
 */
export async function getCachedProfileSummary(linkedinId: string): Promise<ProfileSummary | null> {
  const key = getProfileSummaryCacheKey(linkedinId);
  return getCache<ProfileSummary>(key);
}

/**
 * Retrieve a cached full profile by LinkedIn ID.
 */
export async function getCachedFullProfile(linkedinId: string): Promise<CachedProfile | null> {
  const key = getProfileFullCacheKey(linkedinId);
  const cached = await getCache<ProfileData>(key);

  if (!cached) {
    return null;
  }

  return {
    ...cached,
    cachedAt: Date.now(),
    source: 'redis',
  };
}

/**
 * Batch fetch cached full profiles.
 */
export async function batchGetCachedProfiles(
  linkedinIds: string[],
): Promise<Record<string, CachedProfile>> {
  const keys = linkedinIds.map(getProfileFullCacheKey);
  const cached = await batchGetCache<ProfileData>(keys);

  const result: Record<string, CachedProfile> = {};

  linkedinIds.forEach((id, index) => {
    const profile = cached[index];
    if (profile) {
      result[id] = {
        ...profile,
        cachedAt: Date.now(),
        source: 'redis',
      };
    }
  });

  console.log('[Profile Cache] Batch fetch:', {
    requested: linkedinIds.length,
    found: Object.keys(result).length,
  });

  return result;
}

/**
 * Cache a profile summary result.
 */
export async function cacheProfileSummary(summary: ProfileSummary): Promise<boolean> {
  const key = getProfileSummaryCacheKey(summary.linkedinId);
  return setCache(key, summary, CacheTTL.PROFILE_SUMMARY);
}

/**
 * Cache a full profile result.
 */
export async function cacheFullProfile(profile: ProfileData): Promise<boolean> {
  const key = getProfileFullCacheKey(profile.linkedinId);

  console.log('[Profile Cache] Caching full profile:', {
    linkedinId: profile.linkedinId,
    ttl: CacheTTL.PROFILE_FULL,
  });

  return setCache(key, profile, CacheTTL.PROFILE_FULL);
}

/**
 * Cache multiple full profiles sequentially.
 */
export async function batchCacheProfiles(profiles: ProfileData[]): Promise<number> {
  let cachedCount = 0;

  for (const profile of profiles) {
    const success = await cacheFullProfile(profile);
    if (success) {
      cachedCount += 1;
    }
  }

  console.log('[Profile Cache] Batch cached:', {
    total: profiles.length,
    cached: cachedCount,
  });

  return cachedCount;
}
