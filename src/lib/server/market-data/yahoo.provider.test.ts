// src/lib/server/market-data/yahoo.provider.test.ts
import { describe, it, expect } from 'vitest';
import { makeYahooProvider } from './yahoo.provider';

const fakeClient = {
  quote: async (_symbols: string[]) => ([
    { symbol: 'NVDA', regularMarketPrice: 100, regularMarketChangePercent: 1.5,
      bid: 99.9, ask: 100.1, regularMarketVolume: 1000, marketState: 'REGULAR',
      regularMarketTime: new Date('2026-06-03T15:00:00Z') }
  ]),
  chart: async (_symbol: string, _opts: unknown) => ({
    quotes: [{ date: new Date('2026-06-02T00:00:00Z'), open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }]
  })
};

describe('yahoo provider', () => {
  it('normalizes a quote and maps marketState to session', async () => {
    const p = makeYahooProvider(fakeClient as never);
    const [q] = await p.getQuotes(['US.NVDA']);
    expect(q).toMatchObject({ symbol: 'US.NVDA', last: 100, changePct: 1.5, bid: 99.9, ask: 100.1, volume: 1000, session: 'regular', source: 'yahoo' });
    expect(q.ts).toBe(new Date('2026-06-03T15:00:00Z').getTime());
  });

  it('normalizes candles to {t,o,h,l,c,v}', async () => {
    const p = makeYahooProvider(fakeClient as never);
    const candles = await p.getCandles('US.NVDA', '1M');
    expect(candles[0]).toEqual({ t: '2026-06-02', o: 1, h: 2, l: 0.5, c: 1.5, v: 10 });
  });

  it('throws when the upstream client throws', async () => {
    const p = makeYahooProvider({ quote: async () => { throw new Error('upstream'); } } as never);
    await expect(p.getQuotes(['US.NVDA'])).rejects.toThrow();
  });
});
