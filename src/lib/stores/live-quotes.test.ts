import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); localStorage.clear(); });

async function setup(fetchImpl: typeof fetch) {
  const mod = await import('./live-quotes');
  mod.__setTestHooks({ fetch: fetchImpl, isVisible: () => true });
  const toggle = await import('./live-toggle');
  toggle.liveEnabled.set(true);
  return mod;
}

const okResp = (quotes: unknown[]) => ({ ok: true, json: async () => ({ quotes }) }) as Response;

describe('live-quotes store', () => {
  it('polls the union of subscribed codes and patches the map', async () => {
    const fetchImpl = vi.fn(async () => okResp([{ symbol: 'US.NVDA', last: 100, changePct: 1, bid: null, ask: null, volume: null, session: 'regular', source: 'yahoo', ts: Date.now() }]));
    const { subscribeQuotes, liveQuotes } = await setup(fetchImpl as never);
    const un = subscribeQuotes(['US.NVDA']);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(get(liveQuotes).get('US.NVDA')?.last).toBe(100);
    un();
  });

  it('does not poll when toggle is off', async () => {
    const fetchImpl = vi.fn(async () => okResp([]));
    const { subscribeQuotes } = await setup(fetchImpl as never);
    const toggle = await import('./live-toggle');
    toggle.liveEnabled.set(false);
    subscribeQuotes(['US.NVDA']);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('marks codes stale and keeps last value on fetch failure', async () => {
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call += 1;
      if (call === 1) return okResp([{ symbol: 'US.NVDA', last: 100, changePct: 1, bid: null, ask: null, volume: null, session: 'regular', source: 'yahoo', ts: Date.now() }]);
      throw new Error('down');
    });
    const { subscribeQuotes, liveQuotes } = await setup(fetchImpl as never);
    subscribeQuotes(['US.NVDA']);
    await vi.advanceTimersByTimeAsync(10_000); // ok
    await vi.advanceTimersByTimeAsync(10_000); // fails
    const q = get(liveQuotes).get('US.NVDA')!;
    expect(q.last).toBe(100);   // last value retained
    expect(q.stale).toBe(true);
  });

  it('refcounts: stops fetching after all subscribers unsubscribe', async () => {
    const fetchImpl = vi.fn(async () => okResp([]));
    const { subscribeQuotes } = await setup(fetchImpl as never);
    const un1 = subscribeQuotes(['US.NVDA']);
    const un2 = subscribeQuotes(['US.NVDA']);
    un1(); un2();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
