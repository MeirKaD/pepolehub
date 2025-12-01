import redis from './client';

export async function checkRedisHealth(): Promise<boolean> {
  if (!redis) return false;
  try {
    const result = await redis.ping();
    return result === 'PONG';
  } catch (error) {
    console.error('[Redis Health] Health check failed:', error);
    return false;
  }
}

export async function getRedisInfo(): Promise<Record<string, string>> {
  if (!redis) return {};
  try {
    const info = await redis.info();
    const lines = info.split('\r\n');
    const parsed: Record<string, string> = {};

    for (const line of lines) {
      if (line && !line.startsWith('#')) {
        const [key, value] = line.split(':');
        if (key && value) {
          parsed[key] = value;
        }
      }
    }

    return parsed;
  } catch (error) {
    console.error('[Redis Health] Failed to get info:', error);
    return {};
  }
}
