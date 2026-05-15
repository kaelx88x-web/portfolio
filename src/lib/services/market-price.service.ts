// src/lib/services/market-price.service.ts
import { prisma } from '$lib/server/db';
import { getLatestSnapshot } from '$lib/services/snapshot.service';
import type { SnapshotHolding } from '$lib/types/portfolio';

export function normalizeSymbol(symbol: string): string {
  if (symbol.startsWith('US.')) return symbol.slice(3);
  if (symbol.startsWith('HK.')) {
    const code = symbol.slice(3).padStart(4, '0');
    return `${code}.HK`;
  }
  return symbol;
}

export async function fetchYahooPrices(symbols: string[]): Promise<Record<string, number>> {
  if (symbols.length === 0) return {};

  const normalized = symbols.map(normalizeSymbol);
  // Map Yahoo's echoed symbol → our normalized input symbol
  const yahooToInput: Record<string, string> = {};
  for (const sym of normalized) {
    yahooToInput[sym.toUpperCase()] = sym;
  }

  const query = normalized.join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(query)}&fields=regularMarketPrice`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'Mozilla/5.0' }
    });

    if (!response.ok) return {};

    const payload = await response.json();
    const quotes: Array<{ symbol: string; regularMarketPrice?: number }> =
      payload?.quoteResponse?.result ?? [];

    const result: Record<string, number> = {};
    for (const quote of quotes) {
      if (quote.regularMarketPrice == null) continue;
      const inputKey = yahooToInput[quote.symbol.toUpperCase()] ?? quote.symbol;
      result[inputKey] = quote.regularMarketPrice;
    }
    return result;
  } catch {
    return {};
  }
}

export type PriceRefreshResult = {
  updated: number;
  failed: number;
  skipped: number;
  refreshedAt: string;
};

export async function refreshHoldingPrices(userId: string): Promise<PriceRefreshResult> {
  // Get symbols from latest snapshot (Moomoo sync) first, fall back to transactions
  const snapshot = await getLatestSnapshot(userId);
  let symbols: string[] = [];

  if (snapshot) {
    try {
      const rows: SnapshotHolding[] = JSON.parse(snapshot.holdingsJson);
      symbols = [...new Set(rows.map((h) => h.symbol).filter(Boolean))];
    } catch {
      symbols = [];
    }
  }

  if (symbols.length === 0) {
    const assets = await prisma.asset.findMany({
      where: { transactions: { some: { userId, type: { in: ['buy', 'sell'] } } } },
      select: { symbol: true }
    });
    symbols = assets.map((a) => a.symbol);
  }

  if (symbols.length === 0) {
    return { updated: 0, failed: 0, skipped: 0, refreshedAt: new Date().toISOString() };
  }
  const prices = await fetchYahooPrices(symbols);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const symbol of symbols) {
    const normalizedSymbol = normalizeSymbol(symbol);
    const price = prices[normalizedSymbol];

    if (price == null) {
      skipped++;
      continue;
    }

    try {
      await prisma.asset.updateMany({
        where: { symbol },
        data: { latestPrice: price }
      });
      updated++;
    } catch {
      failed++;
    }
  }

  return { updated, failed, skipped, refreshedAt: new Date().toISOString() };
}
