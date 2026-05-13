<script lang="ts">
  import type { PageData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import StatCard from '$lib/components/portfolioai/StatCard.svelte';
  import AiBanner from '$lib/components/portfolioai/AiBanner.svelte';
  import AIInsightCard from '$lib/components/portfolioai/AIInsightCard.svelte';
  import PortfolioGrowthChart from '$lib/components/portfolioai/charts/PortfolioGrowthChart.svelte';
  import AllocationChart from '$lib/components/portfolioai/charts/AllocationChart.svelte';
  import HoldingsTable from '$lib/components/portfolioai/tables/HoldingsTable.svelte';
  import WatchlistTable from '$lib/components/portfolioai/tables/WatchlistTable.svelte';

  export let data: PageData;

  function money(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }

  $: sharpe = 1.42; // TODO: wire from analytics service in future phase
</script>

<PageHeader
  title="Dashboard"
  subtitle={new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
/>

<!-- AI Banner -->
<AiBanner brief={data.aiBrief} />

<!-- Stat row -->
<div class="stat-row">
  <StatCard label="Portfolio Value" value={money(data.totalValue)} change="+1.2% today" tint="primary" />
  <StatCard label="Day P&L"        value={money(data.totalPnl)}   change="+0.85%"      tint="success" />
  <StatCard
    label="Total Return"
    value={(data.totalPnlPct >= 0 ? '+' : '') + data.totalPnlPct.toFixed(1) + '%'}
    change="since inception"
    tint="success"
  />
  <StatCard label="Sharpe Ratio" value={sharpe.toFixed(2)} change="▲ Good" tint="primary" />
</div>

<!-- Charts row -->
<div class="charts-row">
  <div class="chart-main">
    <PortfolioGrowthChart snapshots={data.growthData} />
  </div>
  <div class="chart-side">
    <AllocationChart allocations={data.allocations} />
  </div>
</div>

<!-- AI Insight cards -->
<div class="insight-row">
  <AIInsightCard
    title="⚠ Risk Signal"
    summary="Portfolio concentration is moderate. Top 5 holdings represent 68% of value."
    signal="medium"
    href="/analytics/risk"
  />
  <AIInsightCard
    title="◉ Allocation"
    summary="Tech sector is overweight at {data.allocations[0]?.percentage.toFixed(0) ?? '—'}%. Consider rebalancing."
    signal="high"
    href="/analytics/exposure"
  />
  <AIInsightCard
    title="↗ Benchmark"
    summary="Portfolio is outperforming SPY by +0.4% over the past 30 days."
    signal="low"
    href="/analytics/benchmark"
  />
</div>

<!-- Bottom row -->
<div class="bottom-row">
  <div class="card bottom-card">
    <div class="bottom-header">
      <span class="bottom-title">Top Holdings</span>
      <a href="/holdings" class="bottom-link">View all →</a>
    </div>
    <HoldingsTable holdings={data.topHoldings} />
  </div>
  <div class="card bottom-card">
    <div class="bottom-header">
      <span class="bottom-title">Watchlist</span>
      <a href="/watchlist" class="bottom-link">Manage →</a>
    </div>
    <WatchlistTable items={data.watchlistItems} />
  </div>
</div>

<style>
  .stat-row    { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px; }
  .charts-row  { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 16px; }
  .chart-main  { min-width: 0; }
  .chart-side  { min-width: 0; }
  .insight-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
  .bottom-row  { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .bottom-card { padding: 16px; }
  .bottom-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .bottom-title  { font-size: 0.85rem; font-weight: 600; color: #dce8ff; }
  .bottom-link   { font-size: 0.72rem; color: #6c8fff; text-decoration: none; }
  .bottom-link:hover { text-decoration: underline; }

  @media (min-width: 1024px) {
    .stat-row { grid-template-columns: repeat(4, 1fr); }
  }
  @media (max-width: 767px) {
    .charts-row  { grid-template-columns: 1fr; }
    .insight-row { grid-template-columns: 1fr; }
    .bottom-row  { grid-template-columns: 1fr; }
  }
</style>
