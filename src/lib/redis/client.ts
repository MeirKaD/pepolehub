import Redis from 'ioredis';

type RedisGlobal = {
  redis: Redis | undefined;
  redisListenersRegistered?: boolean;
  redisCleanupRegistered?: boolean;
};

const globalForRedis = globalThis as unknown as RedisGlobal;

const requiredVars = ['REDIS_HOST', 'REDIS_PORT', 'REDIS_PASSWORD'] as const;
const missingVars = requiredVars.filter((key) => !process.env[key]);

if (missingVars.length > 0) {
  throw new Error(
    `[Redis] Missing required environment variables: ${missingVars.join(
      ', ',
    )}. Please set them in your environment before initializing the Redis client.`,
  );
}

const redisInstance =
  globalForRedis.redis ??
  new Redis({
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
  });

if (!globalForRedis.redisListenersRegistered) {
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

if (!globalForRedis.redisCleanupRegistered) {
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

if (process.env.NODE_ENV !== 'production') {
  globalForRedis.redis = redisInstance;
}

export const redis = redisInstance;
export default redis;
