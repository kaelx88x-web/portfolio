// src/lib/server/market-data/yahoo.provider.ts
//
// v3 NOTE: yahoo-finance2 v3 exports a CLASS as the default export, not an instance.
// Usage: `import YahooFinance from 'yahoo-finance2'; const client = new YahooFinance();`
// Methods: client.quote(symbols: string[]) => Promise<Quote[]>
//          client.chart(symbol: string, opts) => Promise<ChartResultArray> with { quotes: [...] }
//
import YahooFinance from 'yahoo-finance2';
import { toYahooSymbol } from './symbols';
import type { MarketDataProvider, MarketQuote, MarketSession, Candle } from './types';

// Minimal structural type the factory needs — decoupled from the real v3 class type
// so the fake in tests satisfies it without `as never`.
export interface YahooClient {
  quote(symbols: string[]): Promise<Array<Record<string, unknown>>>;
  chart(symbol: string, opts: unknown): Promise<{ quotes: Array<Record<string, unknown>> }>;
}

function rangeOpts(range: string): { period1: Date; interval: '1d' | '1h' | '5m' } {
  switch (range) {
    case '1D': return { period1: daysAgo(1), interval: '5m' };
    case '1W': return { period1: daysAgo(7), interval: '1h' };
    case '1M': return { period1: daysAgo(30), interval: '1d' };
    case '1Y': return { period1: daysAgo(365), interval: '1d' };
    case '3M':
    default:   return { period1: daysAgo(90), interval: '1d' };
  }
}

function daysAgo(n: number): Date { return new Date(Date.now() - n * 86_400_000); }

function toSession(state: string | undefined): MarketSession {
  switch (state) {
    case 'PRE': return 'pre';
    case 'REGULAR': return 'regular';
    case 'POST':
    case 'POSTPOST': return 'post';
    default: return 'closed';
  }
}

const num = (v: unknown): number | null =>
  (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function makeYahooProvider(client: YahooClient): MarketDataProvider {
  return {
    name: 'yahoo',

    async getQuotes(codes: string[]): Promise<MarketQuote[]> {
      const pairs = codes.map((c) => ({ code: c, y: toYahooSymbol(c) }));
      const rows = await client.quote(pairs.map((p) => p.y));
      const list = Array.isArray(rows) ? rows : [rows];
      const byY = new Map(
        list.map((r) => [String((r as { symbol?: string }).symbol ?? '').toUpperCase(), r])
      );
      return pairs.map(({ code, y }) => {
        const r = byY.get(y.toUpperCase()) as Record<string, unknown> | undefined;
        const t = r?.regularMarketTime as Date | number | undefined;
        return {
          symbol: code,
          last: num(r?.regularMarketPrice),
          changePct: num(r?.regularMarketChangePercent),
          bid: num(r?.bid),
          ask: num(r?.ask),
          volume: num(r?.regularMarketVolume),
          session: toSession(r?.marketState as string | undefined),
          source: 'yahoo',
          ts: t instanceof Date ? t.getTime() : typeof t === 'number' ? t * 1000 : Date.now()
        };
      });
    },

    async getCandles(code: string, range: string): Promise<Candle[]> {
      const opts = rangeOpts(range);
      const res = await client.chart(toYahooSymbol(code), opts);
      const quotes = (res?.quotes ?? []) as Array<Record<string, unknown>>;
      return quotes
        .filter((q) => q.close != null)
        .map((q) => ({
          t: new Date(q.date as Date).toISOString().slice(0, 10),
          o: Number(q.open ?? 0),
          h: Number(q.high ?? 0),
          l: Number(q.low ?? 0),
          c: Number(q.close ?? 0),
          v: Number(q.volume ?? 0)
        }));
    }
  };
}

// Production binding: v3 exports a CLASS — instantiate it to get the client.
// The instance's quote/chart methods satisfy YahooClient structurally.
export const yahooProvider: MarketDataProvider = makeYahooProvider(
  new YahooFinance() as unknown as YahooClient
);
