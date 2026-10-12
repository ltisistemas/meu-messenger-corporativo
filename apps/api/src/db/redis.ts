import Redis from 'ioredis';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

export function createRedisClient(): Redis {
  const client = new Redis(REDIS_URL, {
    maxRetriesPerRequest: 3,
    enableReadyCheck: false,
    retryStrategy: (times) => {
      // Exponential backoff with 2s ceiling
      return Math.min(times * 100, 2000);
    },
    lazyConnect: true,
  });

  client.on('error', (err) => {
    // Avoid unhandled rejection crash if redis is offline during isolated unit tests
    if (process.env.NODE_ENV !== 'test') {
      console.warn(`[Redis Connection Error]: ${err.message}`);
    }
  });

  return client;
}

export const redis = createRedisClient();
