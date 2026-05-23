// workers/connection.ts
// Redis connection options for BullMQ workers.
// Workers run outside SvelteKit — must use process.env directly, no $env.
import 'dotenv/config';
import type { ConnectionOptions } from 'bullmq';

export function getWorkerConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379', 10),
      username: parsed.username || undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      db: parsed.pathname && parsed.pathname.length > 1
        ? parseInt(parsed.pathname.slice(1), 10)
        : 0,
      ...(parsed.protocol === 'rediss:' ? { tls: {} } : {}),
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}
