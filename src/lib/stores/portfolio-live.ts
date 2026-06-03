import type { LiveQuote } from './live-quotes';

export interface LiveHolding { code: string; qty: number; fallbackPrice: number; }

/** Sum market value, preferring a live price per holding, else its fallback. */
export function computeLiveTotal(holdings: LiveHolding[], quotes: Map<string, Pick<LiveQuote, 'last'>>): number {
  return holdings.reduce((sum, h) => {
    const live = quotes.get(h.code.trim().toUpperCase())?.last;
    const price = live ?? h.fallbackPrice;
    return sum + price * h.qty;
  }, 0);
}
