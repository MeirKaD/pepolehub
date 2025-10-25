# TASKS: Redis Caching + Two-Phase Search Flow

**Created:** 2025-10-25
**Status:** Planning Phase
**Priority:** High

---

## Overview

This document outlines the tasks required to implement two major improvements to PeopleHub:

1. **Redis Cloud Caching Layer** - Fast in-memory cache with TTL for search results
2. **Two-Phase Search Flow** - Lightweight initial results → Full profile on-demand

### Current Flow (Before)
```
User Query → AI Parse → Google Search → Check DB Cache → Fetch Full Profiles → Display
                                              ↓
                                        30-day PostgreSQL cache
```

### New Flow (After)
```
Phase 1: User Query → AI Parse → Google Search → Check Redis → Display URLs/Titles/Descriptions
                                        ↓
                                  Redis Cache (1 hour TTL)
                                        ↓
                                  PostgreSQL (30 days)

Phase 2: User Click → Check Redis → Check PostgreSQL → Fetch Full Profile → Display Details
                            ↓
                      Redis Cache (24 hour TTL)
                            ↓
                      PostgreSQL (30 days)
```

---

## Architecture Changes

### New Caching Strategy

| Data Type | Cache Layer 1 (Redis) | Cache Layer 2 (PostgreSQL) |
|-----------|----------------------|---------------------------|
| **Search Results** | 1 hour TTL | Not stored separately |
| **Profile Summaries** | 1 hour TTL | Derived from full profile |
| **Full Profiles** | 24 hour TTL | 30 days TTL |

### Key Benefits
- **Faster Response Times:** Redis in-memory cache (sub-millisecond)
- **Reduced API Costs:** Two-tier caching reduces Bright Data calls
- **Better UX:** Instant search results, lazy load full profiles
- **Lower Database Load:** Redis absorbs most read traffic

---

## Task Breakdown

### Phase 1: Redis Setup & Infrastructure

#### Task 1.1: Setup Redis Cloud Account
**Priority:** High
**Estimated Time:** 30 minutes

**Steps:**
1. Go to https://redis.com/try-free/
2. Create a free Redis Cloud account
3. Create a new database:
   - **Name:** `pepolehub-cache`
   - **Cloud Provider:** AWS
   - **Region:** `us-east-1` (same as Supabase for low latency)
   - **Type:** Free tier (30MB) or Basic (1GB recommended)
   - **Eviction Policy:** `allkeys-lru` (evict least recently used)
   - **Data Persistence:** AOF (Append-Only File) - optional for free tier
4. Note down connection details:
   - **Host:** `redis-xxxxx.c123.us-east-1-1.ec2.cloud.redislabs.com`
   - **Port:** `xxxxx`
   - **Password:** (copy from dashboard)
5. Test connection using Redis CLI or online tool

**Deliverables:**
- Redis Cloud database created
- Connection credentials saved securely

**Resources:**
- Redis Cloud Console: https://app.redislabs.com/
- Free Tier Docs: https://redis.io/docs/latest/operate/rc/

---

#### Task 1.2: Install Redis Dependencies
**Priority:** High
**Estimated Time:** 15 minutes
**Depends On:** Task 1.1

**Steps:**
1. Install `ioredis` package (official TypeScript support built-in):
```bash
npm install ioredis
```

2. Install types (if needed - ioredis includes types):
```bash
# Not needed - ioredis is written in TypeScript
```

3. Verify installation:
```bash
npm list ioredis
```

**Files to Create:**
- None (just dependency installation)

**Deliverables:**
- `ioredis` added to `package.json`
- `package-lock.json` updated

---

#### Task 1.3: Configure Environment Variables
**Priority:** High
**Estimated Time:** 10 minutes
**Depends On:** Task 1.1

**Steps:**
1. Add Redis credentials to `.env.local`:
```env
# Redis Cloud Configuration
REDIS_HOST="redis-xxxxx.c123.us-east-1-1.ec2.cloud.redislabs.com"
REDIS_PORT="xxxxx"
REDIS_PASSWORD="your_password_here"
REDIS_TLS_ENABLED="true"  # Redis Cloud uses TLS by default
```

2. Update `.env.example`:
```env
# Redis Cloud Configuration (Required)
REDIS_HOST=""
REDIS_PORT=""
REDIS_PASSWORD=""
REDIS_TLS_ENABLED="true"
```

3. Add to Vercel environment variables (for production)

**Files to Modify:**
- `.env.example`
- `.env.local` (local only, not committed)

**Deliverables:**
- Redis credentials configured locally
- Template updated in `.env.example`

---

#### Task 1.4: Create Redis Client Singleton
**Priority:** High
**Estimated Time:** 45 minutes
**Depends On:** Task 1.2, Task 1.3

**Steps:**
1. Create new file: `src/lib/redis/client.ts`

```typescript
import Redis from 'ioredis';

const globalForRedis = globalThis as unknown as {
  redis: Redis | undefined;
};

export const redis =
  globalForRedis.redis ??
  new Redis({
    host: process.env.REDIS_HOST!,
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD!,
    tls: process.env.REDIS_TLS_ENABLED === 'true' ? {} : undefined,
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ECONNRESET'];
      if (targetErrors.some((e) => err.message.includes(e))) {
        return true; // Reconnect
      }
      return false;
    },
    lazyConnect: false,
    enableReadyCheck: true,
    // Logging in development
    showFriendlyErrorStack: process.env.NODE_ENV === 'development',
  });

// Connection event handlers
redis.on('connect', () => {
  console.log('[Redis] Connected to Redis Cloud');
});

redis.on('ready', () => {
  console.log('[Redis] Redis client ready');
});

redis.on('error', (err) => {
  console.error('[Redis] Redis error:', err);
});

redis.on('close', () => {
  console.warn('[Redis] Redis connection closed');
});

redis.on('reconnecting', () => {
  console.log('[Redis] Reconnecting to Redis...');
});

// Store in global for development hot-reload
if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redis;
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('[Redis] SIGTERM received, closing Redis connection');
  await redis.quit();
});

export default redis;
```

2. Create health check utility: `src/lib/redis/health.ts`

```typescript
import redis from './client';

export async function checkRedisHealth(): Promise<boolean> {
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('[Redis Health] Health check failed:', error);
    return false;
  }
}

export async function getRedisInfo(): Promise<Record<string, string>> {
  try {
    const info = await redis.info();
    const lines = info.split('\r\n');
    const parsed: Record<string, string> = {};

    lines.forEach((line) => {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          parsed[key] = value;
        }
      }
    });

    return parsed;
  } catch (error) {
    console.error('[Redis Health] Failed to get info:', error);
    return {};
  }
}
```

**Files to Create:**
- `src/lib/redis/client.ts`
- `src/lib/redis/health.ts`

**Deliverables:**
- Redis client singleton with error handling
- Health check utilities
- Connection logging for debugging

**Testing:**
```bash
# Create test file: src/tests/test-redis.ts
import redis from '../lib/redis/client';
import { checkRedisHealth } from '../lib/redis/health';

async function testRedis() {
  console.log('Testing Redis connection...');

  const isHealthy = await checkRedisHealth();
  console.log('Health check:', isHealthy);

  await redis.set('test:key', 'Hello Redis!', 'EX', 60);
  const value = await redis.get('test:key');
  console.log('Test value:', value);

  await redis.quit();
}

testRedis();
```

---

#### Task 1.5: Create Redis Cache Utility Layer
**Priority:** High
**Estimated Time:** 1.5 hours
**Depends On:** Task 1.4

**Steps:**
1. Create cache utility: `src/lib/redis/cache.ts`

```typescript
import redis from './client';

/**
 * Cache key prefixes for namespacing
 */
export const CachePrefix = {
  SEARCH_RESULTS: 'search:results',      // Search result summaries (1 hour)
  PROFILE_SUMMARY: 'profile:summary',    // Profile summaries (1 hour)
  PROFILE_FULL: 'profile:full',          // Full profiles (24 hours)
  GOOGLE_SEARCH: 'google:search',        // Google search results (1 hour)
} as const;

/**
 * Cache TTL in seconds
 */
export const CacheTTL = {
  SEARCH_RESULTS: 60 * 60,        // 1 hour
  PROFILE_SUMMARY: 60 * 60,       // 1 hour
  PROFILE_FULL: 24 * 60 * 60,     // 24 hours
  GOOGLE_SEARCH: 60 * 60,         // 1 hour
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
export async function setCache<T>(
  key: string,
  value: T,
  ttl: number
): Promise<boolean> {
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
export async function incrementCounter(
  key: string,
  ttl?: number
): Promise<number> {
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
```

**Files to Create:**
- `src/lib/redis/cache.ts`

**Deliverables:**
- Generic cache utilities with type safety
- Namespace prefixes for different data types
- TTL constants for each cache type
- Batch operations support

---

### Phase 2: New Data Types & Interfaces

#### Task 2.1: Define Profile Summary Types
**Priority:** High
**Estimated Time:** 30 minutes
**Depends On:** None

**Steps:**
1. Update `src/types/linkedin.ts` with new types:

```typescript
/**
 * Lightweight profile summary for search results (Phase 1)
 */
export interface ProfileSummary {
  linkedinUrl: string;
  linkedinId: string;
  title: string;              // From Google search result title
  snippet: string;        // From Google search result snippet
  // Extracted from title/description if possible
  name?: string;
  headline?: string;
  location?: string;
}

/**
 * Google search result item
 */
export interface GoogleSearchResult {
  title: string;
  link: string;               // LinkedIn URL
  description: string;            // Description
  position: number;
}

/**
 * Cached search results
 */
export interface CachedSearchResults {
  query: string;
  parsedQuery: ParsedSearchQuery;
  results: ProfileSummary[];
  count: number;
  timestamp: number;
}

/**
 * Full profile with cache metadata
 */
export interface CachedProfile extends ProfileData {
  cachedAt: number;           // Unix timestamp
  source: 'redis' | 'postgres' | 'api';
}
```

**Files to Modify:**
- `src/types/linkedin.ts`

**Deliverables:**
- New TypeScript interfaces for two-phase flow
- Cache metadata types

---

#### Task 2.2: Update Bright Data Search to Return Summaries
**Priority:** High
**Estimated Time:** 1 hour
**Depends On:** Task 2.1

**Steps:**
1. Modify `src/lib/brightdata/search.ts`:

```typescript
import { GoogleSearchResult, ProfileSummary } from '@/types/linkedin';

/**
 * Extract profile summary from Google search result
 */
export function extractProfileSummary(result: GoogleSearchResult): ProfileSummary {
  const linkedinUrl = result.link;
  const linkedinId = extractLinkedInId(linkedinUrl);

  // Try to extract name from title (usually "Name - Job Title - Company | LinkedIn")
  const titleParts = result.title.split(' - ');
  const name = titleParts[0]?.replace(' | LinkedIn', '').trim();
  const headline = titleParts.slice(1).join(' - ').replace(' | LinkedIn', '').trim();

  // Try to extract location from snippet if present
  const locationMatch = result.snippet.match(/Location:\s*([^·]+)/);
  const location = locationMatch?.[1]?.trim();

  return {
    linkedinUrl,
    linkedinId,
    title: result.title,
    description: result.snippet,
    name: name || undefined,
    headline: headline || undefined,
    location: location || undefined,
  };
}

/**
 * Search Google and return profile summaries
 */
export async function searchLinkedInProfiles(
  query: string,
  maxResults: number = 10,
  countryCode?: string
): Promise<ProfileSummary[]> {
  console.log('[Google Search] Searching for LinkedIn profiles:', {
    query,
    maxResults,
    countryCode,
  });

  try {
    const searchResults = await searchGoogle(query, 1, countryCode);
    const linkedinResults = searchResults
      .filter((result) => result.link.includes('linkedin.com/in/'))
      .slice(0, maxResults);

    const summaries = linkedinResults.map(extractProfileSummary);

    console.log('[Google Search] Found summaries:', summaries.length);
    return summaries;
  } catch (error) {
    console.error('[Google Search] Error:', error);
    throw new Error('Failed to search LinkedIn profiles');
  }
}
```

**Files to Modify:**
- `src/lib/brightdata/search.ts`

**Deliverables:**
- Function to extract summaries from Google results
- Updated search function returning summaries

---

### Phase 3: Redis Cache Integration

#### Task 3.1: Create Search Results Cache Layer
**Priority:** High
**Estimated Time:** 1.5 hours
**Depends On:** Task 1.5, Task 2.1

**Steps:**
1. Create `src/lib/redis/search-cache.ts`:

```typescript
import {
  getCache,
  setCache,
  getCacheKey,
  CachePrefix,
  CacheTTL,
} from './cache';
import {
  ProfileSummary,
  CachedSearchResults,
  ParsedSearchQuery,
} from '@/types/linkedin';

/**
 * Generate cache key for search query
 */
export function getSearchCacheKey(query: string): string {
  // Normalize query for consistent caching
  const normalized = query.toLowerCase().trim();
  return getCacheKey(CachePrefix.SEARCH_RESULTS, normalized);
}

/**
 * Get cached search results
 */
export async function getCachedSearchResults(
  query: string
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
 * Cache search results
 */
export async function cacheSearchResults(
  query: string,
  parsedQuery: ParsedSearchQuery,
  results: ProfileSummary[]
): Promise<boolean> {
  const key = getSearchCacheKey(query);

  const data: CachedSearchResults = {
    query,
    parsedQuery,
    results,
    count: results.length,
    timestamp: Date.now(),
  };

  console.log('[Search Cache] Caching results:', {
    query,
    count: results.length,
    ttl: CacheTTL.SEARCH_RESULTS,
  });

  return setCache(key, data, CacheTTL.SEARCH_RESULTS);
}
```

**Files to Create:**
- `src/lib/redis/search-cache.ts`

**Deliverables:**
- Search results caching functions
- Query normalization for cache keys

---

#### Task 3.2: Create Profile Cache Layer
**Priority:** High
**Estimated Time:** 2 hours
**Depends On:** Task 1.5, Task 2.1

**Steps:**
1. Create `src/lib/redis/profile-cache.ts`:

```typescript
import {
  getCache,
  setCache,
  batchGetCache,
  getCacheKey,
  CachePrefix,
  CacheTTL,
} from './cache';
import { ProfileData, ProfileSummary, CachedProfile } from '@/types/linkedin';

/**
 * Generate cache key for profile summary
 */
export function getProfileSummaryCacheKey(linkedinId: string): string {
  return getCacheKey(CachePrefix.PROFILE_SUMMARY, linkedinId);
}

/**
 * Generate cache key for full profile
 */
export function getProfileFullCacheKey(linkedinId: string): string {
  return getCacheKey(CachePrefix.PROFILE_FULL, linkedinId);
}

/**
 * Get cached profile summary
 */
export async function getCachedProfileSummary(
  linkedinId: string
): Promise<ProfileSummary | null> {
  const key = getProfileSummaryCacheKey(linkedinId);
  return getCache<ProfileSummary>(key);
}

/**
 * Get cached full profile
 */
export async function getCachedFullProfile(
  linkedinId: string
): Promise<CachedProfile | null> {
  const key = getProfileFullCacheKey(linkedinId);
  const cached = await getCache<ProfileData>(key);

  if (cached) {
    return {
      ...cached,
      cachedAt: Date.now(),
      source: 'redis',
    };
  }

  return null;
}

/**
 * Batch get cached full profiles
 */
export async function batchGetCachedProfiles(
  linkedinIds: string[]
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

  console.log('[Profile Cache] Batch check:', {
    requested: linkedinIds.length,
    found: Object.keys(result).length,
  });

  return result;
}

/**
 * Cache profile summary
 */
export async function cacheProfileSummary(
  summary: ProfileSummary
): Promise<boolean> {
  const key = getProfileSummaryCacheKey(summary.linkedinId);
  return setCache(key, summary, CacheTTL.PROFILE_SUMMARY);
}

/**
 * Cache full profile
 */
export async function cacheFullProfile(
  profile: ProfileData
): Promise<boolean> {
  const key = getProfileFullCacheKey(profile.linkedinId);

  console.log('[Profile Cache] Caching full profile:', {
    linkedinId: profile.linkedinId,
    ttl: CacheTTL.PROFILE_FULL,
  });

  return setCache(key, profile, CacheTTL.PROFILE_FULL);
}

/**
 * Batch cache multiple profiles
 */
export async function batchCacheProfiles(
  profiles: ProfileData[]
): Promise<number> {
  let cached = 0;

  for (const profile of profiles) {
    const success = await cacheFullProfile(profile);
    if (success) cached++;
  }

  console.log('[Profile Cache] Batch cached:', {
    total: profiles.length,
    cached,
  });

  return cached;
}
```

**Files to Create:**
- `src/lib/redis/profile-cache.ts`

**Deliverables:**
- Profile summary and full profile caching
- Batch operations for efficiency

---

### Phase 4: Update Search API (Phase 1 - Lightweight Results)

#### Task 4.1: Modify Search API to Return Summaries First
**Priority:** High
**Estimated Time:** 2 hours
**Depends On:** Task 3.1, Task 3.2, Task 2.2

**Steps:**
1. Update `src/app/api/search/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { parseSearchQuery } from '@/lib/search/parser';
import { searchLinkedInProfiles } from '@/lib/brightdata/search';
import {
  getCachedSearchResults,
  cacheSearchResults,
} from '@/lib/redis/search-cache';
import { cacheProfileSummary } from '@/lib/redis/profile-cache';

export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    // Validate query
    if (!query || typeof query !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Query is required' },
        { status: 400 }
      );
    }

    if (query.length < 2 || query.length > 100) {
      return NextResponse.json(
        { success: false, error: 'Query must be 2-100 characters' },
        { status: 400 }
      );
    }

    console.log('[Search API] Query:', query);

    // STEP 1: Check Redis cache for search results
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

    // STEP 2: Parse query with AI
    const parsedQuery = await parseSearchQuery(query);
    console.log('[Search API] Parsed query:', parsedQuery);

    // STEP 3: Search Google for LinkedIn profiles (returns summaries)
    const summaries = await searchLinkedInProfiles(
      parsedQuery.googleQuery,
      parsedQuery.count,
      parsedQuery.countryCode
    );

    // STEP 4: Cache search results in Redis
    await cacheSearchResults(query, parsedQuery, summaries);

    // STEP 5: Cache individual profile summaries
    for (const summary of summaries) {
      await cacheProfileSummary(summary);
    }

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
      { status: 500 }
    );
  }
}
```

**Files to Modify:**
- `src/app/api/search/route.ts`

**Deliverables:**
- Updated search API returning lightweight summaries
- Redis caching integrated
- Faster response times

---

### Phase 5: Create Profile Fetch API (Phase 2 - On-Demand)

#### Task 5.1: Create Individual Profile Fetch API
**Priority:** High
**Estimated Time:** 2 hours
**Depends On:** Task 3.2

**Steps:**
1. Create new API route: `src/app/api/profile/[linkedinId]/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getCachedFullProfile, cacheFullProfile } from '@/lib/redis/profile-cache';
import { getCachedProfile, saveProfile } from '@/lib/cache';
import { fetchLinkedInProfile } from '@/lib/brightdata/linkedin';

interface Params {
  params: {
    linkedinId: string;
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { linkedinId } = params;

    console.log('[Profile API] Fetching profile:', linkedinId);

    // STEP 1: Check Redis cache (24 hour TTL)
    const redisProfile = await getCachedFullProfile(linkedinId);

    if (redisProfile) {
      console.log('[Profile API] Found in Redis cache');
      return NextResponse.json({
        success: true,
        profile: redisProfile,
        source: 'redis',
      });
    }

    // STEP 2: Check PostgreSQL cache (30 day TTL)
    const linkedinUrl = `https://www.linkedin.com/in/${linkedinId}`;
    const pgProfile = await getCachedProfile(linkedinUrl);

    if (pgProfile) {
      console.log('[Profile API] Found in PostgreSQL cache');

      // Cache in Redis for faster future access
      await cacheFullProfile(pgProfile);

      return NextResponse.json({
        success: true,
        profile: { ...pgProfile, source: 'postgres' },
        source: 'postgres',
      });
    }

    // STEP 3: Fetch from Bright Data LinkedIn API
    console.log('[Profile API] Fetching from Bright Data API');
    const freshProfile = await fetchLinkedInProfile(linkedinUrl);

    if (!freshProfile) {
      return NextResponse.json(
        { success: false, error: 'Profile not found' },
        { status: 404 }
      );
    }

    // STEP 4: Save to PostgreSQL (30 day cache)
    await saveProfile(freshProfile);

    // STEP 5: Cache in Redis (24 hour cache)
    await cacheFullProfile(freshProfile);

    console.log('[Profile API] Returning fresh profile from API');

    return NextResponse.json({
      success: true,
      profile: { ...freshProfile, source: 'api' },
      source: 'api',
    });
  } catch (error) {
    console.error('[Profile API] Error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch profile',
      },
      { status: 500 }
    );
  }
}
```

**Files to Create:**
- `src/app/api/profile/[linkedinId]/route.ts`

**Deliverables:**
- New API endpoint for individual profile fetching
- Three-tier caching (Redis → PostgreSQL → API)
- Proper error handling

---

#### Task 5.2: Create Batch Profile Fetch API
**Priority:** Medium
**Estimated Time:** 1.5 hours
**Depends On:** Task 5.1

**Steps:**
1. Create batch endpoint: `src/app/api/profiles/batch/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { batchGetCachedProfiles, batchCacheProfiles } from '@/lib/redis/profile-cache';
import { getCachedProfiles, saveProfile } from '@/lib/cache';
import { fetchLinkedInProfiles } from '@/lib/brightdata/linkedin';
import { extractLinkedInId } from '@/lib/brightdata/search';

export async function POST(request: NextRequest) {
  try {
    const { linkedinIds } = await request.json();

    if (!Array.isArray(linkedinIds) || linkedinIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'linkedinIds array is required' },
        { status: 400 }
      );
    }

    if (linkedinIds.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Maximum 50 profiles per batch' },
        { status: 400 }
      );
    }

    console.log('[Batch Profile API] Fetching profiles:', linkedinIds.length);

    // STEP 1: Check Redis cache
    const redisProfiles = await batchGetCachedProfiles(linkedinIds);
    const redisHits = Object.keys(redisProfiles);

    // STEP 2: Check PostgreSQL for Redis misses
    const redisMisses = linkedinIds.filter((id) => !redisProfiles[id]);
    const linkedinUrls = redisMisses.map((id) => `https://www.linkedin.com/in/${id}`);

    const pgProfiles = await getCachedProfiles(linkedinUrls);
    const pgHits = Object.keys(pgProfiles);

    // Cache PG hits in Redis
    if (pgHits.length > 0) {
      await batchCacheProfiles(Object.values(pgProfiles));
    }

    // STEP 3: Fetch remaining from Bright Data
    const allCachedIds = new Set([...redisHits, ...pgHits]);
    const apiMisses = linkedinIds.filter((id) => !allCachedIds.has(id));

    let apiProfiles = [];
    if (apiMisses.length > 0) {
      const apiUrls = apiMisses.map((id) => `https://www.linkedin.com/in/${id}`);
      apiProfiles = await fetchLinkedInProfiles(apiUrls);

      // Save to PostgreSQL
      for (const profile of apiProfiles) {
        await saveProfile(profile);
      }

      // Cache in Redis
      await batchCacheProfiles(apiProfiles);
    }

    // STEP 4: Combine all results
    const allProfiles = [
      ...Object.values(redisProfiles).map((p) => ({ ...p, source: 'redis' })),
      ...Object.values(pgProfiles).map((p) => ({ ...p, source: 'postgres' })),
      ...apiProfiles.map((p) => ({ ...p, source: 'api' })),
    ];

    console.log('[Batch Profile API] Results:', {
      total: allProfiles.length,
      redis: redisHits.length,
      postgres: pgHits.length,
      api: apiProfiles.length,
    });

    return NextResponse.json({
      success: true,
      count: allProfiles.length,
      profiles: allProfiles,
      stats: {
        redis: redisHits.length,
        postgres: pgHits.length,
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
      { status: 500 }
    );
  }
}
```

**Files to Create:**
- `src/app/api/profiles/batch/route.ts`

**Deliverables:**
- Batch profile fetching endpoint
- Efficient three-tier caching for multiple profiles

---

### Phase 6: Update Frontend Components

#### Task 6.1: Update Search Results Page UI
**Priority:** High
**Estimated Time:** 2 hours
**Depends On:** Task 4.1

**Steps:**
1. Update `src/app/search/page.tsx`:

```typescript
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { ProfileSummary } from '@/types/linkedin';
import SearchBar from '@/components/SearchBar';
import ProfileSummaryCard from '@/components/ProfileSummaryCard';
import LoadingState from '@/components/LoadingState';

export default function SearchPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';

  const [summaries, setSummaries] = useState<ProfileSummary[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!query) {
      setSummaries([]);
      return;
    }

    const fetchSummaries = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Search failed');
        }

        setSummaries(data.results || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setIsLoading(false);
      }
    };

    fetchSummaries();
  }, [query]);

  return (
    <div className="container mx-auto px-4 py-8">
      <SearchBar onSearch={() => {}} isLoading={isLoading} />

      {isLoading && <LoadingState />}

      {error && (
        <div className="text-center py-12">
          <p className="text-red-500">{error}</p>
        </div>
      )}

      {!isLoading && !error && summaries.length === 0 && query && (
        <div className="text-center py-12">
          <p className="text-gray-500">No profiles found</p>
        </div>
      )}

      {!isLoading && summaries.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-8">
          {summaries.map((summary) => (
            <ProfileSummaryCard
              key={summary.linkedinId}
              summary={summary}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

**Files to Modify:**
- `src/app/search/page.tsx`

**Deliverables:**
- Updated search page using summaries instead of full profiles
- Faster initial load times

---

#### Task 6.2: Create Profile Summary Card Component
**Priority:** High
**Estimated Time:** 1.5 hours
**Depends On:** Task 6.1

**Steps:**
1. Create `src/components/ProfileSummaryCard.tsx`:

```typescript
'use client';

import { useState } from 'react';
import { ProfileSummary, CachedProfile } from '@/types/linkedin';
import { Card, CardHeader, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ExternalLink, ChevronDown, ChevronUp } from 'lucide-react';
import ProfileDetails from '@/components/ProfileDetails';

interface Props {
  summary: ProfileSummary;
}

export default function ProfileSummaryCard({ summary }: Props) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [fullProfile, setFullProfile] = useState<CachedProfile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExpand = async () => {
    if (!isExpanded && !fullProfile) {
      // Fetch full profile on first expand
      setIsLoading(true);
      setError(null);

      try {
        const response = await fetch(`/api/profile/${summary.linkedinId}`);
        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to load profile');
        }

        setFullProfile(data.profile);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error loading profile');
      } finally {
        setIsLoading(false);
      }
    }

    setIsExpanded(!isExpanded);
  };

  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <h3 className="font-semibold text-lg line-clamp-2">
              {summary.name || summary.title}
            </h3>
            {summary.headline && (
              <p className="text-sm text-gray-600 mt-1 line-clamp-1">
                {summary.headline}
              </p>
            )}
            {summary.location && (
              <Badge variant="secondary" className="mt-2">
                {summary.location}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <p className="text-sm text-gray-700 line-clamp-3 mb-4">
          {summary.description}
        </p>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleExpand}
            disabled={isLoading}
          >
            {isLoading ? (
              'Loading...'
            ) : isExpanded ? (
              <>
                <ChevronUp className="w-4 h-4 mr-1" />
                Less
              </>
            ) : (
              <>
                <ChevronDown className="w-4 h-4 mr-1" />
                More
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="default"
            asChild
          >
            <a
              href={summary.linkedinUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <ExternalLink className="w-4 h-4 mr-1" />
              View on LinkedIn
            </a>
          </Button>
        </div>

        {isExpanded && (
          <div className="mt-4 pt-4 border-t">
            {error && <p className="text-red-500 text-sm">{error}</p>}
            {fullProfile && <ProfileDetails profile={fullProfile} />}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
```

2. Create `src/components/ProfileDetails.tsx`:

```typescript
import { CachedProfile } from '@/types/linkedin';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Building2, GraduationCap, Languages, Users } from 'lucide-react';

interface Props {
  profile: CachedProfile;
}

export default function ProfileDetails({ profile }: Props) {
  const initials = `${profile.firstName[0]}${profile.lastName[0]}`.toUpperCase();
  const avatarUrl = profile.profilePicUrl
    ? `/api/proxy-image?url=${encodeURIComponent(profile.profilePicUrl)}`
    : undefined;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Avatar className="w-16 h-16">
          <AvatarImage src={avatarUrl} alt={profile.fullName} />
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h4 className="font-semibold text-lg">{profile.fullName}</h4>
          {profile.headline && (
            <p className="text-sm text-gray-600">{profile.headline}</p>
          )}
          {profile.location && (
            <p className="text-xs text-gray-500 mt-1">{profile.location}</p>
          )}
          <Badge variant="outline" className="mt-2 text-xs">
            Cached from {profile.source}
          </Badge>
        </div>
      </div>

      {/* About */}
      {profile.about && (
        <>
          <Separator />
          <div>
            <h5 className="font-medium text-sm mb-2">About</h5>
            <p className="text-sm text-gray-700 whitespace-pre-line">
              {profile.about}
            </p>
          </div>
        </>
      )}

      {/* Experience */}
      {profile.experience && profile.experience.length > 0 && (
        <>
          <Separator />
          <div>
            <h5 className="font-medium text-sm mb-3 flex items-center">
              <Building2 className="w-4 h-4 mr-2" />
              Experience
            </h5>
            <div className="space-y-3">
              {profile.experience.slice(0, 3).map((exp, idx) => (
                <div key={idx} className="text-sm">
                  <p className="font-medium">{exp.title}</p>
                  <p className="text-gray-600">{exp.company}</p>
                  {exp.duration && (
                    <p className="text-xs text-gray-500">{exp.duration}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Education */}
      {profile.education && profile.education.length > 0 && (
        <>
          <Separator />
          <div>
            <h5 className="font-medium text-sm mb-3 flex items-center">
              <GraduationCap className="w-4 h-4 mr-2" />
              Education
            </h5>
            <div className="space-y-2">
              {profile.education.slice(0, 2).map((edu, idx) => (
                <div key={idx} className="text-sm">
                  <p className="font-medium">{edu.title}</p>
                  {edu.start_year && edu.end_year && (
                    <p className="text-xs text-gray-500">
                      {edu.start_year} - {edu.end_year}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Languages */}
      {profile.languages && profile.languages.length > 0 && (
        <>
          <Separator />
          <div>
            <h5 className="font-medium text-sm mb-2 flex items-center">
              <Languages className="w-4 h-4 mr-2" />
              Languages
            </h5>
            <div className="flex flex-wrap gap-2">
              {profile.languages.map((lang, idx) => (
                <Badge key={idx} variant="secondary" className="text-xs">
                  {lang.title}
                </Badge>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Stats */}
      {(profile.connections || profile.followers) && (
        <>
          <Separator />
          <div className="flex items-center gap-4 text-sm">
            {profile.connections && (
              <div className="flex items-center gap-1 text-gray-600">
                <Users className="w-4 h-4" />
                <span>{profile.connections.toLocaleString()} connections</span>
              </div>
            )}
            {profile.followers && (
              <div className="flex items-center gap-1 text-gray-600">
                <Users className="w-4 h-4" />
                <span>{profile.followers.toLocaleString()} followers</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

**Files to Create:**
- `src/components/ProfileSummaryCard.tsx`
- `src/components/ProfileDetails.tsx`

**Deliverables:**
- New lightweight summary card component
- Expandable details with lazy loading
- On-demand profile fetching

---

### Phase 7: Testing & Optimization

#### Task 7.1: Create Redis Cache Tests
**Priority:** Medium
**Estimated Time:** 1 hour
**Depends On:** Task 3.1, Task 3.2

**Steps:**
1. Create `src/tests/test-redis-cache.ts`:

```typescript
import redis from '../lib/redis/client';
import { checkRedisHealth, getRedisInfo } from '../lib/redis/health';
import {
  setCache,
  getCache,
  deleteCache,
  existsCache,
  getTTL,
} from '../lib/redis/cache';

async function testRedisCache() {
  console.log('=== Redis Cache Test ===\n');

  // Health check
  console.log('1. Health Check');
  const isHealthy = await checkRedisHealth();
  console.log('  Healthy:', isHealthy);

  if (!isHealthy) {
    console.error('  ❌ Redis is not healthy, aborting tests');
    await redis.quit();
    return;
  }

  // Get Redis info
  console.log('\n2. Redis Info');
  const info = await getRedisInfo();
  console.log('  Version:', info.redis_version);
  console.log('  Used Memory:', info.used_memory_human);

  // Test basic cache operations
  console.log('\n3. Test Cache Operations');

  const testKey = 'test:cache:key';
  const testData = { name: 'John Doe', age: 30 };

  console.log('  Setting cache...');
  await setCache(testKey, testData, 60);

  console.log('  Checking exists...');
  const exists = await existsCache(testKey);
  console.log('  Exists:', exists);

  console.log('  Getting cache...');
  const cached = await getCache<typeof testData>(testKey);
  console.log('  Cached data:', cached);

  console.log('  Getting TTL...');
  const ttl = await getTTL(testKey);
  console.log('  TTL:', ttl, 'seconds');

  console.log('  Deleting cache...');
  await deleteCache(testKey);

  console.log('  Checking exists after delete...');
  const existsAfter = await existsCache(testKey);
  console.log('  Exists:', existsAfter);

  console.log('\n✅ All tests passed!');

  await redis.quit();
}

testRedisCache().catch(console.error);
```

2. Create `src/tests/test-search-cache.ts`:

```typescript
import redis from '../lib/redis/client';
import {
  cacheSearchResults,
  getCachedSearchResults,
} from '../lib/redis/search-cache';
import { ProfileSummary } from '../types/linkedin';

async function testSearchCache() {
  console.log('=== Search Cache Test ===\n');

  const testQuery = '5 AI Engineers in San Francisco';
  const testResults: ProfileSummary[] = [
    {
      linkedinUrl: 'https://linkedin.com/in/test1',
      linkedinId: 'test1',
      title: 'John Doe - AI Engineer - OpenAI',
      description: 'AI Engineer with 5 years of experience...',
      name: 'John Doe',
      headline: 'AI Engineer at OpenAI',
      location: 'San Francisco, CA',
    },
  ];

  const parsedQuery = {
    count: 5,
    role: 'AI Engineer',
    location: 'San Francisco',
    countryCode: 'US',
    keywords: [],
    googleQuery: 'site:linkedin.com/in "AI Engineer" "San Francisco"',
  };

  console.log('1. Cache search results');
  await cacheSearchResults(testQuery, parsedQuery, testResults);

  console.log('\n2. Retrieve cached results');
  const cached = await getCachedSearchResults(testQuery);
  console.log('  Found:', cached?.count, 'results');
  console.log('  Query:', cached?.query);
  console.log('  Cached:', !!cached);

  console.log('\n✅ Search cache test passed!');

  await redis.quit();
}

testSearchCache().catch(console.error);
```

**Files to Create:**
- `src/tests/test-redis-cache.ts`
- `src/tests/test-search-cache.ts`

**Deliverables:**
- Comprehensive Redis cache tests
- Search cache validation

**Run Tests:**
```bash
npx tsx src/tests/test-redis-cache.ts
npx tsx src/tests/test-search-cache.ts
```

---

#### Task 7.2: Add Cache Monitoring Dashboard
**Priority:** Low
**Estimated Time:** 2 hours
**Depends On:** Task 1.4

**Steps:**
1. Create admin API: `src/app/api/admin/cache/stats/route.ts`

```typescript
import { NextResponse } from 'next/server';
import redis from '@/lib/redis/client';
import { getRedisInfo } from '@/lib/redis/health';

export async function GET() {
  try {
    const info = await getRedisInfo();

    // Get key counts by prefix
    const searchKeys = await redis.keys('search:*');
    const profileKeys = await redis.keys('profile:*');
    const googleKeys = await redis.keys('google:*');

    const stats = {
      redis: {
        version: info.redis_version,
        uptime: info.uptime_in_seconds,
        memory: {
          used: info.used_memory_human,
          peak: info.used_memory_peak_human,
          rss: info.used_memory_rss_human,
        },
        clients: info.connected_clients,
        hits: info.keyspace_hits,
        misses: info.keyspace_misses,
        hitRate:
          parseInt(info.keyspace_hits || '0') /
          (parseInt(info.keyspace_hits || '0') +
            parseInt(info.keyspace_misses || '1')),
      },
      keys: {
        total: parseInt(info.db0?.split('keys=')[1]?.split(',')[0] || '0'),
        searches: searchKeys.length,
        profiles: profileKeys.length,
        google: googleKeys.length,
      },
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[Cache Stats] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get cache stats' },
      { status: 500 }
    );
  }
}
```

2. Create cache clear endpoint: `src/app/api/admin/cache/clear/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { deleteCachePattern } from '@/lib/redis/cache';

export async function POST(request: Request) {
  try {
    const { pattern } = await request.json();

    if (!pattern) {
      return NextResponse.json(
        { error: 'Pattern is required' },
        { status: 400 }
      );
    }

    const deleted = await deleteCachePattern(pattern);

    return NextResponse.json({
      success: true,
      deleted,
      pattern,
    });
  } catch (error) {
    console.error('[Cache Clear] Error:', error);
    return NextResponse.json(
      { error: 'Failed to clear cache' },
      { status: 500 }
    );
  }
}
```

**Files to Create:**
- `src/app/api/admin/cache/stats/route.ts`
- `src/app/api/admin/cache/clear/route.ts`

**Deliverables:**
- Cache statistics API
- Cache clearing utility

---

#### Task 7.3: Performance Testing & Benchmarking
**Priority:** Medium
**Estimated Time:** 1.5 hours
**Depends On:** Phase 6 complete

**Steps:**
1. Create benchmark script: `src/tests/benchmark-cache.ts`

```typescript
import { performance } from 'perf_hooks';
import redis from '../lib/redis/client';
import { setCache, getCache } from '../lib/redis/cache';

async function benchmark() {
  console.log('=== Cache Performance Benchmark ===\n');

  const iterations = 1000;
  const testData = {
    name: 'Test User',
    email: 'test@example.com',
    data: Array(100).fill('test'),
  };

  // Write benchmark
  console.log(`1. Write Benchmark (${iterations} operations)`);
  const writeStart = performance.now();

  for (let i = 0; i < iterations; i++) {
    await setCache(`benchmark:${i}`, testData, 3600);
  }

  const writeEnd = performance.now();
  const writeTime = writeEnd - writeStart;
  console.log(`  Total: ${writeTime.toFixed(2)}ms`);
  console.log(`  Average: ${(writeTime / iterations).toFixed(2)}ms per operation`);
  console.log(`  Throughput: ${(iterations / (writeTime / 1000)).toFixed(0)} ops/sec`);

  // Read benchmark
  console.log(`\n2. Read Benchmark (${iterations} operations)`);
  const readStart = performance.now();

  for (let i = 0; i < iterations; i++) {
    await getCache(`benchmark:${i}`);
  }

  const readEnd = performance.now();
  const readTime = readEnd - readStart;
  console.log(`  Total: ${readTime.toFixed(2)}ms`);
  console.log(`  Average: ${(readTime / iterations).toFixed(2)}ms per operation`);
  console.log(`  Throughput: ${(iterations / (readTime / 1000)).toFixed(0)} ops/sec`);

  // Cleanup
  console.log('\n3. Cleanup');
  for (let i = 0; i < iterations; i++) {
    await redis.del(`benchmark:${i}`);
  }

  console.log('\n✅ Benchmark complete!');
  await redis.quit();
}

benchmark().catch(console.error);
```

**Files to Create:**
- `src/tests/benchmark-cache.ts`

**Deliverables:**
- Performance benchmark script
- Metrics for optimization

**Run Benchmark:**
```bash
npx tsx src/tests/benchmark-cache.ts
```

---

### Phase 8: Documentation & Deployment

#### Task 8.1: Update PROJECT.MD Documentation
**Priority:** High
**Estimated Time:** 1 hour
**Depends On:** Phase 7 complete

**Steps:**
1. Update `docs/PROJECT.MD` sections:
   - Add Redis Cloud to Technology Stack
   - Update Architecture & Data Flow with Redis layer
   - Document new API endpoints
   - Add caching strategy section
   - Update environment variables

2. Add Redis troubleshooting section

3. Update deployment instructions

**Files to Modify:**
- `docs/PROJECT.MD`

**Deliverables:**
- Updated comprehensive documentation

---

#### Task 8.2: Create Redis Setup Guide
**Priority:** High
**Estimated Time:** 45 minutes
**Depends On:** None

**Steps:**
1. Create `docs/REDIS_SETUP.MD`:

```markdown
# Redis Cloud Setup Guide

## Step 1: Create Redis Cloud Account

1. Go to https://redis.com/try-free/
2. Sign up with email or GitHub
3. Verify your email

## Step 2: Create Database

1. Click "New Database"
2. Configure:
   - **Name:** pepolehub-cache
   - **Cloud Provider:** AWS
   - **Region:** us-east-1 (match Supabase)
   - **Type:**
     - Free: 30MB (good for testing)
     - Basic: 1GB (recommended for production)
   - **Eviction Policy:** allkeys-lru
   - **Data Persistence:** AOF (optional)

3. Click "Create Database"

## Step 3: Get Connection Details

1. Click on your database
2. Copy:
   - **Endpoint:** redis-xxxxx.c123.us-east-1-1.ec2.cloud.redislabs.com:xxxxx
   - **Password:** (click "Show" to reveal)

3. Parse endpoint:
   - **Host:** redis-xxxxx.c123.us-east-1-1.ec2.cloud.redislabs.com
   - **Port:** xxxxx

## Step 4: Configure Environment

Add to `.env.local`:

```env
REDIS_HOST="redis-xxxxx.c123.us-east-1-1.ec2.cloud.redislabs.com"
REDIS_PORT="xxxxx"
REDIS_PASSWORD="your_password_here"
REDIS_TLS_ENABLED="true"
```

## Step 5: Test Connection

```bash
npx tsx src/tests/test-redis-cache.ts
```

## Troubleshooting

### Connection Timeout
- Check firewall settings
- Verify TLS is enabled
- Check Redis Cloud status page

### Authentication Failed
- Double-check password
- Ensure no trailing spaces in .env

### High Memory Usage
- Check eviction policy
- Monitor key expiration
- Use cache stats API: `GET /api/admin/cache/stats`

## Monitoring

### Redis Cloud Dashboard
- Real-time metrics
- Memory usage graphs
- Operations per second
- Hit/miss ratio

### Application Monitoring
```bash
curl http://localhost:3000/api/admin/cache/stats
```

## Best Practices

1. **Always Set TTL:** Never store data without expiration
2. **Use Namespaces:** Prefix keys for organization
3. **Monitor Memory:** Stay under 80% of limit
4. **Plan for Failures:** Application should work if Redis is down
5. **Secure Credentials:** Never commit passwords to git
```

**Files to Create:**
- `docs/REDIS_SETUP.MD`

**Deliverables:**
- Step-by-step Redis setup guide

---

#### Task 8.3: Deploy to Production
**Priority:** High
**Estimated Time:** 1 hour
**Depends On:** All previous tasks

**Steps:**
1. Set Vercel environment variables:
   - REDIS_HOST
   - REDIS_PORT
   - REDIS_PASSWORD
   - REDIS_TLS_ENABLED

2. Deploy to Vercel:
```bash
vercel deploy --prod
```

3. Test production endpoints:
   - POST /api/search (should use Redis cache)
   - GET /api/profile/[linkedinId]
   - GET /api/admin/cache/stats

4. Monitor logs for Redis connections

**Deliverables:**
- Production deployment with Redis
- Verified caching functionality

---

## Task Checklist Summary

### Phase 1: Redis Setup (5 tasks)
- [ ] Task 1.1: Setup Redis Cloud Account
- [ ] Task 1.2: Install Redis Dependencies
- [ ] Task 1.3: Configure Environment Variables
- [ ] Task 1.4: Create Redis Client Singleton
- [ ] Task 1.5: Create Redis Cache Utility Layer

### Phase 2: Data Types (2 tasks)
- [ ] Task 2.1: Define Profile Summary Types
- [ ] Task 2.2: Update Bright Data Search to Return Summaries

### Phase 3: Redis Integration (2 tasks)
- [ ] Task 3.1: Create Search Results Cache Layer
- [ ] Task 3.2: Create Profile Cache Layer

### Phase 4: Search API Update (1 task)
- [ ] Task 4.1: Modify Search API to Return Summaries First

### Phase 5: Profile Fetch API (2 tasks)
- [ ] Task 5.1: Create Individual Profile Fetch API
- [ ] Task 5.2: Create Batch Profile Fetch API

### Phase 6: Frontend (2 tasks)
- [ ] Task 6.1: Update Search Results Page UI
- [ ] Task 6.2: Create Profile Summary Card Component

### Phase 7: Testing (3 tasks)
- [ ] Task 7.1: Create Redis Cache Tests
- [ ] Task 7.2: Add Cache Monitoring Dashboard
- [ ] Task 7.3: Performance Testing & Benchmarking

### Phase 8: Documentation (3 tasks)
- [ ] Task 8.1: Update PROJECT.MD Documentation
- [ ] Task 8.2: Create Redis Setup Guide
- [ ] Task 8.3: Deploy to Production

---

## Total Effort Estimate

| Phase | Tasks | Estimated Time |
|-------|-------|----------------|
| Phase 1 | 5 | 4.5 hours |
| Phase 2 | 2 | 1.5 hours |
| Phase 3 | 2 | 3.5 hours |
| Phase 4 | 1 | 2 hours |
| Phase 5 | 2 | 3.5 hours |
| Phase 6 | 2 | 3.5 hours |
| Phase 7 | 3 | 4.5 hours |
| Phase 8 | 3 | 2.75 hours |
| **Total** | **20 tasks** | **~25.75 hours** |

---

## Implementation Order

### Week 1: Infrastructure
1. Complete Phase 1 (Redis Setup)
2. Complete Phase 2 (Data Types)
3. Complete Phase 3 (Redis Integration)
4. Test cache utilities

### Week 2: Backend APIs
1. Complete Phase 4 (Search API)
2. Complete Phase 5 (Profile APIs)
3. Test API endpoints

### Week 3: Frontend & Testing
1. Complete Phase 6 (Frontend)
2. Complete Phase 7 (Testing)
3. Performance optimization

### Week 4: Documentation & Deployment
1. Complete Phase 8 (Documentation)
2. Production deployment
3. Monitoring and iteration

---

## Success Metrics

### Performance
- [ ] Search results < 200ms (90th percentile)
- [ ] Profile fetch < 500ms (90th percentile)
- [ ] Redis cache hit rate > 70%
- [ ] Bright Data API calls reduced by 50%

### User Experience
- [ ] Instant search results display
- [ ] Smooth expand/collapse interactions
- [ ] Clear loading states
- [ ] Error handling graceful

### Technical
- [ ] Zero Redis connection failures
- [ ] < 80% Redis memory usage
- [ ] All tests passing
- [ ] Documentation complete

---

## Risk Mitigation

### Redis Connection Failures
**Risk:** Redis Cloud downtime or connection issues
**Mitigation:** Graceful fallback to PostgreSQL if Redis unavailable

### Memory Limits
**Risk:** Redis cache fills up on free tier
**Mitigation:**
- Use `allkeys-lru` eviction policy
- Monitor usage with admin dashboard
- Upgrade to paid tier if needed

### Data Consistency
**Risk:** Redis and PostgreSQL out of sync
**Mitigation:**
- Redis is always secondary cache
- PostgreSQL remains source of truth
- TTLs ensure eventual consistency

---

## Next Steps After Completion

1. **Analytics Integration**
   - Track cache hit rates
   - Monitor API response times
   - User engagement metrics

2. **Advanced Features**
   - Prefetch profiles on hover
   - Background cache warming
   - Smart cache eviction

3. **Optimization**
   - Profile compression
   - CDN for images
   - Database query optimization

---

**Last Updated:** 2025-10-25
**Status:** Ready for Implementation
**Owner:** Development Team
