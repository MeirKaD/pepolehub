import Redis from 'ioredis';

type RedisGlobal = {
  redis: Redis | undefined;
  redisListenersRegistered?: boolean;
  redisCleanupRegistered?: boolean;
};

const globalForRedis = globalThis as unknown as RedisGlobal;

// Check if Redis credentials are provided
const hasRedisCredentials =
  process.env.REDIS_HOST && process.env.REDIS_PORT && process.env.REDIS_PASSWORD;

if (!hasRedisCredentials) {
  console.warn('[Redis] Missing Redis credentials. Redis cache will be disabled.');
}

const redisInstance =
  globalForRedis.redis ??
  (hasRedisCredentials
    ? new Redis({
        host: process.env.REDIS_HOST,
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
        password: process.env.REDIS_PASSWORD,
        tls: process.env.REDIS_TLS_ENABLED === 'true' ? {} : undefined,
        maxRetriesPerRequest: 3,
        retryStrategy(times) {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        reconnectOnError(err) {
          const targetErrors = ['READONLY', 'ECONNRESET'];
          if (targetErrors.some((code) => err.message.includes(code))) {
            return true;
          }
          return false;
        },
        lazyConnect: false,
        enableReadyCheck: true,
        showFriendlyErrorStack: process.env.NODE_ENV === 'development',
      })
    : null);

if (redisInstance && !globalForRedis.redisListenersRegistered) {
  redisInstance.on('connect', () => {
    console.log('[Redis] Connected to Redis Cloud');
  });

  redisInstance.on('ready', () => {
    console.log('[Redis] Redis client ready');
  });

  redisInstance.on('error', (err) => {
    console.error('[Redis] Redis error:', err);
  });

  redisInstance.on('close', () => {
    console.warn('[Redis] Redis connection closed');
  });

  redisInstance.on('reconnecting', () => {
    console.log('[Redis] Reconnecting to Redis...');
  });

  globalForRedis.redisListenersRegistered = true;
}

if (redisInstance && !globalForRedis.redisCleanupRegistered) {
  process.on('SIGTERM', async () => {
    console.log('[Redis] SIGTERM received, closing Redis connection');
    try {
      await redisInstance.quit();
    } catch (error) {
      console.error('[Redis] Error closing connection on SIGTERM:', error);
    }
  });

  globalForRedis.redisCleanupRegistered = true;
}

if (process.env.NODE_ENV !== 'production' && redisInstance) {
  globalForRedis.redis = redisInstance;
}

export const redis = redisInstance;
export default redis;
