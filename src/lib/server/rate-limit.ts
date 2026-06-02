/**
 * In-memory sliding-window rate limiter (audit §14).
 *
 * Keyed per user+action, this caps how often a sensitive endpoint (trade-ticket
 * creation, execution confirmation) can be hit in a rolling window — a real
 * per-endpoint limiter, distinct from the daily ticket cap. Pure and clock-
 * injectable so it is unit-testable without timers.
 *
 * NOTE: state is per-process. For a multi-node deployment, back this with Redis
 * (the same window algorithm) so the limit is shared across instances.
 */

const buckets = new Map<string, number[]>();

export type RateLimitOptions = {
  /** Max allowed hits within the window. */
  limit: number;
  /** Rolling window length in milliseconds. */
  windowMs: number;
};

export type RateLimitResult = {
  allowed: boolean;
  /** Remaining hits in the current window (0 when blocked). */
  remaining: number;
  /** Milliseconds until the next hit would be allowed (0 when allowed). */
  retryAfterMs: number;
  limit: number;
};

/**
 * Record an attempt for `key` and decide whether it is allowed. Timestamps
 * older than the window are evicted on each call, so memory is bounded by the
 * number of distinct active keys × limit.
 */
export function rateLimit(key: string, opts: RateLimitOptions, now: number = Date.now()): RateLimitResult {
  const { limit, windowMs } = opts;
  const cutoff = now - windowMs;
  const recent = (buckets.get(key) ?? []).filter((t) => t > cutoff);

  if (recent.length >= limit) {
    buckets.set(key, recent);
    const retryAfterMs = Math.max(0, recent[0] + windowMs - now);
    return { allowed: false, remaining: 0, retryAfterMs, limit };
  }

  recent.push(now);
  buckets.set(key, recent);
  return { allowed: true, remaining: Math.max(0, limit - recent.length), retryAfterMs: 0, limit };
}

/** Clear one key (or all) — used by tests and admin reset paths. */
export function resetRateLimit(key?: string): void {
  if (key === undefined) buckets.clear();
  else buckets.delete(key);
}
