<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import type { PageData } from './$types';
  import type { CashFlowItem } from '$lib/services/broker.service';

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

  $: filtered = data.items.filter(i =>
    (filterType === 'All' || i.cashflow_type === filterType) &&
    (filterDir  === 'All' || i.cashflow_direction === filterDir)
  );

  // Group by clearing_date
  $: grouped = filtered.reduce<Record<string, CashFlowItem[]>>((acc, item) => {
    (acc[item.clearing_date] ??= []).push(item);
    return acc;
  }, {});
  $: dates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  // Totals
  $: totalIn  = filtered.filter(i => i.cashflow_direction === 'IN').reduce((s, i) => s + Math.abs(i.amount), 0);
  $: totalOut = filtered.filter(i => i.cashflow_direction === 'OUT').reduce((s, i) => s + Math.abs(i.amount), 0);

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  }

  function fmtAmt(item: CashFlowItem) {
    const sign = item.cashflow_direction === 'IN' ? '+' : '-';
    return `${sign}${Math.abs(item.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${item.currency}`;
  }

  function icon(type: string) {
    return TYPE_ICON[type] ?? '·';
  }
</script>

<PageHeader title="Cash Flow" subtitle="Account transactions from Moomoo broker — last 60 days" />

<!-- Stat strip -->
<div class="stat-strip">
  <div class="stat">
    <div class="stat-val positive">+{totalIn.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
    <div class="stat-lbl">Total In</div>
  </div>
  <div class="stat-divider"></div>
  <div class="stat">
    <div class="stat-val negative">-{totalOut.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
    <div class="stat-lbl">Total Out</div>
  </div>
  <div class="stat-divider"></div>
  <div class="stat">
    <div class="stat-val" class:positive={totalIn - totalOut >= 0} class:negative={totalIn - totalOut < 0}>
      {totalIn - totalOut >= 0 ? '+' : ''}{(totalIn - totalOut).toLocaleString('en-US', { minimumFractionDigits: 2 })}
    </div>
    <div class="stat-lbl">Net ({filtered.length} transactions)</div>
  </div>
</div>

<!-- Filters -->
<div class="filter-bar">
  <div class="filter-group">
    {#each types as t}
      <button class="filter-btn" class:active={filterType === t} on:click={() => filterType = t}>{t}</button>
    {/each}
  </div>
  <div class="filter-group">
    {#each ['All', 'IN', 'OUT'] as d}
      <button class="filter-btn" class:active={filterDir === d} on:click={() => filterDir = d}>{d}</button>
    {/each}
  </div>
</div>

{#if data.items.length === 0}
  <div class="empty">
    <div class="empty-icon">📭</div>
    <div class="empty-title">No cash flow data</div>
    <div class="empty-sub">Connect Moomoo OpenD and sync your account to see transactions here.</div>
  </div>
{:else if filtered.length === 0}
  <div class="empty">
    <div class="empty-icon">🔍</div>
    <div class="empty-title">No matching transactions</div>
    <div class="empty-sub">Try changing the filter.</div>
  </div>
{:else}
  {#each dates as date}
    <div class="date-group">
      <div class="date-label">{fmtDate(date)}</div>
      {#each grouped[date] as item}
        <div class="cf-row">
          <div class="cf-icon">{icon(item.cashflow_type)}</div>
          <div class="cf-info">
            <div class="cf-type">{item.cashflow_type || 'Unknown'}</div>
            {#if item.remark}
              <div class="cf-remark">{item.remark}</div>
            {/if}
            <div class="cf-settle">Settles {item.settlement_date}</div>
          </div>
          <div class="cf-amount" class:positive={item.cashflow_direction === 'IN'} class:negative={item.cashflow_direction === 'OUT'}>
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
