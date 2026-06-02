# Stock Detail Page (with Options) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/stocks/[symbol]` detail page (Overview + Options tabs) that surfaces the moomoo quote data already wired in `broker.service`, with short-lived caching, multi-market symbol mapping, and a Wheel-focused options view — read-only + paper-trade only.

**Architecture:** SvelteKit route with a server `load` that fans out cached `broker.service` calls into a view-model (`stock-detail.service.ts`), rendered by small focused components. Options data is lazy-loaded via thin API endpoints. Heavy bridge calls go through an in-memory TTL cache to respect OpenD frequency limits. Every block degrades to "Data Not Available" — no invented data.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript, Vitest, Playwright, ECharts (dynamic import), Prisma/MySQL, the Python moomoo bridge (`moomoo-service`).

**Spec:** `docs/superpowers/specs/2026-06-02-stock-detail-page-design.md`

**Phasing:** Phase 1 ships the Overview page + infra (cache, mapping, services, endpoints, components). Phase 2 adds the Options tab. Each phase is independently shippable and testable.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/lib/server/quote-cache.ts` | In-memory TTL + single-flight cache wrapper for heavy bridge calls |
| `src/lib/server/quote-cache.test.ts` | Cache unit tests |
| `src/lib/services/stock-detail.service.ts` | `toMoomooCode`, `expiryDte`, `buildStockDetail` view-model shaper |
| `src/lib/services/stock-detail.service.test.ts` | Mapping / DTE / shaper unit tests |
| `src/lib/services/broker.service.ts` | (edit) wrap candles/flow/basic-info in cache; add `getOptionSpreadCandidates` |
| `src/routes/api/stocks/[symbol]/candles/+server.ts` | Candle range endpoint (`?range=&force=`) |
| `src/routes/api/stocks/[symbol]/options/expiry/+server.ts` | Expiry + DTE |
| `src/routes/api/stocks/[symbol]/options/chain/+server.ts` | Chain with Greeks |
| `src/routes/api/stocks/[symbol]/options/candidates/+server.ts` | CC/CSP + spread candidates |
| `src/routes/stocks/[symbol]/+page.server.ts` | `load` (calls shaper) + reused `add`/`toggleWatchlist` actions |
| `src/routes/stocks/[symbol]/+page.svelte` | Overview/Options tabs + two-column layout |
| `src/lib/components/stocks/detail/StockDetailHeader.svelte` | Price, change, market-state badge, last-updated (market TZ), refresh |
| `src/lib/components/stocks/detail/PriceChart.svelte` | ECharts candle/line + timeframe pills |
| `src/lib/components/stocks/detail/MoneyFlowPanel.svelte` | Capital flow bars |
| `src/lib/components/stocks/detail/KeyStatsGrid.svelte` | PE/PB/EPS/mktcap/52wk |
| `src/lib/components/stocks/detail/PositionActions.svelte` | Position + watchlist + add/paper-trade |
| `src/lib/components/stocks/detail/SectorPeers.svelte` | Peer rows |
| `src/lib/components/stocks/detail/BidAsk.svelte` | Best bid/ask |
| `src/lib/components/stocks/detail/OptionsPanel.svelte` | Expiry/DTE/Delta filters + chain table + Paper buttons |
| `src/lib/components/stocks/detail/Unavailable.svelte` | Shared "Data Not Available" block |
| `src/lib/components/stocks/StockCard.svelte` | (edit) link card to `/stocks/{symbol}` |
| `moomoo-service/options_logic.py` | (edit) `spread_candidates` leg-pairing |
| `moomoo-service/tests/test_options.py` | (edit) spread-candidate tests |
| `moomoo-service/main.py` | (edit) `/options/spread-candidates` endpoint |
| `tests/e2e/stock-detail/*.spec.ts` | e2e (creds-gated) |

**Note on caching backend:** This plan implements the cache **in-memory per-process** (single-flight + TTL), matching the existing `src/lib/server/rate-limit.ts` precedent. The spec mentions optional Redis (`ioredis`) backing — the wrapper's interface allows a Redis read-through to be dropped in later without touching call sites. In-memory is correct for the current single-node deployment and is unit-testable without external services.

---

# PHASE 1 — Overview page + infra

## Task 1: Quote cache (TTL + single-flight)

**Files:**
- Create: `src/lib/server/quote-cache.ts`
- Test: `src/lib/server/quote-cache.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/server/quote-cache.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { cached, clearQuoteCache } from './quote-cache';

beforeEach(() => clearQuoteCache());

describe('cached', () => {
  it('returns the fn result and caches within TTL', async () => {
    const fn = vi.fn().mockResolvedValue(1);
    expect(await cached('k', 1000, fn, undefined, 1000)).toBe(1);
    expect(await cached('k', 1000, fn, undefined, 1500)).toBe(1); // within TTL
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('refetches after TTL expires', async () => {
    const fn = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    expect(await cached('k', 1000, fn, undefined, 1000)).toBe(1);
    expect(await cached('k', 1000, fn, undefined, 2001)).toBe(2); // past TTL
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('force bypasses the cache', async () => {
    const fn = vi.fn().mockResolvedValueOnce(1).mockResolvedValueOnce(2);
    await cached('k', 1000, fn, { force: false }, 1000);
    expect(await cached('k', 1000, fn, { force: true }, 1200)).toBe(2);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('single-flights concurrent calls for the same key', async () => {
    let resolve!: (v: number) => void;
    const fn = vi.fn().mockReturnValue(new Promise<number>((r) => (resolve = r)));
    const a = cached('k', 1000, fn, undefined, 1000);
    const b = cached('k', 1000, fn, undefined, 1000);
    resolve(7);
    expect(await a).toBe(7);
    expect(await b).toBe(7);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('does not cache a rejected fn (next call retries)', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(9);
    await expect(cached('k', 1000, fn, undefined, 1000)).rejects.toThrow('x');
    expect(await cached('k', 1000, fn, undefined, 1010)).toBe(9);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node node_modules/vitest/vitest.mjs run src/lib/server/quote-cache.test.ts`
Expected: FAIL — `cached` not exported.

- [ ] **Step 3: Implement the cache**

```ts
// src/lib/server/quote-cache.ts
/**
 * In-memory TTL + single-flight cache for heavy moomoo bridge calls (candles,
 * capital flow, basic info). Protects against OpenD frequency limits. Per-process,
 * matching src/lib/server/rate-limit.ts. The `now` param is injectable for tests.
 */
type Entry = { value: unknown; expires: number };

const store = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();

export type CacheOpts = { force?: boolean };

export async function cached<T>(
  key: string,
  ttlMs: number,
  fn: () => Promise<T>,
  opts: CacheOpts = {},
  now: number = Date.now()
): Promise<T> {
  if (!opts.force) {
    const hit = store.get(key);
    if (hit && hit.expires > now) return hit.value as T;
    const flight = inflight.get(key);
    if (flight) return flight as Promise<T>;
  }

  const p = (async () => {
    const value = await fn();
    store.set(key, { value, expires: now + ttlMs });
    return value;
  })();

  inflight.set(key, p);
  try {
    return (await p) as T;
  } finally {
    inflight.delete(key);
  }
}

export function clearQuoteCache(key?: string): void {
  if (key === undefined) {
    store.clear();
    inflight.clear();
  } else {
    store.delete(key);
    inflight.delete(key);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node node_modules/vitest/vitest.mjs run src/lib/server/quote-cache.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/quote-cache.ts src/lib/server/quote-cache.test.ts
git commit -m "feat(stocks): TTL + single-flight quote cache for bridge calls"
```

---

## Task 2: Symbol mapping + DTE (`stock-detail.service`)

**Files:**
- Create: `src/lib/services/stock-detail.service.ts`
- Test: `src/lib/services/stock-detail.service.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/services/stock-detail.service.test.ts
import { describe, it, expect } from 'vitest';
import { toMoomooCode, expiryDte } from './stock-detail.service';

describe('toMoomooCode', () => {
  it('US ticker → US. prefix', () => {
    expect(toMoomooCode('nvda', 'US')).toBe('US.NVDA');
    expect(toMoomooCode('AAPL', null)).toBe('US.AAPL'); // default US
  });
  it('HK numeric → HK. zero-padded to 5', () => {
    expect(toMoomooCode('700', 'HK')).toBe('HK.00700');
    expect(toMoomooCode('5', 'HK')).toBe('HK.00005');
  });
  it('MY numeric → MY. zero-padded to 4', () => {
    expect(toMoomooCode('1023', 'MY')).toBe('MY.1023');
    expect(toMoomooCode('23', 'MY')).toBe('MY.0023');
  });
  it('China A → SH/SZ by leading digit', () => {
    expect(toMoomooCode('600519', 'CN')).toBe('SH.600519');
    expect(toMoomooCode('000001', 'CN')).toBe('SZ.000001');
  });
  it('already-prefixed code passes through', () => {
    expect(toMoomooCode('HK.00700', 'HK')).toBe('HK.00700');
    expect(toMoomooCode('US.NVDA', 'US')).toBe('US.NVDA');
  });
});

describe('expiryDte', () => {
  it('counts whole days to expiry', () => {
    expect(expiryDte('2026-07-02', new Date('2026-06-02T00:00:00Z'))).toBe(30);
  });
  it('today → 0', () => {
    expect(expiryDte('2026-06-02', new Date('2026-06-02T12:00:00Z'))).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node node_modules/vitest/vitest.mjs run src/lib/services/stock-detail.service.test.ts`
Expected: FAIL — module/exports missing.

- [ ] **Step 3: Implement mapping + DTE**

```ts
// src/lib/services/stock-detail.service.ts (part 1 — pure helpers)
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
      // Shanghai codes start 6; Shenzhen start 0/3.
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node node_modules/vitest/vitest.mjs run src/lib/services/stock-detail.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/stock-detail.service.ts src/lib/services/stock-detail.service.test.ts
git commit -m "feat(stocks): multi-market toMoomooCode + expiryDte helpers"
```

---

## Task 3: Cache the heavy bridge calls

**Files:**
- Modify: `src/lib/services/broker.service.ts` (`getHistoricalCandles`, `getCapitalFlow`, `getCapitalDistribution`, `getStockBasicInfo`)

- [ ] **Step 1: Wrap each heavy call body in `cached(...)`**

Add the import at the top of `broker.service.ts`:

```ts
import { cached } from '$lib/server/quote-cache';
```

Wrap the four functions. Example for `getHistoricalCandles` — keep the existing fetch as the inner fn, key by code+range, TTL 30s:

```ts
export async function getHistoricalCandles(
  code: string,
  start?: string | null,
  end?: string | null,
  force = false
): Promise<HistoricalCandle[]> {
  return cached(`candles:${code}:${start ?? ''}:${end ?? ''}`, 30_000, async () => {
    const params = new URLSearchParams({ code: code.trim().toUpperCase() });
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    const res = await fetch(`${bridgeBase()}/quotes/history?${params.toString()}`, {
      signal: AbortSignal.timeout(30000)
    });
    if (!res.ok) throw new Error(`${res.status} ${await readError(res, 'Historical quote failed')}`);
    const body = await res.json();
    return body.candles ?? [];
  }, { force });
}
```

Apply the same wrapping to `getCapitalFlow` (TTL 20_000, key `flow:${codes.join(',')}`), `getCapitalDistribution` (TTL 20_000, key `dist:...`), and `getStockBasicInfo` (TTL 60_000, key `basic:${codes.join(',')}`). Preserve each function's existing fallback behaviour (return `[]`/null-item arrays) by keeping those branches **inside** the inner fn except for hard errors — for `getCapitalFlow`/`getStockBasicInfo` which currently catch and return null-item arrays, keep the try/catch inside the inner fn so the cached value is the same shape as today.

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: no new errors in `broker.service.ts`.

- [ ] **Step 3: Run the existing suite (no regressions)**

Run: `node node_modules/vitest/vitest.mjs run`
Expected: all pass (the cache is transparent).

- [ ] **Step 4: Commit**

```bash
git add src/lib/services/broker.service.ts
git commit -m "perf(stocks): cache candles/flow/basic-info to respect OpenD limits"
```

---

## Task 4: View-model shaper (`buildStockDetail`)

**Files:**
- Modify: `src/lib/services/stock-detail.service.ts` (add shaper + types)
- Test: `src/lib/services/stock-detail.service.test.ts` (add shaper tests)

**Block-state contract:** every block is `{ status: 'ok' | 'unavailable' | 'stale', data: T | null }`.

- [ ] **Step 1: Write the failing shaper tests**

```ts
// append to src/lib/services/stock-detail.service.test.ts
import { vi } from 'vitest';

vi.mock('$lib/server/db', () => ({
  prisma: {
    asset: { findUnique: vi.fn() },
    transaction: { findMany: vi.fn() },
    watchlistItem: { findFirst: vi.fn() }
  }
}));
vi.mock('./broker.service', () => ({
  getQuoteSnapshots: vi.fn(), getStockBasicInfo: vi.fn(), getHistoricalCandles: vi.fn(),
  getCapitalFlow: vi.fn(), getMarketStates: vi.fn(), getPlateList: vi.fn(), getPlateStocks: vi.fn()
}));

import { buildStockDetail } from './stock-detail.service';
import { prisma } from '$lib/server/db';
import * as bs from './broker.service';

const mp = prisma as any;
const ASSET = { id: 'a1', symbol: 'NVDA', name: 'NVIDIA', country: 'US', exchange: 'NASDAQ', currency: 'USD', latestPrice: 170, sector: 'Tech', assetType: 'stock' };

function ok() {
  mp.asset.findUnique.mockResolvedValue(ASSET);
  mp.transaction.findMany.mockResolvedValue([]);
  mp.watchlistItem.findFirst.mockResolvedValue(null);
  (bs.getQuoteSnapshots as any).mockResolvedValue([{ code: 'US.NVDA', last_price: 170.5, prev_close_price: 167, bid_price: 170.4, ask_price: 170.6, volume: 1000 }]);
  (bs.getStockBasicInfo as any).mockResolvedValue([{ code: 'US.NVDA', pe_ttm: 55, pb_ratio: 40, eps: 3.1, market_cap: 4.1e12, high_52wk: 174, low_52wk: 80, lot_size: 1, error: null }]);
  (bs.getHistoricalCandles as any).mockResolvedValue([{ time_key: '2026-06-01', open: 168, close: 170, high: 171, low: 167 }]);
  (bs.getCapitalFlow as any).mockResolvedValue([{ code: 'US.NVDA', in_flow: 12, main_in_flow: 8, error: null }]);
  (bs.getMarketStates as any).mockResolvedValue([{ code: 'US.NVDA', market_state: 'MARKET_OPEN' }]);
  (bs.getPlateList as any).mockResolvedValue([{ code: 'US.SEMI', name: 'Semis', class: 'INDUSTRY' }]);
  (bs.getPlateStocks as any).mockResolvedValue([{ code: 'US.AMD', name: 'AMD', change_pct: 1.2, last_price: 160 }]);
}

describe('buildStockDetail', () => {
  beforeEach(() => { vi.clearAllMocks(); ok(); });

  it('returns 404-style null when asset not found', async () => {
    mp.asset.findUnique.mockResolvedValue(null);
    expect(await buildStockDetail('u', 'ZZZ')).toBeNull();
  });

  it('maps snapshot into an ok header block with change %', async () => {
    const vm = await buildStockDetail('u', 'NVDA');
    expect(vm!.header.status).toBe('ok');
    expect(vm!.header.data!.lastPrice).toBe(170.5);
    expect(Math.round(vm!.header.data!.changePct * 10) / 10).toBe(2.1);
  });

  it('header falls back to stale latestPrice when snapshot unavailable', async () => {
    (bs.getQuoteSnapshots as any).mockResolvedValue([]);
    const vm = await buildStockDetail('u', 'NVDA');
    expect(vm!.header.status).toBe('stale');
    expect(vm!.header.data!.lastPrice).toBe(170);
  });

  it('marks a block unavailable when its source returns empty', async () => {
    (bs.getStockBasicInfo as any).mockResolvedValue([]);
    const vm = await buildStockDetail('u', 'NVDA');
    expect(vm!.stats.status).toBe('unavailable');
    expect(vm!.stats.data).toBeNull();
  });

  it('never throws when a source rejects (degrades that block)', async () => {
    (bs.getCapitalFlow as any).mockRejectedValue(new Error('bridge down'));
    const vm = await buildStockDetail('u', 'NVDA');
    expect(vm!.flow.status).toBe('unavailable');
    expect(vm!.header.status).toBe('ok'); // other blocks unaffected
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `node node_modules/vitest/vitest.mjs run src/lib/services/stock-detail.service.test.ts`
Expected: FAIL — `buildStockDetail` not exported.

- [ ] **Step 3: Implement the shaper**

```ts
// append to src/lib/services/stock-detail.service.ts
import { prisma } from '$lib/server/db';
import {
  getQuoteSnapshots, getStockBasicInfo, getHistoricalCandles, getCapitalFlow,
  getMarketStates, getPlateList, getPlateStocks
} from './broker.service';

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

/** settle helper: ok(data) / unavailable on empty / unavailable on throw. */
async function block<T>(fn: () => Promise<T | null | undefined>, isEmpty: (v: T) => boolean): Promise<BlockState<T>> {
  try {
    const data = await fn();
    if (data == null || isEmpty(data as T)) return { status: 'unavailable', data: null };
    return { status: 'ok', data: data as T };
  } catch {
    return { status: 'unavailable', data: null };
  }
}

export async function buildStockDetail(userId: string, symbolParam: string): Promise<StockDetailVM | null> {
  const symbol = decodeURIComponent(symbolParam).trim().toUpperCase();
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
    getMarketStates([code]).catch(() => []),
    prisma.transaction.findMany({ where: { userId, assetId: asset.id, type: { in: ['buy', 'sell'] } }, select: { type: true, quantity: true, price: true } }),
    prisma.watchlistItem.findFirst({ where: { assetId: asset.id, watchlist: { userId } }, select: { id: true } })
  ]);

  // Header: prefer live snapshot; fall back to stale asset.latestPrice.
  let header: StockDetailVM['header'];
  if (snapRes.status === 'ok' && snapRes.data) {
    const s = snapRes.data as any;
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
    asset: { id: asset.id, symbol: asset.symbol, name: asset.name, market: asset.country, currency: asset.currency, sector: asset.sector },
    moomooCode: code,
    marketState: marketStates[0]?.market_state ?? null,
    header,
    stats: stats as StockDetailVM['stats'],
    candles: candles as StockDetailVM['candles'],
    flow: flow as StockDetailVM['flow'],
    peers: peers as StockDetailVM['peers'],
    bidAsk: header.data ? { status: header.status === 'unavailable' ? 'unavailable' : 'ok', data: { bid: header.data.bid, ask: header.data.ask } } : { status: 'unavailable', data: null },
    position,
    watchlisted: Boolean(wl)
  };
}
```

- [ ] **Step 4: Run to verify pass**

Run: `node node_modules/vitest/vitest.mjs run src/lib/services/stock-detail.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/stock-detail.service.ts src/lib/services/stock-detail.service.test.ts
git commit -m "feat(stocks): buildStockDetail view-model with per-block degradation"
```

---

## Task 5: Candles API endpoint

**Files:**
- Create: `src/routes/api/stocks/[symbol]/candles/+server.ts`

- [ ] **Step 1: Implement the endpoint**

```ts
// src/routes/api/stocks/[symbol]/candles/+server.ts
import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { getHistoricalCandles } from '$lib/services/broker.service';
import { toMoomooCode } from '$lib/services/stock-detail.service';
import type { RequestHandler } from './$types';

const RANGE_DAYS: Record<string, number> = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '1Y': 365 };

export const GET: RequestHandler = async ({ params, url, locals }) => {
  void locals.user!; // auth enforced by hooks
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  const asset = await prisma.asset.findUnique({ where: { symbol } });
  if (!asset) throw error(404, 'Unknown symbol');

  const range = url.searchParams.get('range') ?? '3M';
  const force = url.searchParams.get('force') === 'true';
  const days = RANGE_DAYS[range] ?? 90;
  const start = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  const code = toMoomooCode(asset.symbol, asset.country);
  const candles = (await getHistoricalCandles(code, start, null, force))
    .map((k) => ({ t: k.time_key, o: k.open, h: k.high, l: k.low, c: k.close, v: k.volume ?? 0 }));
  return json({ status: 'ready', range, candles });
};
```

- [ ] **Step 2: Type-check**

Run: `npm run check`
Expected: no errors in the new endpoint.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/stocks/[symbol]/candles/+server.ts
git commit -m "feat(stocks): candles range API endpoint"
```

---

## Task 6: Page server load + StockCard link

**Files:**
- Create: `src/routes/stocks/[symbol]/+page.server.ts`
- Modify: `src/lib/components/stocks/StockCard.svelte`

- [ ] **Step 1: Implement `load` + actions**

```ts
// src/routes/stocks/[symbol]/+page.server.ts
import { error, fail } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { buildStockDetail } from '$lib/services/stock-detail.service';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  const user = locals.user!;
  const vm = await buildStockDetail(user.id, params.symbol);
  if (!vm) throw error(404, `No data for ${params.symbol}`);
  return { detail: vm };
};

export const actions: Actions = {
  toggleWatchlist: async ({ request, locals }) => {
    const user = locals.user!;
    const assetId = String((await request.formData()).get('assetId') ?? '');
    if (!assetId) return fail(400, { error: 'assetId required' });
    let wl = await prisma.watchlist.findFirst({ where: { userId: user.id } });
    if (!wl) wl = await prisma.watchlist.create({ data: { userId: user.id, name: 'Watchlist' } });
    const existing = await prisma.watchlistItem.findFirst({ where: { watchlistId: wl.id, assetId } });
    if (existing) { await prisma.watchlistItem.delete({ where: { id: existing.id } }); return { watchlisted: false }; }
    await prisma.watchlistItem.create({ data: { watchlistId: wl.id, assetId } });
    return { watchlisted: true };
  }
};
```

- [ ] **Step 2: Make StockCard navigate to the detail page**

In `src/lib/components/stocks/StockCard.svelte`, wrap the card's main click target (symbol/name area) in an `<a href={`/stocks/${encodeURIComponent(asset.symbol)}`}>` (keep the existing Add/Watchlist buttons as separate controls with `on:click|stopPropagation`). Match the existing markup; do not restyle.

- [ ] **Step 3: Verify the route resolves**

Run (dev server on 5173): `node node_modules/@playwright/test/cli.js test tests/e2e/trading-audit/route-safety.spec.ts -g "require authentication" --reporter=line`
Then manually: an anon GET `/stocks/NVDA` should redirect to `/login` (the global hook covers the new route). Expected: still passing, no 500.

- [ ] **Step 4: Commit**

```bash
git add src/routes/stocks/[symbol]/+page.server.ts src/lib/components/stocks/StockCard.svelte
git commit -m "feat(stocks): detail page load + card link"
```

---

## Task 7: Overview components

**Files (create all):**
- `src/lib/components/stocks/detail/Unavailable.svelte`
- `src/lib/components/stocks/detail/StockDetailHeader.svelte`
- `src/lib/components/stocks/detail/PriceChart.svelte`
- `src/lib/components/stocks/detail/MoneyFlowPanel.svelte`
- `src/lib/components/stocks/detail/KeyStatsGrid.svelte`
- `src/lib/components/stocks/detail/PositionActions.svelte`
- `src/lib/components/stocks/detail/SectorPeers.svelte`
- `src/lib/components/stocks/detail/BidAsk.svelte`

- [ ] **Step 1: Shared Unavailable block**

```svelte
<!-- Unavailable.svelte -->
<script lang="ts">export let label = 'Data'; </script>
<div class="na"><span>{label}</span><b>Data Not Available</b></div>
<style>
  .na { display:flex; flex-direction:column; gap:2px; padding:14px; background:var(--card); border:1px solid var(--border); border-radius:10px; }
  .na span { font-size:.62rem; text-transform:uppercase; letter-spacing:.4px; color:var(--muted); }
  .na b { font-size:.82rem; color:var(--muted); font-weight:600; }
</style>
```

- [ ] **Step 2: Header (market-state badge + market-TZ timestamp + refresh)**

```svelte
<!-- StockDetailHeader.svelte -->
<script lang="ts">
  import type { StockDetailVM } from '$lib/services/stock-detail.service';
  export let detail: StockDetailVM;
  export let timezone: string | null = null;   // market TZ from getGlobalMarkets, set by page
  export let onRefresh: () => void = () => {};
  export let refreshing = false;

  $: h = detail.header.data;
  $: up = (h?.changePct ?? 0) >= 0;
  $: stateLabel = mapState(detail.marketState);
  $: open = detail.marketState?.toUpperCase().includes('OPEN') ?? false;

  function mapState(s: string | null): string {
    const v = (s ?? '').toUpperCase();
    if (v.includes('PRE')) return 'Pre-market';
    if (v.includes('AFTER') || v.includes('POST')) return 'After-hours';
    if (v.includes('OPEN') || v.includes('TRADING')) return 'Open';
    return 'Closed';
  }
  function lastUpdated(): string {
    try {
      return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', timeZone: timezone ?? undefined, timeZoneName: 'short' }).format(new Date());
    } catch { return new Date().toLocaleTimeString(); }
  }
</script>

<header class="dh">
  <div class="dh-id">
    <h1>{detail.asset.symbol}</h1>
    <span class="dh-name">{detail.asset.name}</span>
    <span class="dh-state" class:open>{stateLabel}</span>
  </div>
  {#if h}
    <div class="dh-px">
      <span class="px">{h.lastPrice.toFixed(2)} <small>{detail.asset.currency}</small></span>
      <span class="chg" class:up class:down={!up}>{up ? '+' : ''}{h.changePct.toFixed(2)}%</span>
      {#if detail.header.status === 'stale'}<span class="stale">stale</span>{/if}
    </div>
  {:else}
    <span class="chg down">Price Not Available</span>
  {/if}
  <div class="dh-meta">
    <span>Updated {lastUpdated()}</span>
    <button class="rf" on:click={onRefresh} disabled={refreshing}>
      {refreshing ? 'Refreshing…' : open ? 'Refresh' : 'Refresh (market closed)'}
    </button>
  </div>
</header>

<style>
  .dh { display:flex; flex-wrap:wrap; align-items:center; gap:14px; justify-content:space-between; background:var(--card); border:1px solid var(--border); border-radius:12px; padding:16px; }
  .dh-id { display:flex; align-items:baseline; gap:10px; }
  .dh-id h1 { font-size:1.4rem; margin:0; color:var(--text); }
  .dh-name { color:var(--muted); font-size:.82rem; }
  .dh-state { font-size:.62rem; font-weight:700; text-transform:uppercase; padding:2px 8px; border-radius:6px; background:rgba(255,255,255,.06); color:var(--muted); }
  .dh-state.open { background:rgba(57,217,138,.14); color:#39d98a; }
  .dh-px { display:flex; align-items:baseline; gap:10px; }
  .px { font-size:1.3rem; font-weight:700; color:var(--text); } .px small { font-size:.7rem; color:var(--muted); }
  .chg { font-size:.9rem; font-weight:700; } .chg.up { color:#39d98a; } .chg.down { color:#f6685e; }
  .stale { font-size:.6rem; color:#f5b450; border:1px solid #f5b45055; border-radius:4px; padding:1px 5px; }
  .dh-meta { display:flex; align-items:center; gap:10px; font-size:.7rem; color:var(--muted); }
  .rf { font-size:.7rem; font-weight:600; padding:5px 10px; border-radius:7px; border:1px solid var(--border); background:none; color:var(--text); cursor:pointer; }
  .rf:disabled { opacity:.5; cursor:default; }
</style>
```

- [ ] **Step 3: PriceChart (follow the existing ECharts pattern)**

```svelte
<!-- PriceChart.svelte -->
<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getChartTheme } from '$lib/echarts.config';
  import { theme } from '$lib/stores/ui';

  export let symbol: string;
  export let initial: { t: string; o: number; h: number; l: number; c: number }[] = [];

  type Candle = { t: string; o: number; h: number; l: number; c: number };
  const RANGES = ['1D', '1W', '1M', '3M', '1Y'] as const;
  let range: (typeof RANGES)[number] = '3M';
  let mode: 'candle' | 'line' = 'candle';
  let data: Candle[] = initial;
  let loading = false;
  let container: HTMLDivElement;
  let chart: import('echarts').ECharts | null = null;

  async function loadRange(r: typeof range) {
    range = r; loading = true;
    try {
      const res = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/candles?range=${r}`);
      data = (await res.json()).candles ?? [];
    } finally { loading = false; render(); }
  }

  function render() {
    if (!chart) return;
    const ct = getChartTheme();
    const series = mode === 'candle'
      ? [{ type: 'candlestick', data: data.map((k) => [k.o, k.c, k.l, k.h]), itemStyle: { color: '#39d98a', color0: '#f6685e', borderColor: '#39d98a', borderColor0: '#f6685e' } }]
      : [{ type: 'line', data: data.map((k) => k.c), smooth: true, symbol: 'none', lineStyle: { color: ct.color[0], width: 2 } }];
    chart.setOption({ ...ct, grid: { left: 52, right: 16, top: 16, bottom: 28 },
      xAxis: { type: 'category', data: data.map((k) => k.t), axisLabel: { color: ct.axisLabel.color, fontSize: 9 } },
      yAxis: { type: 'value', scale: true, axisLabel: { color: ct.axisLabel.color, fontSize: 9 }, splitLine: ct.splitLine },
      tooltip: { trigger: 'axis' }, series }, true);
  }

  $: if (chart && $theme) render();

  onMount(() => {
    let ro: ResizeObserver | null = null;
    import('echarts').then((e) => { chart = e.init(container, null, { renderer: 'canvas' }); render(); ro = new ResizeObserver(() => chart?.resize()); ro.observe(container); });
    return () => ro?.disconnect();
  });
  onDestroy(() => chart?.dispose());
</script>

<div class="pc">
  <div class="pc-head">
    <div class="pills">
      {#each RANGES as r}<button class:active={range === r} on:click={() => loadRange(r)} disabled={loading}>{r}</button>{/each}
    </div>
    <div class="pills">
      <button class:active={mode === 'candle'} on:click={() => { mode = 'candle'; render(); }}>Candle</button>
      <button class:active={mode === 'line'} on:click={() => { mode = 'line'; render(); }}>Line</button>
    </div>
  </div>
  <div bind:this={container} class="pc-canvas"></div>
</div>

<style>
  .pc { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:14px; }
  .pc-head { display:flex; justify-content:space-between; margin-bottom:10px; }
  .pills { display:flex; gap:3px; }
  .pills button { font-size:.65rem; font-weight:600; padding:3px 9px; border-radius:6px; border:1px solid transparent; background:none; color:var(--muted); cursor:pointer; }
  .pills button.active { color:var(--primary); background:rgba(var(--primary-rgb),.14); border-color:rgba(var(--primary-rgb),.3); }
  .pc-canvas { height:300px; }
  @media (max-width:767px){ .pc-canvas{ height:240px; } }
</style>
```

- [ ] **Step 4: MoneyFlowPanel, KeyStatsGrid, BidAsk, SectorPeers, PositionActions**

```svelte
<!-- MoneyFlowPanel.svelte -->
<script lang="ts">
  import type { StockDetailVM } from '$lib/services/stock-detail.service';
  import Unavailable from './Unavailable.svelte';
  export let flow: StockDetailVM['flow'];
  const money = (n: number | null) => n == null ? '—' : (Math.abs(n) >= 1e6 ? (n/1e6).toFixed(1)+'M' : (n/1e3).toFixed(0)+'K');
</script>
{#if flow.status === 'ok' && flow.data}
  <div class="mf">
    <div class="mf-h">Money Flow (today)</div>
    <div class="mf-row"><span>Net inflow</span><b class:pos={(flow.data.inFlow??0)>=0} class:neg={(flow.data.inFlow??0)<0}>{money(flow.data.inFlow)}</b></div>
    <div class="mf-row"><span>Main inflow</span><b class:pos={(flow.data.mainInFlow??0)>=0} class:neg={(flow.data.mainInFlow??0)<0}>{money(flow.data.mainInFlow)}</b></div>
  </div>
{:else}<Unavailable label="Money Flow" />{/if}
<style>
  .mf { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:14px; }
  .mf-h { font-size:.7rem; font-weight:600; color:var(--text); margin-bottom:8px; }
  .mf-row { display:flex; justify-content:space-between; font-size:.78rem; padding:4px 0; color:var(--muted); }
  .mf-row b.pos { color:#39d98a; } .mf-row b.neg { color:#f6685e; }
</style>
```

```svelte
<!-- KeyStatsGrid.svelte -->
<script lang="ts">
  import type { StockDetailVM } from '$lib/services/stock-detail.service';
  import Unavailable from './Unavailable.svelte';
  export let stats: StockDetailVM['stats'];
  const f = (n: number | null | undefined, d = 2) => n == null ? '—' : n.toFixed(d);
  const cap = (n: number | null | undefined) => n == null ? '—' : n >= 1e12 ? (n/1e12).toFixed(2)+'T' : n >= 1e9 ? (n/1e9).toFixed(1)+'B' : (n/1e6).toFixed(0)+'M';
</script>
{#if stats.status === 'ok' && stats.data}
  <div class="ks">
    <div class="ks-h">Key Stats</div>
    <div class="ks-grid">
      <div><span>PE</span><b>{f(stats.data.pe)}</b></div>
      <div><span>PB</span><b>{f(stats.data.pb)}</b></div>
      <div><span>EPS</span><b>{f(stats.data.eps)}</b></div>
      <div><span>Mkt Cap</span><b>{cap(stats.data.marketCap)}</b></div>
      <div><span>52w High</span><b>{f(stats.data.high52)}</b></div>
      <div><span>52w Low</span><b>{f(stats.data.low52)}</b></div>
    </div>
  </div>
{:else}<Unavailable label="Key Stats" />{/if}
<style>
  .ks { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:14px; }
  .ks-h { font-size:.7rem; font-weight:600; color:var(--text); margin-bottom:10px; }
  .ks-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
  .ks-grid div { background:var(--bg, rgba(255,255,255,.02)); border-radius:6px; padding:6px 8px; }
  .ks-grid span { display:block; font-size:.6rem; color:var(--muted); text-transform:uppercase; }
  .ks-grid b { font-size:.85rem; color:var(--text); }
</style>
```

```svelte
<!-- BidAsk.svelte -->
<script lang="ts">
  import type { StockDetailVM } from '$lib/services/stock-detail.service';
  import Unavailable from './Unavailable.svelte';
  export let bidAsk: StockDetailVM['bidAsk'];
</script>
{#if bidAsk.status === 'ok' && bidAsk.data && (bidAsk.data.bid != null || bidAsk.data.ask != null)}
  <div class="ba">
    <div class="ba-c"><span>Bid</span><b class="bid">{bidAsk.data.bid?.toFixed(2) ?? '—'}</b></div>
    <div class="ba-c"><span>Ask</span><b class="ask">{bidAsk.data.ask?.toFixed(2) ?? '—'}</b></div>
  </div>
{:else}<Unavailable label="Bid / Ask" />{/if}
<style>
  .ba { display:flex; gap:8px; }
  .ba-c { flex:1; background:var(--card); border:1px solid var(--border); border-radius:10px; padding:12px; text-align:center; }
  .ba-c span { font-size:.6rem; color:var(--muted); text-transform:uppercase; }
  .ba-c b { display:block; font-size:1rem; } .bid { color:#39d98a; } .ask { color:#f6685e; }
</style>
```

```svelte
<!-- SectorPeers.svelte -->
<script lang="ts">
  import type { StockDetailVM } from '$lib/services/stock-detail.service';
  import Unavailable from './Unavailable.svelte';
  export let peers: StockDetailVM['peers'];
  const code = (c: string) => c.includes('.') ? c.split('.')[1] : c;
</script>
{#if peers.status === 'ok' && peers.data?.length}
  <div class="pe">
    <div class="pe-h">Sector Peers</div>
    {#each peers.data as p}
      <a class="pe-row" href={`/stocks/${encodeURIComponent(code(p.symbol))}`}>
        <span class="pe-sym">{code(p.symbol)}</span>
        <span class="pe-name">{p.name}</span>
        <span class="pe-chg" class:up={(p.changePct??0)>=0} class:down={(p.changePct??0)<0}>{p.changePct==null?'—':(p.changePct>=0?'+':'')+p.changePct.toFixed(2)+'%'}</span>
      </a>
    {/each}
  </div>
{:else}<Unavailable label="Sector Peers" />{/if}
<style>
  .pe { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:14px; }
  .pe-h { font-size:.7rem; font-weight:600; color:var(--text); margin-bottom:8px; }
  .pe-row { display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border); text-decoration:none; }
  .pe-row:last-child { border-bottom:none; }
  .pe-sym { font-size:.76rem; font-weight:700; color:var(--text); min-width:64px; }
  .pe-name { font-size:.7rem; color:var(--muted); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .pe-chg.up { color:#39d98a; } .pe-chg.down { color:#f6685e; font-size:.76rem; }
</style>
```

```svelte
<!-- PositionActions.svelte -->
<script lang="ts">
  import { invalidateAll, goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import type { StockDetailVM } from '$lib/services/stock-detail.service';
  export let detail: StockDetailVM;
  export let onAdd: () => void = () => {};
  $: pos = detail.position;
</script>
<div class="pa">
  <div class="pa-h">Your Position</div>
  {#if pos}
    <div class="pa-row"><span>Shares</span><b>{pos.owned}</b></div>
    <div class="pa-row"><span>Avg cost</span><b>{pos.avgCost.toFixed(2)}</b></div>
    <div class="pa-row"><span>Market value</span><b>{pos.marketValue.toFixed(2)}</b></div>
    <div class="pa-row"><span>Unrealized P/L</span><b class:up={pos.unrealizedPnl>=0} class:down={pos.unrealizedPnl<0}>{pos.unrealizedPnl>=0?'+':''}{pos.unrealizedPnl.toFixed(2)}</b></div>
  {:else}
    <p class="pa-empty">You don't hold {detail.asset.symbol}.</p>
  {/if}
  <div class="pa-actions">
    <button class="btn primary" on:click={onAdd}>Add to portfolio</button>
    <button class="btn" on:click={() => goto(`/paper-trading?symbol=${encodeURIComponent(detail.asset.symbol)}`)}>Paper trade</button>
    <form method="POST" action="?/toggleWatchlist" use:enhance={() => async ({ update }) => { await update(); await invalidateAll(); }}>
      <input type="hidden" name="assetId" value={detail.asset.id} />
      <button class="btn ghost" type="submit">{detail.watchlisted ? '★ Watchlisted' : '☆ Watchlist'}</button>
    </form>
  </div>
</div>
<style>
  .pa { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:14px; }
  .pa-h { font-size:.7rem; font-weight:600; color:var(--text); margin-bottom:8px; }
  .pa-row { display:flex; justify-content:space-between; font-size:.78rem; color:var(--muted); padding:3px 0; }
  .pa-row b.up, b.up { color:#39d98a; } .pa-row b.down, b.down { color:#f6685e; }
  .pa-empty { font-size:.74rem; color:var(--muted); }
  .pa-actions { display:flex; flex-direction:column; gap:6px; margin-top:10px; }
  .btn { font-size:.74rem; font-weight:600; padding:7px; border-radius:7px; border:1px solid var(--border); background:none; color:var(--text); cursor:pointer; }
  .btn.primary { background:var(--primary); color:#fff; border-color:var(--primary); }
  .btn.ghost { color:var(--muted); }
  .pa-actions form { margin:0; }
</style>
```

- [ ] **Step 5: Type-check**

Run: `npm run check`
Expected: no errors in the new components.

- [ ] **Step 6: Commit**

```bash
git add src/lib/components/stocks/detail/
git commit -m "feat(stocks): overview detail components (header/chart/flow/stats/position/peers/bidask)"
```

---

## Task 8: Compose the Overview page

**Files:**
- Create: `src/routes/stocks/[symbol]/+page.svelte`
- Modify: `src/routes/stocks/[symbol]/+page.server.ts` (add market timezone to load)

- [ ] **Step 1: Add market timezone to `load`**

In `+page.server.ts` `load`, after building `vm`, look up the timezone for the asset's market via `getGlobalMarkets()` (cached, tolerant) and return it:

```ts
import { getGlobalMarkets } from '$lib/services/broker.service';
// inside load, after vm:
const tz = await getGlobalMarkets()
  .then((g) => g.markets.find((m) => m.key?.toUpperCase() === (vm.asset.market ?? 'US').toUpperCase())?.timezone ?? null)
  .catch(() => null);
return { detail: vm, timezone: tz };
```

- [ ] **Step 2: Compose the two-column layout**

```svelte
<!-- src/routes/stocks/[symbol]/+page.svelte -->
<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import StockDetailHeader from '$lib/components/stocks/detail/StockDetailHeader.svelte';
  import PriceChart from '$lib/components/stocks/detail/PriceChart.svelte';
  import MoneyFlowPanel from '$lib/components/stocks/detail/MoneyFlowPanel.svelte';
  import KeyStatsGrid from '$lib/components/stocks/detail/KeyStatsGrid.svelte';
  import PositionActions from '$lib/components/stocks/detail/PositionActions.svelte';
  import SectorPeers from '$lib/components/stocks/detail/SectorPeers.svelte';
  import BidAsk from '$lib/components/stocks/detail/BidAsk.svelte';
  import AddDrawer from '$lib/components/stocks/AddDrawer.svelte';
  import OptionsPanel from '$lib/components/stocks/detail/OptionsPanel.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
  $: d = data.detail;
  let tab: 'overview' | 'options' = 'overview';
  let refreshing = false;
  let drawerOpen = false;

  async function refresh() { refreshing = true; try { await invalidateAll(); } finally { refreshing = false; } }
</script>

<PageHeader title={d.asset.symbol} subtitle={d.asset.name}
  breadcrumb={[{ label: 'Stocks', href: '/stocks' }, { label: d.asset.symbol }]} />

<StockDetailHeader detail={d} timezone={data.timezone} onRefresh={refresh} {refreshing} />

<div class="tabs" role="tablist">
  <button role="tab" aria-selected={tab==='overview'} class:active={tab==='overview'} on:click={() => tab='overview'}>Overview</button>
  <button role="tab" aria-selected={tab==='options'} class:active={tab==='options'} on:click={() => tab='options'}>Options</button>
</div>

{#if tab === 'overview'}
  <div class="grid">
    <div class="main">
      {#if d.candles.status === 'ok'}<PriceChart symbol={d.asset.symbol} initial={d.candles.data ?? []} />{/if}
      <MoneyFlowPanel flow={d.flow} />
      <SectorPeers peers={d.peers} />
    </div>
    <aside class="rail">
      <PositionActions detail={d} onAdd={() => drawerOpen = true} />
      <KeyStatsGrid stats={d.stats} />
      <BidAsk bidAsk={d.bidAsk} />
    </aside>
  </div>
{:else}
  <OptionsPanel symbol={d.asset.symbol} />
{/if}

<AddDrawer bind:open={drawerOpen} selectedAsset={{ id: d.asset.id, symbol: d.asset.symbol, name: d.asset.name, currency: d.asset.currency, country: d.asset.market, sector: d.asset.sector, assetType: 'stock', exchange: null, latestPrice: d.header.data?.lastPrice ?? 0, createdAt: new Date(), updatedAt: new Date() }} />

<style>
  .tabs { display:flex; gap:4px; margin:14px 0; }
  .tabs button { padding:6px 14px; border-radius:8px; border:1px solid var(--border); background:none; color:var(--muted); font-size:.78rem; font-weight:600; cursor:pointer; }
  .tabs button.active { background:rgba(var(--primary-rgb),.12); border-color:var(--primary); color:var(--primary); }
  .grid { display:grid; grid-template-columns:1.7fr 1fr; gap:14px; align-items:start; }
  .main, .rail { display:flex; flex-direction:column; gap:14px; }
  .rail { position:sticky; top:16px; }
  @media (max-width:1023px){ .grid { grid-template-columns:1fr; } .rail { position:static; } }
</style>
```

- [ ] **Step 3: Manual smoke (dev server)**

Visit `http://127.0.0.1:5173/stocks/NVDA` while logged in. Expected: header with price, Overview tab shows chart + flow + peers (left) and position + stats + bid/ask (right); blocks with no data show "Data Not Available"; Options tab renders the panel (Phase 2).

- [ ] **Step 4: Commit**

```bash
git add src/routes/stocks/[symbol]/+page.svelte src/routes/stocks/[symbol]/+page.server.ts
git commit -m "feat(stocks): compose overview detail page (two-column, tabs)"
```

> **Note:** `OptionsPanel.svelte` is created in Phase 2. To compile Phase 1 alone, add a stub `OptionsPanel.svelte` that renders `<p>Options — coming soon</p>` and replace it in Task 12.

---

## Task 9: Overview e2e

**Files:**
- Create: `tests/e2e/stock-detail/overview.spec.ts`

- [ ] **Step 1: Write the spec (creds-gated, matches trading-audit pattern)**

```ts
// tests/e2e/stock-detail/overview.spec.ts
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle, expectNoHorizontalOverflow, VIEWPORTS } from '../ai-ux/helpers';

test('anonymous /stocks/NVDA redirects to login', async ({ page }) => {
  const res = await page.goto('/stocks/NVDA');
  expect(res!.status()).toBeLessThan(500);
  await expect(page).toHaveURL(/\/login/);
});

test.describe('stock detail — authenticated', () => {
  test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
  test.beforeEach(async ({ page }) => signInByApi(page));

  test('overview renders header + tabs', async ({ page }) => {
    await gotoAndSettle(page, '/stocks/NVDA');
    if (page.url().match(/onboarding|login/)) test.skip(true, 'redirected');
    await expect(page.getByRole('heading', { name: 'NVDA' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /options/i })).toBeVisible();
  });

  for (const vp of VIEWPORTS) {
    test(`no overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/stocks/NVDA');
      if (page.url().match(/onboarding|login/)) test.skip(true, 'redirected');
      await expectNoHorizontalOverflow(page);
    });
  }
});
```

- [ ] **Step 2: Run the anon test (no creds needed)**

Run: `node node_modules/@playwright/test/cli.js test tests/e2e/stock-detail/overview.spec.ts -g "redirects to login" --reporter=line`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/stock-detail/overview.spec.ts
git commit -m "test(stocks): e2e for stock detail overview (auth + mobile)"
```

---

# PHASE 2 — Options tab

## Task 10: Bridge spread candidates (pure math)

**Files:**
- Modify: `moomoo-service/options_logic.py` (add `spread_candidates`)
- Modify: `moomoo-service/tests/test_options.py`

- [ ] **Step 1: Write the failing test**

```python
# append to moomoo-service/tests/test_options.py
from options_logic import spread_candidates

class TestSpreadCandidates(unittest.TestCase):
    def _chain(self):
        # puts at 5.0/4.5 with mids 0.40/0.25 → bull put credit spread width 0.5
        return [
            {"option_type": "PUT", "strike": 5.0, "bid": 0.38, "ask": 0.42, "delta": -0.30},
            {"option_type": "PUT", "strike": 4.5, "bid": 0.23, "ask": 0.27, "delta": -0.18},
        ]

    def test_bull_put_credit_spread_max_loss_profit(self):
        out = spread_candidates(self._chain(), strategy="bull_put", width=0.5)
        self.assertEqual(len(out), 1)
        c = out[0]
        # net credit = 0.40 - 0.25 = 0.15 → max profit 15, max loss (0.5-0.15)*100 = 35
        self.assertAlmostEqual(c["net_credit"], 0.15, places=2)
        self.assertAlmostEqual(c["max_profit"], 15.0, places=2)
        self.assertAlmostEqual(c["max_loss"], 35.0, places=2)
        self.assertEqual(c["short_strike"], 5.0)
        self.assertEqual(c["long_strike"], 4.5)

    def test_no_pair_when_width_not_found(self):
        self.assertEqual(spread_candidates(self._chain(), strategy="bull_put", width=2.0), [])
```

- [ ] **Step 2: Run to verify it fails**

Run: `c:/Ampps/www/az/backend/venv/Scripts/python.exe -m unittest moomoo-service.tests.test_options` (from repo root: `cd moomoo-service && python -m unittest tests.test_options`)
Expected: FAIL — `spread_candidates` missing.

- [ ] **Step 3: Implement `spread_candidates`**

```python
# append to moomoo-service/options_logic.py
def spread_candidates(chain: list[dict[str, Any]], strategy: str = "bull_put", width: float = 0.5) -> list[dict[str, Any]]:
    """Pair two legs of the same type into a vertical credit spread and price it
    with the existing vertical_spread_* helpers. Currently supports 'bull_put'
    (sell higher-strike put, buy lower-strike put) and 'bear_call' (sell lower
    call, buy higher call). Pure: takes a chain, returns candidate dicts."""
    is_put = strategy == "bull_put"
    legs = [r for r in chain if str(r.get("option_type", "")).lower().startswith("p" if is_put else "c")]
    by_strike = {round(float(r.get("strike") or 0), 2): r for r in legs}
    out: list[dict[str, Any]] = []
    for strike, short_leg in by_strike.items():
        # credit spread: long leg is `width` further OTM
        long_strike = round(strike - width, 2) if is_put else round(strike + width, 2)
        long_leg = by_strike.get(long_strike)
        if not long_leg:
            continue
        short_mid = option_mid(short_leg.get("bid") or 0, short_leg.get("ask") or 0)
        long_mid = option_mid(long_leg.get("bid") or 0, long_leg.get("ask") or 0)
        net_credit = round(short_mid - long_mid, 4)
        if net_credit <= 0:
            continue
        out.append({
            "strategy": strategy,
            "short_strike": strike,
            "long_strike": long_strike,
            "width": round(width, 2),
            "net_credit": net_credit,
            "max_profit": vertical_spread_max_profit(width, net_credit, is_debit=False),
            "max_loss": vertical_spread_max_loss(width, net_credit, is_debit=False),
            "short_delta": short_leg.get("delta"),
        })
    out.sort(key=lambda x: x["max_profit"], reverse=True)
    return out
```

- [ ] **Step 4: Run to verify pass**

Run: `cd moomoo-service && c:/Ampps/www/az/backend/venv/Scripts/python.exe -m unittest tests.test_options`
Expected: OK (all tests).

- [ ] **Step 5: Commit**

```bash
git add moomoo-service/options_logic.py moomoo-service/tests/test_options.py
git commit -m "feat(bridge): vertical credit-spread candidate pairing (pure)"
```

---

## Task 11: Bridge endpoint + broker.service spread fn + options API endpoints

**Files:**
- Modify: `moomoo-service/main.py` (add `GET /options/spread-candidates`)
- Modify: `src/lib/services/broker.service.ts` (add `getOptionSpreadCandidates`)
- Create: `src/routes/api/stocks/[symbol]/options/expiry/+server.ts`
- Create: `src/routes/api/stocks/[symbol]/options/chain/+server.ts`
- Create: `src/routes/api/stocks/[symbol]/options/candidates/+server.ts`

- [ ] **Step 1: Bridge endpoint** — in `main.py`, add an endpoint that calls `get_option_chain` for `symbol`/`expiry` then `spread_candidates(chain, strategy, width)` and returns `{ "symbol", "expiry", "strategy", "candidates": [...] }`. Follow the existing `options_candidates` structure for ctx setup and `_records`.

- [ ] **Step 2: `getOptionSpreadCandidates` in `broker.service.ts`**

```ts
export type OptionSpreadCandidate = {
  strategy: string; short_strike: number; long_strike: number; width: number;
  net_credit: number; max_profit: number; max_loss: number; short_delta: number | null;
};
export async function getOptionSpreadCandidates(symbol: string, expiry: string, strategy = 'bull_put', width = 0.5): Promise<OptionSpreadCandidate[]> {
  try {
    const params = new URLSearchParams({ symbol, expiry, strategy, width: String(width) });
    const res = await fetch(`${bridgeBase()}/options/spread-candidates?${params}`, { signal: AbortSignal.timeout(20000) });
    if (!res.ok) return [];
    return (await res.json()).candidates ?? [];
  } catch { return []; }
}
```

- [ ] **Step 3: Options API endpoints (thin wrappers)**

```ts
// src/routes/api/stocks/[symbol]/options/expiry/+server.ts
import { json } from '@sveltejs/kit';
import { getOptionExpiry } from '$lib/services/broker.service';
import { expiryDte } from '$lib/services/stock-detail.service';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ params, locals }) => {
  void locals.user!;
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  try {
    const r = await getOptionExpiry(symbol);
    return json({ status: 'ready', expiries: r.expiry_dates.map((d) => ({ date: d, dte: expiryDte(d) })) });
  } catch { return json({ status: 'unavailable', expiries: [] }); }
};
```

```ts
// src/routes/api/stocks/[symbol]/options/chain/+server.ts
import { json } from '@sveltejs/kit';
import { getOptionChain } from '$lib/services/broker.service';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ params, url, locals }) => {
  void locals.user!;
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  const expiry = url.searchParams.get('expiry') ?? '';
  const type = (url.searchParams.get('type') ?? 'all') as 'call' | 'put' | 'all';
  if (!expiry) return json({ status: 'error', chain: [] }, { status: 400 });
  try { return json({ status: 'ready', ...(await getOptionChain(symbol, expiry, type)) }); }
  catch { return json({ status: 'unavailable', chain: [] }); }
};
```

```ts
// src/routes/api/stocks/[symbol]/options/candidates/+server.ts
import { json } from '@sveltejs/kit';
import { getOptionCandidates, getOptionSpreadCandidates } from '$lib/services/broker.service';
import type { RequestHandler } from './$types';
export const GET: RequestHandler = async ({ params, url, locals }) => {
  void locals.user!;
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  const mode = url.searchParams.get('mode') ?? 'both'; // cc | csp | both | spread
  try {
    if (mode === 'spread') {
      const expiry = url.searchParams.get('expiry') ?? '';
      const strategy = url.searchParams.get('strategy') ?? 'bull_put';
      return json({ status: 'ready', mode, candidates: await getOptionSpreadCandidates(symbol, expiry, strategy) });
    }
    const r = await getOptionCandidates([symbol], mode as 'cc' | 'csp' | 'both');
    return json({ status: 'ready', mode, candidates: r.candidates });
  } catch { return json({ status: 'unavailable', candidates: [] }); }
};
```

- [ ] **Step 4: Type-check + Python tests**

Run: `npm run check` (expect clean) and `cd moomoo-service && python -m unittest tests.test_options` (expect OK).

- [ ] **Step 5: Commit**

```bash
git add moomoo-service/main.py src/lib/services/broker.service.ts src/routes/api/stocks/[symbol]/options/
git commit -m "feat(stocks): options API endpoints + spread-candidate bridge fn"
```

---

## Task 12: OptionsPanel component

**Files:**
- Create (replace stub): `src/lib/components/stocks/detail/OptionsPanel.svelte`

- [ ] **Step 1: Implement the panel (expiry/DTE/Delta/strategy filters + Greeks table)**

```svelte
<!-- OptionsPanel.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  export let symbol: string;

  type Expiry = { date: string; dte: number };
  type Row = { strike: number | null; option_type: string; bid: number | null; ask: number | null; mid: number | null; implied_volatility: number | null; delta: number | null; theta: number | null; open_interest: number | null };

  let expiries: Expiry[] = [];
  let expiry = '';
  let strategy: 'all' | 'cc' | 'csp' | 'spread' = 'all';
  let dteMin = 30, dteMax = 45;
  let deltaMin = 0.2, deltaMax = 0.35;
  let rows: Row[] = [];
  let loading = false;
  let loaded = false;

  async function init() {
    loaded = true; loading = true;
    try {
      const r = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/options/expiry`).then((x) => x.json());
      expiries = r.expiries ?? [];
      const inWindow = expiries.find((e) => e.dte >= dteMin && e.dte <= dteMax) ?? expiries[0];
      if (inWindow) { expiry = inWindow.date; await loadChain(); }
    } finally { loading = false; }
  }

  async function loadChain() {
    if (!expiry) return;
    loading = true;
    try {
      const type = strategy === 'cc' ? 'call' : strategy === 'csp' ? 'put' : 'all';
      const r = await fetch(`/api/stocks/${encodeURIComponent(symbol)}/options/chain?expiry=${expiry}&type=${type}`).then((x) => x.json());
      rows = r.chain ?? [];
    } finally { loading = false; }
  }

  $: visible = rows.filter((r) => r.delta == null || (Math.abs(r.delta) >= deltaMin && Math.abs(r.delta) <= deltaMax));
  $: if (!loaded) init();

  function paper(r: Row) { goto(`/paper-trading?symbol=${encodeURIComponent(symbol)}&type=option&strike=${r.strike}&expiry=${expiry}&side=${r.option_type}`); }
</script>

<div class="op">
  <div class="op-bar">
    <div class="pills">
      {#each expiries.slice(0, 6) as e}
        <button class:active={expiry===e.date} on:click={() => { expiry=e.date; loadChain(); }}>{e.date.slice(5)} · {e.dte}d</button>
      {/each}
    </div>
    <div class="pills">
      {#each [['all','All'],['cc','Covered call'],['csp','Cash-secured put'],['spread','Credit spread']] as [v,l]}
        <button class:active={strategy===v} on:click={() => { strategy=v; loadChain(); }}>{l}</button>
      {/each}
    </div>
  </div>
  <div class="op-filters">
    <label>DTE <input type="number" bind:value={dteMin} min="0" /> – <input type="number" bind:value={dteMax} min="0" /></label>
    <label>|Δ| <input type="number" step="0.05" bind:value={deltaMin} /> – <input type="number" step="0.05" bind:value={deltaMax} /></label>
  </div>

  {#if loading}
    <p class="op-msg">Loading chain…</p>
  {:else if visible.length === 0}
    <p class="op-msg">Data Not Available for this expiry / filter.</p>
  {:else}
    <div class="op-table" role="table">
      <div class="op-thead" role="row"><span>Strike</span><span>Bid/Ask</span><span>IV</span><span>Δ</span><span>Θ</span><span>OI</span><span></span></div>
      {#each visible as r}
        <div class="op-trow" role="row">
          <span>{r.strike?.toFixed(1)} {r.option_type?.[0]?.toUpperCase()}</span>
          <span>{r.bid?.toFixed(2) ?? '—'}/{r.ask?.toFixed(2) ?? '—'}</span>
          <span>{r.implied_volatility != null ? (r.implied_volatility*100).toFixed(0)+'%' : '—'}</span>
          <span>{r.delta?.toFixed(2) ?? '—'}</span>
          <span>{r.theta?.toFixed(3) ?? '—'}</span>
          <span>{r.open_interest ?? '—'}</span>
          <span><button class="op-paper" on:click={() => paper(r)}>Paper</button></span>
        </div>
      {/each}
    </div>
    <p class="op-note">Read-only chain + paper-trade only — no live order path.</p>
  {/if}
</div>

<style>
  .op { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:14px; }
  .op-bar { display:flex; justify-content:space-between; flex-wrap:wrap; gap:8px; margin-bottom:8px; }
  .pills { display:flex; gap:3px; flex-wrap:wrap; }
  .pills button { font-size:.65rem; font-weight:600; padding:3px 9px; border-radius:6px; border:1px solid var(--border); background:none; color:var(--muted); cursor:pointer; }
  .pills button.active { color:var(--primary); background:rgba(var(--primary-rgb),.14); border-color:var(--primary); }
  .op-filters { display:flex; gap:14px; margin-bottom:10px; font-size:.7rem; color:var(--muted); }
  .op-filters input { width:48px; background:var(--card); border:1px solid var(--border); border-radius:5px; color:var(--text); padding:2px 5px; }
  .op-table { border:1px solid var(--border); border-radius:8px; overflow:hidden; }
  .op-thead, .op-trow { display:grid; grid-template-columns:1.1fr 1.2fr .8fr .7fr .9fr .8fr .9fr; gap:0; align-items:center; }
  .op-thead { font-size:.6rem; text-transform:uppercase; color:var(--muted); padding:6px 8px; border-bottom:1px solid var(--border); }
  .op-trow { font-size:.74rem; color:var(--text); padding:6px 8px; border-bottom:1px solid var(--border); }
  .op-trow:last-child { border-bottom:none; }
  .op-paper { font-size:.66rem; font-weight:600; padding:3px 8px; border-radius:5px; border:1px solid rgba(var(--primary-rgb),.3); background:rgba(var(--primary-rgb),.08); color:var(--primary); cursor:pointer; }
  .op-msg, .op-note { font-size:.72rem; color:var(--muted); padding:10px 2px; }
  @media (max-width:767px){ .op-thead span:nth-child(3), .op-trow span:nth-child(3){ display:none; } .op-thead, .op-trow { grid-template-columns:1.1fr 1.2fr .7fr .9fr .8fr .9fr; } }
</style>
```

- [ ] **Step 2: Remove the stub import note** — `+page.svelte` already imports `OptionsPanel`; no change needed beyond deleting the Phase-1 stub file content (now replaced).

- [ ] **Step 3: Type-check + manual smoke**

Run: `npm run check`. Then visit `/stocks/NVDA`, click **Options** → expiry pills load, chain shows Δ/Θ columns, DTE/Δ filters narrow rows, **Paper** buttons present.

- [ ] **Step 4: Commit**

```bash
git add src/lib/components/stocks/detail/OptionsPanel.svelte
git commit -m "feat(stocks): options panel — expiry/DTE/Delta filters + Greeks table"
```

---

## Task 13: Options e2e

**Files:**
- Create: `tests/e2e/stock-detail/options.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
// tests/e2e/stock-detail/options.spec.ts
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle } from '../ai-ux/helpers';

test.describe('stock detail — options', () => {
  test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
  test.beforeEach(async ({ page }) => signInByApi(page));

  test('options tab loads chain with Greeks and no live control', async ({ page }) => {
    await gotoAndSettle(page, '/stocks/NVDA');
    if (page.url().match(/onboarding|login/)) test.skip(true, 'redirected');
    await page.getByRole('tab', { name: /options/i }).click();
    // Either a chain renders or an explicit "Data Not Available" — never a crash.
    await expect(page.locator('.op')).toBeVisible();
    // No control offers a LIVE order.
    const liveBtn = page.getByRole('button', { name: /live/i });
    await expect(liveBtn).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Commit**

```bash
git add tests/e2e/stock-detail/options.spec.ts
git commit -m "test(stocks): e2e for options tab"
```

---

## Final verification

- [ ] Run full Vitest: `node node_modules/vitest/vitest.mjs run` — all pass.
- [ ] Run Python option tests: `cd moomoo-service && python -m unittest tests.test_options` — OK.
- [ ] Run anon e2e: `node node_modules/@playwright/test/cli.js test tests/e2e/stock-detail --reporter=line` — auth-redirect tests pass.
- [ ] (Optional, with creds + prod build) full e2e per the trading-audit pattern.

---

## Self-review notes (author)

- **Spec coverage:** Header/chart/flow/stats/position/peers/bidask (Tasks 4,7,8); Options expiry/chain/candidates + spreads + Greeks + DTE/Δ (Tasks 10–12); caching (Task 1,3); multi-market mapping (Task 2); market-TZ + market-state header (Tasks 7,8); invalidateAll watchlist (Task 7); "Data Not Available" (Task 4 + components). All covered.
- **Type consistency:** `BlockState<T>`, `StockDetailVM`, `toMoomooCode`, `expiryDte`, `cached`, `getOptionSpreadCandidates`/`OptionSpreadCandidate`, `spread_candidates` used consistently across tasks.
- **Deferred (per spec):** company profile; one-click 2-leg spread execution (candidates shown, paper leg-by-leg); auto-refresh; Redis cache backend (interface allows later drop-in).
