const PREFIXES = ['US.', 'HK.', 'SH.', 'SZ.', 'SG.', 'MY.'];

/** Map a UI symbol + market to a moomoo code with correct prefix and padding. */
export function toMoomooCode(symbol: string, market?: string | null): string {
  const raw = String(symbol ?? '').trim().toUpperCase();
  if (PREFIXES.some((p) => raw.startsWith(p))) return raw;

  const m = (market ?? 'US').trim().toUpperCase();
  const digits = raw.replace(/\D/g, '');

  switch (m) {
    case 'HK':
      return `HK.${digits.padStart(5, '0')}`;
    case 'MY':
    case 'MYS':
      return `MY.${digits.padStart(4, '0')}`;
    case 'CN':
    case 'A':
      // Shanghai listings are the 6-series (60xxxx/688xxx); everything else
      // (Shenzhen main 00xxxx, ChiNext 30xxxx) routes to Shenzhen.
      return `${digits.startsWith('6') ? 'SH' : 'SZ'}.${digits.padStart(6, '0')}`;
    case 'SG':
      return `SG.${raw}`;
    case 'US':
    default:
      return `US.${raw}`;
  }
}

/** Whole days from `today` (UTC date) to an expiry 'YYYY-MM-DD'. */
export function expiryDte(expiry: string, today: Date = new Date()): number {
  const e = new Date(`${expiry}T00:00:00Z`).getTime();
  const t = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  return Math.round((e - t) / 86_400_000);
}

import { error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import {
  getQuoteSnapshots, getStockBasicInfo, getHistoricalCandles, getCapitalFlow,
  getMarketStates, getPlateList, getPlateStocks
} from './broker.service';

/** Decode a `[symbol]` route param, 404ing on a malformed %-escape rather than
 *  letting the URIError bubble up as a 500. For use in `/api/stocks/[symbol]/*`. */
export function decodeSymbolParam(param: string): string {
  try {
    return decodeURIComponent(param).trim().toUpperCase();
  } catch {
    throw error(404, 'Unknown symbol');
  }
}

export type BlockState<T> = { status: 'ok' | 'unavailable' | 'stale'; data: T | null };

export type StockDetailVM = {
  asset: { id: string; symbol: string; name: string; market: string | null; currency: string; sector: string | null };
  moomooCode: string;
  marketState: string | null;
  header: BlockState<{ lastPrice: number; prevClose: number; changePct: number; volume: number; bid: number | null; ask: number | null; stale?: boolean }>;
  stats: BlockState<{ pe: number | null; pb: number | null; eps: number | null; marketCap: number | null; high52: number | null; low52: number | null; lot: number | null }>;
  candles: BlockState<{ t: string; o: number; h: number; l: number; c: number }[]>;
  flow: BlockState<{ inFlow: number | null; mainInFlow: number | null }>;
  peers: BlockState<{ symbol: string; name: string; changePct: number | null; price: number | null }[]>;
  bidAsk: BlockState<{ bid: number | null; ask: number | null }>;
  position: { owned: number; avgCost: number; marketValue: number; unrealizedPnl: number } | null;
  watchlisted: boolean;
};

/**
 * Reject a promise if it doesn't settle within `ms`. The underlying bridge fetch
 * keeps running (its result still populates the quote cache for the next visit),
 * but the page never waits on it — a slow/hanging OpenD degrades a block to
 * "Data Not Available" fast instead of hanging server-side rendering.
 */
export function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms}ms`)), ms))
  ]);
}

const BLOCK_TIMEOUT_MS = 4000;

/** settle helper: ok(data) / unavailable on empty / unavailable on throw/timeout. */
async function block<T>(fn: () => Promise<T | null | undefined>, isEmpty: (v: T) => boolean, timeoutMs = BLOCK_TIMEOUT_MS): Promise<BlockState<T>> {
  try {
    const data = await withTimeout(Promise.resolve(fn()), timeoutMs);
    if (data == null || isEmpty(data as T)) return { status: 'unavailable', data: null };
    return { status: 'ok', data: data as T };
  } catch {
    return { status: 'unavailable', data: null };
  }
}

export async function buildStockDetail(userId: string, symbolParam: string): Promise<StockDetailVM | null> {
  // A malformed %-escape (e.g. `%E0%A4%A`) throws URIError; treat it as an
  // unknown symbol (→ 404) rather than letting it bubble to a 500.
  let symbol: string;
  try {
    symbol = decodeURIComponent(symbolParam).trim().toUpperCase();
  } catch {
    return null;
  }
  const asset = await prisma.asset.findUnique({ where: { symbol } });
  if (!asset) return null;

  const code = toMoomooCode(asset.symbol, asset.country);

  const [snapRes, stats, candles, flow, peers, marketStates, txns, wl] = await Promise.all([
    block(async () => (await getQuoteSnapshots([code]))[0], (s) => !s),
    block(async () => {
      const b = (await getStockBasicInfo([code]))[0];
      if (!b || b.error) return null;
      return { pe: b.pe_ttm ?? b.pe_ratio, pb: b.pb_ratio, eps: b.eps, marketCap: b.market_cap, high52: b.high_52wk, low52: b.low_52wk, lot: b.lot_size };
    }, () => false),
    block(async () => (await getHistoricalCandles(code)).map((k) => ({ t: k.time_key, o: k.open, h: k.high, l: k.low, c: k.close })), (a) => a.length === 0),
    block(async () => {
      const f = (await getCapitalFlow([code]))[0];
      if (!f || f.error) return null;
      return { inFlow: f.in_flow, mainInFlow: f.main_in_flow };
    }, () => false),
    block(async () => {
      const plates = await getPlateList(asset.country === 'HK' ? 'HK' : 'US', 'INDUSTRY');
      if (!plates.length) return [];
      const stocks = await getPlateStocks(plates[0].code);
      return stocks.slice(0, 8).map((s) => ({ symbol: s.code, name: s.name, changePct: s.change_pct, price: s.last_price }));
    }, (a) => a.length === 0),
    withTimeout(getMarketStates([code]), 3000).catch(() => []),
    // Guard the raw prisma calls too — a DB blip must degrade these to
    // empty/null, never reject Promise.all and 500 the page.
    prisma.transaction.findMany({ where: { userId, assetId: asset.id, type: { in: ['buy', 'sell'] } }, select: { type: true, quantity: true, price: true } }).catch(() => [] as { type: string; quantity: number; price: number }[]),
    prisma.watchlistItem.findFirst({ where: { assetId: asset.id, watchlist: { userId } }, select: { id: true } }).catch(() => null)
  ]);

  // Header: prefer live snapshot; fall back to stale asset.latestPrice.
  let header: StockDetailVM['header'];
  if (snapRes.status === 'ok' && snapRes.data) {
    const s = snapRes.data;
    const last = Number(s.last_price ?? 0);
    const prev = Number(s.prev_close_price ?? last);
    header = { status: 'ok', data: { lastPrice: last, prevClose: prev, changePct: prev ? ((last - prev) / prev) * 100 : 0, volume: Number(s.volume ?? 0), bid: s.bid_price ?? null, ask: s.ask_price ?? null } };
  } else if (asset.latestPrice > 0) {
    header = { status: 'stale', data: { lastPrice: asset.latestPrice, prevClose: asset.latestPrice, changePct: 0, volume: 0, bid: null, ask: null, stale: true } };
  } else {
    header = { status: 'unavailable', data: null };
  }

  // Position from the ledger.
  let owned = 0, cost = 0;
  for (const tx of txns) {
    if (tx.type === 'buy') { const q = owned + tx.quantity; cost = q ? (cost * owned + tx.price * tx.quantity) / q : 0; owned = q; }
    else owned = Math.max(0, owned - tx.quantity);
  }
  const last = header.data?.lastPrice ?? asset.latestPrice;
  const position = owned > 0 ? { owned, avgCost: cost, marketValue: owned * last, unrealizedPnl: owned * (last - cost) } : null;

  return {
    asset: { id: asset.id, symbol: asset.symbol, name: asset.name, market: asset.country, currency: asset.currency, sector: asset.sector ?? null },
    moomooCode: code,
    marketState: marketStates[0]?.market_state ?? null,
    header,
    stats: stats as StockDetailVM['stats'],
    candles: candles as StockDetailVM['candles'],
    flow: flow as StockDetailVM['flow'],
    peers: peers as StockDetailVM['peers'],
    // bid/ask only come from a live snapshot; a stale/absent header means unavailable.
    bidAsk: header.status === 'ok' && header.data ? { status: 'ok', data: { bid: header.data.bid, ask: header.data.ask } } : { status: 'unavailable', data: null },
    position,
    watchlisted: Boolean(wl)
  };
}
