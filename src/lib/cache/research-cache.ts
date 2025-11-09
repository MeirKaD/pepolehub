import { prisma } from '@/lib/prisma';
import { Prisma } from '@prisma/client';
import {
  CachePrefix,
  CacheTTL,
  getCache,
  getCacheKey,
  setCache,
  deleteCache,
} from '@/lib/redis/cache';

const RESEARCH_CACHE_FRESHNESS_HOURS = 24; // Research reports are fresh for 24 hours

export type ResearchStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface ResearchRecord {
  id: string;
  personId: string | null;
  linkedinUrl: string;
  personName: string;
  report: string;
  sources: Array<{ url: string; summary: string }>;
  metadata: Record<string, unknown> | null;
  status: ResearchStatus;
  errorMessage: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CachedResearch {
  id: string;
  personName: string;
  linkedinUrl: string;
  report: string;
  sources: Array<{ url: string; summary: string }>;
  status: ResearchStatus;
  createdAt: Date;
  updatedAt: Date;
  cachedAt: number;
  source: 'redis' | 'postgres';
}

/**
 * Get cached research by LinkedIn URL
 * Checks Redis first, then PostgreSQL
 */
export async function getCachedResearch(
  linkedinUrl: string
): Promise<CachedResearch | null> {
  const normalizedUrl = normalizeLinkedInUrl(linkedinUrl);
  if (!normalizedUrl) {
    console.log('[Research Cache] Invalid LinkedIn URL:', linkedinUrl);
    return null;
  }

  // Check Redis first
  const redisKey = getResearchCacheKey(normalizedUrl);
  const redisData = await getCache<CachedResearch>(redisKey);
  if (redisData) {
    console.log('[Research Cache] HIT (Redis) for:', normalizedUrl);
    return {
      ...redisData,
      cachedAt: Date.now(),
      source: 'redis',
    };
  }

  // Check PostgreSQL
  try {
    const research = await prisma.research.findFirst({
      where: {
        linkedinUrl: normalizedUrl,
        status: 'completed', // Only return completed research
      },
      orderBy: {
        createdAt: 'desc', // Get most recent
      },
    });

    if (!research) {
      console.log('[Research Cache] MISS for:', normalizedUrl);
      return null;
    }

    // Check if research is fresh (< 24 hours old)
    const hoursSinceUpdate = Math.floor(
      (Date.now() - research.updatedAt.getTime()) / (1000 * 60 * 60)
    );

    if (hoursSinceUpdate >= RESEARCH_CACHE_FRESHNESS_HOURS) {
      console.log(
        `[Research Cache] Research for ${normalizedUrl} is stale (${hoursSinceUpdate} hours old)`
      );
      return null;
    }

    console.log(
      `[Research Cache] HIT (PostgreSQL) for ${normalizedUrl} (${hoursSinceUpdate}h old)`
    );

    const cached: CachedResearch = {
      id: research.id,
      personName: research.personName,
      linkedinUrl: research.linkedinUrl,
      report: research.report,
      sources: research.sources as Array<{ url: string; summary: string }>,
      status: research.status as ResearchStatus,
      createdAt: research.createdAt,
      updatedAt: research.updatedAt,
      cachedAt: Date.now(),
      source: 'postgres',
    };

    // Backfill Redis cache
    try {
      await cacheResearchInRedis(cached);
    } catch (cacheError) {
      console.error('[Research Cache] Failed to backfill Redis:', cacheError);
    }

    return cached;
  } catch (error) {
    console.error('[Research Cache] Error fetching from PostgreSQL:', error);
    return null;
  }
}

/**
 * Create a new research record with 'pending' status
 */
export async function createResearchRecord(
  linkedinUrl: string,
  personName: string,
  personId?: string
): Promise<ResearchRecord> {
  const normalizedUrl = normalizeLinkedInUrl(linkedinUrl);
  if (!normalizedUrl) {
    throw new Error('Invalid LinkedIn URL');
  }

  try {
    const research = await prisma.research.create({
      data: {
        linkedinUrl: normalizedUrl,
        personName,
        personId: personId || null,
        report: '',
        sources: [],
        metadata: {
          startedAt: new Date().toISOString(),
        },
        status: 'pending',
      },
    });

    console.log('[Research Cache] Created research record:', research.id);

    return transformResearchRecord(research);
  } catch (error) {
    console.error('[Research Cache] Error creating research record:', error);
    throw new Error(
      `Failed to create research record: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`
    );
  }
}

/**
 * Update research status
 */
export async function updateResearchStatus(
  id: string,
  status: ResearchStatus,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const updateData: Prisma.ResearchUpdateInput = {
      status,
      updatedAt: new Date(),
    };

    if (metadata) {
      // Merge with existing metadata
      const existing = await prisma.research.findUnique({
        where: { id },
        select: { metadata: true },
      });

      updateData.metadata = {
        ...(existing?.metadata as Record<string, unknown> || {}),
        ...metadata,
      } as Prisma.InputJsonValue;
    }

    await prisma.research.update({
      where: { id },
      data: updateData,
    });

    console.log(`[Research Cache] Updated research ${id} status to:`, status);
  } catch (error) {
    console.error('[Research Cache] Error updating status:', error);
    throw new Error(`Failed to update research status: ${error}`);
  }
}

/**
 * Save completed research report
 */
export async function saveResearchReport(
  id: string,
  report: string,
  sources: Array<{ url: string; summary: string }>,
  metadata?: Record<string, unknown>
): Promise<CachedResearch> {
  try {
    const updateData: Prisma.ResearchUpdateInput = {
      report,
      sources: sources as Prisma.InputJsonValue,
      status: 'completed',
      updatedAt: new Date(),
    };

    if (metadata) {
      const existing = await prisma.research.findUnique({
        where: { id },
        select: { metadata: true },
      });

      updateData.metadata = {
        ...(existing?.metadata as Record<string, unknown> || {}),
        ...metadata,
        completedAt: new Date().toISOString(),
      } as Prisma.InputJsonValue;
    }

    const research = await prisma.research.update({
      where: { id },
      data: updateData,
    });

    console.log(`[Research Cache] Saved research report:`, id);

    const cached: CachedResearch = {
      id: research.id,
      personName: research.personName,
      linkedinUrl: research.linkedinUrl,
      report: research.report,
      sources: research.sources as Array<{ url: string; summary: string }>,
      status: research.status as ResearchStatus,
      createdAt: research.createdAt,
      updatedAt: research.updatedAt,
      cachedAt: Date.now(),
      source: 'postgres',
    };

    // Cache in Redis
    try {
      await cacheResearchInRedis(cached);
    } catch (cacheError) {
      console.error('[Research Cache] Failed to cache in Redis:', cacheError);
    }

    return cached;
  } catch (error) {
    console.error('[Research Cache] Error saving research report:', error);
    throw new Error(`Failed to save research report: ${error}`);
  }
}

/**
 * Mark research as failed
 */
export async function markResearchFailed(
  id: string,
  errorMessage: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const updateData: Prisma.ResearchUpdateInput = {
      status: 'failed',
      errorMessage,
      updatedAt: new Date(),
    };

    if (metadata) {
      const existing = await prisma.research.findUnique({
        where: { id },
        select: { metadata: true },
      });

      updateData.metadata = {
        ...(existing?.metadata as Record<string, unknown> || {}),
        ...metadata,
        failedAt: new Date().toISOString(),
      } as Prisma.InputJsonValue;
    }

    await prisma.research.update({
      where: { id },
      data: updateData,
    });

    console.log(`[Research Cache] Marked research ${id} as failed:`, errorMessage);
  } catch (error) {
    console.error('[Research Cache] Error marking research as failed:', error);
    throw new Error(`Failed to mark research as failed: ${error}`);
  }
}

/**
 * Get research by ID
 */
export async function getResearchById(id: string): Promise<ResearchRecord | null> {
  try {
    const research = await prisma.research.findUnique({
      where: { id },
    });

    if (!research) {
      return null;
    }

    return transformResearchRecord(research);
  } catch (error) {
    console.error('[Research Cache] Error fetching research by ID:', error);
    return null;
  }
}

/**
 * List recent research reports
 */
export async function listRecentResearch(
  limit: number = 20,
  offset: number = 0,
  status?: ResearchStatus
): Promise<ResearchRecord[]> {
  try {
    const where: Prisma.ResearchWhereInput = status ? { status } : {};

    const researches = await prisma.research.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      skip: offset,
    });

    return researches.map(transformResearchRecord);
  } catch (error) {
    console.error('[Research Cache] Error listing research:', error);
    return [];
  }
}

/**
 * Cache research in Redis
 */
async function cacheResearchInRedis(research: CachedResearch): Promise<void> {
  const key = getResearchCacheKey(research.linkedinUrl);
  await setCache(key, research, CacheTTL.PROFILE_FULL); // 24 hours
  console.log('[Research Cache] Cached in Redis:', research.linkedinUrl);
}

/**
 * Invalidate research cache
 */
export async function invalidateResearchCache(linkedinUrl: string): Promise<void> {
  const normalizedUrl = normalizeLinkedInUrl(linkedinUrl);
  if (!normalizedUrl) return;

  const key = getResearchCacheKey(normalizedUrl);
  await deleteCache(key);
  console.log('[Research Cache] Invalidated cache for:', normalizedUrl);
}

/**
 * Get Redis cache key for research
 */
function getResearchCacheKey(linkedinUrl: string): string {
  return getCacheKey(CachePrefix.PROFILE_FULL, `research:${linkedinUrl}`);
}

/**
 * Normalize LinkedIn URL
 */
function normalizeLinkedInUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    // Normalize to https://www.linkedin.com/in/username format
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (pathParts[0] === 'in' && pathParts[1]) {
      return `https://www.linkedin.com/in/${pathParts[1]}`;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Transform Prisma research record to ResearchRecord type
 */
function transformResearchRecord(
  research: {
    id: string;
    personId: string | null;
    linkedinUrl: string;
    personName: string;
    report: string;
    sources: Prisma.JsonValue;
    metadata: Prisma.JsonValue;
    status: string;
    errorMessage: string | null;
    createdAt: Date;
    updatedAt: Date;
  }
): ResearchRecord {
  return {
    id: research.id,
    personId: research.personId,
    linkedinUrl: research.linkedinUrl,
    personName: research.personName,
    report: research.report,
    sources: research.sources as Array<{ url: string; summary: string }>,
    metadata: research.metadata as Record<string, unknown> | null,
    status: research.status as ResearchStatus,
    errorMessage: research.errorMessage,
    createdAt: research.createdAt,
    updatedAt: research.updatedAt,
  };
}
