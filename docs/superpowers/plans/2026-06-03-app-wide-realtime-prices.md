# App-Wide Realtime Prices Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** App-wide, poll-based live stock prices (off by default) sourced from a pluggable free market-data provider (Yahoo), with delay disclaimer, market-session awareness, trade staleness protection, and a price audit log.

**Architecture:** A server-side `MarketDataProvider` interface (default Yahoo via `yahoo-finance2`) feeds a cached batch `/api/quotes/live` endpoint. A client ref-counted quote store polls the union of on-screen symbols on a user-set interval, gated by a global Live toggle + market session + tab visibility. Trade/paper flows read the store's freshness and record a `PriceAuditLog` snapshot at confirm; stale quotes warn or block live orders. The chart is sourced from the provider but is not part of the realtime loop.

**Tech Stack:** SvelteKit, TypeScript, Svelte stores, Prisma (MySQL), Vitest, Playwright, `yahoo-finance2`.

**Spec:** `docs/superpowers/specs/2026-06-03-app-wide-realtime-prices-design.md`

**Conventions:**
- Run a single vitest file: `npx vitest run <path>`
- Run one test by name: `npx vitest run <path> -t "<name>"`
- e2e: `npx playwright test <path>` (creds via `.env.test`)
- Commit after every green step. Branch: `realtime-prices`.

---

## Phase 1 — Provider abstraction + endpoints

### Task 1: Install yahoo-finance2

**Files:**
- Modify: `package.json` (dependencies)

- [ ] **Step 1: Install**

Run: `npm install yahoo-finance2`
Expected: package added to `dependencies`; `node -e "console.log(require('yahoo-finance2/package.json').version)"` prints a version.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(realtime): add yahoo-finance2 dependency"
```

---

### Task 2: Provider types

**Files:**
- Create: `src/lib/server/market-data/types.ts`

- [ ] **Step 1: Write the types (no test — pure declarations)**

```ts
// src/lib/server/market-data/types.ts
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
  getQuotes(codes: string[]): Promise<MarketQuote[]>; // batch; throws on upstream failure
  getCandles(code: string, range: string): Promise<Candle[]>;
}
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep market-data/types || echo OK`
Expected: `OK` (no errors in this file)

```bash
git add src/lib/server/market-data/types.ts
git commit -m "feat(realtime): MarketDataProvider types"
```

---

### Task 3: Symbol mapping

**Files:**
- Create: `src/lib/server/market-data/symbols.ts`
- Test: `src/lib/server/market-data/symbols.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/server/market-data/symbols.test.ts
import { describe, it, expect } from 'vitest';
import { toYahooSymbol } from './symbols';

describe('toYahooSymbol', () => {
  it('passes through plain US tickers', () => {
    expect(toYahooSymbol('NVDA')).toBe('NVDA');
    expect(toYahooSymbol('US.NVDA')).toBe('NVDA');
  });
  it('maps HK to zero-padded .HK', () => {
    expect(toYahooSymbol('HK.00700')).toBe('0700.HK');
    expect(toYahooSymbol('HK.700')).toBe('0700.HK');
  });
  it('maps Shanghai to .SS and Shenzhen to .SZ', () => {
    expect(toYahooSymbol('SH.600519')).toBe('600519.SS');
    expect(toYahooSymbol('SZ.000001')).toBe('000001.SZ');
  });
  it('uppercases and trims', () => {
    expect(toYahooSymbol('  us.aapl ')).toBe('AAPL');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/server/market-data/symbols.test.ts`
Expected: FAIL — `toYahooSymbol is not a function`

- [ ] **Step 3: Implement**

```ts
// src/lib/server/market-data/symbols.ts
/** Map an app/moomoo code (e.g. "US.NVDA", "HK.00700") to a Yahoo ticker. */
export function toYahooSymbol(code: string): string {
  const raw = String(code ?? '').trim().toUpperCase();
  const dot = raw.indexOf('.');
  if (dot === -1) return raw; // already a plain Yahoo ticker

  const market = raw.slice(0, dot);
  const rest = raw.slice(dot + 1);
  switch (market) {
    case 'US':
      return rest;
    case 'HK':
      return `${rest.replace(/\D/g, '').padStart(4, '0')}.HK`;
    case 'SH':
      return `${rest}.SS`;
    case 'SZ':
      return `${rest}.SZ`;
    default:
      return rest; // unknown prefix: best-effort bare symbol
  }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/server/market-data/symbols.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/market-data/symbols.ts src/lib/server/market-data/symbols.test.ts
git commit -m "feat(realtime): app-code to Yahoo symbol mapping"
```

---

### Task 4: Yahoo provider

**Files:**
- Create: `src/lib/server/market-data/yahoo.provider.ts`
- Test: `src/lib/server/market-data/yahoo.provider.test.ts`

- [ ] **Step 1: Write the failing test (inject a fake yahoo client)**

```ts
// src/lib/server/market-data/yahoo.provider.test.ts
import { describe, it, expect } from 'vitest';
import { makeYahooProvider } from './yahoo.provider';

const fakeClient = {
  quote: async (_symbols: string[]) => ([
    { symbol: 'NVDA', regularMarketPrice: 100, regularMarketChangePercent: 1.5,
      bid: 99.9, ask: 100.1, regularMarketVolume: 1000, marketState: 'REGULAR',
      regularMarketTime: new Date('2026-06-03T15:00:00Z') }
  ]),
  chart: async (_symbol: string, _opts: unknown) => ({
    quotes: [{ date: new Date('2026-06-02T00:00:00Z'), open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }]
  })
};

describe('yahoo provider', () => {
  it('normalizes a quote and maps marketState to session', async () => {
    const p = makeYahooProvider(fakeClient as never);
    const [q] = await p.getQuotes(['US.NVDA']);
    expect(q).toMatchObject({ symbol: 'US.NVDA', last: 100, changePct: 1.5, bid: 99.9, ask: 100.1, volume: 1000, session: 'regular', source: 'yahoo' });
    expect(q.ts).toBe(new Date('2026-06-03T15:00:00Z').getTime());
  });

  it('normalizes candles to {t,o,h,l,c,v}', async () => {
    const p = makeYahooProvider(fakeClient as never);
    const candles = await p.getCandles('US.NVDA', '1M');
    expect(candles[0]).toEqual({ t: '2026-06-02', o: 1, h: 2, l: 0.5, c: 1.5, v: 10 });
  });

  it('throws when the upstream client throws', async () => {
    const p = makeYahooProvider({ quote: async () => { throw new Error('upstream'); } } as never);
    await expect(p.getQuotes(['US.NVDA'])).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/server/market-data/yahoo.provider.test.ts`
Expected: FAIL — `makeYahooProvider is not a function`

- [ ] **Step 3: Implement**

```ts
// src/lib/server/market-data/yahoo.provider.ts
import yahooFinance from 'yahoo-finance2';
import { toYahooSymbol } from './symbols';
import type { MarketDataProvider, MarketQuote, MarketSession, Candle } from './types';

type YahooClient = Pick<typeof yahooFinance, 'quote' | 'chart'>;

const RANGE_TO_OPTS: Record<string, { period1: Date; interval: '1d' | '1h' | '5m' }> = {
  '1D': { period1: daysAgo(1), interval: '5m' },
  '1W': { period1: daysAgo(7), interval: '1h' },
  '1M': { period1: daysAgo(30), interval: '1d' },
  '3M': { period1: daysAgo(90), interval: '1d' },
  '1Y': { period1: daysAgo(365), interval: '1d' }
};

function daysAgo(n: number): Date { return new Date(Date.now() - n * 86_400_000); }

function toSession(state: string | undefined): MarketSession {
  switch (state) {
    case 'PRE': return 'pre';
    case 'REGULAR': return 'regular';
    case 'POST':
    case 'POSTPOST': return 'post';
    default: return 'closed';
  }
}

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

export function makeYahooProvider(client: YahooClient): MarketDataProvider {
  // Map Yahoo symbol back to the app code the caller asked for.
  return {
    name: 'yahoo',
    async getQuotes(codes: string[]): Promise<MarketQuote[]> {
      const pairs = codes.map((c) => ({ code: c, y: toYahooSymbol(c) }));
      const rows = await client.quote(pairs.map((p) => p.y));
      const list = Array.isArray(rows) ? rows : [rows];
      const byY = new Map(list.map((r) => [String((r as { symbol?: string }).symbol ?? '').toUpperCase(), r]));
      return pairs.map(({ code, y }) => {
        const r = byY.get(y.toUpperCase()) as Record<string, unknown> | undefined;
        const t = r?.regularMarketTime as Date | number | undefined;
        return {
          symbol: code,
          last: num(r?.regularMarketPrice),
          changePct: num(r?.regularMarketChangePercent),
          bid: num(r?.bid),
          ask: num(r?.ask),
          volume: num(r?.regularMarketVolume),
          session: toSession(r?.marketState as string | undefined),
          source: 'yahoo',
          ts: t instanceof Date ? t.getTime() : typeof t === 'number' ? t * 1000 : Date.now()
        };
      });
    },
    async getCandles(code: string, range: string): Promise<Candle[]> {
      const opts = RANGE_TO_OPTS[range] ?? RANGE_TO_OPTS['3M'];
      const res = await client.chart(toYahooSymbol(code), opts);
      const quotes = (res?.quotes ?? []) as Array<Record<string, unknown>>;
      return quotes
        .filter((q) => q.close != null)
        .map((q) => ({
          t: new Date(q.date as Date).toISOString().slice(0, 10),
          o: Number(q.open ?? 0), h: Number(q.high ?? 0),
          l: Number(q.low ?? 0), c: Number(q.close ?? 0), v: Number(q.volume ?? 0)
        }));
    }
  };
}

/** Production provider bound to the real yahoo-finance2 client. */
export const yahooProvider: MarketDataProvider = makeYahooProvider(yahooFinance);
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/server/market-data/yahoo.provider.test.ts`
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/server/market-data/yahoo.provider.ts src/lib/server/market-data/yahoo.provider.test.ts
git commit -m "feat(realtime): Yahoo market-data provider"
```

---

### Task 5: Provider registry

**Files:**
- Create: `src/lib/server/market-data/index.ts`

- [ ] **Step 1: Implement (selection logic; tested indirectly via endpoint)**

```ts
// src/lib/server/market-data/index.ts
import type { MarketDataProvider, ProviderName } from './types';
import { yahooProvider } from './yahoo.provider';

const PROVIDERS: Partial<Record<ProviderName, MarketDataProvider>> = {
  yahoo: yahooProvider
  // future: moomoo, polygon, twelvedata — register here behind the same interface.
};

/** The active provider, chosen by MARKET_DATA_PROVIDER (default 'yahoo'). */
export function getProvider(): MarketDataProvider {
  const name = (process.env.MARKET_DATA_PROVIDER ?? 'yahoo') as ProviderName;
  return PROVIDERS[name] ?? yahooProvider;
}

export type { MarketDataProvider, MarketQuote, MarketSession, Candle, ProviderName } from './types';
```

- [ ] **Step 2: Typecheck + commit**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep "market-data/index" || echo OK`
Expected: `OK`

```bash
git add src/lib/server/market-data/index.ts
git commit -m "feat(realtime): market-data provider registry"
```

---

### Task 6: Batch live-quote endpoint

**Files:**
- Create: `src/routes/api/quotes/live/+server.ts`
- Test: `src/routes/api/quotes/live/server.test.ts`

- [ ] **Step 1: Write the failing test (mock provider + cache)**

```ts
// src/routes/api/quotes/live/server.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getQuotes = vi.fn();
vi.mock('$lib/server/market-data', () => ({ getProvider: () => ({ name: 'yahoo', getQuotes, getCandles: vi.fn() }) }));
vi.mock('$lib/server/quote-cache', () => ({ cached: (_k: string, _t: number, fn: () => unknown) => fn() }));

import { GET } from './+server';

function req(codes: string) {
  return { url: new URL(`http://x/api/quotes/live?codes=${codes}`), locals: { user: { id: 'u1' } } } as never;
}

beforeEach(() => getQuotes.mockReset());

describe('GET /api/quotes/live', () => {
  it('dedupes codes and returns quotes', async () => {
    getQuotes.mockResolvedValue([{ symbol: 'US.NVDA', last: 1, session: 'regular', source: 'yahoo', ts: 1 }]);
    const res = await GET(req('US.NVDA,US.NVDA'));
    const body = await res.json();
    expect(getQuotes).toHaveBeenCalledWith(['US.NVDA']);
    expect(body.quotes).toHaveLength(1);
  });

  it('returns empty quotes for no codes without calling provider', async () => {
    const res = await GET(req(''));
    const body = await res.json();
    expect(getQuotes).not.toHaveBeenCalled();
    expect(body.quotes).toEqual([]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/routes/api/quotes/live/server.test.ts`
Expected: FAIL — cannot find `./+server`

- [ ] **Step 3: Implement**

```ts
// src/routes/api/quotes/live/+server.ts
import { json } from '@sveltejs/kit';
import { getProvider } from '$lib/server/market-data';
import { cached } from '$lib/server/quote-cache';
import type { RequestHandler } from './$types';

const TTL_MS = 8_000;

export const GET: RequestHandler = async ({ url, locals }) => {
  void locals.user!; // auth enforced by hooks
  const codes = [...new Set(
    (url.searchParams.get('codes') ?? '').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
  )].sort();
  if (codes.length === 0) return json({ quotes: [] });

  const quotes = await cached(`live:${codes.join(',')}`, TTL_MS, () => getProvider().getQuotes(codes));
  return json({ quotes });
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/routes/api/quotes/live/server.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add "src/routes/api/quotes/live/+server.ts" src/routes/api/quotes/live/server.test.ts
git commit -m "feat(realtime): batch /api/quotes/live endpoint (8s cache)"
```

---

### Task 7: Switch candle endpoint to the provider

**Files:**
- Modify: `src/routes/api/stocks/[symbol]/candles/+server.ts`

- [ ] **Step 1: Replace the moomoo candle source**

Replace the body's data fetch. The current handler decodes the symbol, looks up the asset, then calls `getHistoricalCandles(code, ...)`. Replace with provider candles cached ~60s:

```ts
// src/routes/api/stocks/[symbol]/candles/+server.ts
import { json } from '@sveltejs/kit';
import { decodeSymbolParam } from '$lib/services/stock-detail.service';
import { getProvider } from '$lib/server/market-data';
import { cached } from '$lib/server/quote-cache';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, locals }) => {
  void locals.user!; // auth enforced by hooks
  const symbol = decodeSymbolParam(params.symbol); // 404s on malformed %-escape
  const range = url.searchParams.get('range') ?? '3M';
  const candles = await cached(`candles:${symbol}:${range}`, 60_000, () => getProvider().getCandles(symbol, range));
  return json({ status: 'ready', range, candles });
};
```

(Note: this removes the asset lookup + `toMoomooCode` path; `decodeSymbolParam` already 404s malformed input. The provider maps the symbol internally.)

- [ ] **Step 2: Verify existing/typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep "candles" || echo OK`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add "src/routes/api/stocks/[symbol]/candles/+server.ts"
git commit -m "feat(realtime): source chart candles from market-data provider"
```

---

## Phase 2 — Client stores + indicator

### Task 8: Settings + toggle stores

**Files:**
- Create: `src/lib/stores/live-settings.ts`
- Create: `src/lib/stores/live-toggle.ts`
- Test: `src/lib/stores/live-settings.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/stores/live-settings.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

beforeEach(() => { vi.resetModules(); localStorage.clear(); });

describe('live-settings', () => {
  it('defaults: interval 10s, live off, warning on', async () => {
    const { liveSettings } = await import('./live-settings');
    expect(get(liveSettings)).toEqual({ refreshIntervalMs: 10_000, enabledByDefault: false, showDelayedWarning: true });
  });
  it('persists changes to localStorage', async () => {
    const { liveSettings } = await import('./live-settings');
    liveSettings.update((s) => ({ ...s, refreshIntervalMs: 30_000 }));
    expect(JSON.parse(localStorage.getItem('liveSettings')!)).toMatchObject({ refreshIntervalMs: 30_000 });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/stores/live-settings.test.ts`
Expected: FAIL — cannot find `./live-settings`

- [ ] **Step 3: Implement both stores**

```ts
// src/lib/stores/live-settings.ts
import { writable } from 'svelte/store';
import { browser } from '$app/environment';

export interface LiveSettings {
  refreshIntervalMs: 10_000 | 30_000 | 60_000;
  enabledByDefault: boolean;
  showDelayedWarning: boolean;
}

const KEY = 'liveSettings';
const DEFAULTS: LiveSettings = { refreshIntervalMs: 10_000, enabledByDefault: false, showDelayedWarning: true };

function load(): LiveSettings {
  if (!browser) return DEFAULTS;
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; }
  catch { return DEFAULTS; }
}

export const liveSettings = writable<LiveSettings>(load());
if (browser) liveSettings.subscribe((v) => localStorage.setItem(KEY, JSON.stringify(v)));
```

```ts
// src/lib/stores/live-toggle.ts
import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { get } from 'svelte/store';
import { liveSettings } from './live-settings';

const KEY = 'liveEnabled';

function load(): boolean {
  if (!browser) return false;
  const stored = localStorage.getItem(KEY);
  if (stored === null) return get(liveSettings).enabledByDefault;
  return stored === 'true';
}

export const liveEnabled = writable<boolean>(load());
if (browser) liveEnabled.subscribe((v) => localStorage.setItem(KEY, String(v)));
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/stores/live-settings.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/live-settings.ts src/lib/stores/live-toggle.ts src/lib/stores/live-settings.test.ts
git commit -m "feat(realtime): live settings + toggle stores (localStorage)"
```

---

### Task 9: Quote freshness helper

**Files:**
- Create: `src/lib/trading/freshness.ts`
- Test: `src/lib/trading/freshness.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/lib/trading/freshness.test.ts
import { describe, it, expect } from 'vitest';
import { assessQuoteFreshness } from './freshness';

describe('assessQuoteFreshness', () => {
  it('fresh when <= 60s', () => {
    expect(assessQuoteFreshness(0)).toBe('fresh');
    expect(assessQuoteFreshness(60_000)).toBe('fresh');
  });
  it('warns between 60s and 5min', () => {
    expect(assessQuoteFreshness(60_001)).toBe('warn');
    expect(assessQuoteFreshness(5 * 60_000)).toBe('warn');
  });
  it('blocks beyond 5min', () => {
    expect(assessQuoteFreshness(5 * 60_000 + 1)).toBe('block');
  });
  it('blocks when age is null/unknown', () => {
    expect(assessQuoteFreshness(null)).toBe('block');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/trading/freshness.test.ts`
Expected: FAIL — `assessQuoteFreshness is not a function`

- [ ] **Step 3: Implement**

```ts
// src/lib/trading/freshness.ts
export type Freshness = 'fresh' | 'warn' | 'block';

export const WARN_MS = 60_000;        // > 60s → warn
export const BLOCK_MS = 5 * 60_000;   // > 5min → block live orders

/** Classify a quote's age. null/unknown age → block (never trade on no data). */
export function assessQuoteFreshness(ageMs: number | null): Freshness {
  if (ageMs === null || !Number.isFinite(ageMs)) return 'block';
  if (ageMs <= WARN_MS) return 'fresh';
  if (ageMs <= BLOCK_MS) return 'warn';
  return 'block';
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/trading/freshness.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/trading/freshness.ts src/lib/trading/freshness.test.ts
git commit -m "feat(realtime): pure quote-freshness classifier"
```

---

### Task 10: Shared quote store

**Files:**
- Create: `src/lib/stores/live-quotes.ts`
- Test: `src/lib/stores/live-quotes.test.ts`

- [ ] **Step 1: Write the failing test (fake timers + injected fetch/visibility)**

```ts
// src/lib/stores/live-quotes.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { get } from 'svelte/store';

beforeEach(() => { vi.resetModules(); vi.useFakeTimers(); localStorage.clear(); });

async function setup(fetchImpl: typeof fetch) {
  const mod = await import('./live-quotes');
  mod.__setTestHooks({ fetch: fetchImpl, isVisible: () => true });
  const toggle = await import('./live-toggle');
  toggle.liveEnabled.set(true);
  return mod;
}

const okResp = (quotes: unknown[]) => ({ ok: true, json: async () => ({ quotes }) }) as Response;

describe('live-quotes store', () => {
  it('polls the union of subscribed codes and patches the map', async () => {
    const fetchImpl = vi.fn(async () => okResp([{ symbol: 'US.NVDA', last: 100, changePct: 1, bid: null, ask: null, volume: null, session: 'regular', source: 'yahoo', ts: Date.now() }]));
    const { subscribeQuotes, liveQuotes } = await setup(fetchImpl as never);
    const un = subscribeQuotes(['US.NVDA']);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(get(liveQuotes).get('US.NVDA')?.last).toBe(100);
    un();
  });

  it('does not poll when toggle is off', async () => {
    const fetchImpl = vi.fn(async () => okResp([]));
    const { subscribeQuotes } = await setup(fetchImpl as never);
    const toggle = await import('./live-toggle');
    toggle.liveEnabled.set(false);
    subscribeQuotes(['US.NVDA']);
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('marks codes stale and keeps last value on fetch failure', async () => {
    let call = 0;
    const fetchImpl = vi.fn(async () => {
      call += 1;
      if (call === 1) return okResp([{ symbol: 'US.NVDA', last: 100, changePct: 1, bid: null, ask: null, volume: null, session: 'regular', source: 'yahoo', ts: Date.now() }]);
      throw new Error('down');
    });
    const { subscribeQuotes, liveQuotes } = await setup(fetchImpl as never);
    subscribeQuotes(['US.NVDA']);
    await vi.advanceTimersByTimeAsync(10_000); // ok
    await vi.advanceTimersByTimeAsync(10_000); // fails
    const q = get(liveQuotes).get('US.NVDA')!;
    expect(q.last).toBe(100);   // last value retained
    expect(q.stale).toBe(true);
  });

  it('refcounts: stops fetching after all subscribers unsubscribe', async () => {
    const fetchImpl = vi.fn(async () => okResp([]));
    const { subscribeQuotes } = await setup(fetchImpl as never);
    const un1 = subscribeQuotes(['US.NVDA']);
    const un2 = subscribeQuotes(['US.NVDA']);
    un1(); un2();
    await vi.advanceTimersByTimeAsync(30_000);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/stores/live-quotes.test.ts`
Expected: FAIL — cannot find `./live-quotes`

- [ ] **Step 3: Implement**

```ts
// src/lib/stores/live-quotes.ts
import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { liveEnabled } from './live-toggle';
import { liveSettings } from './live-settings';
import type { MarketQuote, MarketSession } from '$lib/server/market-data/types';

export interface LiveQuote {
  last: number | null; changePct: number | null; bid: number | null; ask: number | null;
  volume: number | null; session: MarketSession; source: string; ts: number; stale: boolean;
}

export const liveQuotes = writable<Map<string, LiveQuote>>(new Map());

const refcounts = new Map<string, number>();
let timer: ReturnType<typeof setInterval> | null = null;
let inFlight = false;

// Test seams (overridden in unit tests).
let _fetch: typeof fetch = browser ? fetch.bind(globalThis) : (async () => { throw new Error('no fetch'); }) as never;
let _isVisible: () => boolean = () => !browser || document.visibilityState === 'visible';
export function __setTestHooks(h: { fetch?: typeof fetch; isVisible?: () => boolean }) {
  if (h.fetch) _fetch = h.fetch;
  if (h.isVisible) _isVisible = h.isVisible;
}

function activeCodes(): string[] {
  return [...refcounts.entries()].filter(([, n]) => n > 0).map(([c]) => c).sort();
}

function anyMarketOpen(): boolean {
  const map = get(liveQuotes);
  const codes = activeCodes();
  if (codes.length === 0) return false;
  // Unknown (not yet fetched) counts as open so we can learn the session on the first tick.
  return codes.some((c) => (map.get(c)?.session ?? 'regular') !== 'closed');
}

async function tick() {
  if (inFlight) return;
  if (!get(liveEnabled) || !_isVisible()) return;
  const codes = activeCodes();
  if (codes.length === 0 || !anyMarketOpen()) return;
  inFlight = true;
  try {
    const res = await _fetch(`/api/quotes/live?codes=${encodeURIComponent(codes.join(','))}`);
    if (!res.ok) throw new Error(`live ${res.status}`);
    const body = await res.json() as { quotes: MarketQuote[] };
    liveQuotes.update((m) => {
      const next = new Map(m);
      for (const q of body.quotes) {
        next.set(q.symbol, { last: q.last, changePct: q.changePct, bid: q.bid, ask: q.ask, volume: q.volume, session: q.session, source: q.source, ts: q.ts, stale: false });
      }
      return next;
    });
  } catch {
    liveQuotes.update((m) => {
      const next = new Map(m);
      for (const c of codes) { const prev = next.get(c); if (prev) next.set(c, { ...prev, stale: true }); }
      return next;
    });
  } finally {
    inFlight = false;
  }
}

function ensureLoop() {
  if (timer || !browser) return;
  const interval = get(liveSettings).refreshIntervalMs;
  timer = setInterval(tick, interval);
}

function maybeStopLoop() {
  if (timer && activeCodes().length === 0) { clearInterval(timer); timer = null; }
}

/** Register interest in `codes`; returns an unsubscribe to call in onDestroy. */
export function subscribeQuotes(codes: string[]): () => void {
  for (const raw of codes) {
    const c = raw.trim().toUpperCase();
    refcounts.set(c, (refcounts.get(c) ?? 0) + 1);
  }
  ensureLoop();
  return () => {
    for (const raw of codes) {
      const c = raw.trim().toUpperCase();
      const n = (refcounts.get(c) ?? 1) - 1;
      if (n <= 0) refcounts.delete(c); else refcounts.set(c, n);
    }
    maybeStopLoop();
  };
}

/** Age of a quote in ms (null if unknown). */
export function quoteAge(code: string, now = Date.now()): number | null {
  const q = get(liveQuotes).get(code.trim().toUpperCase());
  return q ? now - q.ts : null;
}

// Restart the loop with a new interval when settings change.
if (browser) liveSettings.subscribe(() => { if (timer) { clearInterval(timer); timer = null; ensureLoop(); } });
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/stores/live-quotes.test.ts`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/live-quotes.ts src/lib/stores/live-quotes.test.ts
git commit -m "feat(realtime): ref-counted polling quote store"
```

---

### Task 11: LiveDot + DelayedDataNotice components

**Files:**
- Create: `src/lib/components/LiveDot.svelte`
- Create: `src/lib/components/DelayedDataNotice.svelte`

- [ ] **Step 1: Implement LiveDot (status from store, mobile-safe)**

```svelte
<!-- src/lib/components/LiveDot.svelte -->
<script lang="ts">
  import { liveEnabled } from '$lib/stores/live-toggle';
  import { liveQuotes } from '$lib/stores/live-quotes';
  export let code: string;
  $: q = $liveQuotes.get(code.trim().toUpperCase());
  $: label = !$liveEnabled ? 'Off'
    : q?.stale ? 'Delayed'
    : q?.session === 'pre' ? 'Pre-market'
    : q?.session === 'post' ? 'After-hours'
    : q?.session === 'closed' ? 'Closed'
    : q ? 'Live' : 'Live';
  $: tone = label === 'Live' ? 'live' : label === 'Delayed' ? 'warn' : label === 'Off' ? 'off' : 'muted';
</script>

<span class="livedot {tone}" title={label}>
  <span class="dot" class:pulse={label === 'Live'}></span>
  <span class="lbl">{label}</span>
</span>

<style>
  .livedot { display:inline-flex; align-items:center; gap:5px; font-size:.62rem; font-weight:600; color:var(--muted); }
  .dot { width:7px; height:7px; border-radius:50%; background:var(--muted); flex:none; }
  .live .dot { background:var(--success, #30a46c); } .warn .dot { background:var(--warning, #d9a514); } .off .dot { background:var(--border); }
  .pulse { animation:p 1.6s ease-in-out infinite; } @keyframes p { 0%,100%{opacity:1;} 50%{opacity:.35;} }
  @media (max-width:767px) { .lbl { display:none; } } /* dot-only on mobile so rows never overflow */
</style>
```

- [ ] **Step 2: Implement DelayedDataNotice**

```svelte
<!-- src/lib/components/DelayedDataNotice.svelte -->
<script lang="ts">
  import { liveSettings } from '$lib/stores/live-settings';
</script>

{#if $liveSettings.showDelayedWarning}
  <p class="delayed-notice">
    Harga mungkin <strong>delayed</strong> dan berbeza ikut bursa — bukan untuk keputusan
    execution live trade. <span class="en">(Prices may be delayed and vary by exchange — not for live trade execution.)</span>
  </p>
{/if}

<style>
  .delayed-notice { font-size:.66rem; color:var(--muted); line-height:1.35; padding:6px 8px; border:1px solid var(--border); border-radius:8px; background:rgba(217,165,20,.06); }
  .en { opacity:.7; }
</style>
```

- [ ] **Step 3: Typecheck + commit**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | grep -E "LiveDot|DelayedDataNotice" || echo OK`
Expected: `OK`

```bash
git add src/lib/components/LiveDot.svelte src/lib/components/DelayedDataNotice.svelte
git commit -m "feat(realtime): LiveDot indicator + delayed-data notice"
```

---

## Phase 3 — Wire price surfaces + paper-trading realtime

### Task 12: Top-bar Live toggle

**Files:**
- Modify: `src/routes/+layout.svelte` (top bar; add toggle + LiveDot host)

- [ ] **Step 1: Add the toggle control to the top bar**

In the top-bar action cluster (near the account switcher / Ask AI buttons), add:

```svelte
<script lang="ts">
  import { liveEnabled } from '$lib/stores/live-toggle';
</script>

<button
  class="live-toggle"
  class:on={$liveEnabled}
  aria-pressed={$liveEnabled}
  title="Toggle live prices"
  on:click={() => liveEnabled.update((v) => !v)}
>
  <span class="dot"></span> Live
</button>

<style>
  .live-toggle { display:inline-flex; align-items:center; gap:6px; font-size:.7rem; font-weight:600; padding:4px 10px; border-radius:8px; border:1px solid var(--border); background:none; color:var(--muted); cursor:pointer; }
  .live-toggle.on { color:var(--success, #30a46c); border-color:var(--success, #30a46c); }
  .live-toggle .dot { width:7px; height:7px; border-radius:50%; background:currentColor; }
</style>
```

(Place inside the existing header actions container; match surrounding markup. If `+layout.svelte` is large, add only this button + its handler import, do not restructure.)

- [ ] **Step 2: Manual verify + commit**

Run: `npm run dev` then open `http://127.0.0.1:5173/dashboard`; the "Live" toggle appears in the top bar and toggles color on click.
Expected: visible toggle; no console errors.

```bash
git add "src/routes/+layout.svelte"
git commit -m "feat(realtime): top-bar Live toggle"
```

---

### Task 13: Stock-detail header live price + LiveDot

**Files:**
- Modify: `src/lib/components/stocks/detail/StockDetailHeader.svelte`

- [ ] **Step 1: Subscribe + show live values**

Add to the header component (props already include the symbol/code and SSR header data). Subscribe on mount, prefer the live value when present:

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { subscribeQuotes, liveQuotes } from '$lib/stores/live-quotes';
  import LiveDot from '$lib/components/LiveDot.svelte';
  export let code: string;           // moomoo code, e.g. "US.NVDA"
  export let lastPrice: number | null = null; // SSR fallback (existing prop or derived)

  const un = subscribeQuotes([code]);
  onDestroy(un);

  $: live = $liveQuotes.get(code.trim().toUpperCase());
  $: shownPrice = live?.last ?? lastPrice;
  $: shownChangePct = live?.changePct ?? null;
</script>

<!-- near the price display -->
<span class="price">{shownPrice != null ? shownPrice.toFixed(2) : 'Price Not Available'}</span>
{#if shownChangePct != null}<span class="chg">{shownChangePct.toFixed(2)}%</span>{/if}
<LiveDot {code} />
```

(Wire `code`/`lastPrice` from the page's `detail` VM where this component is used. Keep the existing markup; only replace the static price binding with `shownPrice` and add `<LiveDot>`.)

- [ ] **Step 2: Manual verify + commit**

Run: `npm run dev`; open `/stocks/NVDA`, toggle Live on. With market open the price updates; with market closed/bridge issues the LiveDot shows Closed/Delayed and SSR value remains.
Expected: no console errors; LiveDot renders.

```bash
git add src/lib/components/stocks/detail/StockDetailHeader.svelte
git commit -m "feat(realtime): live price + LiveDot on stock detail header"
```

---

### Task 14: Holdings + portfolio total live

**Files:**
- Modify: `src/routes/holdings/+page.svelte`
- Test: `src/lib/stores/portfolio-live.test.ts`
- Create: `src/lib/stores/portfolio-live.ts`

- [ ] **Step 1: Write the failing test for the live-total derivation**

```ts
// src/lib/stores/portfolio-live.test.ts
import { describe, it, expect } from 'vitest';
import { computeLiveTotal } from './portfolio-live';

describe('computeLiveTotal', () => {
  const holdings = [{ code: 'US.NVDA', qty: 2, fallbackPrice: 100 }, { code: 'US.AAPL', qty: 1, fallbackPrice: 50 }];
  it('uses live prices when present', () => {
    const quotes = new Map([['US.NVDA', { last: 120 } as never]]);
    // NVDA: 2*120 + AAPL fallback 1*50 = 290
    expect(computeLiveTotal(holdings, quotes)).toBe(290);
  });
  it('falls back when no live price', () => {
    expect(computeLiveTotal(holdings, new Map())).toBe(250);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/stores/portfolio-live.test.ts`
Expected: FAIL — cannot find `./portfolio-live`

- [ ] **Step 3: Implement the pure derivation**

```ts
// src/lib/stores/portfolio-live.ts
import type { LiveQuote } from './live-quotes';

export interface LiveHolding { code: string; qty: number; fallbackPrice: number; }

/** Sum market value, preferring a live price per holding, else its fallback. */
export function computeLiveTotal(holdings: LiveHolding[], quotes: Map<string, Pick<LiveQuote, 'last'>>): number {
  return holdings.reduce((sum, h) => {
    const live = quotes.get(h.code.trim().toUpperCase())?.last;
    const price = live ?? h.fallbackPrice;
    return sum + price * h.qty;
  }, 0);
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/stores/portfolio-live.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Wire holdings page (subscribe all holding codes; show live total)**

In `src/routes/holdings/+page.svelte`:

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { subscribeQuotes, liveQuotes } from '$lib/stores/live-quotes';
  import { computeLiveTotal, type LiveHolding } from '$lib/stores/portfolio-live';
  import LiveDot from '$lib/components/LiveDot.svelte';
  export let data;
  $: holdings = (data.holdings ?? []).map((h) => ({ code: h.code, qty: h.quantity, fallbackPrice: h.lastPrice })) as LiveHolding[];
  const un = subscribeQuotes(holdings.map((h) => h.code));
  onDestroy(un);
  $: liveTotal = computeLiveTotal(holdings, $liveQuotes);
</script>

<!-- where the total is shown -->
<span>{liveTotal.toFixed(2)}</span>
```

(Adapt field names — `data.holdings`, `h.code`, `h.quantity`, `h.lastPrice` — to the page's actual shape; subscribe once for the whole list.)

- [ ] **Step 6: Commit**

```bash
git add src/lib/stores/portfolio-live.ts src/lib/stores/portfolio-live.test.ts src/routes/holdings/+page.svelte
git commit -m "feat(realtime): live holdings prices + portfolio total"
```

---

### Task 15: Paper-trading realtime P/L

**Files:**
- Modify: `src/routes/paper-trading/+page.svelte`

- [ ] **Step 1: Subscribe position symbols; recompute unrealized P/L from live marks**

```svelte
<script lang="ts">
  import { onDestroy } from 'svelte';
  import { subscribeQuotes, liveQuotes } from '$lib/stores/live-quotes';
  import LiveDot from '$lib/components/LiveDot.svelte';
  import DelayedDataNotice from '$lib/components/DelayedDataNotice.svelte';
  export let data;
  $: positions = data.paper?.positions ?? [];
  // moomoo position codes look like "US.NVDA"; subscribe them all.
  const un = subscribeQuotes(positions.map((p) => p.code));
  onDestroy(un);
  function mark(p) { return $liveQuotes.get(String(p.code).toUpperCase())?.last ?? p.last_price ?? p.cost_price; }
  function uPnl(p) { return (mark(p) - p.cost_price) * p.qty; }
</script>

<DelayedDataNotice />
{#each positions as p}
  <tr>
    <td>{p.code} <LiveDot code={p.code} /></td>
    <td>{mark(p)?.toFixed(2)}</td>
    <td class:pos={uPnl(p) >= 0} class:neg={uPnl(p) < 0}>{uPnl(p).toFixed(2)}</td>
  </tr>
{/each}
```

(Adapt to the page's existing positions table + field names: `p.code`, `p.qty`, `p.cost_price`, `p.last_price`. Add the LiveDot + DelayedDataNotice; recompute P/L from `mark()`.)

- [ ] **Step 2: Manual verify + commit**

Run: `npm run dev`; open `/paper-trading`, toggle Live on. Position marks + unrealized P/L update; delayed notice shows.
Expected: no console errors.

```bash
git add src/routes/paper-trading/+page.svelte
git commit -m "feat(realtime): realtime mark + P/L on paper-trading"
```

---

## Phase 4 — Staleness protection + price audit log

### Task 16: PriceAuditLog model + migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add the model**

Append to `prisma/schema.prisma`:

```prisma
model PriceAuditLog {
  id        String   @id @default(cuid())
  userId    String
  context   String   @db.VarChar(16) // 'trade' | 'order' | 'paper'
  symbol    String   @db.VarChar(32)
  source    String   @db.VarChar(16) // provider name at capture
  price     Float?
  bid       Float?
  ask       Float?
  quoteTs   DateTime // provider quote timestamp
  ageMs     Int      // age at confirm
  status    String   @db.VarChar(16) // 'live' | 'stale' | 'delayed'
  createdAt DateTime @default(now())

  @@index([userId, symbol, createdAt])
}
```

- [ ] **Step 2: Push schema + regenerate client**

Run: `npx prisma db push && npx prisma generate`
Expected: `PriceAuditLog` table created; client regenerated, no errors.

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(realtime): PriceAuditLog model"
```

---

### Task 17: Price audit service

**Files:**
- Create: `src/lib/services/price-audit.service.ts`
- Test: `src/lib/services/price-audit.service.test.ts`

- [ ] **Step 1: Write the failing test (mock prisma)**

```ts
// src/lib/services/price-audit.service.test.ts
import { describe, it, expect, vi } from 'vitest';
const create = vi.fn(async (args) => ({ id: 'a1', ...args.data }));
vi.mock('$lib/server/db', () => ({ prisma: { priceAuditLog: { create } } }));
import { recordPriceAudit } from './price-audit.service';

describe('recordPriceAudit', () => {
  it('derives status from age and persists the snapshot', async () => {
    const now = 1_000_000;
    await recordPriceAudit({ userId: 'u1', context: 'paper', symbol: 'US.NVDA', source: 'yahoo', price: 100, bid: 99, ask: 101, quoteTs: now - 90_000 }, now);
    const arg = create.mock.calls[0][0].data;
    expect(arg).toMatchObject({ userId: 'u1', context: 'paper', symbol: 'US.NVDA', source: 'yahoo', price: 100, ageMs: 90_000, status: 'stale' });
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/lib/services/price-audit.service.test.ts`
Expected: FAIL — cannot find `./price-audit.service`

- [ ] **Step 3: Implement**

```ts
// src/lib/services/price-audit.service.ts
import { prisma } from '$lib/server/db';
import { assessQuoteFreshness } from '$lib/trading/freshness';

export interface PriceAuditInput {
  userId: string;
  context: 'trade' | 'order' | 'paper';
  symbol: string;
  source: string;
  price: number | null;
  bid: number | null;
  ask: number | null;
  quoteTs: number; // epoch ms
}

/** Persist the price the user acted on, classifying freshness as live/stale/delayed. */
export async function recordPriceAudit(input: PriceAuditInput, now = Date.now()) {
  const ageMs = Math.max(0, now - input.quoteTs);
  const f = assessQuoteFreshness(ageMs);
  const status = f === 'fresh' ? 'live' : f === 'warn' ? 'stale' : 'delayed';
  return prisma.priceAuditLog.create({
    data: {
      userId: input.userId, context: input.context, symbol: input.symbol, source: input.source,
      price: input.price, bid: input.bid, ask: input.ask,
      quoteTs: new Date(input.quoteTs), ageMs, status
    }
  });
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/lib/services/price-audit.service.test.ts`
Expected: PASS (1 test)

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/price-audit.service.ts src/lib/services/price-audit.service.test.ts
git commit -m "feat(realtime): price audit service"
```

---

### Task 18: Block stale live orders in trade validation

**Files:**
- Modify: `src/routes/api/trades/validate/+server.ts`
- Test: `src/routes/api/trades/validate/freshness.test.ts`

- [ ] **Step 1: Write the failing test (client sends quote snapshot; server gates)**

```ts
// src/routes/api/trades/validate/freshness.test.ts
import { describe, it, expect, vi } from 'vitest';
vi.mock('$lib/services/trade-layer.service', () => ({
  parseTradeOrderType: (x: unknown) => x, parseTradeTicketType: (x: unknown) => x,
  validateTradeTicket: vi.fn(async () => ({ ok: true, warnings: [] }))
}));
vi.mock('$lib/services/price-audit.service', () => ({ recordPriceAudit: vi.fn(async () => ({})) }));
import { POST } from './+server';

function post(quoteTs: number) {
  return { request: { json: async () => ({ symbol: 'US.NVDA', side: 'buy', quantity: 1, quote: { price: 100, bid: null, ask: null, ts: quoteTs, source: 'yahoo' } }) }, locals: { user: { id: 'u1' } } } as never;
}

describe('validate freshness gate', () => {
  it('blocks when the quote is older than 5min', async () => {
    const res = await POST(post(Date.now() - 6 * 60_000));
    const body = await res.json();
    expect(body.validation.freshness).toBe('block');
    expect(body.validation.ok).toBe(false);
  });
  it('passes a fresh quote through', async () => {
    const res = await POST(post(Date.now()));
    const body = await res.json();
    expect(body.validation.freshness).toBe('fresh');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/routes/api/trades/validate/freshness.test.ts`
Expected: FAIL (no freshness field / wrong shape)

- [ ] **Step 3: Implement the gate (server-side enforcement + audit)**

```ts
// src/routes/api/trades/validate/+server.ts
import { json } from '@sveltejs/kit';
import {
  parseTradeOrderType, parseTradeTicketType, validateTradeTicket
} from '$lib/services/trade-layer.service';
import { assessQuoteFreshness } from '$lib/trading/freshness';
import { recordPriceAudit } from '$lib/services/price-audit.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user!;
  const body = await request.json().catch(() => ({}));

  // Server-side staleness enforcement on the client-supplied quote snapshot.
  const quote = body.quote ?? null;
  const ageMs = quote && typeof quote.ts === 'number' ? Date.now() - quote.ts : null;
  const freshness = assessQuoteFreshness(ageMs);

  const validation = await validateTradeTicket(user.id, {
    sourceType: String(body.sourceType ?? 'manual'),
    sourceId: body.sourceId ? String(body.sourceId) : null,
    ticketType: parseTradeTicketType(body.ticketType),
    symbol: String(body.symbol ?? ''),
    side: body.side,
    quantity: Number(body.quantity ?? 0),
    orderType: parseTradeOrderType(body.orderType),
    limitPrice: body.limitPrice === null || body.limitPrice === undefined ? null : Number(body.limitPrice),
    thesis: body.thesis ? String(body.thesis) : undefined,
    metadata: typeof body.metadata === 'object' && body.metadata ? body.metadata : {}
  });

  // Record what price the user is validating against.
  if (quote) {
    await recordPriceAudit({
      userId: user.id, context: 'trade', symbol: String(body.symbol ?? ''),
      source: String(quote.source ?? 'unknown'), price: quote.price ?? null,
      bid: quote.bid ?? null, ask: quote.ask ?? null, quoteTs: Number(quote.ts ?? Date.now())
    }).catch(() => {});
  }

  // A block overrides ok; a warn is surfaced but non-blocking.
  const ok = (validation as { ok?: boolean }).ok !== false && freshness !== 'block';
  const warnings = [
    ...((validation as { warnings?: string[] }).warnings ?? []),
    ...(freshness === 'warn' ? ['Quote may be stale (>60s) — refresh before confirming.'] : []),
    ...(freshness === 'block' ? ['Quote too old (>5min) — refresh required before placing a live order.'] : [])
  ];

  return json({ status: 'validated', validation: { ...validation, ok, freshness, warnings } });
};
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/routes/api/trades/validate/freshness.test.ts`
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add "src/routes/api/trades/validate/+server.ts" src/routes/api/trades/validate/freshness.test.ts
git commit -m "feat(realtime): block stale quotes + audit in trade validation"
```

---

### Task 19: Audit paper orders (and prove paper never hits live broker)

**Files:**
- Modify: `src/routes/paper-trading/+page.server.ts` (`submitOrder` action)
- Test: `src/routes/paper-trading/paper-safety.test.ts`

- [ ] **Step 1: Write the failing test (paper submit is always SIMULATE)**

```ts
// src/routes/paper-trading/paper-safety.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
vi.mock('$lib/services/price-audit.service', () => ({ recordPriceAudit: vi.fn(async () => ({})) }));
const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ broker_order_id: 'x', status: 'submitted' }) }));
vi.stubGlobal('fetch', fetchMock);

import { actions } from './+page.server';

function fd(map: Record<string, string>) { const f = new FormData(); for (const k in map) f.set(k, map[k]); return f; }
beforeEach(() => fetchMock.mockClear());

describe('paper submitOrder safety', () => {
  it('always targets the SIMULATE env, never LIVE', async () => {
    await actions.submitOrder({ request: { formData: async () => fd({ asset_type: 'stock', side: 'BUY', symbol: 'NVDA', qty: '1', price: '100' }) }, locals: { user: { id: 'u1' } } } as never);
    const sentBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sentBody.trade_env).toBe('SIMULATE');
    expect(sentBody.dry_run).toBe(false);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/routes/paper-trading/paper-safety.test.ts`
Expected: FAIL — `recordPriceAudit` import path not yet used / action shape (it will actually pass on env assertion but fail on the audit-mock expectation once added; if it passes immediately, proceed — the test pins the invariant).

- [ ] **Step 3: Add audit logging to `submitOrder` (keep SIMULATE invariant)**

In `submitOrder`, after building `orderPayload` (which already hardcodes `trade_env: 'SIMULATE'`, `acc_id: PAPER_ACC_ID`), record the price audit before the bridge call:

```ts
// inside submitOrder, after reading price/qty/symbol:
import { recordPriceAudit } from '$lib/services/price-audit.service';
// ...
const quoteTsRaw = data.get('quote_ts');
await recordPriceAudit({
  userId: user.id, context: 'paper', symbol: toMoomooSymbol(symbol),
  source: String(data.get('quote_source') ?? 'unknown'),
  price: price > 0 ? price : null, bid: null, ask: null,
  quoteTs: quoteTsRaw ? Number(quoteTsRaw) : Date.now()
}).catch(() => {});
```

(The `submitOrder` body is unchanged otherwise — `trade_env` stays `'SIMULATE'`, so paper can never reach the live broker. The test asserts this invariant.)

- [ ] **Step 4: Run to verify it passes**

Run: `npx vitest run src/routes/paper-trading/paper-safety.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/routes/paper-trading/+page.server.ts src/routes/paper-trading/paper-safety.test.ts
git commit -m "feat(realtime): audit paper orders; assert SIMULATE-only invariant"
```

---

## Phase 5 — Settings UI + e2e

### Task 20: Settings controls

**Files:**
- Modify: `src/routes/settings/+page.svelte`

- [ ] **Step 1: Add live-price settings controls bound to the store**

```svelte
<script lang="ts">
  import { liveSettings } from '$lib/stores/live-settings';
</script>

<section class="setting-group">
  <h3>Live prices</h3>
  <label>
    Refresh interval
    <select bind:value={$liveSettings.refreshIntervalMs}>
      <option value={10_000}>10s</option>
      <option value={30_000}>30s</option>
      <option value={60_000}>60s</option>
    </select>
  </label>
  <label><input type="checkbox" bind:checked={$liveSettings.enabledByDefault} /> Enable live prices by default</label>
  <label><input type="checkbox" bind:checked={$liveSettings.showDelayedWarning} /> Show delayed-data warning</label>
</section>
```

(Place within the existing settings layout; match its section markup. `bind:value`/`bind:checked` on `$liveSettings` persists via the store's localStorage subscription.)

- [ ] **Step 2: Manual verify + commit**

Run: `npm run dev`; open `/settings`, change interval to 30s, reload — value persists.
Expected: persists; no console errors.

```bash
git add src/routes/settings/+page.svelte
git commit -m "feat(realtime): live-price settings controls"
```

---

### Task 21: e2e — toggle, indicator, mobile layout, degradation

**Files:**
- Create: `tests/e2e/realtime/live-prices.spec.ts`

- [ ] **Step 1: Write the e2e**

```ts
// tests/e2e/realtime/live-prices.spec.ts
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle } from '../ai-ux/helpers';

test.describe('realtime live prices', () => {
  test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
  test.beforeEach(async ({ page }) => signInByApi(page));

  test('Live toggle renders and persists', async ({ page }) => {
    await gotoAndSettle(page, '/dashboard');
    const toggle = page.getByRole('button', { name: /live/i }).first();
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-pressed', 'true');
    await page.reload();
    await expect(page.getByRole('button', { name: /live/i }).first()).toHaveAttribute('aria-pressed', 'true');
  });

  test('LiveDot renders on stock detail and never crashes the page', async ({ page }) => {
    await gotoAndSettle(page, '/stocks/NVDA');
    if (page.url().match(/onboarding|login/)) test.skip(true, 'redirected');
    await expect(page.locator('.livedot').first()).toBeVisible();
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    await page.waitForTimeout(1500);
    expect(errors).toEqual([]);
  });

  test('mobile LiveDot does not overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await gotoAndSettle(page, '/stocks/NVDA');
    if (page.url().match(/onboarding|login/)) test.skip(true, 'redirected');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});
```

- [ ] **Step 2: Run the e2e**

Run: `set -a; . ./.env.test; set +a; npx playwright test tests/e2e/realtime/live-prices.spec.ts --reporter=line`
Expected: PASS (3 tests), or skipped if no creds.

- [ ] **Step 3: Commit**

```bash
git add tests/e2e/realtime/live-prices.spec.ts
git commit -m "test(realtime): e2e toggle, LiveDot, mobile, degradation"
```

---

### Task 22: Full regression + finish

- [ ] **Step 1: Run the unit + python suites**

Run: `npx vitest run`
Expected: all pass (existing 254 + new realtime tests).
Run: `cd moomoo-service && python -m pytest -q` (unchanged — should still be 43 passed)

- [ ] **Step 2: Typecheck**

Run: `npx svelte-check --tsconfig ./tsconfig.json --threshold error 2>&1 | tail -3`
Expected: no new errors in realtime files.

- [ ] **Step 3: Finish the branch**

Use `superpowers:finishing-a-development-branch` to verify tests and choose merge/PR for `realtime-prices`.

---

## Self-Review (author checklist — completed)

**Spec coverage:**
- Provider abstraction + Yahoo + registry → Tasks 2,4,5. ✅
- Symbol map → Task 3. ✅
- Batch endpoint w/ 8s cache → Task 6. ✅
- Chart from provider (not realtime) → Task 7. ✅
- Toggle (default off) + settings (interval/default/warning) → Tasks 8,12,20. ✅
- Freshness helper → Task 9. ✅
- Quote store (refcount/union/pause/stale/interval) → Task 10. ✅
- LiveDot + sessions + delayed notice → Task 11. ✅
- Wiring header/holdings/total/paper realtime → Tasks 13,14,15. ✅
- Staleness block + audit on trade → Task 18; paper audit + invariant → Task 19; audit model/service → Tasks 16,17. ✅
- Tests: stale-blocks-order (18), paper-cannot-hit-live (19), live-updates-total (14), Yahoo-failure-keeps-last (10), mobile LiveDot (21). ✅

**Placeholder scan:** No TBD/TODO; every code step shows code. Modify-existing steps that depend on page-specific field names note the adaptation explicitly and show the exact code to insert. ✅

**Type consistency:** `MarketQuote`/`MarketSession` used consistently across provider, endpoint, store; `LiveQuote` shape stable; `assessQuoteFreshness(ageMs)` signature consistent in Tasks 9/17/18; `subscribeQuotes`/`liveQuotes`/`__setTestHooks` names consistent across Tasks 10/13/14/15. ✅
