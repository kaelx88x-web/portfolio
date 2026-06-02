/**
 * In-memory TTL + single-flight cache wrapper for any async fetch. Used to
 * throttle heavy moomoo bridge calls against OpenD frequency limits, but the
 * wrapper itself is generic. Per-process, matching src/lib/server/rate-limit.ts.
 * The `now` param is injectable for tests.
 *
 * Keys are expected to be a BOUNDED set (e.g. `fn:moomooCode:args`) — entries are
 * only evicted by a later fetch of the same key, so unbounded dynamic keys would
 * grow `store` without limit.
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
  // force (e.g. a manual UI refresh) intentionally bypasses both the cached
  // value and any in-flight request, always starting a fresh fetch. A normal
  // call already in flight still resolves from its own captured promise.
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
