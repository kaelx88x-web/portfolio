# Approval-Based Trade Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add "Execute All" to the Rebalance page and per-candidate "Execute" to the Options page, both routing through an inline confirmation panel to Moomoo paper trading.

**Architecture:** A new `execution-bridge.service.ts` converts domain objects (RebalanceSuggestion[], CoveredCallCandidate[], PutExposureRow[]) into TradeTickets, then a shared `ExecutionConfirmPanel.svelte` handles user confirmation. Actual order submission reuses the existing trade-layer → moomoo-execution pipeline unchanged.

**Tech Stack:** SvelteKit, TypeScript, Svelte 5, Prisma, existing `trade-layer.service.ts`, `moomoo-execution.service.ts`

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/services/execution-bridge.service.ts` | **CREATE** | Convert suggestions/candidates → TradeTickets; expiry math; quantity calc |
| `src/lib/components/execution/ExecutionConfirmPanel.svelte` | **CREATE** | Inline panel: trade rows, DTE picker, Confirm/Cancel, result state |
| `src/lib/components/options/CoveredCallTable.svelte` | **MODIFY** | Add optional `onExecute` event dispatch + Execute button per row |
| `src/routes/optimization/rebalance/+page.server.ts` | **MODIFY** | Add `queueRebalance` and `executeAll` actions |
| `src/routes/optimization/rebalance/+page.svelte` | **MODIFY** | Add Execute All button + ExecutionConfirmPanel |
| `src/routes/optimization/options/+page.server.ts` | **MODIFY** | Add `queueOption` and `executeOption` actions |
| `src/routes/optimization/options/+page.svelte` | **MODIFY** | Wire ExecutionConfirmPanel for covered calls and puts |

---

## Task 1: execution-bridge.service.ts

**Files:**
- Create: `src/lib/services/execution-bridge.service.ts`

**Context:** This service is the only place that knows both domains (optimization + trade execution). It never calls moomoo-execution directly — it only creates TradeTickets. All tickets get `metadata.mode = 'paper'` so callers can assert it before submitting.

- [ ] **Step 1: Create the file with types and date helpers**

```typescript
// src/lib/services/execution-bridge.service.ts
import { createTradeTicket, cancelTradeTicket } from '$lib/services/trade-layer.service';
import { fetchYahooPrices } from '$lib/services/market-price.service';
import { getHoldings } from '$lib/services/portfolio.service';
import type { RebalanceSuggestion } from '$lib/services/optimization-engine.service';
import type { CoveredCallCandidate, PutExposureRow } from '$lib/services/options-intelligence.service';
import type { TradeTicket } from '$lib/services/trade-layer.service';

export type DTE = 21 | 30 | 45 | 60;
export const DTE_OPTIONS: DTE[] = [21, 30, 45, 60];

export type RebalanceQueueResult = {
  tickets: TradeTicket[];
  skipped: Array<{ label: string; reason: string }>;
};

export function parseDte(value: FormDataEntryValue | string | null): DTE {
  const n = Number(value ?? 30);
  return (DTE_OPTIONS as number[]).includes(n) ? (n as DTE) : 30;
}

// ── Date helpers ──────────────────────────────────────────────────────────────

/** Returns 'YYMMDD' string for the nearest monthly expiry (third Friday) >= today+dte */
export function nearestMonthlyExpiry(dte: DTE): string {
  const today = new Date();
  const target = new Date(today);
  target.setDate(target.getDate() + dte);

  const friday = thirdFridayOfMonth(target.getFullYear(), target.getMonth());
  if (friday >= target) return toYYMMDD(friday);

  // Use next month
  const nm = new Date(target.getFullYear(), target.getMonth() + 1, 1);
  const nextFriday = thirdFridayOfMonth(nm.getFullYear(), nm.getMonth());
  return toYYMMDD(nextFriday ?? target);
}

function thirdFridayOfMonth(year: number, month: number): Date {
  // Find first Friday of month, then add 14 days for the third
  const first = new Date(year, month, 1);
  const dayOfWeek = first.getDay(); // 0=Sun … 6=Sat, 5=Fri
  const firstFriday = 1 + ((5 - dayOfWeek + 7) % 7);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const thirdFridayDay = firstFriday + 14;
  return new Date(year, month, thirdFridayDay > daysInMonth ? thirdFridayDay - 7 : thirdFridayDay);
}

function toYYMMDD(date: Date): string {
  const yy = String(date.getFullYear()).slice(2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

/** Build contract symbol. Matches observed format: PATH260529P9500 (no zero-padding). */
function toContractSymbol(underlying: string, expiry: string, type: 'C' | 'P', strike: number): string {
  return `${underlying}${expiry}${type}${Math.round(strike * 1000)}`;
}

/** Extract underlying ticker from contract symbol e.g. PATH260529P9500 → PATH */
export function extractUnderlying(contractSymbol: string): string {
  return contractSymbol.replace(/^US\./, '').match(/^([A-Z]+)\d{6}/)?.[1] ?? contractSymbol;
}
```

- [ ] **Step 2: Add `rebalanceSuggestionsToTickets()`**

Append to the same file:

```typescript
// ── Rebalance ─────────────────────────────────────────────────────────────────

export async function rebalanceSuggestionsToTickets(
  userId: string,
  suggestions: RebalanceSuggestion[],
  totalPortfolioValue: number
): Promise<RebalanceQueueResult> {
  const tickets: TradeTicket[] = [];
  const skipped: Array<{ label: string; reason: string }> = [];

  // Flatten allocations with meaningful delta (>= 0.5%) and skip cash
  const tradeable = suggestions.flatMap((s) =>
    s.targetAllocation
      .filter((a) => Math.abs(a.deltaPct) >= 0.5 && a.role !== 'cash')
      .map((a) => ({ allocation: a }))
  );

  if (tradeable.length === 0) return { tickets: [], skipped: [] };

  const symbols = [...new Set(tradeable.map((t) => t.allocation.label))];
  const prices = await fetchYahooPrices(symbols);

  for (const { allocation } of tradeable) {
    const symbol = allocation.label;
    const price = prices[symbol];

    if (!price || price <= 0) {
      skipped.push({ label: symbol, reason: 'price unavailable' });
      continue;
    }

    const side = allocation.deltaPct > 0 ? ('buy' as const) : ('sell' as const);
    const dollarAmount = (Math.abs(allocation.deltaPct) / 100) * totalPortfolioValue;
    const quantity = Math.max(1, Math.round(dollarAmount / price));

    const ticket = await createTradeTicket(userId, {
      sourceType: 'rebalance_bridge',
      sourceId: null,
      ticketType: side === 'buy' ? 'buy' : 'sell',
      symbol,
      side,
      quantity,
      orderType: 'market',
      limitPrice: null,
      thesis: `Rebalance: ${allocation.deltaPct > 0 ? '+' : ''}${allocation.deltaPct.toFixed(1)}% target adjustment`,
      metadata: { source: 'execution-bridge', mode: 'paper', deltaPct: allocation.deltaPct }
    });

    tickets.push(ticket);
  }

  return { tickets, skipped };
}
```

- [ ] **Step 3: Add `coveredCallToTicket()` and `cspToTicket()`**

Append to the same file:

```typescript
// ── Options ───────────────────────────────────────────────────────────────────

export async function coveredCallToTicket(
  userId: string,
  candidate: CoveredCallCandidate,
  dte: DTE
): Promise<TradeTicket> {
  const expiry = nearestMonthlyExpiry(dte);
  const contractSymbol = toContractSymbol(candidate.symbol, expiry, 'C', candidate.suggested_strike);
  // limitPrice = per-share premium (estimated_premium already in dollars for all contracts)
  const premiumPerShare = candidate.possible_contracts > 0
    ? candidate.estimated_premium / (candidate.possible_contracts * 100)
    : 0;

  return createTradeTicket(userId, {
    sourceType: 'options_bridge',
    sourceId: null,
    ticketType: 'covered_call',
    symbol: contractSymbol,
    side: 'open',
    quantity: candidate.possible_contracts,
    orderType: 'limit',
    limitPrice: premiumPerShare > 0 ? premiumPerShare : null,
    thesis: `Covered call: ${candidate.symbol} strike $${candidate.suggested_strike} expiry ${expiry} (~${dte} DTE)`,
    metadata: {
      source: 'execution-bridge',
      mode: 'paper',
      underlying: candidate.symbol,
      strike: candidate.suggested_strike,
      expiry,
      dte
    }
  });
}

export async function cspToTicket(
  userId: string,
  row: PutExposureRow,
  dte: DTE
): Promise<TradeTicket> {
  const underlying = extractUnderlying(row.symbol);
  const expiry = nearestMonthlyExpiry(dte);
  const contractSymbol = toContractSymbol(underlying, expiry, 'P', row.strike);
  const premiumPerShare = row.contracts > 0 ? row.premium / (row.contracts * 100) : 0;

  return createTradeTicket(userId, {
    sourceType: 'options_bridge',
    sourceId: null,
    ticketType: 'cash_secured_put',
    symbol: contractSymbol,
    side: 'open',
    quantity: row.contracts,
    orderType: 'limit',
    limitPrice: premiumPerShare > 0 ? premiumPerShare : null,
    thesis: `Cash-secured put: ${underlying} strike $${row.strike} expiry ${expiry} (~${dte} DTE)`,
    metadata: {
      source: 'execution-bridge',
      mode: 'paper',
      underlying,
      strike: row.strike,
      expiry,
      dte
    }
  });
}

export async function cancelBridgeTicket(userId: string, ticketId: string): Promise<void> {
  await cancelTradeTicket(userId, ticketId, 'Replaced — DTE or params changed');
}
```

- [ ] **Step 4: Run TypeScript check**

```bash
npm run check
```

Expected: no new errors in `execution-bridge.service.ts`. Fix any type errors before continuing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/execution-bridge.service.ts
git commit -m "feat: add execution-bridge service — rebalance/options → paper trade tickets"
```

---

## Task 2: ExecutionConfirmPanel.svelte

**Files:**
- Create: `src/lib/components/execution/ExecutionConfirmPanel.svelte`

**Context:** Pure UI component. Receives `tickets[]` and emits events — it never calls server actions directly. The parent page owns all form submission. Shows trade rows pre-confirm, then result rows post-confirm. DTE picker only shown when `mode === 'option'`.

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/components/execution/ExecutionConfirmPanel.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Zap, X, ExternalLink, AlertTriangle, CheckCircle2, XCircle } from 'lucide-svelte';
  import type { TradeTicket } from '$lib/services/trade-layer.service';
  import { DTE_OPTIONS, type DTE } from '$lib/services/execution-bridge.service';

  export let tickets: TradeTicket[] = [];
  export let skipped: Array<{ label: string; reason: string }> = [];
  export let mode: 'rebalance' | 'option' = 'rebalance';
  export let selectedDte: DTE = 30;
  export let loading = false;
  export let results: Array<{
    ticketId: string;
    status: string;
    message: string;
    brokerOrderId?: string | null;
  }> | null = null;

  const dispatch = createEventDispatcher<{
    confirm: void;
    cancel: void;
    dteChange: DTE;
    retry: void;
  }>();

  $: totalEst = tickets.reduce((s, t) => s + t.estimatedValue, 0);
  $: allBlocked = tickets.length > 0 && tickets.every((t) => t.status === 'blocked');
  $: confirmedCount = results?.filter((r) => r.status === 'submitted' || r.status === 'dry_run').length ?? 0;
  $: failedCount = results?.filter((r) => r.status !== 'submitted' && r.status !== 'dry_run').length ?? 0;

  const fmt = (n: number) =>
    new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(n);

  function handleDteKey(e: KeyboardEvent, dte: DTE) {
    const idx = DTE_OPTIONS.indexOf(dte);
    if (e.key === 'ArrowRight' && idx < DTE_OPTIONS.length - 1) dispatch('dteChange', DTE_OPTIONS[idx + 1]);
    if (e.key === 'ArrowLeft' && idx > 0) dispatch('dteChange', DTE_OPTIONS[idx - 1]);
  }
</script>

<div class="panel">
  <div class="panel-header">
    <div class="panel-title"><Zap size={13} /> Confirm Execution — Paper Trading</div>
    <button class="close-btn" type="button" on:click={() => dispatch('cancel')} aria-label="Cancel">
      <X size={14} />
    </button>
  </div>

  {#if results}
    <!-- ── Result state ── -->
    <div class="results">
      {#each results as r}
        <div class="result-row" class:result-ok={r.status === 'submitted' || r.status === 'dry_run'} class:result-fail={r.status !== 'submitted' && r.status !== 'dry_run'}>
          {#if r.status === 'submitted' || r.status === 'dry_run'}
            <CheckCircle2 size={13} />
          {:else}
            <XCircle size={13} />
          {/if}
          <span class="result-msg">{r.message}</span>
          {#if r.brokerOrderId}<span class="order-id">{r.brokerOrderId}</span>{/if}
        </div>
      {/each}
      <div class="result-footer">
        <span>{confirmedCount} submitted · {failedCount} failed</span>
        <a class="view-link" href="/trades"><ExternalLink size={11} /> View in Trades</a>
      </div>
    </div>

  {:else}
    <!-- ── Pre-confirm state ── -->
    <div class="trade-rows">
      {#each tickets as ticket}
        <div class="trade-row">
          <div class="trade-info">
            <span
              class="side-badge"
              class:side-buy={ticket.side === 'buy'}
              class:side-sell={ticket.side === 'sell'}
              class:side-open={ticket.side === 'open'}
            >
              {ticket.side === 'buy' ? 'BUY' : ticket.side === 'sell' ? 'SELL' : 'OPEN'}
            </span>
            <span class="symbol">{ticket.symbol}</span>
            <span class="detail">
              {ticket.quantity} ·
              {ticket.orderType === 'limit' && ticket.limitPrice != null
                ? `limit $${ticket.limitPrice.toFixed(2)}`
                : 'market'}
            </span>
          </div>
          <div class="trade-right">
            <span class="est-val">{fmt(ticket.estimatedValue)}</span>
            <span class="safety" class:ok={ticket.status !== 'blocked'} class:blocked={ticket.status === 'blocked'}>
              {ticket.status === 'blocked' ? '✗ blocked' : '✓ pass'}
            </span>
          </div>
        </div>
      {/each}

      {#if skipped.length > 0}
        <details class="skipped">
          <summary><AlertTriangle size={11} /> {skipped.length} skipped (price unavailable)</summary>
          <div class="skipped-list">
            {#each skipped as s}<div class="skipped-item">{s.label} — {s.reason}</div>{/each}
            <button type="button" class="retry-btn" on:click={() => dispatch('retry')}>Retry skipped</button>
          </div>
        </details>
      {/if}
    </div>

    {#if mode === 'option'}
      <div class="dte-picker">
        <div class="dte-label">Expiry (DTE)</div>
        <div class="dte-pills" role="group" aria-label="Days to expiration">
          {#each DTE_OPTIONS as dte}
            <button
              type="button"
              class="dte-pill"
              class:dte-active={selectedDte === dte}
              on:click={() => dispatch('dteChange', dte)}
              on:keydown={(e) => handleDteKey(e, dte)}
              aria-pressed={selectedDte === dte}
            >{dte}d</button>
          {/each}
        </div>
      </div>
    {/if}

    <div class="summary-bar">
      <span class="summary-count">{tickets.length} trade{tickets.length !== 1 ? 's' : ''} · est. {fmt(totalEst)}</span>
      <span class="paper-badge">📄 PAPER</span>
    </div>

    <div class="actions">
      <button
        class="btn-confirm"
        type="button"
        disabled={loading || allBlocked}
        on:click={() => dispatch('confirm')}
      >
        {#if loading}<span class="spin"></span>{:else}<Zap size={13} />{/if}
        {loading ? 'Submitting…' : 'Confirm & Submit to Paper'}
      </button>
      <button class="btn-cancel" type="button" on:click={() => dispatch('cancel')}>Cancel</button>
    </div>
  {/if}
</div>

<style>
  .panel { border: 2px solid var(--primary); border-radius: 8px; background: rgba(var(--primary-rgb), 0.03); overflow: hidden; margin-top: 10px; }
  .panel-header { display: flex; justify-content: space-between; align-items: center; padding: 9px 12px; border-bottom: 1px solid var(--border); background: rgba(var(--primary-rgb), 0.06); }
  .panel-title { display: flex; align-items: center; gap: 6px; font-size: 0.65rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.05em; }
  .close-btn { background: none; border: none; color: var(--muted); cursor: pointer; padding: 2px; display: flex; align-items: center; border-radius: 4px; }
  .close-btn:hover { color: var(--text); }

  .trade-rows { display: grid; gap: 6px; padding: 10px 10px 0; }
  .trade-row { display: flex; justify-content: space-between; align-items: center; background: var(--surface-1); border: 1px solid var(--border); border-radius: 6px; padding: 7px 10px; }
  .trade-info { display: flex; align-items: center; gap: 6px; }
  .side-badge { font-weight: 800; font-size: 0.62rem; padding: 2px 5px; border-radius: 3px; }
  .side-buy { background: rgba(74,222,128,0.14); color: #4ade80; }
  .side-sell { background: rgba(248,113,113,0.14); color: #f87171; }
  .side-open { background: rgba(99,102,241,0.14); color: #818cf8; }
  .symbol { font-size: 0.75rem; font-weight: 700; color: var(--text); }
  .detail { font-size: 0.68rem; color: var(--muted); }
  .trade-right { display: flex; flex-direction: column; align-items: flex-end; gap: 2px; }
  .est-val { font-size: 0.72rem; color: var(--text); }
  .safety { font-size: 0.62rem; }
  .ok { color: #4ade80; }
  .blocked { color: #f87171; }

  .skipped { padding: 8px 10px 0; font-size: 0.7rem; color: var(--muted); }
  .skipped summary { cursor: pointer; display: flex; align-items: center; gap: 5px; list-style: none; }
  .skipped-list { margin-top: 6px; display: grid; gap: 3px; padding-left: 10px; }
  .skipped-item { font-size: 0.68rem; }
  .retry-btn { margin-top: 6px; font-size: 0.68rem; color: var(--primary); background: none; border: none; cursor: pointer; padding: 0; text-decoration: underline; }

  .dte-picker { padding: 10px 10px 0; }
  .dte-label { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; color: var(--muted); margin-bottom: 6px; letter-spacing: 0.04em; }
  .dte-pills { display: flex; gap: 6px; }
  .dte-pill { border: 1px solid var(--border); border-radius: 4px; padding: 4px 10px; font-size: 0.72rem; color: var(--muted); background: var(--surface-1); cursor: pointer; transition: all 0.1s; }
  .dte-pill:hover { border-color: var(--primary); color: var(--primary); }
  .dte-active { border: 2px solid var(--primary) !important; color: var(--primary); font-weight: 700; background: rgba(var(--primary-rgb), 0.08); }

  .summary-bar { display: flex; justify-content: space-between; align-items: center; padding: 9px 10px; border-top: 1px solid var(--border); margin-top: 10px; }
  .summary-count { font-size: 0.72rem; color: var(--muted); }
  .paper-badge { font-size: 0.63rem; font-weight: 700; color: #818cf8; background: rgba(99,102,241,0.1); border: 1px solid rgba(99,102,241,0.25); border-radius: 4px; padding: 2px 7px; }

  .actions { display: flex; gap: 8px; padding: 9px 10px; }
  .btn-confirm { flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px; background: var(--primary); color: white; border: none; border-radius: 6px; padding: 7px; font-size: 0.75rem; font-weight: 600; cursor: pointer; transition: opacity 0.12s; }
  .btn-confirm:disabled { opacity: 0.45; cursor: not-allowed; }
  .btn-cancel { background: var(--surface-1); color: var(--muted); border: 1px solid var(--border); border-radius: 6px; padding: 7px 12px; font-size: 0.75rem; cursor: pointer; }

  .results { padding: 10px; display: grid; gap: 6px; }
  .result-row { display: flex; align-items: center; gap: 8px; font-size: 0.74rem; padding: 6px 8px; border-radius: 4px; }
  .result-ok { background: rgba(74,222,128,0.07); color: #4ade80; }
  .result-fail { background: rgba(248,113,113,0.07); color: #f87171; }
  .result-msg { flex: 1; }
  .order-id { font-size: 0.62rem; opacity: 0.65; }
  .result-footer { border-top: 1px solid var(--border); padding-top: 8px; font-size: 0.7rem; color: var(--muted); display: flex; justify-content: space-between; align-items: center; }
  .view-link { display: flex; align-items: center; gap: 4px; color: var(--primary); text-decoration: none; font-size: 0.68rem; }

  .spin { width: 12px; height: 12px; border: 2px solid rgba(255,255,255,0.3); border-top-color: white; border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
  @keyframes spin { to { transform: rotate(360deg); } }
</style>
```

- [ ] **Step 2: Run TypeScript check**

```bash
npm run check
```

Expected: no errors in `ExecutionConfirmPanel.svelte`. Fix any import/type errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/execution/ExecutionConfirmPanel.svelte
git commit -m "feat: add ExecutionConfirmPanel — inline trade confirmation with DTE picker"
```

---

## Task 3: Rebalance Page — Execute All

**Files:**
- Modify: `src/routes/optimization/rebalance/+page.server.ts`
- Modify: `src/routes/optimization/rebalance/+page.svelte`

**Context:** Rebalance page already has `data.rebalance` (RebalanceSuggestion[]), `data.portfolioMode`, and `data.rebalanceProjection`. We add two new server actions (`queueRebalance`, `executeAll`) and wire the panel in the Svelte page. The existing `simulate` and `aiSuggest` actions are unchanged.

- [ ] **Step 1: Add imports and actions to `+page.server.ts`**

Open `src/routes/optimization/rebalance/+page.server.ts`. The file currently has `simulate` and `aiSuggest` actions. Replace the entire file with:

```typescript
import { fail, type Actions } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { getAiRebalanceSuggestions } from '$lib/services/ai-rebalance.service';
import { getBehavioralProfile } from '$lib/services/behavioral-profile.service';
import { getBehavioralExplanation } from '$lib/services/ai-behavioral-explanation.service';
import {
  getOptimizationDashboard,
  getRebalanceSuggestionsByMode,
  parseOptimizationBenchmark,
  parseOptimizationPeriod,
  saveRebalanceSuggestions
} from '$lib/services/optimization-engine.service';
import {
  getRebalanceProjection,
  parseSimulationPortfolioMode,
  simulateRebalance
} from '$lib/services/scenario-simulation.service';
import { getHoldings } from '$lib/services/portfolio.service';
import { rebalanceSuggestionsToTickets } from '$lib/services/execution-bridge.service';
import {
  approveTradeTicket,
  getTradeTicket
} from '$lib/services/trade-layer.service';
import {
  previewMoomooExecution,
  submitMoomooExecution,
  type ExecutionSafetyCheck
} from '$lib/services/moomoo-execution.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const user = await getDemoUser();
  const period = parseOptimizationPeriod(url.searchParams.get('period'));
  const benchmark = parseOptimizationBenchmark(url.searchParams.get('benchmark'));
  const portfolioMode = parseSimulationPortfolioMode(url.searchParams.get('portfolioMode'));

  const [dashboard, rebalanceProjection, modeRebalance, behavioralProfile] = await Promise.all([
    getOptimizationDashboard(user.id, { period, benchmark }),
    getRebalanceProjection(user.id, { period, benchmark, portfolioMode }),
    getRebalanceSuggestionsByMode(user.id, portfolioMode),
    getBehavioralProfile(user.id).catch(() => null),
  ]);

  const behavioralExplanation = behavioralProfile
    ? await getBehavioralExplanation(behavioralProfile).catch(() => null)
    : null;

  return {
    ...dashboard,
    rebalance: modeRebalance,
    portfolioMode,
    rebalanceProjection,
    behavioralProfile,
    behavioralExplanation,
  };
};

export const actions: Actions = {
  simulate: async ({ request, url }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    try {
      await simulateRebalance(user.id, {
        period: parseOptimizationPeriod(url.searchParams.get('period')),
        benchmark: parseOptimizationBenchmark(url.searchParams.get('benchmark')),
        portfolioMode: parseSimulationPortfolioMode(form.get('portfolioMode') ?? url.searchParams.get('portfolioMode'))
      });
      return { status: 'completed', message: 'Rebalance projection simulated.' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Rebalance simulation failed.' });
    }
  },

  aiSuggest: async ({ request }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    const portfolioMode = parseSimulationPortfolioMode(form.get('portfolioMode'));
    try {
      const { suggestions, aiUsed } = await getAiRebalanceSuggestions(user.id, portfolioMode);
      await saveRebalanceSuggestions(user.id, suggestions);
      return {
        status: 'ai_completed',
        aiUsed,
        message: aiUsed
          ? `AI generated ${suggestions.length} suggestions for ${portfolioMode} mode.`
          : `AI provider not configured — showing rule-based suggestions for ${portfolioMode} mode.`,
        suggestions
      };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'AI suggestion failed.' });
    }
  },

  queueRebalance: async ({ request }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    const portfolioMode = parseSimulationPortfolioMode(form.get('portfolioMode'));
    try {
      const [suggestions, holdings] = await Promise.all([
        getRebalanceSuggestionsByMode(user.id, portfolioMode),
        getHoldings(user.id)
      ]);
      const totalValue = holdings
        .filter((h) => h.quantity > 0)
        .reduce((sum, h) => sum + h.marketValue, 0);
      const { tickets, skipped } = await rebalanceSuggestionsToTickets(user.id, suggestions, totalValue);
      return {
        status: 'queued',
        ticketIds: tickets.map((t) => t.id).join(','),
        tickets,
        skipped
      };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Failed to queue rebalance.' });
    }
  },

  executeAll: async ({ request }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    const ticketIds = String(form.get('ticketIds') ?? '').split(',').filter(Boolean);
    const results: Array<{ ticketId: string; status: string; message: string; brokerOrderId?: string | null }> = [];

    for (const ticketId of ticketIds) {
      try {
        const ticket = await getTradeTicket(user.id, ticketId);
        if (!ticket) {
          results.push({ ticketId, status: 'failed', message: 'Ticket not found.' });
          continue;
        }

        // Assert paper mode — fail fast if violated
        const meta = ticket.metadata as Record<string, unknown>;
        if (meta?.mode !== 'paper') {
          results.push({ ticketId, status: 'failed', message: 'Only paper mode tickets allowed here.' });
          continue;
        }

        await approveTradeTicket(user.id, ticketId, 'Approved via rebalance execute-all');
        const preview = await previewMoomooExecution(user.id, { tradeTicketId: ticketId, mode: 'paper' });

        if (preview.status === 'blocked') {
          const blocked = (preview.safetyChecks as ExecutionSafetyCheck[] | undefined)
            ?.find((c) => c.checkStatus === 'block');
          results.push({ ticketId, status: 'blocked', message: blocked?.message ?? 'Safety check blocked.' });
          continue;
        }

        const submitted = await submitMoomooExecution(user.id, preview.id, { confirm: true });
        const sub = (submitted.submissions as Array<{ brokerOrderId?: string }> | undefined)?.[0];
        results.push({
          ticketId,
          status: submitted.status,
          message: `${ticket.symbol} submitted to paper.`,
          brokerOrderId: sub?.brokerOrderId ?? null
        });
      } catch (err) {
        results.push({ ticketId, status: 'failed', message: err instanceof Error ? err.message : 'Execution failed.' });
      }
    }

    return { status: 'execution_done', results };
  }
};
```

- [ ] **Step 2: Run TypeScript check**

```bash
npm run check
```

Expected: no errors. Fix any import/type issues before proceeding.

- [ ] **Step 3: Update `+page.svelte` — add state variables and Execute All button**

Open `src/routes/optimization/rebalance/+page.svelte`. Add the following to the `<script>` block, after the existing state variables (`let simulating`, `let aiLoading`):

```typescript
  import ExecutionConfirmPanel from '$lib/components/execution/ExecutionConfirmPanel.svelte';
  import type { TradeTicket } from '$lib/services/trade-layer.service';
  import type { DTE } from '$lib/services/execution-bridge.service';

  // Execution state
  let queueing = false;
  let panelTickets: TradeTicket[] | null = null;
  let panelSkipped: Array<{ label: string; reason: string }> = [];
  let panelTicketIds = '';
  let executionLoading = false;
  let executionResults: Array<{ ticketId: string; status: string; message: string; brokerOrderId?: string | null }> | null = null;

  // Watch form for queueRebalance result
  $: if (form?.status === 'queued' && form?.tickets) {
    panelTickets = form.tickets as TradeTicket[];
    panelSkipped = (form.skipped as Array<{ label: string; reason: string }>) ?? [];
    panelTicketIds = (form.ticketIds as string) ?? '';
    executionResults = null;
    queueing = false;
  }

  // Watch form for executeAll result
  $: if (form?.status === 'execution_done') {
    executionResults = form.results as Array<{ ticketId: string; status: string; message: string; brokerOrderId?: string | null }>;
    executionLoading = false;
  }

  function queueEnhance() {
    return async ({ update }: { update: (opts?: { reset: boolean }) => Promise<void> }) => {
      await update({ reset: false });
      queueing = false;
    };
  }

  function executeEnhance() {
    return async ({ update }: { update: (opts?: { reset: boolean }) => Promise<void> }) => {
      await update({ reset: false });
      executionLoading = false;
    };
  }

  function cancelPanel() {
    panelTickets = null;
    panelSkipped = [];
    panelTicketIds = '';
    executionResults = null;
  }
```

- [ ] **Step 4: Add the Execute All button to the control bar in `+page.svelte`**

In the template, find the `.actions` div in the control bar (after the `aiSuggest` form). Add a new `queueRebalance` form **after** the existing forms, still inside `.actions`:

```svelte
    <form method="POST" action="?/queueRebalance" use:enhance={queueEnhance} on:submit={() => (queueing = true)}>
      <input type="hidden" name="portfolioMode" value={data.portfolioMode} />
      <button class="btn-execute" type="submit" disabled={queueing || displaySuggestions.length === 0}>
        {#if queueing}<span class="spin spin-exec"></span>{:else}<Zap size={12} />{/if}
        {queueing ? 'Queuing…' : 'Execute All'}
      </button>
    </form>
```

Also add the hidden `executeAll` form and panel **after** the existing `{#if form?.message}` notice block and before the `{#if data.behavioralProfile}` block:

```svelte
{#if panelTickets}
  <!-- Hidden form for batch execution — submitted programmatically -->
  <form id="execute-all-form" method="POST" action="?/executeAll" use:enhance={executeEnhance} on:submit={() => (executionLoading = true)}>
    <input type="hidden" name="ticketIds" value={panelTicketIds} />
  </form>

  <ExecutionConfirmPanel
    tickets={panelTickets}
    skipped={panelSkipped}
    mode="rebalance"
    loading={executionLoading}
    results={executionResults}
    on:confirm={() => {
      executionLoading = true;
      (document.getElementById('execute-all-form') as HTMLFormElement)?.requestSubmit();
    }}
    on:cancel={cancelPanel}
    on:retry={() => { queueing = true; (document.querySelector('[action="?/queueRebalance"]') as HTMLFormElement)?.requestSubmit(); }}
  />
{/if}
```

- [ ] **Step 5: Add CSS for the Execute All button to the `<style>` block**

Add to the existing style block (alongside `.btn-outline`, `.btn-ai`):

```css
  .btn-execute { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; background: rgba(var(--primary-rgb), 0.1); color: var(--primary); border: 1px solid rgba(var(--primary-rgb), 0.35); cursor: pointer; transition: all 0.12s; }
  .btn-execute:hover:not(:disabled) { background: rgba(var(--primary-rgb), 0.18); }
  .btn-execute:disabled { opacity: 0.5; cursor: not-allowed; }
  .spin-exec { width: 12px; height: 12px; border: 2px solid rgba(var(--primary-rgb), 0.3); border-top-color: var(--primary); border-radius: 50%; animation: spin 0.7s linear infinite; display: inline-block; }
```

- [ ] **Step 6: Run TypeScript check**

```bash
npm run check
```

Expected: no errors in rebalance page files.

- [ ] **Step 7: Manual test — verify Execute All flow**

1. Navigate to `http://localhost:5173/optimization/rebalance`
2. Confirm "Execute All" button appears in the control bar
3. Click Execute All — panel should expand with trade rows
4. Click "Confirm & Submit to Paper" — should show result rows with order IDs or error messages
5. Click Cancel — panel should close

- [ ] **Step 8: Commit**

```bash
git add src/routes/optimization/rebalance/+page.server.ts src/routes/optimization/rebalance/+page.svelte
git commit -m "feat: add Execute All to rebalance page with inline confirmation panel"
```

---

## Task 4: Options Page — Execute per Candidate

**Files:**
- Modify: `src/lib/components/options/CoveredCallTable.svelte`
- Modify: `src/routes/optimization/options/+page.server.ts`
- Modify: `src/routes/optimization/options/+page.svelte`

**Context:** Options page uses `data.coveredCalls` (CoveredCallCandidate[]) for covered calls and `data.puts` (PutExposureRow[]) for CSPs. We modify `CoveredCallTable` to emit an `execute` event per row, and we add the `ExecutionConfirmPanel` to the main options page for both types. The `PutExposureChart` component is left unchanged — we add execute buttons separately in the page.

- [ ] **Step 1: Modify `CoveredCallTable.svelte` — add Execute button per row**

Add `createEventDispatcher` and an `executeEnabled` prop, then add Execute button in the table. Replace the full file:

```svelte
<!-- src/lib/components/options/CoveredCallTable.svelte -->
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  import { Zap } from 'lucide-svelte';
  import type { CoveredCallCandidate } from '$lib/services/options-intelligence.service';

  export let rows: CoveredCallCandidate[] = [];
  export let executeEnabled = false;  // show Execute buttons when true

  const dispatch = createEventDispatcher<{ execute: CoveredCallCandidate }>();

  const statusColor = (s: string) => s === 'covered' ? 'green' : s === 'partially_covered' ? 'amber' : 'blue';
  const statusLabel = (s: string) => s === 'covered' ? 'Covered' : s === 'partially_covered' ? 'Partial' : 'Available';
  const cleanSym = (s: string) => s.replace(/^US\./, '');
</script>

<article class="card">
  <div class="card-head">
    <div class="title">Covered Call Candidates</div>
    <div class="count">{rows.length} position{rows.length !== 1 ? 's' : ''}</div>
  </div>

  {#if rows.length > 0}
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Symbol</th>
            <th class="r">Shares</th>
            <th class="r">Active</th>
            <th class="r">Available</th>
            <th class="r">Suggested Strike</th>
            <th class="r">Est. Premium</th>
            <th>Status</th>
            {#if executeEnabled}<th></th>{/if}
          </tr>
        </thead>
        <tbody>
          {#each rows as row}
            <tr>
              <td class="sym">{cleanSym(row.symbol)}</td>
              <td class="r">{row.shares_available.toLocaleString()}</td>
              <td class="r {row.active_contracts > 0 ? 'active-call' : 'muted'}">{row.active_contracts > 0 ? row.active_contracts : '—'}</td>
              <td class="r">{row.possible_contracts > 0 ? row.possible_contracts : '—'}</td>
              <td class="r">${row.suggested_strike.toFixed(2)}</td>
              <td class="r prem">
                {#if row.estimated_premium > 0}${row.estimated_premium.toLocaleString()}{:else if row.active_contracts > 0}<span class="roll">Roll opportunity</span>{:else}—{/if}
              </td>
              <td><span class="badge {statusColor(row.coverage_status)}">{statusLabel(row.coverage_status)}</span></td>
              {#if executeEnabled}
                <td class="exec-cell">
                  {#if row.possible_contracts > 0}
                    <button class="exec-btn" type="button" on:click={() => dispatch('execute', row)}>
                      <Zap size={11} /> Execute
                    </button>
                  {/if}
                </td>
              {/if}
            </tr>
            {#if row.coverage_status === 'covered' && row.active_contracts > 0}
              <tr class="note-row"><td colspan={executeEnabled ? 8 : 7}><span class="note">✓ {row.active_contracts} active covered call. Consider rolling to a higher strike or later expiry to capture more premium.</span></td></tr>
            {:else if row.note && row.possible_contracts > 0}
              <tr class="note-row"><td colspan={executeEnabled ? 8 : 7}><span class="note">{row.note}</span></td></tr>
            {/if}
          {/each}
        </tbody>
      </table>
    </div>
  {:else}
    <div class="empty">
      <div class="empty-icon">📋</div>
      <div>No 100-share covered call candidates detected.</div>
      <div class="empty-sub">You need at least 100 shares of a stock to sell a covered call.</div>
    </div>
  {/if}
</article>

<style>
  .card { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 16px; display: grid; gap: 12px; }
  .card-head { display: flex; justify-content: space-between; align-items: center; }
  .title { font-size: 0.78rem; font-weight: 700; color: var(--text); }
  .count { font-size: 0.68rem; color: var(--muted); }
  .table-wrap { overflow-x: auto; margin: -4px -4px 0; }
  table { width: 100%; border-collapse: collapse; min-width: 560px; }
  th { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); padding: 6px 10px; border-bottom: 1px solid var(--border); text-align: left; }
  td { font-size: 0.76rem; color: var(--muted); padding: 9px 10px; border-bottom: 1px solid var(--border); }
  tbody tr:last-child td { border-bottom: none; }
  tbody tr:last-child.note-row td { border-bottom: none; padding-top: 0; }
  .r { text-align: right; }
  .sym { color: var(--text); font-weight: 800; font-size: 0.8rem; }
  .prem { color: var(--success); font-weight: 700; }
  .muted { color: var(--muted); }
  .active-call { color: var(--primary); font-weight: 700; }
  .roll { font-size: 0.68rem; color: var(--warning); font-weight: 700; }
  .note-row td { padding-top: 2px; padding-bottom: 8px; }
  .note { font-size: 0.68rem; color: var(--muted); font-style: italic; }
  .badge { display: inline-block; font-size: 0.6rem; font-weight: 800; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 999px; }
  .badge.green { background: rgba(var(--success-rgb), 0.12); color: var(--success); }
  .badge.amber { background: rgba(var(--warning-rgb), 0.12); color: var(--warning); }
  .badge.blue { background: rgba(var(--primary-rgb), 0.12); color: var(--primary); }
  .empty { display: grid; gap: 6px; padding: 24px; text-align: center; color: var(--muted); font-size: 0.76rem; }
  .empty-icon { font-size: 1.8rem; }
  .empty-sub { font-size: 0.68rem; }
  .exec-cell { text-align: right; white-space: nowrap; }
  .exec-btn { display: inline-flex; align-items: center; gap: 4px; font-size: 0.68rem; font-weight: 700; color: var(--primary); background: rgba(var(--primary-rgb), 0.1); border: 1px solid rgba(var(--primary-rgb), 0.3); border-radius: 4px; padding: 3px 8px; cursor: pointer; transition: all 0.1s; }
  .exec-btn:hover { background: rgba(var(--primary-rgb), 0.18); }
</style>
```

- [ ] **Step 2: Add server actions to `options/+page.server.ts`**

Replace the full file:

```typescript
import { fail, type Actions } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  getOptionsIntelligenceDashboard,
  parseOptionsBenchmark,
  parseOptionsPeriod,
  refreshOptionsIntelligence
} from '$lib/services/options-intelligence.service';
import {
  coveredCallToTicket,
  cspToTicket,
  cancelBridgeTicket,
  parseDte
} from '$lib/services/execution-bridge.service';
import {
  approveTradeTicket,
  getTradeTicket
} from '$lib/services/trade-layer.service';
import {
  previewMoomooExecution,
  submitMoomooExecution,
  type ExecutionSafetyCheck
} from '$lib/services/moomoo-execution.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const user = await getDemoUser();
  const period = parseOptionsPeriod(url.searchParams.get('period'));
  const benchmark = parseOptionsBenchmark(url.searchParams.get('benchmark'));
  return await getOptionsIntelligenceDashboard(user.id, { period, benchmark });
};

export const actions: Actions = {
  refresh: async ({ url }) => {
    const user = await getDemoUser();
    try {
      return {
        message: 'Options intelligence refreshed.',
        result: await refreshOptionsIntelligence(user.id, {
          period: parseOptionsPeriod(url.searchParams.get('period')),
          benchmark: parseOptionsBenchmark(url.searchParams.get('benchmark'))
        })
      };
    } catch (e) {
      return fail(400, { message: e instanceof Error ? e.message : 'Options intelligence refresh failed.' });
    }
  },

  queueOption: async ({ request }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    const optionType = String(form.get('optionType') ?? 'call') as 'call' | 'put';
    const symbol = String(form.get('symbol') ?? '');
    const dte = parseDte(form.get('dte'));
    const prevTicketId = form.get('prevTicketId') ? String(form.get('prevTicketId')) : null;

    try {
      // Cancel previous ticket if DTE changed — fail fast if cancel fails
      if (prevTicketId) {
        try {
          await cancelBridgeTicket(user.id, prevTicketId);
        } catch {
          return fail(400, {
            message: 'Could not update DTE — previous ticket still active. Cancel and retry.',
            prevTicketId
          });
        }
      }

      const dashboard = await getOptionsIntelligenceDashboard(user.id);
      let ticket;

      if (optionType === 'call') {
        const candidate = dashboard.coveredCalls.find((c) => c.symbol === symbol);
        if (!candidate) return fail(400, { message: `Covered call candidate for ${symbol} not found.` });
        ticket = await coveredCallToTicket(user.id, candidate, dte);
      } else {
        const row = dashboard.puts.find((p) => p.symbol === symbol);
        if (!row) return fail(400, { message: `Put position ${symbol} not found.` });
        ticket = await cspToTicket(user.id, row, dte);
      }

      return { status: 'queued', ticket, dte };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Failed to queue option.' });
    }
  },

  executeOption: async ({ request }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    const ticketId = String(form.get('ticketId') ?? '');

    try {
      const ticket = await getTradeTicket(user.id, ticketId);
      if (!ticket) return fail(404, { message: 'Ticket not found.' });

      const meta = ticket.metadata as Record<string, unknown>;
      if (meta?.mode !== 'paper') {
        return fail(400, { message: 'Only paper mode tickets allowed here.' });
      }

      await approveTradeTicket(user.id, ticketId, 'Approved via options execute');
      const preview = await previewMoomooExecution(user.id, { tradeTicketId: ticketId, mode: 'paper' });

      if (preview.status === 'blocked') {
        const blocked = (preview.safetyChecks as ExecutionSafetyCheck[] | undefined)
          ?.find((c) => c.checkStatus === 'block');
        return fail(400, { message: `Execution blocked: ${blocked?.message ?? 'Safety check failed.'}` });
      }

      const submitted = await submitMoomooExecution(user.id, preview.id, { confirm: true });
      const sub = (submitted.submissions as Array<{ brokerOrderId?: string }> | undefined)?.[0];
      return {
        status: 'executed',
        message: `Option submitted to paper.${sub?.brokerOrderId ? ` Order ID: ${sub.brokerOrderId}` : ''}`,
        brokerOrderId: sub?.brokerOrderId ?? null,
        ticketId
      };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Option execution failed.' });
    }
  }
};
```

- [ ] **Step 3: Run TypeScript check**

```bash
npm run check
```

Expected: no errors in options server file.

- [ ] **Step 4: Update `options/+page.svelte` — wire the panel**

Replace the full file:

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import { Coins, RefreshCw, ShieldAlert, Table2 } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AssignmentRiskCard from '$lib/components/options/AssignmentRiskCard.svelte';
  import CollateralUsageChart from '$lib/components/options/CollateralUsageChart.svelte';
  import CoveredCallTable from '$lib/components/options/CoveredCallTable.svelte';
  import OptimizationStatStrip from '$lib/components/optimization/OptimizationStatStrip.svelte';
  import OptionsExposureCard from '$lib/components/options/OptionsExposureCard.svelte';
  import PremiumYieldCard from '$lib/components/options/PremiumYieldCard.svelte';
  import PutExposureChart from '$lib/components/options/PutExposureChart.svelte';
  import WheelStrategyCard from '$lib/components/options/WheelStrategyCard.svelte';
  import ExecutionConfirmPanel from '$lib/components/execution/ExecutionConfirmPanel.svelte';
  import type { ActionData, PageData } from './$types';
  import type { TradeTicket } from '$lib/services/trade-layer.service';
  import type { CoveredCallCandidate, PutExposureRow } from '$lib/services/options-intelligence.service';
  import type { DTE } from '$lib/services/execution-bridge.service';

  export let data: PageData;
  export let form: ActionData;

  type Color = 'red' | 'amber' | 'green';
  function statusColor(status: string): Color {
    return status === 'high' ? 'red' : status === 'medium' ? 'amber' : 'green';
  }
  $: stats = data.widgets.slice(0, 4).map((w) => ({ label: w.label, value: w.value, color: statusColor(w.status) }));

  // ── Execution state ──────────────────────────────────────────────────────────
  type ActivePanel = {
    symbol: string;
    optionType: 'call' | 'put';
    prevTicketId: string | null;
    selectedDte: DTE;
  };

  let activePanel: ActivePanel | null = null;
  let panelTicket: TradeTicket | null = null;
  let executionLoading = false;
  let executionResult: { ticketId: string; status: string; message: string; brokerOrderId?: string | null } | null = null;

  // Watch form for queueOption result
  $: if (form?.status === 'queued' && form?.ticket) {
    panelTicket = form.ticket as TradeTicket;
    executionResult = null;
    executionLoading = false;
    if (activePanel) activePanel.prevTicketId = (form.ticket as TradeTicket).id;
  }

  // Watch form for executeOption result
  $: if (form?.status === 'executed') {
    executionLoading = false;
    executionResult = {
      ticketId: String(form.ticketId ?? ''),
      status: 'submitted',
      message: String(form.message ?? 'Submitted.'),
      brokerOrderId: (form.brokerOrderId as string | null) ?? null
    };
  }

  function openPanel(symbol: string, optionType: 'call' | 'put') {
    activePanel = { symbol, optionType, prevTicketId: null, selectedDte: 30 };
    panelTicket = null;
    executionResult = null;
  }

  function closePanel() {
    activePanel = null;
    panelTicket = null;
    executionResult = null;
  }

  function handleCoveredCallExecute(e: CustomEvent<CoveredCallCandidate>) {
    openPanel(e.detail.symbol, 'call');
  }

  function handlePutExecute(symbol: string) {
    openPanel(symbol, 'put');
  }

  function queueOptionEnhance() {
    return async ({ update }: { update: (opts?: { reset: boolean }) => Promise<void> }) => {
      await update({ reset: false });
    };
  }

  function executeOptionEnhance() {
    return async ({ update }: { update: (opts?: { reset: boolean }) => Promise<void> }) => {
      await update({ reset: false });
      executionLoading = false;
    };
  }
</script>

<PageHeader
  title="Options Strategy"
  subtitle="Covered call and cash-secured put candidates, ranked by premium yield."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Options' }]}
/>

<div class="actions-bar">
  <div class="actions-left">
    <a class="tab-btn" href="/optimization/options/exposure"><ShieldAlert size={13} /> Exposure</a>
    <a class="tab-btn" href="/optimization/options/wheel"><Table2 size={13} /> Wheel</a>
    <a class="tab-btn" href="/optimization/options/premium"><Coins size={13} /> Premium</a>
  </div>
  <form method="POST" action="?/refresh">
    <button class="button" type="submit"><RefreshCw size={13} /> Refresh Data</button>
  </form>
</div>

<OptimizationStatStrip {stats} />

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<!-- Hidden forms for option execution — submitted programmatically -->
{#if activePanel}
  <form id="queue-option-form" method="POST" action="?/queueOption" use:enhance={queueOptionEnhance}>
    <input type="hidden" name="symbol" value={activePanel.symbol} />
    <input type="hidden" name="optionType" value={activePanel.optionType} />
    <input type="hidden" name="dte" value={activePanel.selectedDte} />
    <input type="hidden" name="prevTicketId" value={activePanel.prevTicketId ?? ''} />
  </form>
{/if}

{#if panelTicket}
  <form id="execute-option-form" method="POST" action="?/executeOption" use:enhance={executeOptionEnhance} on:submit={() => (executionLoading = true)}>
    <input type="hidden" name="ticketId" value={panelTicket.id} />
  </form>
{/if}

<div class="layout">
  <main class="main-col">
    <OptionsExposureCard exposure={data.exposure} />

    <CoveredCallTable
      rows={data.coveredCalls}
      executeEnabled={true}
      on:execute={handleCoveredCallExecute}
    />

    {#if activePanel?.optionType === 'call'}
      {#if !panelTicket}
        <div class="panel-loading">⚡ Queuing covered call ticket…</div>
      {:else}
        <ExecutionConfirmPanel
          tickets={[panelTicket]}
          mode="option"
          selectedDte={activePanel.selectedDte}
          loading={executionLoading}
          results={executionResult ? [executionResult] : null}
          on:confirm={() => {
            executionLoading = true;
            (document.getElementById('execute-option-form') as HTMLFormElement)?.requestSubmit();
          }}
          on:cancel={closePanel}
          on:dteChange={(e) => {
            if (activePanel) {
              activePanel = { ...activePanel, selectedDte: e.detail, prevTicketId: panelTicket?.id ?? null };
              (document.getElementById('queue-option-form') as HTMLFormElement)?.requestSubmit();
            }
          }}
        />
      {/if}
    {/if}

    <PutExposureChart rows={data.puts} />

    <!-- Execute buttons for put positions -->
    {#if data.puts.length > 0}
      <div class="put-execute-bar">
        <div class="put-execute-label">Execute CSP</div>
        {#each data.puts as row}
          <button
            class="put-exec-btn"
            type="button"
            on:click={() => handlePutExecute(row.symbol)}
          >
            ⚡ {row.symbol.replace(/^US\./, '')} ${row.strike} Put
          </button>
        {/each}
      </div>
    {/if}

    {#if activePanel?.optionType === 'put' && panelTicket}
      <ExecutionConfirmPanel
        tickets={[panelTicket]}
        mode="option"
        selectedDte={activePanel?.selectedDte ?? 30}
        loading={executionLoading}
        results={executionResult ? [executionResult] : null}
        on:confirm={() => {
          executionLoading = true;
          (document.getElementById('execute-option-form') as HTMLFormElement)?.requestSubmit();
        }}
        on:cancel={closePanel}
        on:dteChange={(e) => {
          if (activePanel) {
            activePanel = { ...activePanel, selectedDte: e.detail, prevTicketId: panelTicket?.id ?? null };
            (document.getElementById('queue-option-form') as HTMLFormElement)?.requestSubmit();
          }
        }}
      />
    {/if}

    <div class="next-step">
      <div class="next-text">
        <strong>Review optimization history</strong>
        <span>Compare how your portfolio metrics and allocation targets have changed over past runs.</span>
      </div>
      <a class="button" href="/optimization/history">View History →</a>
    </div>
  </main>
  <aside class="side-col">
    <PremiumYieldCard premium={data.premium} />
    <AssignmentRiskCard score={data.exposure.assignment_risk_score} level={data.exposure.risk_level} warnings={data.exposure.warnings} />
    <CollateralUsageChart usagePct={data.exposure.collateral_usage_pct} collateral={data.exposure.collateral_locked} />
    {#if data.wheel.length > 0}
      <div class="wheel-label">Wheel Strategy</div>
      {#each data.wheel.slice(0, 3) as report}<WheelStrategyCard {report} />{/each}
    {/if}
  </aside>
</div>

<style>
  .actions-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .actions-left { display: flex; gap: 6px; flex-wrap: wrap; }
  .tab-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; color: var(--muted); background: var(--surface-1); border: 1px solid var(--border); text-decoration: none; transition: all 0.12s; }
  .tab-btn:hover { color: var(--text); border-color: var(--primary); }
  .notice { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .next-step { display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid rgba(var(--primary-rgb), 0.22); border-radius: 8px; background: rgba(var(--primary-rgb), 0.05); padding: 14px 16px; }
  .next-text { display: grid; gap: 3px; }
  .next-text strong { font-size: 0.82rem; color: var(--text); }
  .next-text span { font-size: 0.72rem; color: var(--muted); }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 22rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  .wheel-label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
  @media (max-width: 600px) { .actions-bar { flex-direction: column; align-items: flex-start; } }
  .put-execute-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--card); }
  .put-execute-label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em; margin-right: 4px; }
  .put-exec-btn { display: inline-flex; align-items: center; gap: 4px; font-size: 0.7rem; font-weight: 700; color: var(--primary); background: rgba(var(--primary-rgb), 0.08); border: 1px solid rgba(var(--primary-rgb), 0.25); border-radius: 4px; padding: 4px 10px; cursor: pointer; transition: all 0.1s; }
  .put-exec-btn:hover { background: rgba(var(--primary-rgb), 0.16); }
  .panel-loading { font-size: 0.72rem; color: var(--muted); padding: 10px 0; }
</style>
```

**Note:** The covered call panel auto-queue needs a Svelte `onMount` trigger. After saving the above, add this to the `<script>` block's reactive section:

```typescript
  import { onMount } from 'svelte';

  // When activePanel changes to a new covered call, auto-submit the queue form
  let prevActivePanel: ActivePanel | null = null;
  $: if (activePanel && activePanel !== prevActivePanel) {
    prevActivePanel = activePanel;
    // Auto-queue on next tick
    setTimeout(() => {
      (document.getElementById('queue-option-form') as HTMLFormElement)?.requestSubmit();
    }, 0);
  }
```

- [ ] **Step 5: Run TypeScript check**

```bash
npm run check
```

Expected: no errors in options page files. Fix any type mismatches.

- [ ] **Step 6: Manual test — verify options Execute flow**

1. Navigate to `http://localhost:5173/optimization/options`
2. Confirm "Execute" button appears in the Covered Call Candidates table (NIO row)
3. Click Execute — panel should appear below the table with NIO covered call details and DTE picker
4. Change DTE (e.g., 21d) — panel should update with new expiry
5. Click "Confirm & Submit to Paper" — should show result
6. Confirm "Execute CSP" bar appears below Put Exposure
7. Click a put Execute button — panel should appear below puts section
8. Cancel — panel should close

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/options/CoveredCallTable.svelte src/routes/optimization/options/+page.server.ts src/routes/optimization/options/+page.svelte
git commit -m "feat: add Execute buttons to options page — covered calls and CSPs with inline confirmation"
```

---

## Self-Review Checklist (do not skip)

Before declaring done, verify:

- [ ] `npm run check` passes with no new errors
- [ ] Rebalance: Execute All button visible, panel opens, Confirm submits to paper, result shows
- [ ] Options: Execute button in covered call table, DTE picker changes expiry, panel closes on cancel
- [ ] Options: CSP execute bar visible for put positions
- [ ] Blocked trade shows red "✗ blocked" in panel — does not prevent other trades in batch
- [ ] Cancel panel clears state cleanly (no stale tickets shown)
- [ ] `metadata.mode === 'paper'` assertion in `executeAll` and `executeOption` — confirmed in code
