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
- Options tab (Wheel-focused): expiry picker → filters → chain/candidate table.
  - **Strategy filters:** All / Covered call / Cash-secured put / **Credit spread**.
  - **Screen filters:** **DTE** (default 30–45, the popular Wheel window) and
    **Delta** band (e.g. 0.20–0.35) — both drive `getOptionCandidates` /
    client-side narrowing.
  - **Greeks are first-class** in the chain table: **Delta** and **Theta**
    (time-decay) shown prominently, plus IV, gamma, vega, open interest.
  - Candidate rows carry collateral, assignment risk, max loss (from
    `options_logic.py`).
- Navigation into the page from the existing `StockCard`, search results,
  trending strip, and the new Sector-peers block.

**Out of scope (deferred)**
- Company profile / business description (needs an extra moomoo call not yet in the
  bridge).
- Background auto-refresh / real-time push (manual refresh only for now).
- Live option execution (paper only).
- Multi-leg execution UX beyond display (credit-spread *candidates* are shown and
  paper-tradable leg-by-leg; a one-click 2-leg ticket is a later phase).

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
`/api/stocks/ensure` logic if unknown), map symbol → moomoo code with a **shared,
multi-market mapper** (see "Symbol mapping" below — not the current US-only
`toMoomooSymbol`), then `Promise.all`:

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
Client fetches thin endpoints that reuse the existing service functions:
- `getOptionExpiry(symbol)` — expiry pills + computed **DTE** per expiry (the
  30–45 DTE filter is applied here).
- `getOptionChain(symbol, expiry, type)` — full chain. The chain row already
  carries **delta, gamma, theta, vega, IV, open interest** (see `OptionChainRow`),
  so the Delta band filter and the Greeks columns need no new bridge data.
- `getOptionCandidates(symbols, mode)` — CC/CSP candidates enriched (via
  `options_logic.py`) with `collateral_per_contract`, `assignment_risk`,
  `shares_required`, `max_loss_per_contract`.

**Credit spreads (new bridge work):** single-leg `getOptionCandidates` does not
build spreads. Add a bridge function `option_spread_candidates(symbol, expiry,
type, width)` that pairs two strikes from the chain and computes max-loss /
max-profit using the **already-shipped** `options_logic.vertical_spread_max_loss`
/ `vertical_spread_max_profit`. Exposed as `getOptionSpreadCandidates` in
`broker.service`. The math exists; only the leg-pairing + endpoint are new.

Keeping options lazy means the Overview tab is unaffected by option-chain latency.

### Chart timeframe
Changing the timeframe pill (1D/1W/1M/3M/1Y) calls
`GET /api/stocks/[symbol]/candles?range=` (reuses `getHistoricalCandles`) and
updates the chart in place — no full page reload.

## Caching & rate-limiting (OpenD frequency limits)

`load` fans out 6–7 bridge calls per visit/refresh, and moomoo OpenD enforces
strict frequency limits — especially on **historical candles** and **capital
flow**. To avoid throttling/bans:

- Add a small **short-lived TTL cache** wrapper in `broker.service` for the heavy,
  slow-moving calls: candles (~30s), capital flow / distribution (~20s), basic
  info (~60s). Snapshots/market-state stay uncached (or ~5s) so prices feel live.
- Cache key = `function:moomooCode:args`. Backed by **`ioredis`** (already a
  dependency) when `REDIS_URL` is set, falling back to a process-local `Map` with
  timestamps otherwise. TTL eviction; no stampede (single in-flight promise per
  key).
- The manual **Refresh** button passes a `force` flag that bypasses the cache for
  that one request, so the user can always pull fresh data deliberately.

This makes repeat visits and back-navigation cheap and keeps us under OpenD's
limits.

## New endpoints (thin wrappers over existing services)

- `GET /api/stocks/[symbol]/candles?range=` → `getHistoricalCandles`
- `GET /api/stocks/[symbol]/options/expiry` → `getOptionExpiry`
- `GET /api/stocks/[symbol]/options/chain?expiry=&type=` → `getOptionChain`
- `GET /api/stocks/[symbol]/options/candidates?mode=` → `getOptionCandidates`

(All auth-gated by the existing `hooks.server.ts` guard; user-scoped where they
touch user data.)

## Components (one purpose each, typed props, own their empty state)

- `StockDetailHeader.svelte` — symbol/name/exchange, live price + change, day
  range, volume, and a **market-state-aware** badge (Open / Pre-market /
  After-hours / Closed from `getMarketStates`). Because auto-refresh is
  out-of-scope, the header shows a **"Last updated HH:MM <TZ>" timestamp in the
  market's own timezone** (from `getGlobalMarkets`), not the user's local clock,
  so stale data is obvious. The manual **Refresh** button is enabled when the
  market is open and **relabelled "Refresh (market closed)"** / de-emphasised when
  closed, so users understand a refresh won't change much off-hours.
- `PriceChart.svelte` — ECharts (already a dependency) candle/line toggle +
  timeframe pills; fetches `/candles` on range change.
- `MoneyFlowPanel.svelte` — net inflow/outflow + super/big/mid/small bars.
- `KeyStatsGrid.svelte` — PE/PB/EPS/market cap/52wk/lot/listing.
- `PositionActions.svelte` — owned qty / avg cost / unrealized P&L (if held),
  watchlist toggle, **Add to portfolio** (reuses `AddDrawer`), **Paper trade**
  (navigates to `/paper-trading` prefilled with the symbol). After a watchlist
  toggle or a portfolio add, call **`invalidateAll()`** so the `/stocks` grid
  reflects the change when the user navigates back (no stale watchlist/position
  state).
- `SectorPeers.svelte` — peer rows with change %, each links to its detail page.
- `BidAsk.svelte` — best bid/ask + size from the snapshot.
- `OptionsPanel.svelte` — expiry pills (with DTE), strategy filter (All / CC / CSP
  / Credit spread), DTE (30–45) + Delta-band screens, and a chain/candidate table
  with **Delta & Theta columns** (plus IV/gamma/vega/OI). Each row's **Paper**
  button prefills the existing paper options order.

## Error handling

- Per-block graceful degradation → "Data Not Available" (no fabricated numbers).
- Bridge/OpenD offline → Overview still renders from prisma (asset, position,
  watchlist) with stale price tag; Options tab shows a "broker offline" notice.
- Invalid/unknown symbol → 404 page, not a 500.

## Symbol mapping (multi-market)

The current `toMoomooSymbol` (private in `moomoo-execution.service.ts`) only does
`US.${symbol}` — wrong for Asian markets. Extract a shared
`toMoomooCode(symbol, market)` into `stock-detail.service.ts` (and have the
execution service reuse it) that derives the moomoo prefix and pads numeric codes:

| Market | Prefix | Code rule | Example |
|---|---|---|---|
| US | `US.` | ticker as-is | `NVDA` → `US.NVDA` |
| Hong Kong | `HK.` | numeric, **zero-pad to 5** | `700` → `HK.00700` |
| China A | `SH.`/`SZ.` | 6-digit code | `600519` → `SH.600519` |
| Singapore | `SG.` | ticker as-is | `D05` → `SG.D05` |
| Malaysia | `MY.` | numeric, zero-pad | `1023` → `MY.1023` |

Inputs that already contain a prefix (`HK.00700`) pass through unchanged. Market is
taken from the asset's `country`/`exchange`. Unknown market → default `US.` with a
logged warning (never silently corrupt the code).

## Safety

- Options are **read-only display + paper-trade action only**; there is no live
  order path from this page. Consistent with the Phase-6E/6F trade-safety model
  and the trading-modules audit.

## Testing

- **Vitest (unit):**
  - **`toMoomooCode` multi-market mapping** — `nvda`→`US.NVDA`, HK `700`→`HK.00700`
    (zero-pad), MY `1023`→`MY.1023`, SH `600519`→`SH.600519`, already-prefixed
    passthrough (`HK.00700`), unknown market → `US.` default.
  - **TTL cache wrapper** — returns cached value within TTL, refetches after
    expiry, `force` bypasses, single in-flight promise per key (no stampede).
  - load-data shaper: builds the view model and yields the "Data Not Available"
    fallback per block when a source returns `null`/`[]`.
  - **DTE computation** for the 30–45 filter (expiry date → days, boundary cases).
- **Playwright (e2e, creds-gated, matches `tests/e2e/trading-audit` pattern):**
  - `/stocks/NVDA` loads (auth required → redirect when anon), Overview blocks +
    chart render, no horizontal overflow at 320/375/390/768, controls labelled.
  - Options tab: expiry pills load, chain table renders with **Delta/Theta**
    columns, DTE/Delta filters narrow the list, **Paper** buttons present, and
    **no live-order control exposed**.

## File summary

```
src/routes/stocks/[symbol]/+page.server.ts        (new — load + reused actions)
src/routes/stocks/[symbol]/+page.svelte           (new — Overview/Options tabs + layout)
src/routes/api/stocks/[symbol]/candles/+server.ts (new — ?range=&force=)
src/routes/api/stocks/[symbol]/options/expiry/+server.ts      (new — incl. DTE)
src/routes/api/stocks/[symbol]/options/chain/+server.ts       (new — Greeks)
src/routes/api/stocks/[symbol]/options/candidates/+server.ts  (new — cc/csp + spread + delta/dte)
src/lib/components/stocks/detail/*.svelte         (new — Header, PriceChart, MoneyFlowPanel,
                                                   KeyStatsGrid, PositionActions, SectorPeers,
                                                   BidAsk, OptionsPanel)
src/lib/services/stock-detail.service.ts          (new — view-model shaper, toMoomooCode, DTE; unit-tested)
src/lib/server/quote-cache.ts                     (new — TTL cache wrapper, ioredis|Map; unit-tested)
src/lib/services/broker.service.ts                (edit — wrap heavy calls in cache; add getOptionSpreadCandidates)
moomoo-service/main.py + options_logic.py         (edit — option_spread_candidates leg-pairing using existing spread math)
src/lib/services/moomoo-execution.service.ts      (edit — reuse shared toMoomooCode)
src/lib/components/stocks/StockCard.svelte        (edit — link to /stocks/{symbol})
```

No changes to the existing `/stocks` grid behaviour beyond making cards link to the
detail page and picking up watchlist invalidation.
