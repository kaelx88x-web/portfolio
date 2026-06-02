/**
 * In-memory TTL + single-flight cache for heavy moomoo bridge calls (candles,
 * capital flow, basic info). Protects against OpenD frequency limits. Per-process,
 * matching src/lib/server/rate-limit.ts. The `now` param is injectable for tests.
 */
type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export type CacheOpts = { force?: boolean };

export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  opts: CacheOpts = {},
  now: number = Date.now()
): Promise<T> {
  if (!opts.force) {
    const hit = store.get(key);
    if (hit && hit.expires > now) return hit.value as T;
    const flight = inflight.get(key);
    if (flight) return flight as Promise<T>;
  }

  const p = (async () => {
    const value = await fn();
    store.set(key, { value, expires: now + ttlMs });
    return value;
  })();

  inflight.set(key, p);
  try {
    return (await p) as T;
  } finally {
    inflight.delete(key);
  }
}

export function clearQuoteCache(key?: string): void {
  if (key === undefined) {
    store.clear();
    inflight.clear();
  } else {
    store.delete(key);
    inflight.delete(key);
  }
}
