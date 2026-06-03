// src/lib/server/market-data/types.ts
export type ProviderName = 'yahoo' | 'moomoo' | 'polygon' | 'twelvedata';

export type MarketSession = 'pre' | 'regular' | 'post' | 'closed';

export interface MarketQuote {
  symbol: string;            // app/moomoo code, e.g. "US.NVDA"
  last: number | null;
  changePct: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  session: MarketSession;
  source: ProviderName;
  ts: number;                // provider quote timestamp (epoch ms)
}

export interface Candle { t: string; o: number; h: number; l: number; c: number; v: number; }

export interface MarketDataProvider {
  readonly name: ProviderName;
  getQuotes(codes: string[]): Promise<MarketQuote[]>; // batch; throws on upstream failure
  getCandles(code: string, range: string): Promise<Candle[]>;
}
