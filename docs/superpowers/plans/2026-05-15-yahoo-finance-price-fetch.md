# Yahoo Finance Price Fetch — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Refresh Prices" button to the Holdings page that fetches current market prices from Yahoo Finance and persists them to `asset.latestPrice` in the database.

**Architecture:** A new `market-price.service.ts` handles symbol normalization and Yahoo Finance API calls. A new `refreshPrices` form action in `+page.server.ts` orchestrates the fetch and DB update. The Holdings page gets a button that triggers the action and displays the result inline.

**Tech Stack:** SvelteKit form actions, Prisma (`prisma.asset.update`), Yahoo Finance v7 quote API (no API key required), native `fetch`.

---

## File Map

| File | Change |
|---|---|
| `src/lib/services/market-price.service.ts` | **Create** — symbol normalization + Yahoo fetch + DB update |
| `src/routes/holdings/+page.server.ts` | **Modify** — add `refreshPrices` action |
| `src/routes/holdings/+page.svelte` | **Modify** — add button + result display |

---

## Task 1: Create market-price.service.ts

**Files:**
- Create: `src/lib/services/market-price.service.ts`

- [ ] **Step 1: Create the file with symbol normalization**

Symbols in DB come from Moomoo with market prefixes (e.g. `US.NIO`, `US.SCHG`). Yahoo Finance expects plain tickers (`NIO`, `SCHG`). HK stocks use `.HK` suffix.

```typescript
// src/lib/services/market-price.service.ts
import { prisma } from '$lib/server/db';

export function normalizeSymbol(symbol: string): string {
  if (symbol.startsWith('US.')) return symbol.slice(3);
  if (symbol.startsWith('HK.')) {
    const code = symbol.slice(3).padStart(4, '0');
    return `${code}.HK`;
  }
  return symbol;
}
```

- [ ] **Step 2: Add fetchYahooPrices**

```typescript
export async function fetchYahooPrices(symbols: string[]): Promise<Record<string, number>> {
  if (symbols.length === 0) return {};

  const normalized = symbols.map(normalizeSymbol);
  const query = normalized.join(',');
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(query)}&fields=regularMarketPrice`;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { 'user-agent': 'Mozilla/5.0' }
    });

    if (!response.ok) return {};

    const payload = await response.json();
    const quotes: Array<{ symbol: string; regularMarketPrice?: number }> =
      payload?.quoteResponse?.result ?? [];

    const result: Record<string, number> = {};
    for (const quote of quotes) {
      if (quote.regularMarketPrice != null) {
        result[quote.symbol] = quote.regularMarketPrice;
      }
    }
    return result;
  } catch {
    return {};
  }
}
```

- [ ] **Step 3: Add refreshHoldingPrices**

```typescript
export type PriceRefreshResult = {
  updated: number;
  failed: number;
  skipped: number;
  refreshedAt: string;
};

export async function refreshHoldingPrices(userId: string): Promise<PriceRefreshResult> {
  // Get all distinct asset symbols from this user's buy/sell transactions
  const assets = await prisma.asset.findMany({
    where: {
      transactions: {
        some: { userId, type: { in: ['buy', 'sell'] } }
      }
    },
    select: { id: true, symbol: true }
  });

  if (assets.length === 0) {
    return { updated: 0, failed: 0, skipped: 0, refreshedAt: new Date().toISOString() };
  }

  const symbols = assets.map((a) => a.symbol);
  const prices = await fetchYahooPrices(symbols);

  let updated = 0;
  let failed = 0;
  let skipped = 0;

  for (const asset of assets) {
    const normalizedSymbol = normalizeSymbol(asset.symbol);
    const price = prices[normalizedSymbol];

    if (price == null) {
      skipped++;
      continue;
    }

    try {
      await prisma.asset.update({
        where: { id: asset.id },
        data: { latestPrice: price }
      });
      updated++;
    } catch {
      failed++;
    }
  }

  return { updated, failed, skipped, refreshedAt: new Date().toISOString() };
}
```

- [ ] **Step 4: Verify file compiles — check for TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors related to the new file.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/market-price.service.ts
git commit -m "feat: add market-price service with Yahoo Finance fetch"
```

---

## Task 2: Add refreshPrices action to holdings page server

**Files:**
- Modify: `src/routes/holdings/+page.server.ts`

- [ ] **Step 1: Update the file**

Replace the entire file content:

```typescript
import { getDemoUser } from '$lib/server/demo-user';
import { getCashBalance, getHoldings, snapshotToHoldings } from '$lib/services/portfolio.service';
import { refreshHoldingPrices } from '$lib/services/market-price.service';
import { getLatestSnapshot } from '$lib/services/snapshot.service';
import type { SnapshotHolding } from '$lib/types/portfolio';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const user = await getDemoUser();
  const snapshot = await getLatestSnapshot(user.id);

  if (snapshot) {
    let rows: SnapshotHolding[] = [];
    try { rows = JSON.parse(snapshot.holdingsJson); } catch { rows = []; }
    const totalValue = rows.reduce((sum, h) => sum + h.marketValue, 0);
    return {
      holdings: snapshotToHoldings(rows, totalValue),
      cashBalance: snapshot.cashBalance,
      dataSource: 'snapshot' as const,
      snapshotDate: snapshot.snapshotDate.toISOString()
    };
  }

  const [holdings, cashBalance] = await Promise.all([getHoldings(user.id), getCashBalance(user.id)]);
  return { holdings, cashBalance, dataSource: 'transactions' as const, snapshotDate: null };
};

export const actions: Actions = {
  refreshPrices: async () => {
    const user = await getDemoUser();
    const result = await refreshHoldingPrices(user.id);
    return { refreshResult: result };
  }
};
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/routes/holdings/+page.server.ts
git commit -m "feat: add refreshPrices action to holdings page"
```

---

## Task 3: Add Refresh Prices button to holdings page UI

**Files:**
- Modify: `src/routes/holdings/+page.svelte`

- [ ] **Step 1: Update the script block**

Replace the existing `<script>` block:

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import { RefreshCw } from 'lucide-svelte';
  import type { ActionData, PageData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import HoldingsTable from '$lib/components/portfolioai/tables/HoldingsTable.svelte';
  import StatCard from '$lib/components/portfolioai/StatCard.svelte';

  export let data: PageData;
  export let form: ActionData;

  let refreshing = false;

  function money(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }

  $: totalMarket = data.holdings.reduce((s: number, h: { marketValue: number }) => s + h.marketValue, 0);
  $: openPositions = data.holdings.length;

  $: subtitle = data.dataSource === 'snapshot'
    ? `Live from Moomoo · synced ${new Date(data.snapshotDate as string).toLocaleDateString()}`
    : 'Calculated from transactions';
</script>
```

- [ ] **Step 2: Update the template — add header row with button and result**

Replace the existing template (everything from `<PageHeader>` down to `<HoldingsTable>`):

```svelte
<div class="page-top">
  <PageHeader
    title="Holdings"
    {subtitle}
    breadcrumb={[{ label: 'Portfolio', href: '/dashboard' }, { label: 'Holdings' }]}
  />
  <form
    method="POST"
    action="?/refreshPrices"
    use:enhance={() => {
      refreshing = true;
      return async ({ update }) => {
        await update();
        refreshing = false;
      };
    }}
  >
    <button class="btn-refresh" type="submit" disabled={refreshing}>
      <RefreshCw size={14} class={refreshing ? 'spin' : ''} />
      {refreshing ? 'Refreshing…' : 'Refresh Prices'}
    </button>
  </form>
</div>

{#if form?.refreshResult}
  {@const r = form.refreshResult}
  <div class="refresh-result">
    Updated {r.updated} price{r.updated !== 1 ? 's' : ''}
    {#if r.skipped > 0} · {r.skipped} skipped{/if}
    {#if r.failed > 0} · {r.failed} failed{/if}
    · {new Date(r.refreshedAt).toLocaleTimeString()}
  </div>
{/if}

<div class="stat-row">
  <StatCard label="Market Value"   value={money(totalMarket)}        tint="primary" />
  <StatCard label="Cash Balance"   value={money(data.cashBalance)}   tint="success" />
  <StatCard label="Open Positions" value={String(openPositions)}     tint="primary" />
</div>

<HoldingsTable holdings={data.holdings} />
```

- [ ] **Step 3: Add styles**

Replace the existing `<style>` block:

```svelte
<style>
  .page-top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .btn-refresh {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: var(--card);
    color: var(--text);
    font-size: 0.78rem;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
    transition: border-color 0.15s, background 0.15s;
  }
  .btn-refresh:hover:not(:disabled) {
    border-color: var(--primary);
    background: rgba(var(--primary-rgb), 0.06);
  }
  .btn-refresh:disabled { opacity: 0.55; cursor: not-allowed; }

  :global(.spin) { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .refresh-result {
    margin-bottom: 12px;
    padding: 8px 12px;
    border-radius: 8px;
    border: 1px solid rgba(var(--success-rgb), 0.3);
    background: rgba(var(--success-rgb), 0.07);
    color: var(--success);
    font-size: 0.76rem;
  }

  .stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
  @media (max-width: 640px) { .stat-row { grid-template-columns: 1fr; } }
</style>
```

- [ ] **Step 4: Manual test**

1. Open `http://localhost:5173/holdings`
2. Verify "Refresh Prices" button appears top-right
3. Click button — spinner shows, then result banner appears: "Updated X prices · Y skipped · HH:MM:SS"
4. Check DB: `asset.latestPrice` updated for recognized symbols

- [ ] **Step 5: Commit**

```bash
git add src/routes/holdings/+page.svelte
git commit -m "feat: add Refresh Prices button to holdings page"
```
