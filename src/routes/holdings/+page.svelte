<script lang="ts">
  import { enhance } from '$app/forms';
  import { RefreshCw } from 'lucide-svelte';
  import type { ActionData, PageData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import HoldingsTable from '$lib/components/portfolioai/tables/HoldingsTable.svelte';
  import StatCard from '$lib/components/portfolioai/StatCard.svelte';
  import { money, uniformCurrency } from '$lib/format';

  export let data: PageData;
  export let form: ActionData;

  let refreshing = false;

  $: displayCurrency = uniformCurrency(data.holdings.map((h: { currency?: string }) => h.currency));

  $: totalMarket = data.holdings.reduce((s: number, h: { marketValue: number }) => s + h.marketValue, 0);
  $: openPositions = data.holdings.length;

  $: subtitle = data.dataSource === 'snapshot'
    ? `Live from Moomoo · synced ${new Date(data.snapshotDate as string).toLocaleDateString()}`
    : 'Calculated from transactions';
</script>

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
  <StatCard label="Market Value"   value={money(totalMarket, displayCurrency)}      tint="primary" />
  <StatCard label="Cash Balance"   value={money(data.cashBalance, displayCurrency)} tint="success" />
  <StatCard label="Open Positions" value={String(openPositions)}     tint="primary" />
</div>

<HoldingsTable holdings={data.holdings} flowMap={data.flowMap ?? {}} />

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
