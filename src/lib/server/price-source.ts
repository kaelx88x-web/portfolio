import type { Asset } from '@prisma/client';
import type { PriceData, SparklineData } from '$lib/types/prices';
import { fetchBatchQuotes, fetchSparklines } from './yahoo-finance';

const BRIDGE_URL = process.env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';

// ─── Moomoo helpers ──────────────────────────────────────────────────────────

async function isMoomooAvailable(): Promise<boolean> {
  try {
    const res = await fetch(`${BRIDGE_URL}/status`, {
      signal: AbortSignal.timeout(1000),
    });
    if (!res.ok) return false;
    const data = await res.json();
    return data.quote_logged_in === true;
  } catch {
    return false;
  }
}

/**
 * Convert a DB symbol to Moomoo format.
 * US.AAPL, HK.00700 (5-digit padded). MY → null (unsupported).
 *
 * Idempotent: symbols may be stored bare (AAPL) or already exchange-prefixed
 * (US.SPYT, HK.00005 — e.g. when synced from moomoo). Prefixing blindly would
 * produce "US.US.SPYT", which the bridge cannot resolve, so we detect and keep
 * an existing prefix as-is.
 */
export function toMoomooCode(symbol: string, country: string): string | null {
  const s = symbol.trim().toUpperCase();
  // Already in moomoo format (US./HK./SH./SZ.) — use verbatim.
  if (/^(US|HK|SH|SZ)\./.test(s)) return s;
  if (country === 'US') return `US.${s}`;
  if (country === 'HK') {
    const base = s.replace(/\.HK$/i, '').padStart(5, '0');
    return `HK.${base}`;
  }
  return null;
}

async function fetchFromMoomoo(assets: Asset[]): Promise<Map<string, PriceData>> {
  // Build a lookup map: moomooCode → dbSymbol.
  // Options are excluded — /quotes/snapshot needs separate option-quote
  // permission and a single unpermitted code makes moomoo fail the whole batch.
  const codeMap = new Map<string, string>();
  for (const a of assets) {
    if (a.assetType === 'option') continue;
    const code = toMoomooCode(a.symbol, a.country ?? '');
    if (code) codeMap.set(code, a.symbol);
  }
  if (codeMap.size === 0) return new Map();

  const codes = [...codeMap.keys()];

  try {
    // 1. Snapshot — current price + % change. Chunked so that one bad/unpermitted
    //    code only loses its own chunk rather than every quote in the request.
    const priceBySymbol = new Map<string, { price: number; changePercent: number }>();
    const SNAPSHOT_CHUNK = 30;
    for (let i = 0; i < codes.length; i += SNAPSHOT_CHUNK) {
      const chunk = codes.slice(i, i + SNAPSHOT_CHUNK);
      let quotes: Array<{
        code: string;
        last_price: number;
        change_rate: number | null;
        prev_close_price?: number | null;
      }> = [];
      try {
        const snapRes = await fetch(
          `${BRIDGE_URL}/quotes/snapshot?codes=${chunk.join(',')}`,
          { signal: AbortSignal.timeout(8000) }
        );
        if (!snapRes.ok) continue;
        const snap = await snapRes.json();
        quotes = snap.quotes ?? [];
      } catch {
        continue; // skip this chunk, keep the rest
      }

      for (const q of quotes) {
        const dbSym = codeMap.get(q.code);
        if (dbSym && q.last_price > 0) {
          // moomoo often returns change_rate=null (e.g. outside market hours);
          // fall back to computing it from the previous close.
          const changePercent =
            q.change_rate != null
              ? q.change_rate
              : q.prev_close_price && q.prev_close_price > 0
                ? ((q.last_price - q.prev_close_price) / q.prev_close_price) * 100
                : 0;
          priceBySymbol.set(dbSym, { price: q.last_price, changePercent });
        }
      }
    }

    // 2. Sparklines — one /quotes/history call per symbol, parallel with limit 10
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const sparkBySymbol = new Map<string, SparklineData>();
    for (let i = 0; i < codes.length; i += 10) {
      const chunk = codes.slice(i, i + 10);
      const settled = await Promise.allSettled(
        chunk.map(async code => {
          const r = await fetch(
            `${BRIDGE_URL}/quotes/history` +
              `?code=${encodeURIComponent(code)}` +
              `&start=${weekAgo}&end=${today}&max_count=10`,
            { signal: AbortSignal.timeout(6000) }
          );
          if (!r.ok) return { code, sparkline: null };
          const d = await r.json();
          const candles: Array<{ time_key: string; close: number }> = d.candles ?? [];
          const last5 = candles.filter(c => c.close > 0).slice(-5);
          if (last5.length === 0) return { code, sparkline: null };

          const closes = last5.map(c => c.close);
          const min = Math.min(...closes);
          const max = Math.max(...closes);
          const range = max - min;
          const points =
            range === 0 ? closes.map(() => 0.5) : closes.map(c => (c - min) / range);
          const dates = last5.map(c => {
            const dt = new Date(c.time_key);
            return `${dt.toLocaleDateString('en-US', { weekday: 'short' })} ${dt.getDate()}`;
          });
          const trend: SparklineData['trend'] =
            closes.length < 2
              ? 'flat'
              : closes[closes.length - 1] > closes[0]
              ? 'up'
              : closes[closes.length - 1] < closes[0]
              ? 'down'
              : 'flat';

          return {
            code,
            sparkline: { points, prices: closes, dates, trend } satisfies SparklineData,
          };
        })
      );
      for (const r of settled) {
        if (r.status === 'fulfilled' && r.value.sparkline) {
          const dbSym = codeMap.get(r.value.code);
          if (dbSym) sparkBySymbol.set(dbSym, r.value.sparkline);
        }
      }
    }

    // Merge: only emit entries that have a price
    const result = new Map<string, PriceData>();
    for (const [sym, p] of priceBySymbol) {
      result.set(sym, { ...p, sparkline: sparkBySymbol.get(sym) ?? null });
    }
    return result;
  } catch {
    return new Map();
  }
}

async function fetchFromYahoo(assets: Asset[]): Promise<Map<string, PriceData>> {
  const symbols = assets.map(a => a.symbol);
  const [quotes, sparklines] = await Promise.all([
    fetchBatchQuotes(symbols),
    fetchSparklines(symbols),
  ]);

  const result = new Map<string, PriceData>();
  for (const a of assets) {
    const q = quotes.get(a.symbol);
    if (q) {
      result.set(a.symbol, {
        price: q.price,
        changePercent: q.changePercent,
        sparkline: sparklines.get(a.symbol) ?? null,
      });
    }
  }
  return result;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Fetch current prices + sparklines for all assets.
 * Routes US+HK to Moomoo when available; MY always uses Yahoo Finance.
 * Returns empty Map entries for symbols that fail — callers fall back to DB price.
 */
export async function fetchPrices(assets: Asset[]): Promise<Map<string, PriceData>> {
  const moomooUp = await isMoomooAvailable();

  const mooAssets = moomooUp
    ? assets.filter(a => a.country === 'US' || a.country === 'HK')
    : [];
  const yahooAssets = moomooUp
    ? assets.filter(a => a.country === 'MY')
    : assets;

  const [mooData, yahooData] = await Promise.all([
    mooAssets.length ? fetchFromMoomoo(mooAssets) : Promise.resolve(new Map<string, PriceData>()),
    yahooAssets.length
      ? fetchFromYahoo(yahooAssets)
      : Promise.resolve(new Map<string, PriceData>()),
  ]);

  return new Map([...mooData, ...yahooData]);
}
