import redis from './client';

/**
 * Cache key prefixes for namespacing
 */
export const CachePrefix = {
  SEARCH_RESULTS: 'search:results',
  PROFILE_SUMMARY: 'profile:summary',
  PROFILE_FULL: 'profile:full',
  GOOGLE_SEARCH: 'google:search',
} as const;

/**
 * Cache TTL in seconds
 */
export const CacheTTL = {
  SEARCH_RESULTS: 60 * 60,
  PROFILE_SUMMARY: 60 * 60,
  PROFILE_FULL: 24 * 60 * 60,
  GOOGLE_SEARCH: 60 * 60,
} as const;

/**
 * Generate cache key with prefix
 */
export function getCacheKey(prefix: string, identifier: string): string {
  return `${prefix}:${identifier}`;
}

/**
 * Get value from cache with JSON parsing
 */
export async function getCache<T>(key: string): Promise<T | null> {
  try {
    const value = await redis.get(key);
    if (!value) return null;

    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`[Redis Cache] Get error for key ${key}:`, error);
    return null;
  }
}

/**
 * Set value in cache with JSON stringification and TTL
 */
export async function setCache<T>(key: string, value: T, ttl: number): Promise<boolean> {
  try {
    const serialized = JSON.stringify(value);
    await redis.setex(key, ttl, serialized);
    return true;
  } catch (error) {
    console.error(`[Redis Cache] Set error for key ${key}:`, error);
    return false;
  }
}

/**
 * Delete value from cache
 */
export async function deleteCache(key: string): Promise<boolean> {
  try {
    await redis.del(key);
    return true;
  } catch (error) {
    console.error(`[Redis Cache] Delete error for key ${key}:`, error);
    return false;
  }
}

/**
 * Delete multiple keys by pattern
 */
export async function deleteCachePattern(pattern: string): Promise<number> {
  try {
    const keys = await redis.keys(pattern);
    if (keys.length === 0) return 0;

    await redis.del(...keys);
    return keys.length;
  } catch (error) {
    console.error(`[Redis Cache] Delete pattern error for ${pattern}:`, error);
    return 0;
  }
}

/**
 * Check if key exists in cache
 */
export async function existsCache(key: string): Promise<boolean> {
  try {
    const exists = await redis.exists(key);
    return exists === 1;
  } catch (error) {
    console.error(`[Redis Cache] Exists error for key ${key}:`, error);
    return false;
  }
}

/**
 * Get TTL for a key (in seconds)
 */
export async function getTTL(key: string): Promise<number> {
  try {
    const ttl = await redis.ttl(key);
    return ttl;
  } catch (error) {
    console.error(`[Redis Cache] TTL error for key ${key}:`, error);
    return -1;
  }
}

/**
 * Batch get multiple keys
 */
export async function batchGetCache<T>(keys: string[]): Promise<(T | null)[]> {
  try {
    if (keys.length === 0) return [];

    const values = await redis.mget(...keys);
    return values.map((value) => {
      if (!value) return null;
      try {
        return JSON.parse(value) as T;
      } catch {
        return null;
      }
    });
  } catch (error) {
    console.error('[Redis Cache] Batch get error:', error);
    return keys.map(() => null);
  }
}

/**
 * Increment a counter with optional TTL
 */
export async function incrementCounter(key: string, ttl?: number): Promise<number> {
  try {
    const value = await redis.incr(key);
    if (ttl && value === 1) {
      await redis.expire(key, ttl);
    }
    return value;
  } catch (error) {
    console.error(`[Redis Cache] Increment error for key ${key}:`, error);
    return 0;
  }
}
