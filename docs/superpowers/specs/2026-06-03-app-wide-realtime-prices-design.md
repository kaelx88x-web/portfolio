# App-Wide Realtime Prices + Chart via Free API — Design Spec

**Date:** 2026-06-03
**Status:** Approved (brainstorming) — pending implementation plan
**Branch target:** TBD at plan time (off `master`)

## Summary

Add app-wide, live-updating stock **prices** (last, change %, bid/ask, volume) across
every price surface — header portfolio total, holdings, watchlist / stock list, and the
`/stocks/[symbol]` detail header. Prices update on a periodic client poll (~10s) gated
behind a manual **Live** toggle that is **off by default**.

Quotes **and** chart candles are sourced from a **free market-data API (Yahoo Finance)**
rather than the moomoo bridge. This sidesteps two problems at once: (1) the moomoo
bridge **quote** endpoints currently hang (environmental blocker), and (2) moomoo quote
quota. moomoo remains the source for what it does reliably: holdings, positions, trades,
and sync.

The candlestick **chart** is sourced from Yahoo but is **not** part of the realtime loop:
it loads candles on page load / range change only. The 10s loop updates numeric price
text only — no per-tick chart redraw.

## Goals

- App-wide numeric price surfaces auto-update while the **Live** toggle is on and the
  market is open and the tab is visible.
- Sourced from a free API (Yahoo) so it works today, independent of the hung moomoo
  quote endpoints, and costs **zero moomoo quote quota**.
- Minimal, predictable upstream usage: batched requests, a shared short-TTL server cache,
  off-by-default toggle, and auto-pause.
- Graceful degradation: upstream failure shows a "Delayed" indicator and keeps the last
  value; never crashes a page.

## Non-Goals

- **Live-updating charts / candles.** The chart remains a one-time historical load per
  range selection. Extending the chart with new bars in realtime is a separate future
  feature (would need a streaming kline feed).
- **Tick-by-tick push streaming** (WebSocket/SSE + moomoo subscription). Explicitly
  rejected in favor of polling; avoids moomoo subscription quota entirely.
- **Replacing moomoo for accounts/trades/sync.** Those stay on moomoo.
- **Options chain realtime.** Out of scope for this iteration (numeric equity quotes only).

## Approaches Considered

- **A — Centralized ref-counted quote store + one poll loop (chosen).** A single client
  store holds the live quote map; components register the symbols they display
  (reference-counted); one global interval batches the union of active symbols into one
  request. Single source of truth, automatic dedup, trivial global pause.
- **B — Each component polls its own symbol.** Rejected: N intervals, duplicate requests
  for shared symbols, no batching.
- **C — SvelteKit `invalidate` on a timer.** Rejected: re-runs entire page loads (heavy),
  can't batch across surfaces.

Data-source decision: **Yahoo (free) for quotes + candles**, chosen over keeping moomoo
(blocked + quota) and over "chart only" (which would leave realtime price still blocked).

## Architecture

### Data source split

| Concern | Source |
|---|---|
| Quotes (last, change %, bid/ask, volume, marketState) | Yahoo Finance |
| Chart candles (OHLC) | Yahoo Finance |
| Holdings, positions, trades, sync, fund balance | moomoo bridge (unchanged) |

### Components / units

**1. Yahoo service — `src/lib/server/yahoo.service.ts` (server-only)**
- Wraps the `yahoo-finance2` npm library (handles Yahoo crumb/cookie auth so we don't
  hand-roll fragile requests).
- `getYahooQuotes(symbols: string[]): Promise<YahooQuote[]>` — **batch** quote call (one
  upstream request for many symbols). Returns normalized
  `{ symbol, last, changePct, bid, ask, volume, marketState, ts }`. Errors → throws (so
  the cache layer does not store failures); callers degrade.
- `getYahooCandles(symbol: string, range: string): Promise<Candle[]>` — OHLC mapped to the
  existing `{ t, o, h, l, c, v }` shape so `PriceChart` needs no change.
- `toYahooSymbol(code: string): string` — maps app/moomoo codes to Yahoo tickers:
  `US.NVDA → NVDA`, `NVDA → NVDA`, `HK.00700 → 0700.HK`, `SH.600519 → 600519.SS`,
  `SZ.000001 → 000001.SZ`. Mirror of `toMoomooCode` in `stock-detail.service.ts`.
- `isMarketOpen(marketState: string): boolean` — `REGULAR`/`PRE`/`POST` semantics from
  Yahoo's `marketState`.

**2. Batch quote endpoint — `src/routes/api/quotes/live/+server.ts`**
- `GET ?codes=A,B,C` → dedupes codes, maps via `toYahooSymbol`, calls `getYahooQuotes`,
  wrapped in the existing `cached()` helper (`src/lib/server/quote-cache.ts`) at **~8s TTL
  + single-flight**, keyed by the sorted code-set. Many tabs/components collapse to ≤1
  upstream call per ~8s per code-set.
- Returns `{ quotes: YahooQuote[] }`. Auth enforced by `hooks.server.ts` (non-public).
- Bounds the code-set defensively (chunk if absurdly large; realistically one page worth).

**3. Candle endpoint — `src/routes/api/stocks/[symbol]/candles/+server.ts` (modified)**
- Switch source from `getHistoricalCandles` (moomoo) to `getYahooCandles`. Keep the same
  response shape and `range` param semantics. Cache ~60s (historical data is slow-moving).
- Keep `decodeSymbolParam` guard (404 on malformed symbol).

**4. Live toggle store — `src/lib/stores/live-toggle.ts`**
- Boolean writable persisted to `localStorage`, **default `false`**. When `false`, the poll
  loop never runs (zero upstream usage).

**5. Shared quote store — `src/lib/stores/live-quotes.ts`**
- Internal `Map<code, LiveQuote>` where
  `LiveQuote = { last, changePct, bid, ask, volume, ts, stale }`, plus a derived `status`
  (`off` | `live` | `closed` | `paused` | `delayed`).
- `subscribeQuotes(codes: string[]): () => void` — increments a per-code refcount, ensures
  the loop is running, returns an `unsubscribe()` for `onDestroy`. Shared symbols counted
  once; a code is dropped when its refcount hits 0.
- One global loop (interval ~10s). Each tick runs **only when**: toggle on **and** at least
  one tracked market is open **and** `document.visibilityState === 'visible'` **and** the
  active code-set is non-empty. Otherwise idle. Skips a tick if the previous request is
  still in flight (no overlap).
- On response: patches the map and `ts`, clears `stale`. On failure: marks affected codes
  `stale` (keeps last value), sets `status = delayed`.
- Injectable `fetch` + `now`/timer for tests.

**6. Live indicator — `src/lib/components/LiveDot.svelte`**
- Small pulsing dot + label bound to store `status`: **Off** / **Live** / **Closed** /
  **Paused** / **Delayed**. Placed at each price surface.
- The global **Live** toggle switch lives in the top bar (near the portfolio total /
  account switcher).

**7. Price-surface wiring**
- Stock-detail header, header portfolio total, holdings rows, watchlist / stock list rows:
  call `subscribeQuotes([code])` (or the batch of visible codes) on mount, unsubscribe on
  destroy. Display the SSR-loaded value until the first live tick, then live values with a
  brief green/red flash on change.
- The portfolio total recomputes client-side from live holding prices when available.
- Folds the markets page's bespoke `setInterval(refresh, 60_000)` into the shared store
  (targeted cleanup; remove the duplicate ad-hoc loop).

## Data Flow

```
component mount
  → subscribeQuotes([code])               // refcount++, ensure loop running
  → every ~10s, IF (toggle && marketOpen && visible && codes>0 && !inFlight):
        GET /api/quotes/live?codes=<union> // 8s server cache + single-flight
        → getYahooQuotes(mapped symbols)   // 1 upstream batch call
        → patch store map                  // components react, flash on change
component destroy
  → unsubscribe()                          // refcount--, drop code at 0; loop idles when empty
```

## Error Handling / Degradation

- Endpoint or Yahoo failure → `getYahooQuotes` throws → not cached → store marks codes
  `stale`, indicator shows **Delayed**, last values retained. No page crash.
- Yahoo is unofficial / no SLA. Acceptable for a personal app. If Yahoo proves unreliable,
  a future fallback to moomoo snapshots (once the bridge quote endpoints are fixed) can be
  added behind the same store interface without touching consumers.
- Malformed symbol on candle endpoint → 404 via `decodeSymbolParam` (unchanged).

## Quota / Rate Posture

- **moomoo quote quota: zero** (no moomoo quote/candle calls).
- **Yahoo usage:** batched (one quote request per tick for all on-screen symbols) + 8s
  shared server cache with single-flight + toggle off by default + auto-pause when
  closed/hidden/empty. Worst case during market hours ≈ **≤ 6 upstream quote calls/min
  total**, regardless of users/tabs/symbols. Candles cached ~60s.

## Testing

- **Unit — `toYahooSymbol`:** US passthrough, HK zero-pad + `.HK`, SH `.SS`, SZ `.SZ`,
  already-Yahoo symbols.
- **Unit — Yahoo service normalization:** quote + candle field mapping; throws on upstream
  error.
- **Unit — quote store:** refcount subscribe/unsubscribe, union dedup, gating
  (off / market-closed / tab-hidden / empty), `stale`-on-error, overlapping-tick guard,
  status transitions. Fake timers + injectable fetch.
- **Endpoint:** `/api/quotes/live` dedups codes, applies 8s cache + single-flight, returns
  normalized quotes, requires auth; candle endpoint returns Yahoo candles in the existing
  shape.
- **e2e:** Live toggle renders and persists; `LiveDot` renders and degrades to
  Closed/Delayed; no console errors. (Live ticking verifiable during market hours — no
  longer blocked by moomoo.)

## Dependencies

- New: `yahoo-finance2` (server-side npm dependency).

## Open Items / Risks

- Yahoo unofficial-endpoint reliability and ToS (mitigated by graceful degradation; future
  moomoo fallback possible).
- Quote delay varies by exchange (regular-to-15min); acceptable for this use case. The
  indicator communicates liveness honestly (Live/Delayed/Closed).
