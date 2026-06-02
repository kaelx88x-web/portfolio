# Stock Detail Page (with Options) — Design Spec

**Date:** 2026-06-02
**Status:** Approved (brainstorm) — pending implementation plan
**Route added:** `/stocks/[symbol]` (e.g. `/stocks/NVDA`)

## Goal

`/stocks` today is a browse-and-add grid that shows only a price. The moomoo quote
API exposes far richer per-stock data — snapshot, fundamentals, candles, capital
flow, sector plates, and option chains — and **most of it is already wired in
`src/lib/services/broker.service.ts` but rendered nowhere**. This feature adds a
dedicated **stock detail page** that surfaces that data, plus an **Options** view
for the same underlying. The existing `/stocks` grid stays unchanged as the way in.

Guiding principle (carried from the trading-modules audit): **never invent data.**
Every block sources from the broker bridge / portfolio DB and renders
**"Data Not Available"** when its source is offline. Options are **read-only +
paper-trade only** — no live order path.

## Scope

**In scope**
- New route `/stocks/[symbol]` with two tabs: **Overview** and **Options**.
- Overview blocks: Header, Price chart, Money flow, Key stats, Your position +
  actions, Sector peers, Bid/ask.
- Options tab: expiry picker → strategy filter (All / Covered call / Cash-secured
  put) → chain/candidate table with collateral, assignment risk, max loss.
- Navigation into the page from the existing `StockCard`, search results,
  trending strip, and the new Sector-peers block.

**Out of scope (deferred)**
- Company profile / business description (needs an extra moomoo call not yet in the
  bridge).
- Background auto-refresh / real-time push (manual refresh only for now).
- Live option execution (paper only).

## Layout

Two-column on desktop, single stacked column on mobile (320–768px):

- **Main column:** Header (full width) → Price chart → Money flow → Sector peers.
- **Right rail (sticky):** Your position + actions → Key stats → Bid/ask.
- A top **Overview / Options** tab toggle sits directly under the header.

## Routing & entry

- `src/routes/stocks/[symbol]/+page.server.ts` — `load` + (optional) form actions
  reusing the existing `add` / `toggleWatchlist` actions from `/stocks`.
- `src/routes/stocks/[symbol]/+page.svelte` — composes the blocks; owns the
  Overview/Options tab state.
- `StockCard`, the search rows, `TrendingStrip`, and `SectorPeers` link to
  `/stocks/{symbol}` (URL-encoded). `AddDrawer` remains reachable from the page.

## Data flow

### Overview (server `load`, parallel)
Resolve the asset (prisma by `symbol`; create via the existing
`/api/stocks/ensure` logic if unknown), map symbol → moomoo code (reuse the
`toMoomooSymbol` pattern, e.g. `NVDA` → `US.NVDA`), then `Promise.all`:

| Block | Source (`broker.service`) | Already wired |
|---|---|---|
| Header / price / OHLC / volume / bid-ask | `getQuoteSnapshots` | ✅ |
| Key stats (PE/PB/EPS/mktcap/52wk/lot/listing) | `getStockBasicInfo` | ✅ |
| Price chart (candles) | `getHistoricalCandles` | ✅ |
| Money flow | `getCapitalFlow` (+ `getCapitalDistribution`) | ✅ |
| Market state badge | `getMarketStates` | ✅ |
| Sector peers | `getPlateList` → `getPlateStocks` | ✅ |
| Your position | prisma transactions (owned qty / avg cost / P&L) | ✅ |
| Watchlist state | prisma `watchlistItem` | ✅ |

Each service call already returns `[]`/`null` on bridge failure; the loader wraps
them so one outage degrades a single block to "Data Not Available" and the page
never 500s. Header price falls back to `asset.latestPrice` with a **stale** tag if
the live snapshot fails.

### Options (lazy — only when the Options tab is opened)
Client fetches a thin endpoint that reuses the existing service functions:
- `getOptionExpiry(symbol)` — expiry pills.
- `getOptionChain(symbol, expiry, type)` — full chain, or
- `getOptionCandidates(symbols, mode)` — CC/CSP candidates already enriched (via
  `options_logic.py`) with `collateral_per_contract`, `assignment_risk`,
  `shares_required`, `max_loss_per_contract`.

Keeping options lazy means the Overview tab is unaffected by option-chain latency.

### Chart timeframe
Changing the timeframe pill (1D/1W/1M/3M/1Y) calls
`GET /api/stocks/[symbol]/candles?range=` (reuses `getHistoricalCandles`) and
updates the chart in place — no full page reload.

## New endpoints (thin wrappers over existing services)

- `GET /api/stocks/[symbol]/candles?range=` → `getHistoricalCandles`
- `GET /api/stocks/[symbol]/options/expiry` → `getOptionExpiry`
- `GET /api/stocks/[symbol]/options/chain?expiry=&type=` → `getOptionChain`
- `GET /api/stocks/[symbol]/options/candidates?mode=` → `getOptionCandidates`

(All auth-gated by the existing `hooks.server.ts` guard; user-scoped where they
touch user data.)

## Components (one purpose each, typed props, own their empty state)

- `StockDetailHeader.svelte` — symbol/name/exchange, live price + change, market
  state badge, day range, volume, manual **Refresh** button.
- `PriceChart.svelte` — ECharts (already a dependency) candle/line toggle +
  timeframe pills; fetches `/candles` on range change.
- `MoneyFlowPanel.svelte` — net inflow/outflow + super/big/mid/small bars.
- `KeyStatsGrid.svelte` — PE/PB/EPS/market cap/52wk/lot/listing.
- `PositionActions.svelte` — owned qty / avg cost / unrealized P&L (if held),
  watchlist toggle, **Add to portfolio** (reuses `AddDrawer`), **Paper trade**
  (navigates to `/paper-trading` prefilled with the symbol).
- `SectorPeers.svelte` — peer rows with change %, each links to its detail page.
- `BidAsk.svelte` — best bid/ask + size from the snapshot.
- `OptionsPanel.svelte` — expiry pills + strategy filter + chain/candidate table;
  each row's **Paper** button prefills the existing paper options order.

## Error handling

- Per-block graceful degradation → "Data Not Available" (no fabricated numbers).
- Bridge/OpenD offline → Overview still renders from prisma (asset, position,
  watchlist) with stale price tag; Options tab shows a "broker offline" notice.
- Invalid/unknown symbol → 404 page, not a 500.

## Safety

- Options are **read-only display + paper-trade action only**; there is no live
  order path from this page. Consistent with the Phase-6E/6F trade-safety model
  and the trading-modules audit.

## Testing

- **Vitest (unit):**
  - symbol → moomoo-code mapping (e.g. `nvda` → `US.NVDA`, `0700.HK` passthrough).
  - load-data shaper: builds the view model and yields the "Data Not Available"
    fallback per block when a source returns `null`/`[]`.
- **Playwright (e2e, creds-gated, matches `tests/e2e/trading-audit` pattern):**
  - `/stocks/NVDA` loads (auth required → redirect when anon), Overview blocks +
    chart render, no horizontal overflow at 320/375/390/768, controls labelled.
  - Options tab: expiry pills load, chain table renders, **Paper** buttons present,
    no live-order control exposed.

## File summary

```
src/routes/stocks/[symbol]/+page.server.ts        (new — load + reused actions)
src/routes/stocks/[symbol]/+page.svelte           (new — tabs + layout)
src/routes/api/stocks/[symbol]/candles/+server.ts (new)
src/routes/api/stocks/[symbol]/options/expiry/+server.ts      (new)
src/routes/api/stocks/[symbol]/options/chain/+server.ts       (new)
src/routes/api/stocks/[symbol]/options/candidates/+server.ts  (new)
src/lib/components/stocks/detail/*.svelte         (new — the 8 blocks above)
src/lib/services/stock-detail.service.ts          (new — view-model shaper + mapping; unit-tested)
src/lib/components/stocks/StockCard.svelte        (edit — link to /stocks/{symbol})
```

No changes to the existing `/stocks` grid behaviour beyond making cards link to the
detail page.
