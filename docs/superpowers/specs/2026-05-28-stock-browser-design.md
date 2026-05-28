# Stock Browser & Add-to-Portfolio Design

**Date:** 2026-05-28  
**Status:** Approved

---

## Overview

A dedicated `/stocks` page lets users discover and add stocks/ETFs without knowing ticker symbols in advance. A curated grid of popular securities loads instantly; a search box finds anything else via Yahoo Finance. Clicking **+ Add** opens a slide-in drawer where the user fills in transaction details without leaving the page.

---

## Goals

- New users (no Moomoo sync) can add transactions without a blank asset dropdown
- Users can discover popular stocks across US, MY, and HK markets
- Power users can find any worldwide symbol via live search
- Adding multiple stocks in one session stays fluid (drawer stays on page)

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `src/routes/stocks/+page.svelte` | Browse stocks UI + drawer |
| `src/routes/stocks/+page.server.ts` | Load curated assets, handle drawer submit |
| `src/routes/api/stocks/search/+server.ts` | Yahoo Finance symbol search proxy |
| `prisma/seed-stocks.ts` | One-time seed script for ~150 curated assets |

### Modified files

| File | Change |
|------|--------|
| `src/lib/components/portfolioai/Sidebar.svelte` | Add "Stocks" nav link under Transactions |

### No schema changes
The existing `Asset` model (`id, symbol, name, assetType, exchange, currency, sector, country, latestPrice`) covers all curated and searched securities.

---

## Seed Data (`prisma/seed-stocks.ts`)

A standalone script (run once with `npx tsx prisma/seed-stocks.ts`) upserts ~75 assets across four categories:

**US Stocks (~30):** AAPL, MSFT, NVDA, AMZN, GOOGL, META, TSLA, BRK-B, JPM, V, UNH, XOM, JNJ, WMT, PG, MA, HD, AVGO, LLY, MRK, ABBV, CVX, KO, PEP, BAC, TMO, COST, MCD, CSCO, ADBE

**US ETFs (~15):** VOO, QQQ, SPY, VTI, IVV, VEA, VWO, ARKK, GLD, TLT, HYG, XLK, XLF, SCHD, JEPI

**MY Market (~15):** MAYBANK (1155.KL), PBBANK (1295.KL), TENAGA (5347.KL), CIMB (1023.KL), IHH (5225.KL), PCHEM (5183.KL), AXIATA (6888.KL), DIGI (6947.KL), HLFG (1082.KL), RHBBANK (1066.KL), MAXIS (6012.KL), DIALOG (7277.KL), PETDAG (5681.KL), KLCI ETF (0820EA.KL), MYETF-DJIM (0821EA.KL)

**HK Market (~15):** Tencent (0700.HK), HSBC (0005.HK), AIA (1299.HK), Meituan (3690.HK), Alibaba (9988.HK), BYD (1211.HK), China Mobile (0941.HK), CNOOC (0883.HK), Ping An (2318.HK), China Construction Bank (0939.HK), Li Ning (2331.HK), Xiaomi (1810.HK), HKEX (0388.HK), Tracker Fund HSI (2800.HK), CSOP HSTECH ETF (3033.HK)

Each record includes: `symbol`, `name`, `assetType` (`stock` or `etf`), `exchange`, `currency`, `sector` (for stocks), `country`.

The script uses `prisma.asset.upsert` on `symbol` so re-running is safe.

---

## `/stocks` Page

### Server load (`+page.server.ts`)

```typescript
export const load: PageServerLoad = async ({ locals }) => {
  // Must be authenticated
  const assets = await prisma.asset.findMany({
    orderBy: [{ country: 'asc' }, { symbol: 'asc' }],
  });
  return { assets };
};
```

The `add` form action is defined here too (see Drawer section below).

### Page layout (`+page.svelte`)

```
PageHeader title="Browse Stocks"
[ 🔍 Search any symbol or name… ]          ← debounced 400ms, min 2 chars

Live search results (if query active):
  ┌─────────────────────────────────┐
  │ AAPL  Apple Inc · NASDAQ  + Add │
  │ AAPL.L Apple Inc · LSE    + Add │
  └─────────────────────────────────┘

Tabs: [ All ] [ US Stocks ] [ US ETFs ] [ MY Market ] [ HK Market ]

Card grid (3 cols desktop, 2 cols tablet, 1 col mobile):
  ┌──────────┐  ┌──────────┐  ┌──────────┐
  │ AAPL     │  │ VOO      │  │ MAYBANK  │
  │ Apple    │  │ Vanguard │  │ Maybank  │
  │ $189.30  │  │ $482.10  │  │ RM 9.20  │
  │  + Add   │  │  + Add   │  │  + Add   │
  └──────────┘  └──────────┘  └──────────┘

[ Slide-in drawer — right side, overlays page ]
```

**Tab filter logic:**
- All — show everything
- US Stocks — `country === 'US' && assetType === 'stock'`
- US ETFs — `country === 'US' && assetType === 'etf'`
- MY Market — `country === 'MY'`
- HK Market — `country === 'HK'`

**Prices:** Each card shows `asset.latestPrice` if available, otherwise `—`. No live price fetch on page load (user can hit "Update Prices" on Dashboard).

---

## Live Search API (`/api/stocks/search`)

### Endpoint
`GET /api/stocks/search?q=<query>`

- Auth-gated (`locals.user` required)
- Proxies: `https://query1.finance.yahoo.com/v1/finance/search?q={q}&quotesCount=8&newsCount=0`
- Returns: `{ results: { symbol, name, exchange, type }[] }`
- On Yahoo error: returns `{ results: [] }` (silent degradation — curated list still works)
- No caching (search results are per-query)

### Client-side behaviour
- Minimum 2 characters before firing
- Debounced 400ms
- Shows spinner while loading
- Results appear above the curated grid
- Clicking "+ Add" on a search result: if symbol not in DB → calls `POST /api/stocks/ensure` to `createAsset()` first, then opens drawer

---

## Slide-in Drawer

### Trigger
Any "+ Add" button — from curated grid or live search results.

### Drawer fields

| Field | Default | Notes |
|-------|---------|-------|
| Asset | symbol + name (read-only) | Pre-filled, cannot change |
| Type | BUY | Toggle BUY / SELL |
| Quantity | empty | Required, positive number |
| Price | `asset.latestPrice` or empty | Editable |
| Date | today | Date picker |
| Fee | empty | Optional |

### Submission
POSTs to `/stocks?/add` (SvelteKit form action on the stocks page server).

The `add` action:
1. Validates fields (quantity > 0, price > 0, valid date)
2. Resolves `accountId`: queries `prisma.account.findFirst({ where: { userId: user.id } })` — uses the user's first (primary) account
3. Calls `prisma.transaction.create(...)` (same fields as existing transactions)
4. Returns `{ success: true, symbol }`

### After submit
- Drawer shows **✓ Added AAPL** for 1.5 seconds
- Drawer stays open (user can pick another stock)
- Close button (×) dismisses drawer

### Error handling
- Validation errors shown inline under each field
- Network error: "Something went wrong — try again"

---

## Asset Ensure API (`/api/stocks/ensure`)

`POST /api/stocks/ensure`  
Body: `{ symbol, name, exchange, type }`

- Calls `createAsset()` (upsert on symbol)
- Returns `{ assetId }`
- Used when user adds a stock from live search that isn't in the DB yet

---

## Sidebar Navigation

Add to `Sidebar.svelte` under the Transactions link:

```html
<a href="/stocks" class="nav-link">
  <BarChart2 size={15} />
  Stocks
</a>
```

---

## Out of Scope

- Real-time price streaming on the stocks page
- Watchlist management from this page (watchlist has its own page)
- Editing or deleting transactions from this page
- Pagination (150 assets fits in one load; search handles the rest)

---

## Testing

- Seed script: run, verify 150 assets in DB, run again → no duplicates
- `/stocks` page loads and shows curated grid
- Tab filter correctly shows/hides assets by market
- Search: type "Apple" → AAPL appears in results
- Search: type "a" (1 char) → no API call fired
- Add curated stock → drawer opens with symbol pre-filled and price pre-filled
- Add from search (new symbol) → asset created in DB, drawer opens
- Submit drawer with valid fields → transaction appears in `/transactions`
- Submit drawer with missing quantity → inline error shown
- Drawer stays open after successful add
- Close button dismisses drawer
