// src/lib/server/market-data/index.ts
import type { MarketDataProvider, ProviderName } from './types';
import { yahooProvider } from './yahoo.provider';

const PROVIDERS: Partial<Record<ProviderName, MarketDataProvider>> = {
  yahoo: yahooProvider
  // future: moomoo, polygon, twelvedata — register here behind the same interface.
};

/** The active provider, chosen by MARKET_DATA_PROVIDER (default 'yahoo'). */
export function getProvider(): MarketDataProvider {
  const name = (process.env.MARKET_DATA_PROVIDER ?? 'yahoo') as ProviderName;
  return PROVIDERS[name] ?? yahooProvider;
}

export type { MarketDataProvider, MarketQuote, MarketSession, Candle, ProviderName } from './types';
