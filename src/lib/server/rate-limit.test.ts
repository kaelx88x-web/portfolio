/**
 * rate-limit tests (audit §14) — sliding-window correctness with an injected
 * clock, so no real timers are involved.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { rateLimit, resetRateLimit } from './rate-limit';

const KEY = 'trade-ticket:user-1';
const OPTS = { limit: 3, windowMs: 60_000 };

beforeEach(() => resetRateLimit());

describe('rateLimit', () => {
  it('allows up to the limit within the window', () => {
    const t = 1_000_000;
    expect(rateLimit(KEY, OPTS, t).allowed).toBe(true);
    expect(rateLimit(KEY, OPTS, t + 1).allowed).toBe(true);
    expect(rateLimit(KEY, OPTS, t + 2).allowed).toBe(true);
  });

  it('blocks the call that exceeds the limit', () => {
    const t = 2_000_000;
    rateLimit(KEY, OPTS, t);
    rateLimit(KEY, OPTS, t + 1);
    rateLimit(KEY, OPTS, t + 2);
    const blocked = rateLimit(KEY, OPTS, t + 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.remaining).toBe(0);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it('reports retryAfter that elapses exactly at the window edge', () => {
    const t = 3_000_000;
    rateLimit(KEY, OPTS, t); // first hit at t
    rateLimit(KEY, OPTS, t + 10);
    rateLimit(KEY, OPTS, t + 20);
    const blocked = rateLimit(KEY, OPTS, t + 30);
    // oldest hit (t) frees up at t + windowMs.
    expect(blocked.retryAfterMs).toBe(t + OPTS.windowMs - (t + 30));
  });

  it('recovers once the window slides past old hits', () => {
    const t = 4_000_000;
    rateLimit(KEY, OPTS, t);
    rateLimit(KEY, OPTS, t + 1);
    rateLimit(KEY, OPTS, t + 2);
    expect(rateLimit(KEY, OPTS, t + 3).allowed).toBe(false);
    // Move beyond the window — all three old hits expire.
    expect(rateLimit(KEY, OPTS, t + OPTS.windowMs + 1).allowed).toBe(true);
  });

  it('isolates limits per key (per user/action)', () => {
    const t = 5_000_000;
    rateLimit('a:user-1', OPTS, t);
    rateLimit('a:user-1', OPTS, t + 1);
    rateLimit('a:user-1', OPTS, t + 2);
    expect(rateLimit('a:user-1', OPTS, t + 3).allowed).toBe(false);
    // A different user is unaffected.
    expect(rateLimit('a:user-2', OPTS, t + 3).allowed).toBe(true);
  });

  it('counts remaining correctly', () => {
    const t = 6_000_000;
    expect(rateLimit(KEY, OPTS, t).remaining).toBe(2);
    expect(rateLimit(KEY, OPTS, t + 1).remaining).toBe(1);
    expect(rateLimit(KEY, OPTS, t + 2).remaining).toBe(0);
  });
});
