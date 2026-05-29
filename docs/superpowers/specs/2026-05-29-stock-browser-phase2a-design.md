# Stock Browser Phase 2A — Real Data Design

**Date:** 2026-05-29
**Status:** Approved

---

## Overview

Replace Phase 1's static mock sparklines and stale DB prices with real market data. An adaptive price source layer picks Moomoo (if the user's broker is connected) or Yahoo Finance (fallback). Every `/stocks` page load fetches current prices and 5-trading-day sparklines for all 75 curated assets server-side.

---

## Goals

- Stock cards show real current prices (not stale DB `latestPrice`)
- Sparklines reflect actual 5-day price movement
- Moomoo-connected users get real-time data; everyone else gets Yahoo Finance
- MY market (Bursa) always uses Yahoo Finance (Moomoo support unconfirmed)
- Page degrades gracefully if all external sources fail

---

## Architecture

### New files

| File | Purpose |
|------|---------|
| `src/lib/types/prices.ts` | `SparklineData` and `PriceData` shared types |
| `src/lib/server/yahoo-finance.ts` | Yahoo Finance batch quotes + sparkline history |
| `src/lib/server/price-source.ts` | Adaptive layer — picks Moomoo or Yahoo per asset |

### Modified files

| File | Change |
|------|--------|
| `src/routes/stocks/+page.server.ts` | Call `fetchPrices(assets)`, add `priceMap` to returned data |
| `src/lib/components/stocks/MiniSparkline.svelte` | Accept real `SparklineData`, gradient fill, hover tooltip |
| `src/lib/components/stocks/StockCard.svelte` | Add `priceData` prop, show real price + inline `▲/▼ %` |
| `src/routes/stocks/+page.svelte` | Pass `priceData={data.priceMap[asset.symbol]}` to StockCard |

### No schema changes

`latestPrice` on the `Asset` model stays as the fallback value. Phase 2A does not write fetched prices back to the DB — that remains the job of the existing "Update Prices" flow on Dashboard.

---

## Shared Types (`src/lib/types/prices.ts`)

```typescript
export interface SparklineData {
  points: number[];   // normalized 0–1 for SVG rendering, length ≤ 5
  prices: number[];   // actual closing prices for tooltip display
  dates: string[];    // short labels e.g. "Mon 26", "Tue 27", length matches points
  trend: 'up' | 'down' | 'flat';
}

export interface PriceData {
  price: number;           // current / last-close price
  changePercent: number;  // % change from previous close, e.g. 2.1 means +2.1%
  sparkline: SparklineData | null;
}
```

---

## Yahoo Finance Service (`src/lib/server/yahoo-finance.ts`)

### Batch quotes

```
GET https://query1.finance.yahoo.com/v7/finance/quote
  ?symbols=AAPL,MSFT,VOO,...
  &fields=regularMarketPrice,regularMarketChangePercent
```

- Accepts up to 100 symbols per call (75 curated assets fit in one call)
- Returns `Map<symbol, { price, changePercent }>`
- On any error: returns empty Map (silent degradation)

### Sparkline history

```
GET https://query1.finance.yahoo.com/v8/finance/chart/{symbol}
  ?range=5d&interval=1d
```

- Returns daily closes for the last 5 trading days
- Parse `chart.result[0].timestamp` (Unix seconds → "Mon 26" labels) and `indicators.quote[0].close`
- Filter out any `null` closes before processing (Yahoo sometimes returns nulls for non-trading days)
- Take up to the last 5 valid closes; fewer is acceptable if market data is sparse
- Normalize closes to 0–1 range for SVG rendering (if only 1 point, `points = [0.5]`)
- Derive `trend`: requires at least 2 points; last close > first close → `'up'`; < → `'down'`; single point or equal → `'flat'`
- On error: returns `null` for that symbol

### Concurrency

```typescript
export async function fetchSparklines(
  symbols: string[],
  concurrency = 10
): Promise<Map<string, SparklineData>> {
  // Split symbols into chunks of `concurrency`
  // For each chunk: await Promise.allSettled(chunk.map(fetchSparkline))
  // Collect fulfilled results into Map
}
```

---

## Price Source Layer (`src/lib/server/price-source.ts`)

### Moomoo availability check

```typescript
async function isMoomooAvailable(): Promise<boolean> {
  // GET ${MOOMOO_SERVICE_URL}/status with AbortSignal timeout 1000ms
  // Returns true only if response.ok AND data.quote_logged_in === true
  // Any error (network, timeout, non-ok) returns false
}
```

### Symbol mapping to Moomoo format

| Country | DB symbol | Moomoo code |
|---------|-----------|-------------|
| US | `AAPL` | `US.AAPL` |
| HK | `0700.HK` | `HK.00700` (strip `.HK`, zero-pad to 5 digits) |
| MY | any | `null` — always Yahoo Finance |

```typescript
function toMoomooCode(symbol: string, country: string): string | null {
  if (country === 'US') return `US.${symbol}`;
  if (country === 'HK') {
    const base = symbol.replace(/\.HK$/i, '').padStart(5, '0');
    return `HK.${base}`;
  }
  return null;
}
```

### Main export

```typescript
export async function fetchPrices(assets: Asset[]): Promise<Map<string, PriceData>> {
  const moomooUp = await isMoomooAvailable();

  const mooAssets = moomooUp
    ? assets.filter(a => a.country === 'US' || a.country === 'HK')
    : [];
  const yahooAssets = moomooUp
    ? assets.filter(a => a.country === 'MY')
    : assets;

  const [mooData, yahooData] = await Promise.all([
    mooAssets.length ? fetchFromMoomoo(mooAssets) : Promise.resolve(new Map()),
    yahooAssets.length ? fetchFromYahoo(yahooAssets) : Promise.resolve(new Map()),
  ]);

  return new Map([...mooData, ...yahooData]);
}
```

### Moomoo fetching

Uses two existing moomoo-service endpoints:

**Prices (1 call):**
```
GET /quotes/snapshot?codes=US.AAPL,US.MSFT,HK.00700,...
```
Response shape: `{ quotes: [{ code, last_price, change_rate, ... }] }`

**Sparklines (parallel per symbol):**
```
GET /quotes/history?code=US.AAPL&ktype=K_DAY&autype=qfq
  &start=<today-7-days>&end=<today>
```
Response shape: `{ candles: [{ time_key, close, ... }] }`
- Take last 5 candles → normalize → `SparklineData`

---

## Page Server (`src/routes/stocks/+page.server.ts`)

Add to existing `load` function:

```typescript
import { fetchPrices } from '$lib/server/price-source';

// After fetching assets:
const priceMap = await fetchPrices(assets);
return {
  assets,
  ownedMap,
  watchlistSet,
  priceMap: Object.fromEntries(priceMap),  // Record<symbol, PriceData>
};
```

`fetchPrices` runs after `prisma.asset.findMany` so the load function makes one DB call then one round of external fetches. Total page load time increase: ~1–2 seconds on Yahoo Finance path, ~0.5 seconds if Moomoo is local.

---

## MiniSparkline (`src/lib/components/stocks/MiniSparkline.svelte`)

### Updated props

```typescript
export let symbol: string;
export let trend: 'up' | 'down' | 'flat' = 'flat';
export let sparkline: SparklineData | undefined = undefined;
```

If `sparkline` is provided, render from real data. Otherwise fall back to `mockSparkline(symbol, trend)` from `stock-metadata.ts` (existing behaviour).

### SVG rendering

- Dimensions: `64×28` (unchanged)
- Line: `<polyline>` from normalized points
- Fill: `<polygon>` with gradient (green for up/flat, red for down), opacity 0–0.25
- Hover dot: `<circle>` at active point, radius 2.5

### Hover tooltip

```svelte
<script>
  let hoveredIdx: number | null = null;

  function handleMouseMove(e: MouseEvent) {
    const svg = e.currentTarget as SVGElement;
    const rect = svg.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const step = rect.width / (pts.length - 1);
    hoveredIdx = Math.round(x / step);
    hoveredIdx = Math.max(0, Math.min(pts.length - 1, hoveredIdx));
  }

  function handleMouseLeave() {
    hoveredIdx = null;
  }
</script>

{#if hoveredIdx !== null && sparkline}
  <div class="spark-tooltip">
    <span class="spark-date">{sparkline.dates[hoveredIdx]}</span>
    <span class="spark-price">{fmt(sparkline.prices[hoveredIdx])}</span>
  </div>
{/if}
```

Tooltip positioned absolute above the SVG. MiniSparkline accepts a `currency` prop (`'USD' | 'MYR' | 'HKD'`, default `'USD'`) passed from StockCard via `asset.currency`. Currency prefix map: `USD → '$'`, `MYR → 'RM '`, `HKD → 'HK$'`.

---

## StockCard (`src/lib/components/stocks/StockCard.svelte`)

### New prop

```typescript
export let priceData: PriceData | null = null;
```

### Price display

```svelte
<script>
  $: displayPrice = priceData?.price ?? asset.latestPrice;
  $: displayChange = priceData?.changePercent ?? null;
  $: priceColor = displayChange === null ? 'var(--muted)'
    : displayChange > 0 ? 'var(--success)'
    : displayChange < 0 ? 'var(--danger)'
    : 'var(--muted)';
  $: changeArrow = (displayChange ?? 0) >= 0 ? '▲' : '▼';
</script>

<div class="price-row">
  <span class="price" style="color:{priceColor}">{fmt(displayPrice)}</span>
  {#if displayChange !== null}
    <span class="change" style="color:{priceColor}">
      {changeArrow} {Math.abs(displayChange).toFixed(2)}%
    </span>
  {/if}
</div>
```

Pass `sparkline={priceData?.sparkline ?? undefined}` to `MiniSparkline`.

---

## Main Page (`src/routes/stocks/+page.svelte`)

Pass `priceData` from the new `priceMap`:

```svelte
<StockCard
  {asset}
  {meta}
  owned={data.ownedMap[asset.id] ?? null}
  watchlisted={watchlistSet.has(asset.id)}
  priceData={data.priceMap[asset.symbol] ?? null}
  onAdd={() => openDrawer(asset)}
  onWatchlist={(val) => { ... }}
/>
```

No other changes to the page.

---

## Error Handling Summary

| Scenario | Behaviour |
|----------|-----------|
| Moomoo timeout (>1 s) | `isMoomooAvailable()` returns `false`; Yahoo Finance used for all |
| Yahoo Finance network error | `fetchBatchQuotes` returns empty Map; cards show DB `latestPrice` |
| Individual sparkline fetch fails | `sparkline: null` for that symbol; MiniSparkline renders mock |
| All prices missing | Cards show DB `latestPrice` with no `▲/▼` badge; no error shown to user |
| Moomoo returns unknown symbol | Entry omitted from result Map; Yahoo Finance not re-tried (by design) |

---

## Out of Scope

- Writing fetched prices back to DB (existing Dashboard "Update Prices" flow handles this)
- Real-time WebSocket streaming
- Intraday sparklines (1-minute or 5-minute intervals)
- MY market via Moomoo (deferred until Moomoo Bursa support confirmed)

---

## Testing Checklist

- [ ] `isMoomooAvailable()` returns `false` when bridge is down (timeout ≤ 1s)
- [ ] `toMoomooCode('0700.HK', 'HK')` returns `'HK.00700'`
- [ ] `toMoomooCode('1155.KL', 'MY')` returns `null`
- [ ] `fetchBatchQuotes` returns empty Map on Yahoo Finance 4xx/5xx
- [ ] `fetchSparkline` returns `null` on network error
- [ ] StockCard shows `▲ 2.10%` in green when `changePercent = 2.1`
- [ ] StockCard shows `▼ 1.40%` in red when `changePercent = -1.4`
- [ ] StockCard shows DB `latestPrice` with no badge when `priceData = null`
- [ ] MiniSparkline renders real SVG points when `sparkline` prop provided
- [ ] MiniSparkline falls back to mock when `sparkline = undefined`
- [ ] Hover tooltip shows correct date + price for each point
- [ ] `/stocks` page loads successfully end-to-end with real prices visible
