# App-Wide Realtime Prices + Chart via Free API — Design Spec

**Date:** 2026-06-03
**Status:** Approved (brainstorming) — pending implementation plan
**Branch:** `realtime-prices` (off `master`)

## Summary

Add app-wide, live-updating stock **prices** (last, change %, bid/ask, volume) across
every price surface — header portfolio total, holdings, watchlist / stock list, the
`/stocks/[symbol]` detail header, and `/paper-trading`. Prices update on a periodic client
poll behind a manual **Live** toggle that is **off by default**.

Quotes **and** chart candles are sourced through a **pluggable market-data provider**
(default **Yahoo Finance**, free, no key) rather than the moomoo bridge. This sidesteps the
hung moomoo **quote** endpoints and moomoo quote quota. moomoo remains the source for what
it does reliably: holdings, positions, trades, and sync.

Because the data is from a free, unofficial, exchange-delayed source, the feature is built
**safe by construction**: a visible delay disclaimer, market-session awareness, staleness
protection on trade/order flows, and a price audit log captured at confirm time.

## Goals

- App-wide numeric price surfaces auto-update while **Live** is on, the market session is
  active, and the tab is visible.
- **Provider-agnostic:** swapping Yahoo for another provider must not touch the UI or store.
- **Safe for trading:** stale prices warn/block live orders; every confirmed trade/order
  records a price snapshot for audit.
- **Honest about delay:** a persistent UI disclaimer that prices may be delayed and are not
  for live execution decisions.
- Minimal upstream usage: batched requests, shared short-TTL server cache, off-by-default
  toggle, session/visibility auto-pause, user-configurable interval.
- Graceful degradation: provider failure shows "Delayed", keeps last value, never crashes.

## Non-Goals

- **Live-updating charts / candles.** The chart remains a one-time historical load per range
  selection. Streaming klines is a separate future feature.
- **Tick-by-tick push streaming** (WebSocket/SSE + broker subscription). Polling only.
- **Replacing moomoo for accounts/trades/sync.**
- **Options chain realtime** (numeric equity quotes only this iteration).

## Approaches Considered

- **A — Centralized ref-counted quote store + one poll loop, behind a provider interface
  (chosen).** Single client store; components register displayed symbols (ref-counted); one
  global interval batches the union into one request to the active provider.
- **B — Each component polls its own symbol.** Rejected: N intervals, duplicate requests.
- **C — SvelteKit `invalidate` on a timer.** Rejected: re-runs whole page loads, no batching.

Data source: **free provider (Yahoo) for quotes + candles**, chosen over moomoo (blocked +
quota) and over "chart only" (leaves realtime price blocked).

## Architecture

### Data source split

| Concern | Source |
|---|---|
| Quotes (last, change %, bid/ask, volume, session) | Active market-data provider (default Yahoo) |
| Chart candles (OHLC) | Active market-data provider (default Yahoo) |
| Holdings, positions, trades, sync, fund balance | moomoo bridge (unchanged) |

### 1. Pluggable market-data provider — `src/lib/server/market-data/`

The fallback-ready abstraction. Adding/swapping a provider never touches the store or UI.

```ts
// market-data/types.ts
export type ProviderName = 'yahoo' | 'moomoo' | 'polygon' | 'twelvedata';

export type MarketSession = 'pre' | 'regular' | 'post' | 'closed';

export interface MarketQuote {
  symbol: string;            // app/moomoo code, e.g. "US.NVDA"
  last: number | null;
  changePct: number | null;
  bid: number | null;
  ask: number | null;
  volume: number | null;
  session: MarketSession;
  source: ProviderName;
  ts: number;                // provider quote timestamp (epoch ms)
}

export interface Candle { t: string; o: number; h: number; l: number; c: number; v: number; }

export interface MarketDataProvider {
  readonly name: ProviderName;
  getQuotes(codes: string[]): Promise<MarketQuote[]>;   // batch; throws on upstream failure
  getCandles(code: string, range: string): Promise<Candle[]>;
}
```

- `market-data/yahoo.provider.ts` — implements the interface over `yahoo-finance2` (handles
  Yahoo crumb/cookie auth). Maps `marketState` → `MarketSession`.
- `market-data/index.ts` — `getProvider(): MarketDataProvider` selects the active provider
  from `MARKET_DATA_PROVIDER` env (default `yahoo`). Future providers (`moomoo`, `polygon`,
  `twelvedata`) register here; an ordered **fallback chain** may be added later behind the
  same interface (try primary, fall back on throw) without consumer changes.
- `market-data/symbols.ts` — `toProviderSymbol(code, provider)`: e.g. Yahoo
  `US.NVDA→NVDA`, `HK.00700→0700.HK`, `SH.600519→600519.SS`, `SZ.000001→000001.SZ`.

### 2. Endpoints

- `src/routes/api/quotes/live/+server.ts` — `GET ?codes=A,B,C` → dedupe → active provider
  `getQuotes`, wrapped in `cached()` (`src/lib/server/quote-cache.ts`) at **~8s TTL +
  single-flight**, keyed by sorted code-set. Returns `{ quotes: MarketQuote[] }`. Auth via
  hooks. The 8s TTL collapses many tabs/components to ≤1 upstream call per code-set per 8s.
- `src/routes/api/stocks/[symbol]/candles/+server.ts` (modified) — source candles from the
  active provider; keep the existing `{t,o,h,l,c,v}` shape and `range` semantics; cache
  ~60s; keep the `decodeSymbolParam` 404 guard.

### 3. Client stores

- `src/lib/stores/live-settings.ts` — persisted (localStorage), editable on `/settings`:
  - `enabledByDefault: boolean` (default **false**) — seeds the Live toggle on first load.
  - `refreshIntervalMs: 10_000 | 30_000 | 60_000` (default **10s**).
  - `showDelayedWarning: boolean` (default **true**).
- `src/lib/stores/live-toggle.ts` — boolean, persisted; initialized from
  `enabledByDefault`. When off, the loop never runs (zero upstream usage).
- `src/lib/stores/live-quotes.ts` — the shared store:
  - `Map<code, LiveQuote>`, `LiveQuote = { last, changePct, bid, ask, volume, session, source, ts, stale }`.
  - `subscribeQuotes(codes[]) => unsubscribe()` — ref-counted; shared symbols counted once.
  - `quoteAge(code): number` and `quoteStatus(code): 'live'|'stale'|'delayed'` helpers
    (used by trade/paper flows for staleness).
  - One global loop at `refreshIntervalMs`. A tick runs **only when**: toggle on **and** at
    least one tracked symbol's session ≠ `closed` **and** `visibilityState === 'visible'`
    **and** code-set non-empty **and** no request in flight. Otherwise idle.
  - On response: patch map, set `ts`/`session`/`source`, clear `stale`. On failure: mark
    affected codes `stale` (keep last value).
  - Derived global `status`: `off | live(regular) | pre | post | closed | paused | delayed`.
  - Injectable `fetch`/timer for tests.

### 4. UI components

- `src/lib/components/LiveDot.svelte` — pulsing dot + label from store status, distinguishing
  **Off / Live / Pre-market / After-hours / Closed / Paused / Delayed**. Mobile: compact
  (dot only or truncated label) so it never breaks header/row layout.
- `src/lib/components/DelayedDataNotice.svelte` — persistent disclaimer shown wherever live
  prices appear (gated by `showDelayedWarning`):
  > "Harga mungkin delayed dan berbeza ikut bursa — bukan untuk keputusan execution live
  > trade." (EN equivalent: "Prices may be delayed and vary by exchange — not for live
  > trade execution decisions.")
- The global **Live** toggle switch lives in the top bar near the portfolio total.

### 5. Price-surface wiring

- Stock-detail header, header portfolio total, holdings rows, watchlist / stock list rows,
  and `/paper-trading` subscribe their code(s) on mount, unsubscribe on destroy. Show the
  SSR value until the first tick, then live values with a brief green/red flash on change.
- **Portfolio total** recomputes client-side from live holding prices when available — a
  dedicated test asserts the total reflects live updates.
- Folds the markets page's bespoke `setInterval(refresh, 60_000)` into the shared store.

### 6. Paper-trading integration

- `/paper-trading` uses the **same** quote store, so open paper positions' mark price and
  **unrealized P/L update in realtime** while Live is on.
- Safety invariant (and test): paper mode must **never** reach the live broker — paper order
  submission stays on the paper code path only; no moomoo trade call.

### 7. Staleness protection (trade/order safety)

Applied to live-order flows (`/trade`, `/order`) that read a displayed price:

- Quote **age ≤ 60s** → normal.
- **60s < age ≤ 5min** → non-blocking **warning** ("price may be stale") on the confirm UI.
- **age > 5min** (or status `delayed`/no quote) → **block live order submission**; require an
  explicit refresh first. Paper orders are not blocked but are warned + audited.
- A pure helper `assessQuoteFreshness(ageMs, session): 'fresh'|'warn'|'block'` (unit-tested,
  thresholds centralized) drives both UI and server-side enforcement.

### 8. Price audit log (Prisma)

At trade/order/paper **confirm** time, persist the price snapshot the user acted on:

```prisma
model PriceAuditLog {
  id        String   @id @default(cuid())
  userId    String
  context   String   // 'trade' | 'order' | 'paper'
  symbol    String
  source    String   // provider name at capture
  price     Float?
  bid       Float?
  ask       Float?
  quoteTs   DateTime // provider quote timestamp
  ageMs     Int      // age at confirm
  status    String   // 'live' | 'stale' | 'delayed'
  createdAt DateTime @default(now())
  @@index([userId, symbol, createdAt])
}
```

Written from the order/trade/paper confirm server action. Requires a Prisma migration
(`prisma db push` per project convention).

## Data Flow

```
component mount → subscribeQuotes([code])              // refcount++, ensure loop running
loop tick (every refreshIntervalMs) IF toggle && session!=closed && visible && codes>0 && !inFlight:
  GET /api/quotes/live?codes=<union>                   // 8s server cache + single-flight
  → getProvider().getQuotes(mapped codes)              // 1 upstream batch call
  → patch store; components react, flash on change
trade/order confirm:
  read store quote → assessQuoteFreshness → warn/block  // staleness protection
  on submit → write PriceAuditLog snapshot              // audit
component destroy → unsubscribe()                       // refcount--, loop idles when empty
```

## Error Handling / Degradation

- Provider/endpoint failure → `getQuotes` throws → not cached → store marks codes `stale`,
  indicator shows **Delayed**, last values retained, page never crashes. Dedicated test:
  "Yahoo failure keeps last price."
- Provider is unofficial / no SLA → mitigated by graceful degradation and the provider
  interface (future fallback chain: Yahoo → moomoo/Polygon/TwelveData).
- Malformed symbol on candle endpoint → 404 via `decodeSymbolParam`.

## Quota / Rate Posture

- **moomoo quote quota: zero.**
- **Provider usage:** batched (one quote request per tick for all on-screen symbols) + 8s
  shared cache + single-flight + toggle off by default + session/visibility auto-pause +
  user-chosen interval. Worst case during market hours ≈ **≤ 6 upstream calls/min total** at
  10s (fewer at 30/60s), regardless of users/tabs/symbols. Candles cached ~60s.

## Testing

Unit:
- `toProviderSymbol` (Yahoo): US passthrough, HK zero-pad `.HK`, SH `.SS`, SZ `.SZ`.
- Yahoo provider normalization incl. `marketState → MarketSession` mapping; throws on error.
- Quote store: refcount subscribe/unsubscribe, union dedup, gating (off / closed-session /
  hidden / empty), overlapping-tick guard, `stale`-on-error, status transitions, interval
  changes.
- `assessQuoteFreshness`: ≤60s fresh, 60s–5min warn, >5min block; delayed/no-quote → block.

Safety / integration:
- **Stale quote blocks live order** (>5min → submission blocked; refresh unblocks).
- **Paper mode cannot hit the live broker** (paper submit never calls moomoo trade).
- **Live price updates portfolio total correctly** (store patch → recomputed total).
- **Yahoo failure keeps last price** (throw → stale, last value retained, no crash).

Endpoint:
- `/api/quotes/live` dedup + 8s cache + single-flight + auth; candle endpoint returns the
  existing shape from the active provider.

e2e:
- Live toggle renders/persists; `LiveDot` + delayed notice render and degrade to
  Closed/Delayed; no console errors.
- **Mobile `LiveDot` does not disrupt layout** at 320–768px (no overflow; compact form).

## Dependencies

- New: `yahoo-finance2` (server-side npm dependency).

## Schema Changes

- New Prisma model `PriceAuditLog` (+ migration via `prisma db push`).

## Open Items / Risks

- Provider reliability/ToS (mitigated by degradation + provider interface for fallback).
- Exchange-dependent delay communicated honestly via session label + delayed notice.
- Settings persisted client-side (localStorage) for v1; server-persisted user prefs can
  follow if cross-device sync is wanted.
```

## Suggested Implementation Phases (for the plan step)

1. Provider interface + Yahoo provider + symbol map + `/api/quotes/live` (cached) + candle
   endpoint switch. (Unit + endpoint tests.)
2. Client stores (settings, toggle, quote store) + `LiveDot` + delayed notice. (Store tests.)
3. Wire price surfaces incl. portfolio total + paper-trading realtime P/L. (Integration tests.)
4. Staleness protection + `PriceAuditLog` on trade/order/paper confirm. (Safety tests.)
5. `/settings` controls + e2e (toggle, mobile LiveDot, degradation).
