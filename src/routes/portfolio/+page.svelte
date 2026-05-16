<script lang="ts">
  import type { PageData } from './$types';
  import type { Holding } from '$lib/types/portfolio';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import StatCard from '$lib/components/portfolioai/StatCard.svelte';
  import HoldingsTable from '$lib/components/portfolioai/tables/HoldingsTable.svelte';
  import EmptyState from '$lib/components/portfolioai/EmptyState.svelte';

  export let data: PageData;

  function money(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }

  $: holdings = (data.holdings ?? []) as Holding[];
  $: totalValue = holdings.reduce((s, h) => s + h.marketValue, 0);
  $: totalUnrealised = holdings.reduce((s, h) => s + h.unrealizedPnl, 0);
  $: totalCost = holdings.reduce((s, h) => s + h.costBasis, 0);
  $: totalReturnPct = totalCost > 0 ? (totalUnrealised / totalCost) * 100 : 0;

  $: subtitle = data.dataSource === 'snapshot' && data.snapshotDate
    ? `Broker snapshot · ${new Date(data.snapshotDate).toLocaleString()}`
    : 'From transaction records';

  $: pnlTint = totalUnrealised >= 0 ? ('success' as const) : ('danger' as const);
  $: pnlValue = `${totalUnrealised >= 0 ? '+' : ''}${money(totalUnrealised)}`;
  $: returnValue = `${totalReturnPct >= 0 ? '+' : ''}${totalReturnPct.toFixed(2)}%`;
</script>

<div class="page-top">
  <PageHeader
    title="Portfolio Overview"
    {subtitle}
    breadcrumb={[{ label: 'Portfolio', href: '/dashboard' }, { label: 'Overview' }]}
  />
  <div class="page-actions">
    <a class="button-secondary" href="/broker">Sync Broker</a>
  </div>
</div>

{#if holdings.length > 0}
  <div class="stat-row">
    <StatCard label="Market Value"   value={money(totalValue)}   tint="primary" />
    <StatCard label="Cost Basis"     value={money(totalCost)}    tint="primary" />
    <StatCard label="Unrealised P&L" value={pnlValue}            tint={pnlTint} />
    <StatCard label="Return"         value={returnValue}         tint={pnlTint} />
    <StatCard label="Positions"      value={String(holdings.length)} tint="primary" />
  </div>
{/if}

{#if holdings.length === 0}
  <EmptyState
    icon="◎"
    title="No positions"
    description="Import transactions or sync a broker to see your holdings here."
    ctaLabel="Sync Broker"
    ctaHref="/broker"
  />
{:else}
  <HoldingsTable {holdings} />
{/if}

<style>
  .page-top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 16px;
  }

  .page-actions { display: flex; gap: 8px; flex-wrap: wrap; }

  .stat-row {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
    margin-bottom: 20px;
  }
  @media (min-width: 640px)  { .stat-row { grid-template-columns: repeat(3, 1fr); } }
  @media (min-width: 1024px) { .stat-row { grid-template-columns: repeat(5, 1fr); } }
</style>
