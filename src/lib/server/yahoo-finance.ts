import type { SparklineData } from '$lib/types/prices';

const YF_BASE = 'https://query1.finance.yahoo.com';

// ─── Internal helpers ───────────────────────────────────────────────────────

function normalizePoints(closes: number[]): number[] {
  if (closes.length === 0) return [];
  if (closes.length === 1) return [0.5];
  const min = Math.min(...closes);
  const max = Math.max(...closes);
  const range = max - min;
  if (range === 0) return closes.map(() => 0.5);
  return closes.map(c => (c - min) / range);
}

function deriveTrend(closes: number[]): 'up' | 'down' | 'flat' {
  if (closes.length < 2) return 'flat';
  const diff = closes[closes.length - 1] - closes[0];
  return diff > 0 ? 'up' : diff < 0 ? 'down' : 'flat';
}

function formatUnixDate(unixSeconds: number): string {
  const d = new Date(unixSeconds * 1000);
  const day = d.toLocaleDateString('en-US', { weekday: 'short' });
  return `${day} ${d.getDate()}`;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Batch-fetch current price + % change for up to 100 symbols in one request.
 * Returns empty Map on any error (silent degradation).
 */
export async function fetchBatchQuotes(
  symbols: string[]
): Promise<Map<string, { price: number; changePercent: number }>> {
  if (symbols.length === 0) return new Map();
  try {
    const url =
      `${YF_BASE}/v7/finance/quote` +
      `?symbols=${symbols.join(',')}` +
      `&fields=regularMarketPrice,regularMarketChangePercent`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return new Map();
    const json = await res.json();
    const result: Array<{
      symbol: string;
      regularMarketPrice?: number;
      regularMarketChangePercent?: number;
    }> = json?.quoteResponse?.result ?? [];
    const map = new Map<string, { price: number; changePercent: number }>();
    for (const q of result) {
      const price = q.regularMarketPrice ?? 0;
      if (price > 0) {
        map.set(q.symbol, {
          price,
          changePercent: q.regularMarketChangePercent ?? 0,
        });
      }
    }
    return map;
  } catch {
    return new Map();
  }
}

/**
 * Fetch 5-day daily sparkline for a single symbol.
 * Returns null on any error.
 */
export async function fetchSparkline(symbol: string): Promise<SparklineData | null> {
  try {
    const url =
      `${YF_BASE}/v8/finance/chart/${encodeURIComponent(symbol)}` +
      `?range=5d&interval=1d`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) return null;
    const json = await res.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const timestamps: number[] = result.timestamp ?? [];
    const rawCloses: (number | null)[] = result.indicators?.quote?.[0]?.close ?? [];

    // Zip timestamps + closes, drop nulls/NaN
    const valid = timestamps
      .map((t, i) => ({ t, c: rawCloses[i] }))
      .filter((x): x is { t: number; c: number } =>
        x.c !== null && x.c !== undefined && !isNaN(x.c)
      );

    // Take last 5 valid trading days
    const last5 = valid.slice(-5);
    if (last5.length === 0) return null;

    const closes = last5.map(x => x.c);
    return {
      points: normalizePoints(closes),
      prices: closes,
      dates: last5.map(x => formatUnixDate(x.t)),
      trend: deriveTrend(closes),
    };
  } catch {
    return null;
  }
}

/**
 * Fetch sparklines for many symbols with a concurrency limit.
 * Symbols that fail are silently omitted from the result Map.
 */
export async function fetchSparklines(
  symbols: string[],
  concurrency = 10
): Promise<Map<string, SparklineData>> {
  const result = new Map<string, SparklineData>();
  for (let i = 0; i < symbols.length; i += concurrency) {
    const chunk = symbols.slice(i, i + concurrency);
    const settled = await Promise.allSettled(
      chunk.map(async s => ({ s, data: await fetchSparkline(s) }))
    );
    for (const r of settled) {
      if (r.status === 'fulfilled' && r.value.data) {
        result.set(r.value.s, r.value.data);
      }
    }
  }
  return result;
}
