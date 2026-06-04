<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import type { PageData } from './$types';
  import type { CashFlowItem } from '$lib/services/broker.service';
  import { summariseCashflow, formatCashflowAmount } from './summary';

  export let data: PageData;

  const TYPE_ICON: Record<string, string> = {
    'Dividend':        '💰',
    'Deposit':         '⬆',
    'Withdrawal':      '⬇',
    'Fund Redemption': '🔄',
    'Interest':        '📈',
    'Fee':             '📋',
    'Others':          '·',
  };

  let filterType = 'All';
  let filterDir  = 'All';

  $: types = ['All', ...new Set(data.items.map(i => i.cashflow_type).filter(Boolean))];

  // Filtering + totals live in ./summary (pure, unit-tested). Totals recompute
  // over the filtered set, grouped by currency (no FX — each currency in its
  // own unit, shown exactly as the broker API reports it).
  $: summary = summariseCashflow(data.items, filterType, filterDir);
  $: filtered = summary.filtered;
  $: byCurrency = summary.byCurrency;

  const fmtTotal = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2 });

  // Group by clearing_date
  $: grouped = filtered.reduce<Record<string, CashFlowItem[]>>((acc, item) => {
    (acc[item.clearing_date] ??= []).push(item);
    return acc;
  }, {});
  $: dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  const fmtAmt = formatCashflowAmount;

  function icon(type: string) {
    return TYPE_ICON[type] ?? '·';
  }
</script>

<PageHeader title="Cash Flow" subtitle="Account transactions from Moomoo broker — last 60 days" />

<!-- Stat strip — one per currency (no FX; each shown in its own unit) -->
<div data-testid="cf-summary">
  {#each byCurrency as c (c.currency)}
    <div class="stat-strip" data-testid="cf-currency" data-currency={c.currency}>
      <div class="stat">
        <div class="stat-val positive" data-testid="cf-total-in">+{fmtTotal(c.totalIn)} {c.currency}</div>
        <div class="stat-lbl">Total In</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <div class="stat-val negative" data-testid="cf-total-out">-{fmtTotal(c.totalOut)} {c.currency}</div>
        <div class="stat-lbl">Total Out</div>
      </div>
      <div class="stat-divider"></div>
      <div class="stat">
        <div class="stat-val" class:positive={c.net >= 0} class:negative={c.net < 0} data-testid="cf-net">
          {c.net >= 0 ? '+' : ''}{fmtTotal(c.net)} {c.currency}
        </div>
        <div class="stat-lbl">Net {c.currency} ({c.count} transactions)</div>
      </div>
    </div>
  {/each}
  <div class="cf-count-line" data-testid="cf-count">{filtered.length} transactions</div>
</div>

<!-- Filters -->
<div class="filter-bar">
  <div class="filter-group" data-testid="cf-filter-type" role="group" aria-label="Filter by transaction type">
    {#each types as t}
      <button class="filter-btn" class:active={filterType === t} aria-pressed={filterType === t} data-testid="cf-filter-type-{t}" on:click={() => filterType = t}>{t}</button>
    {/each}
  </div>
  <div class="filter-group" data-testid="cf-filter-dir" role="group" aria-label="Filter by direction">
    {#each ['All', 'IN', 'OUT'] as d}
      <button class="filter-btn" class:active={filterDir === d} aria-pressed={filterDir === d} data-testid="cf-filter-dir-{d}" on:click={() => filterDir = d}>{d}</button>
    {/each}
  </div>
</div>

{#if data.items.length === 0}
  <div class="empty" data-testid="cf-empty">
    <div class="empty-icon">📭</div>
    <div class="empty-title">No cash flow data</div>
    <div class="empty-sub">Connect Moomoo OpenD and sync your account to see transactions here.</div>
  </div>
{:else if filtered.length === 0}
  <div class="empty" data-testid="cf-empty-filtered">
    <div class="empty-icon">🔍</div>
    <div class="empty-title">No matching transactions</div>
    <div class="empty-sub">Try changing the filter.</div>
  </div>
{:else}
  {#each dates as date}
    <div class="date-group">
      <div class="date-label">{fmtDate(date)}</div>
      {#each grouped[date] as item}
        <div class="cf-row" data-testid="cf-row">
          <div class="cf-icon">{icon(item.cashflow_type)}</div>
          <div class="cf-info">
            <div class="cf-type">{item.cashflow_type || 'Unknown'}</div>
            {#if item.remark}
              <div class="cf-remark">{item.remark}</div>
            {/if}
            <div class="cf-settle">Settles {item.settlement_date}</div>
          </div>
          <div class="cf-amount" class:positive={item.cashflow_direction === 'IN'} class:negative={item.cashflow_direction === 'OUT'} data-testid="cf-amount">
            {fmtAmt(item)}
          </div>
        </div>
      {/each}
    </div>
  {/each}
{/if}

<style>
  .stat-strip {
    display: flex; align-items: center; gap: 0;
    background: var(--card); border: 1px solid var(--border);
    border-radius: 10px; padding: 14px 20px;
    margin-bottom: 16px;
  }
  .stat-strip + .stat-strip { margin-top: -8px; }
  .cf-count-line { font-size: 0.7rem; color: var(--muted); margin: 0 0 16px 4px; }
  .stat { flex: 1; text-align: center; }
  .stat-val { font-size: 1.1rem; font-weight: 700; letter-spacing: -0.01em; }
  .stat-lbl { font-size: 0.68rem; color: var(--muted); margin-top: 2px; }
  .stat-divider { width: 1px; height: 36px; background: var(--border); margin: 0 16px; }
  .positive { color: var(--success); }
  .negative { color: var(--danger); }

  .filter-bar {
    display: flex; gap: 12px; flex-wrap: wrap;
    margin-bottom: 20px;
  }
  .filter-group { display: flex; gap: 4px; flex-wrap: wrap; }
  .filter-btn {
    padding: 4px 10px; border-radius: 6px; font-size: 0.72rem; font-weight: 500;
    border: 1px solid var(--border); background: transparent;
    color: var(--muted); cursor: pointer; transition: all 0.15s;
  }
  .filter-btn:hover { border-color: var(--primary); color: var(--primary); }
  .filter-btn.active {
    background: rgba(var(--primary-rgb), 0.1);
    border-color: rgba(var(--primary-rgb), 0.4);
    color: var(--primary);
  }

  .date-group { margin-bottom: 20px; }
  .date-label {
    font-size: 0.65rem; font-weight: 700; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.08em;
    margin-bottom: 8px; padding-bottom: 6px;
    border-bottom: 1px solid var(--border);
  }

  .cf-row {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 10px 0; border-bottom: 1px solid rgba(var(--border-rgb, 255,255,255), 0.06);
  }
  .cf-row:last-child { border-bottom: none; }

  .cf-icon {
    width: 32px; height: 32px; border-radius: 8px; flex-shrink: 0;
    background: var(--surface-1); display: flex; align-items: center;
    justify-content: center; font-size: 0.9rem;
  }

  .cf-info { flex: 1; min-width: 0; }
  .cf-type   { font-size: 0.8rem; font-weight: 600; color: var(--text); }
  .cf-remark { font-size: 0.7rem; color: var(--muted); margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .cf-settle { font-size: 0.65rem; color: var(--muted); margin-top: 3px; }

  .cf-amount { font-size: 0.82rem; font-weight: 700; white-space: nowrap; padding-top: 2px; }

  .empty {
    text-align: center; padding: 60px 20px;
  }
  .empty-icon  { font-size: 2rem; margin-bottom: 12px; }
  .empty-title { font-size: 0.9rem; font-weight: 600; color: var(--text); margin-bottom: 6px; }
  .empty-sub   { font-size: 0.75rem; color: var(--muted); }
</style>
