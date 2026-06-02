import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cached, clearQuoteCache } from './quote-cache';

beforeEach(() => clearQuoteCache());

describe('cached', () => {
  it('returns the fn result and caches within TTL', async () => {
    const fn = vi.fn().mockResolvedValue(1);
    expect(await cached('k', 1000, fn, undefined, 1000)).toBe(1);
    expect(await cached('k', 1000, fn, undefined, 1500)).toBe(1); // within TTL
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('refetches after TTL expires', async () => {
    const fn = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    expect(await cached('k', 1000, fn, undefined, 1000)).toBe(1);
    expect(await cached('k', 1000, fn, undefined, 2001)).toBe(2); // past TTL
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('force bypasses the cache', async () => {
    const fn = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    await cached('k', 1000, fn, { force: false }, 1000);
    expect(await cached('k', 1000, fn, { force: true }, 1200)).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('single-flights concurrent calls for the same key', async () => {
    let resolve!: (v: number) => void;
    const fn = vi.fn().mockReturnValue(new Promise<number>((r) => (resolve = r)));
    const a = cached('k', 1000, fn, undefined, 1000);
    const b = cached('k', 1000, fn, undefined, 1000);
    resolve(7);
    expect(await a).toBe(7);
    expect(await b).toBe(7);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not cache a rejected fn (next call retries)', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(9);
    await expect(cached('k', 1000, fn, undefined, 1000)).rejects.toThrow('x');
    expect(await cached('k', 1000, fn, undefined, 1010)).toBe(9);
  });
});
