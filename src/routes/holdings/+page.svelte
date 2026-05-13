<script lang="ts">
  import type { PageData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import HoldingsTable from '$lib/components/portfolioai/tables/HoldingsTable.svelte';
  import StatCard from '$lib/components/portfolioai/StatCard.svelte';

  export let data: PageData;

  function money(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }

  $: totalMarket = data.holdings.reduce((s: number, h: { marketValue: number }) => s + h.marketValue, 0);
  $: openPositions = data.holdings.length;

  $: subtitle = data.dataSource === 'snapshot'
    ? `Live from Moomoo · synced ${new Date(data.snapshotDate as string).toLocaleDateString()}`
    : 'Calculated from transactions';
</script>

<PageHeader
  title="Holdings"
  {subtitle}
  breadcrumb={[{ label: 'Portfolio', href: '/dashboard' }, { label: 'Holdings' }]}
/>

<div class="stat-row">
  <StatCard label="Market Value"   value={money(totalMarket)}        tint="primary" />
  <StatCard label="Cash Balance"   value={money(data.cashBalance)}   tint="success" />
  <StatCard label="Open Positions" value={String(openPositions)}     tint="primary" />
</div>

<HoldingsTable holdings={data.holdings} />

<style>
  .stat-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 20px; }
  @media (max-width: 640px) { .stat-row { grid-template-columns: 1fr; } }
</style>
