import 'dotenv/config';
import redis from '../lib/redis/client';
import { CachePrefix, CacheTTL, batchGetCache, deleteCache, deleteCachePattern, existsCache, getCache, getCacheKey, getTTL, incrementCounter, setCache } from '../lib/redis/cache';
import { checkRedisHealth } from '../lib/redis/health';

async function testRedis() {
  console.log('Testing Redis connection...');

  const isHealthy = await checkRedisHealth();
  console.log('Health check:', isHealthy);

  const cacheKey = getCacheKey(CachePrefix.SEARCH_RESULTS, 'demo');
  const cachePayload = { message: 'Hello Redis!', timestamp: Date.now() };

  await setCache(cacheKey, cachePayload, CacheTTL.SEARCH_RESULTS);
  const cachedValue = await getCache<typeof cachePayload>(cacheKey);
  console.log('Cache round-trip success:', JSON.stringify(cachedValue) === JSON.stringify(cachePayload));

  const exists = await existsCache(cacheKey);
  console.log('Cache exists:', exists);

  const ttl = await getTTL(cacheKey);
  console.log('Cache TTL (seconds):', ttl);

  const secondaryKey = getCacheKey(CachePrefix.SEARCH_RESULTS, 'demo-2');
  await setCache(secondaryKey, { idx: 2 }, CacheTTL.SEARCH_RESULTS);

  const batchValues = await batchGetCache<Record<string, unknown>>([cacheKey, secondaryKey]);
  console.log('Batch fetch result:', batchValues);

  const counterKey = getCacheKey('counter', 'demo');
  const counterValue = await incrementCounter(counterKey, 30);
  console.log('Counter value:', counterValue);

  const deletedCount = await deleteCachePattern(`${CachePrefix.SEARCH_RESULTS}:demo*`);
  console.log('Deleted keys via pattern:', deletedCount);

  const counterDeleted = await deleteCache(counterKey);
  console.log('Counter deleted:', counterDeleted);
}

testRedis()
  .catch((error) => {
    console.error('[Redis Test] Encountered error:', error);
  })
  .finally(async () => {
    await redis.quit();
  });
