// src/lib/server/redis.ts
import Redis from 'ioredis';

let _client: Redis | null = null;

export function getRedis(): Redis {
  if (!_client) {
    _client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null, // required by BullMQ
      lazyConnect: false,
    });
    _client.on('error', (err) => {
      console.error('[Redis] connection error:', err.message);
    });
    _client.on('connect', () => {
      console.log('[Redis] connected');
    });
  }
  return _client;
}

export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const r = getRedis();
  if (typeof ttlSeconds === 'number' && ttlSeconds > 0) {
    await r.setex(key, ttlSeconds, value);
  } else {
    await r.set(key, value);
  }
}

export async function closeRedis(): Promise<void> {
  if (_client) {
    await _client.quit();
    _client = null;
  }
}

export async function redisGet(key: string): Promise<string | null> {
  return getRedis().get(key);
}

export async function redisDel(key: string): Promise<void> {
  await getRedis().del(key);
}
