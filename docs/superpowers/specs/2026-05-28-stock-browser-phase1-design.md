# Stock Browser Phase 1 — Visual & UX Upgrade Design

**Date:** 2026-05-28  
**Status:** Approved  
**Replaces:** `2026-05-28-stock-browser-design.md` (base spec, superseded by this document)

---

## Overview

Build `/stocks` as a modern AI-native stock discovery hub. Phase 1 delivers the full visual and interactive experience: curated grid, trending strip, enhanced cards with sparklines and investment tags, market status badges, options integration in the add drawer, watchlist toggles, and polished motion/mobile UX.

Phase 2 (separate spec) will layer on: AI semantic search, portfolio exposure analysis, DCA planner, ETF intelligence, `/stocks/[symbol]` detail pages, and AI recommendation engine.

---

## Goals

- New users can discover and add stocks/ETFs without knowing ticker symbols
- Page feels like a modern fintech product (TradingView/Robinhood quality)
- Options traders can jump directly to the wheel strategy from any stock
- Watchlist management is instant and frictionless
- Works great on mobile (full-screen drawer, thumb-friendly spacing)

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `src/routes/stocks/+page.svelte` | Main browse page — trending strip, search, tab grid, drawer |
| `src/routes/stocks/+page.server.ts` | Load curated assets + user holdings; `add` and `watchlist` actions |
| `src/routes/api/stocks/search/+server.ts` | Yahoo Finance symbol search proxy with 10-min in-memory cache |
| `src/routes/api/stocks/ensure/+server.ts` | Upsert asset from search result before opening drawer |
| `prisma/seed-stocks.ts` | One-time seed script — ~75 curated assets across US / MY / HK |
| `src/lib/components/stocks/TrendingStrip.svelte` | Horizontal scroll strip of trending category cards |
| `src/lib/components/stocks/StockCard.svelte` | Enhanced card — sparkline, stats, tags, ownership badge |
| `src/lib/components/stocks/MiniSparkline.svelte` | 7-point SVG sparkline (mock data, deterministic by symbol) |
| `src/lib/components/stocks/MarketStatusBadge.svelte` | Exchange open/closed/lunch badge, timezone-aware |
| `src/lib/components/stocks/AddDrawer.svelte` | Slide-in right drawer — Buy Shares / Trade Options tabs |
| `src/lib/components/stocks/WatchlistToggle.svelte` | ☆/★ toggle button, optimistic UI |
| `src/lib/components/stocks/InvestmentTag.svelte` | Colored chip — Dividend / Growth / AI / Beginner Friendly / etc. |
| `src/lib/components/stocks/SkeletonCard.svelte` | Loading placeholder matching StockCard dimensions |
| `src/lib/data/stock-metadata.ts` | Static map: symbol → { tags, aiSummary, pe, marketCap, dividendYield, sparkline } |

### Modified files

| File | Change |
|------|--------|
| `src/lib/config/nav.ts` | Add `{ label: 'Stocks', href: '/stocks', icon: '🏪' }` to Portfolio section children; add `/stocks` to Portfolio `matchPaths` |

### No schema changes
All enrichment data (sparklines, PE, tags, AI summaries) comes from `src/lib/data/stock-metadata.ts`. The existing `Asset` model is unchanged.

---

## Seed Data (`prisma/seed-stocks.ts`)

Run once: `npx tsx prisma/seed-stocks.ts`

Uses `prisma.asset.upsert` on `symbol` — safe to re-run.

### US Stocks (~30)
`AAPL, MSFT, NVDA, AMZN, GOOGL, META, TSLA, JPM, V, UNH, XOM, JNJ, WMT, PG, MA, HD, AVGO, LLY, ABBV, CVX, KO, PEP, BAC, TMO, COST, MCD, CSCO, ADBE, CRM, NFLX`

Each: `assetType: 'stock'`, `exchange: 'NASDAQ'|'NYSE'`, `currency: 'USD'`, `country: 'US'`, `sector` (e.g. Technology, Healthcare…)

### US ETFs (~15)
`VOO, QQQ, SPY, VTI, IVV, VEA, VWO, ARKK, GLD, TLT, HYG, XLK, XLF, SCHD, JEPI`

Each: `assetType: 'etf'`, `currency: 'USD'`, `country: 'US'`

### MY Market (~15)
`1155.KL (Maybank), 1295.KL (PBBank), 5347.KL (Tenaga), 1023.KL (CIMB), 5225.KL (IHH), 5183.KL (PetChem), 6888.KL (Axiata), 6012.KL (Maxis), 1082.KL (HLFG), 1066.KL (RHBBank), 5681.KL (PetDag), 7277.KL (Dialog), 0820EA.KL (KLCI ETF), 0821EA.KL (MYETF-DJIM), 5819.KL (Hong Leong Bank)`

Each: `currency: 'MYR'`, `country: 'MY'`, `exchange: 'KLSE'`

### HK Market (~15)
`0700.HK (Tencent), 0005.HK (HSBC), 1299.HK (AIA), 3690.HK (Meituan), 9988.HK (Alibaba), 1211.HK (BYD), 0941.HK (China Mobile), 0883.HK (CNOOC), 2318.HK (Ping An), 0939.HK (CCB), 1810.HK (Xiaomi), 0388.HK (HKEX), 2800.HK (Tracker Fund), 3033.HK (CSOP HSTECH ETF), 9618.HK (JD.com)`

Each: `currency: 'HKD'`, `country: 'HK'`, `exchange: 'HKEX'`

---

## Static Metadata (`src/lib/data/stock-metadata.ts`)

```typescript
export interface StockMeta {
  tags: string[];               // e.g. ['Dividend', 'Beginner Friendly']
  aiSummary: string;            // e.g. "Strong AI growth exposure"
  pe: number | null;            // e.g. 28.4
  marketCap: string | null;     // e.g. "$2.9T"
  dividendYield: number | null; // e.g. 0.52 (percent)
  sparkTrend: 'up' | 'down' | 'flat'; // used to color sparkline
  wheelFriendly: boolean;       // true = liquid options chain, show ✅ in drawer
}

export const STOCK_META: Record<string, StockMeta> = {
  AAPL: {
    tags: ['Growth', 'Beginner Friendly'],
    aiSummary: 'Premium consumer tech with strong ecosystem lock-in',
    pe: 28.4,
    marketCap: '$2.9T',
    dividendYield: 0.52,
    sparkTrend: 'up',
  },
  MSFT: {
    tags: ['AI', 'Growth', 'Dividend'],
    aiSummary: 'Cloud and AI leader with recurring revenue model',
    pe: 34.2,
    marketCap: '$3.1T',
    dividendYield: 0.72,
    sparkTrend: 'up',
  },
  VOO: {
    tags: ['ETF', 'Beginner Friendly', 'Diversified'],
    aiSummary: 'Broad S&P 500 exposure at minimal cost',
    pe: 22.1,
    marketCap: null,
    dividendYield: 1.38,
    sparkTrend: 'up',
  },
  // ... entries for all ~75 seeded assets
};

// Fallback by sector when symbol not in map
export const SECTOR_META: Record<string, Partial<StockMeta>> = {
  Technology: { tags: ['Growth'], aiSummary: 'Technology sector exposure' },
  Healthcare:  { tags: ['Defensive'], aiSummary: 'Defensive healthcare exposure' },
  Finance:     { tags: ['Dividend'], aiSummary: 'Financial sector dividend payer' },
  Energy:      { tags: ['Dividend', 'High Risk'], aiSummary: 'Commodity-driven energy stock' },
  // ...
};

export function getStockMeta(symbol: string, sector?: string | null): StockMeta {
  return STOCK_META[symbol] ?? {
    ...SECTOR_META[sector ?? ''],
    tags: [],
    aiSummary: '',
    pe: null,
    marketCap: null,
    dividendYield: null,
    sparkTrend: 'flat',
  };
}
```

---

## `/stocks` Page

### Server load (`+page.server.ts`)

```typescript
export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;

  const [assets, holdings, watchlistItems] = await Promise.all([
    prisma.asset.findMany({ orderBy: [{ country: 'asc' }, { symbol: 'asc' }] }),
    prisma.transaction.findMany({
      where: { userId: user.id, type: { in: ['BUY', 'SELL'] } },
      select: { assetId: true, type: true, quantity: true, price: true },
    }),
    prisma.watchlistItem.findMany({
      where: { watchlist: { userId: user.id } },
      select: { assetId: true },
    }),
  ]);

  // Compute owned quantities and avg cost per assetId
  const ownedMap = new Map<string, { qty: number; avgCost: number }>();
  for (const tx of holdings) {
    const existing = ownedMap.get(tx.assetId) ?? { qty: 0, avgCost: 0 };
    if (tx.type === 'BUY') {
      const totalCost = existing.avgCost * existing.qty + tx.price * tx.quantity;
      const totalQty = existing.qty + tx.quantity;
      ownedMap.set(tx.assetId, { qty: totalQty, avgCost: totalCost / totalQty });
    } else {
      ownedMap.set(tx.assetId, { qty: Math.max(0, existing.qty - tx.quantity), avgCost: existing.avgCost });
    }
  }

  const watchlistSet = new Set(watchlistItems.map(w => w.assetId));

  return {
    assets,
    ownedMap: Object.fromEntries(ownedMap),
    watchlistSet: [...watchlistSet],
  };
};
```

### Actions (`+page.server.ts`)

**`add` action** — creates a transaction:
```typescript
add: async ({ request, locals }) => {
  const user = locals.user!;
  const data = await request.formData();
  // validate: assetId, type (BUY/SELL), quantity > 0, price > 0, date
  const account = await prisma.account.findFirst({ where: { userId: user.id } });
  if (!account) return fail(400, { error: 'No portfolio account found' });
  await prisma.transaction.create({
    data: {
      userId: user.id,
      accountId: account.id,
      assetId: data.get('assetId') as string,
      type: data.get('type') as string,
      quantity: parseFloat(data.get('quantity') as string),
      price: parseFloat(data.get('price') as string),
      tradeDate: new Date(data.get('date') as string),
      fee: data.get('fee') ? parseFloat(data.get('fee') as string) : 0,
    },
  });
  return { added: true, symbol: data.get('symbol') };
},
```

**`toggleWatchlist` action** — adds or removes from watchlist:
```typescript
toggleWatchlist: async ({ request, locals }) => {
  const user = locals.user!;
  const data = await request.formData();
  const assetId = data.get('assetId') as string;
  const wl = await prisma.watchlist.findFirst({ where: { userId: user.id } })
          ?? await prisma.watchlist.create({ data: { userId: user.id, name: 'Watchlist' } });
  const existing = await prisma.watchlistItem.findFirst({ where: { watchlistId: wl.id, assetId } });
  if (existing) {
    await prisma.watchlistItem.delete({ where: { id: existing.id } });
    return { watchlisted: false };
  } else {
    await prisma.watchlistItem.create({ data: { watchlistId: wl.id, assetId } });
    return { watchlisted: true };
  }
},
```

### Page layout (`+page.svelte`)

```
<PageHeader title="Stocks" subtitle="Discover and add securities to your portfolio" />

<MarketStatusBadge /> row  (US · HK · MY badges)

<TrendingStrip categories={TRENDING_CATEGORIES} {assets} />

<div class="search-bar">
  🔍 <input bind:value={query} placeholder="Search any symbol or name…" />
</div>

{#if query.length >= 2}
  <!-- Search results panel (fade in) -->
  {#if searching} <SkeletonCard count={3} /> {/if}
  {#each searchResults as r}
    <SearchResultRow {r} onAdd={openDrawer} />
  {/each}
{:else}
  <!-- Tab filter -->
  <div class="tabs">All | US Stocks | US ETFs | MY Market | HK Market</div>

  <!-- Card grid -->
  {#if loading}
    {#each Array(6) as _} <SkeletonCard /> {/each}
  {:else}
    <div class="stock-grid">
      {#each filteredAssets as asset (asset.id)}
        <StockCard
          {asset}
          meta={getStockMeta(asset.symbol, asset.sector)}
          owned={ownedMap[asset.id]}
          watchlisted={watchlistSet.has(asset.id)}
          onAdd={() => openDrawer(asset)}
          onWatchlist={() => toggleWatchlist(asset)}
        />
      {/each}
    </div>
  {/if}
{/if}

<AddDrawer bind:open={drawerOpen} {selectedAsset} {accountId} />
```

---

## Trending Strip (`TrendingStrip.svelte`)

### Categories (static, client-side)

```typescript
const TRENDING_CATEGORIES = [
  { id: 'trending',  emoji: '🔥', label: 'Trending',      symbols: ['NVDA','TSLA','META','AAPL','MSFT'] },
  { id: 'dividend',  emoji: '💰', label: 'High Dividend',  symbols: ['JEPI','SCHD','1155.KL','1295.KL','VOO'] },
  { id: 'volume',    emoji: '⚡', label: 'High Volume',    symbols: ['SPY','QQQ','AMZN','0700.HK','AAPL'] },
  { id: 'ai',        emoji: '🚀', label: 'AI Stocks',      symbols: ['NVDA','MSFT','GOOGL','META','CRM'] },
  { id: 'defensive', emoji: '🛡', label: 'Defensive',      symbols: ['JNJ','KO','PG','WMT','ABBV'] },
  { id: 'mostAdded', emoji: '📈', label: 'Most Added',     symbols: ['VOO','AAPL','VTI','QQQ','MSFT'] },
  { id: 'aiPicks',   emoji: '🧠', label: 'AI Picks',       symbols: ['NVDA','AVGO','CRM','MSFT','GOOGL'] },
];
```

### Layout

Horizontal scroll container (CSS `overflow-x: auto; scroll-snap-type: x mandatory`).

Each category pill: click expands inline panel below strip showing 5 mini cards for that category's symbols. Click again to collapse. Only one expanded at a time.

Mini cards in the expanded panel:
```
[NVDA]  Nvidia Corp     $875.20  +2.3%
[TSLA]  Tesla Inc       $182.40  -0.8%
```
Each has a `+ Add` button that opens the main drawer.

---

## Enhanced Stock Card (`StockCard.svelte`)

```
┌─────────────────────────────────────┐
│  AAPL  ★            [sparkline SVG] │
│  Apple Inc.                         │
│  NASDAQ · Technology                │
│                                     │
│  $189.30   +1.2%   Owned: 35 sh    │
│  P/E 28.4  Mkt $2.9T  Div 0.52%   │
│                                     │
│  [Growth] [Beginner Friendly]       │
│  "Premium consumer tech with…"      │
│                                     │
│  [      + Add to Portfolio      ]   │
└─────────────────────────────────────┘
```

**Props:**
```typescript
interface StockCardProps {
  asset: Asset;
  meta: StockMeta;
  owned?: { qty: number; avgCost: number };
  watchlisted: boolean;
  onAdd: () => void;
  onWatchlist: () => void;
}
```

**Ownership badge** (shown only when `owned.qty > 0`):
```
Owned: 35 sh  Avg: $181.20
```
Tinted green if unrealized gain > 0 (uses `asset.latestPrice - owned.avgCost`).

**Hover effect:**
```css
.stock-card {
  transition: transform 0.15s ease, box-shadow 0.15s ease;
}
.stock-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 24px rgba(0,0,0,0.18);
}
```

---

## Mini Sparkline (`MiniSparkline.svelte`)

7-point SVG path. Data generated deterministically from the symbol string (so it looks consistent but requires no API call).

```typescript
function mockSparkline(symbol: string, trend: 'up' | 'down' | 'flat'): number[] {
  // Seed a pseudo-random sequence from symbol char codes
  let seed = symbol.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  const rand = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
  const base = 100;
  const points = Array.from({ length: 7 }, () => base + (rand() - 0.5) * 10);
  // Bias last point by trend
  if (trend === 'up')   points[6] = Math.max(...points) * 1.02;
  if (trend === 'down') points[6] = Math.min(...points) * 0.98;
  return points;
}
```

SVG output: `<polyline points="..." stroke="var(--success|--danger)" fill="none" stroke-width="1.5" />`

Width: 64px, height: 28px. No axes, no labels.

---

## Market Status Badge (`MarketStatusBadge.svelte`)

Shows badges for each exchange. Logic runs client-side using `new Date()` + the user's local timezone offset.

```typescript
interface Exchange {
  label: string;
  tz: string;           // IANA timezone
  openH: number;  openM: number;
  closeH: number; closeM: number;
  lunchStart?: { h: number; m: number };
  lunchEnd?:   { h: number; m: number };
}

const EXCHANGES: Exchange[] = [
  { label: 'US',  tz: 'America/New_York',    openH: 9,  openM: 30, closeH: 16, closeM: 0 },
  { label: 'HK',  tz: 'Asia/Hong_Kong',      openH: 9,  openM: 30, closeH: 16, closeM: 0,
    lunchStart: { h: 12, m: 0 }, lunchEnd: { h: 13, m: 0 } },
  { label: 'MY',  tz: 'Asia/Kuala_Lumpur',   openH: 9,  openM: 0,  closeH: 17, closeM: 0,
    lunchStart: { h: 12, m: 30 }, lunchEnd: { h: 14, m: 30 } },
];

type Status = 'open' | 'lunch' | 'closed';

function getStatus(ex: Exchange): Status {
  const now = new Date();
  const localStr = now.toLocaleString('en-US', { timeZone: ex.tz, hour12: false,
    weekday: 'short', hour: 'numeric', minute: 'numeric' });
  // Parse weekday, hour, minute from localStr
  const parts = localStr.split(', ');
  const weekday = parts[0]; // "Mon", "Tue"…
  const [h, m] = parts[1].split(':').map(Number);
  if (['Sat', 'Sun'].includes(weekday)) return 'closed';
  const mins = h * 60 + m;
  const open  = ex.openH  * 60 + ex.openM;
  const close = ex.closeH * 60 + ex.closeM;
  if (mins < open || mins >= close) return 'closed';
  if (ex.lunchStart && ex.lunchEnd) {
    const ls = ex.lunchStart.h * 60 + ex.lunchStart.m;
    const le = ex.lunchEnd.h   * 60 + ex.lunchEnd.m;
    if (mins >= ls && mins < le) return 'lunch';
  }
  return 'open';
}
```

**Badge styles:**
- `open` → green dot + "US Open"
- `lunch` → amber dot + "MY Lunch"
- `closed` → grey dot + "HK Closed"

Refreshes every 60 seconds via `setInterval`.

---

## Add Drawer (`AddDrawer.svelte`)

### Props
```typescript
interface DrawerProps {
  open: boolean;
  selectedAsset: Asset | null;
  accountId: string;
}
```

### Layout

Right side panel, slides in from right. On mobile (< 768px): full-screen overlay.

```
╔══════════════════════════════════╗
║  ✕                               ║
║  AAPL — Apple Inc.               ║
║  NASDAQ · Technology · $189.30   ║
║                                  ║
║  [BUY SHARES] [TRADE OPTIONS]    ║  ← tab toggle
║                                  ║
║  — BUY SHARES tab —              ║
║  Type:  [● BUY  ○ SELL]          ║
║  Qty:   [_____________]          ║
║  Price: [$189.30_______]         ║
║  Date:  [Today_________]         ║
║  Fee:   [optional______]         ║
║                                  ║
║  [    Add Transaction    ]       ║
║                                  ║
╚══════════════════════════════════╝
```

**TRADE OPTIONS tab:**
```
╔══════════════════════════════════╗
║  Trade Options — AAPL            ║
║                                  ║
║  Open the Wheel Strategy tool    ║
║  with AAPL pre-selected.         ║
║                                  ║
║  [  Open Wheel Strategy →  ]     ║  links to /optimization/options/wheel?symbol=AAPL
║                                  ║
║  — Wheel Readiness —             ║
║  ✅ Wheel Friendly               ║
║  Weekly options available        ║
║  High liquidity                  ║
║  [placeholder — future IV data]  ║
╚══════════════════════════════════╝
```

**Wheel Readiness logic (static for Phase 1):**
- "Wheel Friendly" if symbol is in a known liquid list (AAPL, MSFT, NVDA, TSLA, SPY, QQQ…)
- Otherwise "Low option liquidity"
- Stored in `STOCK_META[symbol].wheelFriendly: boolean`

### Submission
Uses SvelteKit `enhance` + `use:enhance` on a `<form action="?/add">`. On success:
1. Shows ✓ "Added AAPL!" for 1.5 seconds (inline success message)
2. Drawer stays open
3. `selectedAsset` cleared — user can pick another stock
4. Error state: inline message under the submit button

### Drawer transition
```css
.drawer {
  transform: translateX(100%);
  transition: transform 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}
.drawer.open {
  transform: translateX(0);
}
```
Backdrop: semi-transparent overlay, click to close.

---

## Watchlist Toggle (`WatchlistToggle.svelte`)

Displayed as ★/☆ icon in top-right of each StockCard.

**Optimistic UI:**
1. Click → immediately flip local `watchlisted` state (☆ → ★)
2. Fire `fetch('?/toggleWatchlist', { method: 'POST', body })` in background
3. On error → revert to previous state + show brief tooltip "Failed to update watchlist"

```typescript
async function toggle() {
  const previous = watchlisted;
  watchlisted = !watchlisted;   // optimistic
  const res = await fetch('?/toggleWatchlist', { method: 'POST', body: formData });
  if (!res.ok) watchlisted = previous;  // revert
}
```

Star color: `var(--warning)` when active, `var(--muted)` when inactive.
Animation: `transform: scale(1.3)` for 150ms on toggle.

---

## Investment Tag (`InvestmentTag.svelte`)

Compact colored chip.

```typescript
const TAG_COLORS: Record<string, { bg: string; color: string }> = {
  'Dividend':          { bg: 'rgba(var(--success-rgb),0.12)', color: 'var(--success)' },
  'Growth':            { bg: 'rgba(var(--primary-rgb),0.12)', color: 'var(--primary)' },
  'AI':                { bg: 'rgba(139,92,246,0.15)',          color: '#a78bfa' },
  'ETF':               { bg: 'rgba(var(--primary-rgb),0.08)', color: 'var(--muted)' },
  'Beginner Friendly': { bg: 'rgba(var(--success-rgb),0.08)', color: 'var(--success)' },
  'High Risk':         { bg: 'rgba(var(--danger-rgb),0.12)',  color: 'var(--danger)' },
  'Defensive':         { bg: 'rgba(59,130,246,0.12)',          color: '#60a5fa' },
  'Diversified':       { bg: 'rgba(var(--muted-rgb),0.1)',    color: 'var(--muted)' },
  'Income':            { bg: 'rgba(var(--success-rgb),0.12)', color: 'var(--success)' },
};
```

Max 2 tags shown on card; additional tags hidden (no overflow label needed).

---

## Skeleton Card (`SkeletonCard.svelte`)

Matches StockCard dimensions. Uses CSS animation:
```css
@keyframes shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skel {
  background: linear-gradient(90deg, var(--surface-2) 25%, var(--border) 50%, var(--surface-2) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.4s infinite;
  border-radius: 6px;
}
```

---

## Search API (`/api/stocks/search/+server.ts`)

```typescript
// In-memory cache: Map<query, { results, expiresAt }>
const cache = new Map<string, { results: SearchResult[]; expiresAt: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) return error(401);
  const q = url.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return json({ results: [] });

  const cached = cache.get(q);
  if (cached && cached.expiresAt > Date.now()) return json({ results: cached.results });

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`,
      { headers: { 'User-Agent': 'Mozilla/5.0' } }
    );
    const data = await res.json();
    const results: SearchResult[] = (data.quotes ?? [])
      .filter((q: any) => q.symbol && q.longname)
      .map((q: any) => ({
        symbol: q.symbol,
        name: q.longname ?? q.shortname ?? q.symbol,
        exchange: q.exchange ?? '',
        type: q.quoteType?.toLowerCase() ?? 'stock',
      }));
    cache.set(q, { results, expiresAt: Date.now() + CACHE_TTL });
    return json({ results });
  } catch {
    return json({ results: [] }); // silent degradation
  }
};
```

### Client-side search flow

```typescript
let query = '';
let searchResults: SearchResult[] = [];
let searching = false;
let searchTimer: ReturnType<typeof setTimeout>;

$: if (query.length >= 2) {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(doSearch, 400); // 400ms debounce
} else {
  searchResults = [];
}

async function doSearch() {
  searching = true;
  const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`);
  const data = await res.json();
  searchResults = data.results;
  searching = false;
}
```

---

## Asset Ensure API (`/api/stocks/ensure/+server.ts`)

Called when user clicks "+ Add" on a search result whose symbol may not be in the DB.

```typescript
POST body: { symbol, name, exchange, type }

// Upsert asset
const asset = await prisma.asset.upsert({
  where: { symbol },
  create: { symbol, name, assetType: type, exchange, currency: inferCurrency(symbol), country: inferCountry(symbol) },
  update: {},
});
return json({ assetId: asset.id });
```

`inferCurrency`: `.KL` → MYR, `.HK` → HKD, else USD.  
`inferCountry`: `.KL` → MY, `.HK` → HK, else US.

---

## Navigation (`nav.ts`)

```typescript
{
  id: 'portfolio',
  matchPaths: ['/holdings', '/transactions', '/accounts', '/watchlist', '/snapshots', '/stocks'],
  children: [
    { label: 'Holdings',     href: '/holdings',     icon: '📋' },
    { label: 'Transactions', href: '/transactions', icon: '💱' },
    { label: 'Stocks',       href: '/stocks',       icon: '🏪' },   // ← new
    { label: 'Watchlist',    href: '/watchlist',    icon: '👁️' },
    { label: 'Accounts',     href: '/accounts',     icon: '🏦' },
    { label: 'Snapshots',    href: '/snapshots',    icon: '📸' },
  ],
}
```

---

## Motion & UX Details

### Page load
- Grid cards fade in with staggered delay: `animation-delay: calc({index} * 30ms)`
- Skeleton cards shown for 0ms–until assets load (SvelteKit server load is synchronous, so skeletons only appear during navigation transitions)

### Search results
- Fade in: `opacity: 0 → 1` over 150ms
- Skeleton rows shown while `searching === true`

### Drawer
- Slide from right: `translateX(100%) → translateX(0)` over 250ms
- Backdrop: `opacity: 0 → 0.5` over 200ms

### Card hover
- `translateY(0) → translateY(-2px)` + box-shadow increase over 150ms

### Watchlist toggle
- Star scale pulse: `scale(1) → scale(1.3) → scale(1)` over 200ms

### Success feedback in drawer
- Green checkmark + "Added {symbol}!" fades in, holds 1.5s, fades out

---

## Mobile Experience

### Grid
- Desktop (≥ 1024px): 3 columns
- Tablet (768–1023px): 2 columns
- Mobile (< 768px): 1 column

### Trending strip
- Horizontal scroll, no scrollbar visible (`scrollbar-width: none`)
- Touch-friendly pill size (min-height: 44px)

### Drawer
- Desktop: right panel, 380px wide
- Mobile (< 768px): full-screen overlay (`position: fixed; inset: 0`)
- Sticky "Add Transaction" button at bottom of drawer on mobile

### Search bar
- Full width on all breakpoints
- Font size ≥ 16px on mobile (prevents iOS zoom)

---

## Testing Checklist

- [ ] `npx tsx prisma/seed-stocks.ts` inserts ~75 assets; re-run produces no duplicates
- [ ] `/stocks` loads and shows all curated assets
- [ ] Tab filter: "MY Market" shows only `country === 'MY'` assets
- [ ] Search: type "Apple" → results appear after 400ms debounce
- [ ] Search: type "a" (1 char) → no API call fired
- [ ] Search result "+ Add" for unknown symbol → asset created in DB, drawer opens
- [ ] Search cache: same query within 10 min does not fire second fetch
- [ ] Drawer opens with symbol + price pre-filled
- [ ] Drawer "Trade Options" tab → links to `/optimization/options/wheel?symbol=AAPL`
- [ ] Drawer submit with missing quantity → inline validation error
- [ ] Drawer submit valid → ✓ confirmation, drawer stays open
- [ ] Watchlist ☆ → ★ optimistic toggle; server error reverts
- [ ] Owned badge shows for holdings user already owns
- [ ] Market status badge: correct open/closed/lunch for current time
- [ ] Market status refreshes every 60s
- [ ] Sparklines render (no blank SVGs)
- [ ] Investment tags display with correct colors
- [ ] Card hover elevation effect visible
- [ ] Mobile: drawer is full-screen on < 768px viewport
- [ ] Mobile: grid collapses to 1 column
- [ ] Nav "Stocks" link appears under Portfolio flyout

---

## Out of Scope (Phase 2)

- AI semantic search ("high dividend ETFs", "Malaysian banking stocks")
- Portfolio exposure analysis in drawer
- DCA planner calculator
- ETF top holdings breakdown
- AI match system ("matches your income strategy")
- `/stocks/[symbol]` detail page
- Real IV / options chain data
- AI-generated summaries (live Anthropic API calls)
- Real sparkline data from Yahoo Finance
