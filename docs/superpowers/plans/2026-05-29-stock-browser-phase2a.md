# Stock Browser Phase 2A — Real Data Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Phase 1 mock sparklines and stale DB prices with real market data — Moomoo when the broker is connected, Yahoo Finance otherwise.

**Architecture:** An adaptive price source layer (`price-source.ts`) checks if the Moomoo bridge is live; if so it batch-fetches US+HK prices via `/quotes/snapshot` and sparklines via `/quotes/history`; MY market always uses Yahoo Finance. Every `/stocks` page load calls `fetchPrices(assets)` server-side, returning a `priceMap` that flows down to StockCard → MiniSparkline.

**Tech Stack:** SvelteKit (TypeScript), Svelte 4, Prisma/MySQL, Yahoo Finance free API, Moomoo Python bridge (`http://127.0.0.1:8001`)

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Create | `src/lib/types/prices.ts` | `SparklineData` + `PriceData` types |
| Create | `src/lib/server/yahoo-finance.ts` | Batch quote fetch + sparkline history |
| Create | `src/lib/server/price-source.ts` | Adaptive Moomoo/Yahoo selection |
| Modify | `src/routes/stocks/+page.server.ts` | Add `fetchPrices` call + `priceMap` return |
| Modify | `src/lib/components/stocks/MiniSparkline.svelte` | Real data, gradient fill, hover tooltip |
| Modify | `src/lib/components/stocks/StockCard.svelte` | `priceData` prop, real price + `▲/▼ %` |
| Modify | `src/routes/stocks/+page.svelte` | Pass `priceData` to StockCard |

---

## Codebase context

**Pattern for server-side services:** See `src/lib/server/finnhub.ts` — plain TypeScript module, exports async functions, imports `$env/dynamic/private` for env vars when needed. No class, no constructor.

**Prisma import:** `import { prisma } from '$lib/server/db'`

**Svelte 4 syntax:** `export let`, `$:` reactive statements, `on:event`, `bind:prop`. No runes.

**CSS:** Custom properties only — `--primary` (#6c8fff), `--success` (#2dd4a0), `--danger` (#f96b7e), `--text` (#dce8ff), `--muted` (#7a8fb0), `--card` (#0f1523), `--border` (#1a2038). No Tailwind.

**Moomoo bridge:** Python FastAPI at `process.env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001'`
- `GET /status` → `{ quote_logged_in: boolean, ... }`
- `GET /quotes/snapshot?codes=US.AAPL,HK.00700,...` → `{ quotes: [{ code, last_price, change_rate }] }`
- `GET /quotes/history?code=US.AAPL&start=YYYY-MM-DD&end=YYYY-MM-DD&max_count=10` → `{ candles: [{ time_key, close }] }`

**Yahoo Finance free endpoints (no auth):**
- `GET https://query1.finance.yahoo.com/v7/finance/quote?symbols=AAPL,MSFT,...&fields=regularMarketPrice,regularMarketChangePercent` → `{ quoteResponse: { result: [{ symbol, regularMarketPrice, regularMarketChangePercent }] } }`
- `GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}?range=5d&interval=1d` → `{ chart: { result: [{ timestamp: number[], indicators: { quote: [{ close: (number|null)[] }] } }] } }`

---

## Task 1: Shared Price Types

**Files:**
- Create: `src/lib/types/prices.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/lib/types/prices.ts

export interface SparklineData {
  /** Normalized 0–1 values for SVG rendering, length ≤ 5 */
  points: number[];
  /** Actual closing prices for tooltip display */
  prices: number[];
  /** Short date labels, e.g. "Mon 26", length matches points */
  dates: string[];
  trend: 'up' | 'down' | 'flat';
}

export interface PriceData {
  /** Current / last-close price */
  price: number;
  /** % change from previous close — 2.1 means +2.1% */
  changePercent: number;
  sparkline: SparklineData | null;
}
```

- [ ] **Step 2: Verify TypeScript accepts it**

```
npx svelte-kit sync && npx tsc --noEmit 2>&1 | grep prices
```
Expected: no output (no errors).

- [ ] **Step 3: Commit**

```
git add src/lib/types/prices.ts
git commit -m "feat(stocks): add SparklineData and PriceData types"
```

---

## Task 2: Yahoo Finance Service

**Files:**
- Create: `src/lib/server/yahoo-finance.ts`

- [ ] **Step 1: Create the service**

```typescript
// src/lib/server/yahoo-finance.ts
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
```

- [ ] **Step 2: Type-check**

```
npx svelte-kit sync && npx tsc --noEmit 2>&1 | grep yahoo
```
Expected: no output.

- [ ] **Step 3: Commit**

```
git add src/lib/server/yahoo-finance.ts
git commit -m "feat(stocks): add Yahoo Finance batch quotes and sparkline service"
```

---

## Task 3: Price Source Layer

**Files:**
- Create: `src/lib/server/price-source.ts`

This layer wraps both Moomoo and Yahoo Finance. It checks Moomoo availability first (1s timeout), then routes assets accordingly — US+HK to Moomoo when live, MY always to Yahoo, everything to Yahoo when Moomoo is down.

- [ ] **Step 1: Create the service**

```typescript
// src/lib/server/price-source.ts
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
 */
function toMoomooCode(symbol: string, country: string): string | null {
  if (country === 'US') return `US.${symbol}`;
  if (country === 'HK') {
    const base = symbol.replace(/\.HK$/i, '').padStart(5, '0');
    return `HK.${base}`;
  }
  return null;
}

async function fetchFromMoomoo(assets: Asset[]): Promise<Map<string, PriceData>> {
  // Build a lookup map: moomooCode → dbSymbol
  const codeMap = new Map<string, string>();
  for (const a of assets) {
    const code = toMoomooCode(a.symbol, a.country ?? '');
    if (code) codeMap.set(code, a.symbol);
  }
  if (codeMap.size === 0) return new Map();

  const codes = [...codeMap.keys()];

  try {
    // 1. Batch snapshot — current price + % change for all codes in one call
    const snapRes = await fetch(
      `${BRIDGE_URL}/quotes/snapshot?codes=${codes.join(',')}`,
      { signal: AbortSignal.timeout(8000) }
    );
    if (!snapRes.ok) return new Map();
    const snap = await snapRes.json();
    const quotes: Array<{ code: string; last_price: number; change_rate: number }> =
      snap.quotes ?? [];

    const priceBySymbol = new Map<string, { price: number; changePercent: number }>();
    for (const q of quotes) {
      const dbSym = codeMap.get(q.code);
      if (dbSym && q.last_price > 0) {
        priceBySymbol.set(dbSym, {
          price: q.last_price,
          changePercent: q.change_rate ?? 0,
        });
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
```

- [ ] **Step 2: Type-check**

```
npx svelte-kit sync && npx tsc --noEmit 2>&1 | grep -E "price-source|yahoo"
```
Expected: no output.

- [ ] **Step 3: Commit**

```
git add src/lib/server/price-source.ts
git commit -m "feat(stocks): add adaptive price source layer (Moomoo + Yahoo Finance)"
```

---

## Task 4: Page Server Integration

**Files:**
- Modify: `src/routes/stocks/+page.server.ts` (current lines 1–42)

- [ ] **Step 1: Add the import and `fetchPrices` call**

Replace the existing `load` function with:

```typescript
// src/routes/stocks/+page.server.ts
import { fail } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { fetchPrices } from '$lib/server/price-source';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;

  const [assets, transactions, watchlistItems] = await Promise.all([
    prisma.asset.findMany({
      orderBy: [{ country: 'asc' }, { symbol: 'asc' }],
    }),
    prisma.transaction.findMany({
      where: { userId: user.id, type: { in: ['BUY', 'SELL'] } },
      select: { assetId: true, type: true, quantity: true, price: true },
    }),
    prisma.watchlistItem.findMany({
      where: { watchlist: { userId: user.id } },
      select: { assetId: true },
    }),
  ]);

  // Compute owned qty + avg cost per assetId
  const ownedMap: Record<string, { qty: number; avgCost: number }> = {};
  for (const tx of transactions) {
    if (!tx.assetId) continue;
    const existing = ownedMap[tx.assetId] ?? { qty: 0, avgCost: 0 };
    if (tx.type === 'BUY') {
      const totalCost = existing.avgCost * existing.qty + tx.price * tx.quantity;
      const totalQty  = existing.qty + tx.quantity;
      ownedMap[tx.assetId] = { qty: totalQty, avgCost: totalQty > 0 ? totalCost / totalQty : 0 };
    } else {
      ownedMap[tx.assetId] = {
        qty:     Math.max(0, existing.qty - tx.quantity),
        avgCost: existing.avgCost,
      };
    }
  }

  const watchlistSet = watchlistItems.map(w => w.assetId);

  // Fetch real prices — falls back gracefully if all sources fail
  const priceMap = await fetchPrices(assets);

  return {
    assets,
    ownedMap,
    watchlistSet,
    priceMap: Object.fromEntries(priceMap),
  };
};
```

Keep the `actions` block (`add` and `toggleWatchlist`) exactly as it is — do not change it.

- [ ] **Step 2: Type-check**

```
npx svelte-kit sync && npx tsc --noEmit 2>&1 | grep "page.server"
```
Expected: no output.

- [ ] **Step 3: Commit**

```
git add src/routes/stocks/+page.server.ts
git commit -m "feat(stocks): integrate real price fetch into stocks page load"
```

---

## Task 5: MiniSparkline — Real Data + Gradient + Hover Tooltip

**Files:**
- Modify: `src/lib/components/stocks/MiniSparkline.svelte` (full rewrite)

The current component is 26 lines — polyline only, no fill, no interaction. Replace it entirely.

- [ ] **Step 1: Rewrite MiniSparkline**

```svelte
<!-- src/lib/components/stocks/MiniSparkline.svelte -->
<script lang="ts">
  import type { SparklineData } from '$lib/types/prices';
  import { mockSparkline } from '$lib/data/stock-metadata';

  export let symbol: string;
  export let trend: 'up' | 'down' | 'flat' = 'flat';
  export let sparkline: SparklineData | undefined = undefined;
  /** Currency code for tooltip formatting: 'USD' | 'MYR' | 'HKD' */
  export let currency: string = 'USD';

  const W = 64;
  const H = 28;

  const CURRENCY_PREFIX: Record<string, string> = {
    USD: '$',
    MYR: 'RM ',
    HKD: 'HK$',
  };

  // Use real sparkline points if provided, otherwise fall back to mock
  $: rawPoints = sparkline ? sparkline.points : mockSparkline(symbol, trend);
  $: activeTrend = sparkline ? sparkline.trend : trend;

  $: color =
    activeTrend === 'up'
      ? 'var(--success)'
      : activeTrend === 'down'
      ? 'var(--danger)'
      : 'var(--muted)';

  // Unique gradient ID per symbol (safe for SVG defs)
  $: gradId = `spk-${symbol.replace(/[^a-zA-Z0-9]/g, '')}`;

  // Map normalized 0–1 points to SVG coordinates
  $: pts = rawPoints.map((p, i) => ({
    x: rawPoints.length === 1 ? W / 2 : (i / (rawPoints.length - 1)) * W,
    y: H - p * (H - 2) - 1, // 1px padding top/bottom
  }));

  $: polylineStr = pts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  // Close the fill polygon at bottom-right and bottom-left
  $: polygonStr =
    polylineStr +
    ` ${pts[pts.length - 1].x.toFixed(1)},${H} 0,${H}`;

  // Hover state
  let hoveredIdx: number | null = null;

  function handleMouseMove(e: MouseEvent) {
    if (!sparkline || pts.length === 0) return;
    const svg = e.currentTarget as SVGSVGElement;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const step = pts.length === 1 ? rect.width : rect.width / (pts.length - 1);
    hoveredIdx = Math.max(0, Math.min(pts.length - 1, Math.round(x / step)));
  }

  function handleMouseLeave() {
    hoveredIdx = null;
  }

  function fmtPrice(val: number): string {
    const prefix = CURRENCY_PREFIX[currency] ?? '$';
    return `${prefix}${val.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }
</script>

<div class="spark-wrap">
  {#if hoveredIdx !== null && sparkline}
    <div class="spark-tooltip">
      <span class="spark-date">{sparkline.dates[hoveredIdx]}</span>
      <span class="spark-price">{fmtPrice(sparkline.prices[hoveredIdx])}</span>
    </div>
  {/if}

  <svg
    width={W}
    height={H}
    viewBox="0 0 {W} {H}"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
    on:mousemove={handleMouseMove}
    on:mouseleave={handleMouseLeave}
    style="cursor:{sparkline ? 'crosshair' : 'default'}"
  >
    <defs>
      <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color={color} stop-opacity="0.25" />
        <stop offset="100%" stop-color={color} stop-opacity="0" />
      </linearGradient>
    </defs>

    <!-- Gradient fill area -->
    <polygon points={polygonStr} fill="url(#{gradId})" />

    <!-- Price line -->
    <polyline
      points={polylineStr}
      stroke={color}
      stroke-width="1.5"
      stroke-linejoin="round"
      stroke-linecap="round"
    />

    <!-- Hover dot -->
    {#if hoveredIdx !== null && pts[hoveredIdx]}
      <circle
        cx={pts[hoveredIdx].x}
        cy={pts[hoveredIdx].y}
        r="2.5"
        fill={color}
      />
    {/if}
  </svg>
</div>

<style>
  .spark-wrap {
    position: relative;
    display: inline-block;
    line-height: 0;
  }
  .spark-tooltip {
    position: absolute;
    bottom: calc(100% + 4px);
    left: 50%;
    transform: translateX(-50%);
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 3px 7px;
    font-size: 0.62rem;
    white-space: nowrap;
    pointer-events: none;
    z-index: 10;
    display: flex;
    gap: 5px;
    align-items: center;
  }
  .spark-date { color: var(--muted); }
  .spark-price { color: var(--text); font-weight: 600; }
</style>
```

- [ ] **Step 2: Type-check**

```
npx svelte-kit sync && npx tsc --noEmit 2>&1 | grep MiniSparkline
```
Expected: no output.

- [ ] **Step 3: Commit**

```
git add src/lib/components/stocks/MiniSparkline.svelte
git commit -m "feat(stocks): upgrade MiniSparkline with real data, gradient fill, hover tooltip"
```

---

## Task 6: StockCard — Real Price + % Change

**Files:**
- Modify: `src/lib/components/stocks/StockCard.svelte`

Add `priceData` prop, update price display to show real price + `▲/▼ %`, pass `sparkline` and `currency` to MiniSparkline.

- [ ] **Step 1: Update the script block**

Replace the `<script lang="ts">` block (lines 1–20) with:

```svelte
<script lang="ts">
  import type { Asset } from '@prisma/client';
  import type { StockMeta } from '$lib/data/stock-metadata';
  import type { PriceData } from '$lib/types/prices';
  import MiniSparkline from './MiniSparkline.svelte';
  import InvestmentTag from './InvestmentTag.svelte';
  import WatchlistToggle from './WatchlistToggle.svelte';

  export let asset: Asset;
  export let meta: StockMeta;
  export let owned: { qty: number; avgCost: number } | undefined = undefined;
  export let watchlisted: boolean;
  export let onAdd: () => void;
  export let onWatchlist: ((val: boolean) => void) | undefined = undefined;
  /** Real-time price data from price-source; null falls back to asset.latestPrice */
  export let priceData: PriceData | null = null;

  $: displayPrice = priceData?.price ?? asset.latestPrice;
  $: displayChange = priceData?.changePercent ?? null;
  $: priceColor =
    displayChange === null
      ? 'var(--text)'
      : displayChange > 0
      ? 'var(--success)'
      : displayChange < 0
      ? 'var(--danger)'
      : 'var(--text)';
  $: changeArrow = (displayChange ?? 0) >= 0 ? '▲' : '▼';

  $: ownedGain =
    owned && displayPrice > 0 ? (displayPrice - owned.avgCost) * owned.qty : 0;
  $: ownedPct =
    owned && owned.avgCost > 0
      ? ((displayPrice - owned.avgCost) / owned.avgCost) * 100
      : 0;
  $: displayTags = meta.tags.slice(0, 2);
</script>
```

- [ ] **Step 2: Update the template — price row and MiniSparkline**

In the template, replace the existing `<MiniSparkline ... />` line:
```svelte
    <MiniSparkline symbol={asset.symbol} trend={meta.sparkTrend} />
```
with:
```svelte
    <MiniSparkline
      symbol={asset.symbol}
      trend={priceData?.sparkline?.trend ?? meta.sparkTrend}
      sparkline={priceData?.sparkline ?? undefined}
      currency={asset.currency ?? 'USD'}
    />
```

Replace the existing `.card-price-row` div:
```svelte
  <div class="card-price-row">
    <span class="price">
      {price > 0 ? price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
      {#if asset.currency && asset.currency !== 'USD'}<span class="currency">{asset.currency}</span>{/if}
    </span>
    {#if owned && owned.qty > 0}
      <span class="owned-badge" class:gain={ownedGain >= 0} class:loss={ownedGain < 0}>
        {owned.qty.toFixed(owned.qty % 1 === 0 ? 0 : 2)} sh
        {ownedPct >= 0 ? '+' : ''}{ownedPct.toFixed(1)}%
      </span>
    {/if}
  </div>
```
with:
```svelte
  <div class="card-price-row">
    <div class="price-block">
      <span class="price" style="color:{priceColor}">
        {displayPrice > 0
          ? displayPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
          : '—'}
        {#if asset.currency && asset.currency !== 'USD'}<span class="currency">{asset.currency}</span>{/if}
      </span>
      {#if displayChange !== null}
        <span class="change" style="color:{priceColor}">
          {changeArrow} {Math.abs(displayChange).toFixed(2)}%
        </span>
      {/if}
    </div>
    {#if owned && owned.qty > 0}
      <span class="owned-badge" class:gain={ownedGain >= 0} class:loss={ownedGain < 0}>
        {owned.qty.toFixed(owned.qty % 1 === 0 ? 0 : 2)} sh
        {ownedPct >= 0 ? '+' : ''}{ownedPct.toFixed(1)}%
      </span>
    {/if}
  </div>
```

- [ ] **Step 3: Add CSS for the new elements**

Add inside the `<style>` block, after `.price { ... }`:

```css
  .price-block {
    display: flex;
    align-items: baseline;
    gap: 5px;
  }
  .change {
    font-size: 0.68rem;
    font-weight: 600;
  }
```

- [ ] **Step 4: Type-check**

```
npx svelte-kit sync && npx tsc --noEmit 2>&1 | grep StockCard
```
Expected: no output.

- [ ] **Step 5: Commit**

```
git add src/lib/components/stocks/StockCard.svelte
git commit -m "feat(stocks): StockCard shows real price + change % from priceData"
```

---

## Task 7: Main Page Wiring + End-to-End Verification

**Files:**
- Modify: `src/routes/stocks/+page.svelte`

- [ ] **Step 1: Pass `priceData` to StockCard**

Find the `<StockCard` usage in `+page.svelte`. It currently looks like:

```svelte
<StockCard
  {asset}
  {meta}
  owned={data.ownedMap[asset.id] ?? null}
  watchlisted={watchlistSet.has(asset.id)}
  onAdd={() => openDrawer(asset)}
  onWatchlist={(val) => {
    if (val) watchlistSet.add(asset.id);
    else watchlistSet.delete(asset.id);
    watchlistSet = watchlistSet;
  }}
/>
```

Add `priceData`:

```svelte
<StockCard
  {asset}
  {meta}
  owned={data.ownedMap[asset.id] ?? null}
  watchlisted={watchlistSet.has(asset.id)}
  priceData={data.priceMap[asset.symbol] ?? null}
  onAdd={() => openDrawer(asset)}
  onWatchlist={(val) => {
    if (val) watchlistSet.add(asset.id);
    else watchlistSet.delete(asset.id);
    watchlistSet = watchlistSet;
  }}
/>
```

- [ ] **Step 2: Full type-check**

```
npx svelte-kit sync && npx tsc --noEmit 2>&1 | grep -v node_modules | head -30
```
Expected: no errors (pre-existing unrelated errors are OK; no new errors in stocks files).

- [ ] **Step 3: Smoke test — start dev server**

```
npm run dev
```
Open `http://localhost:5173/stocks`. Verify:
1. Page loads (may take 1–3 seconds — external price fetch is happening server-side)
2. Stock cards show real prices instead of `$0.00` or `—`
3. Cards show `▲ x.xx%` in green or `▼ x.xx%` in red

- [ ] **Step 4: Test sparkline hover**

Hover over any stock card's sparkline SVG area. Verify:
1. A tooltip appears above the sparkline showing date + price
2. Tooltip updates as you move left/right across the sparkline
3. Tooltip disappears on mouse leave

- [ ] **Step 5: Test fallback**

Stop the Moomoo bridge service (if running). Reload `/stocks`. Verify:
1. Page still loads successfully
2. Prices are shown (now from Yahoo Finance)
3. No error overlay or broken UI

- [ ] **Step 6: Test with Moomoo disconnected from the start**

Ensure `isMoomooAvailable()` times out gracefully: the bridge URL should be unreachable. The page should load within ~3 seconds (1s Moomoo timeout + ~2s Yahoo Finance).

- [ ] **Step 7: Final commit**

```
git add src/routes/stocks/+page.svelte
git commit -m "feat(stocks): Phase 2A complete — real prices and sparklines from Moomoo/Yahoo Finance"
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Real prices on stock cards — Tasks 4, 6, 7
- ✅ 5-day sparklines — Tasks 2, 5
- ✅ Moomoo when connected — Task 3
- ✅ Yahoo Finance fallback — Task 2, 3
- ✅ MY market always Yahoo — Task 3 (`country === 'MY'` filter)
- ✅ Graceful degradation — all fetch functions return empty Map / null on error
- ✅ `currency` prop on MiniSparkline tooltip — Task 5
- ✅ Gradient fill + hover dot — Task 5
- ✅ `▲/▼ %` inline in StockCard — Task 6

**Type consistency check:**
- `SparklineData` defined in Task 1, used in Tasks 2, 3, 5, 6 ✅
- `PriceData` defined in Task 1, used in Tasks 3, 4, 6, 7 ✅
- `fetchPrices` exported in Task 3, imported in Task 4 ✅
- `priceData: PriceData | null` in StockCard (Task 6), passed as `data.priceMap[asset.symbol] ?? null` in Task 7 ✅
- `sparkline: SparklineData | undefined` in MiniSparkline (Task 5), passed as `priceData?.sparkline ?? undefined` from StockCard (Task 6) ✅
