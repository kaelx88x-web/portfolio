<script lang="ts">
  import { Activity, RefreshCw, Table2 } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AllocationHealthCard from '$lib/components/allocation/AllocationHealthCard.svelte';
  import AllocationSuggestionCard from '$lib/components/allocation/AllocationSuggestionCard.svelte';
  import CashEfficiencyCard from '$lib/components/allocation/CashEfficiencyCard.svelte';
  import DiversificationScoreCard from '$lib/components/allocation/DiversificationScoreCard.svelte';
  import OptimizationStatStrip from '$lib/components/optimization/OptimizationStatStrip.svelte';
  import PortfolioStyleBadge from '$lib/components/allocation/PortfolioStyleBadge.svelte';
  import SectorExposureChart from '$lib/components/allocation/SectorExposureChart.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  $: largestPct = data.exposure?.symbol_exposure?.[0]?.percentage ?? 0;
  $: topSectorPct = data.exposure?.category_exposure?.[0]?.percentage ?? 0;
  $: stats = [
    { label: 'Largest Holding', value: `${largestPct.toFixed(1)}%`, color: largestPct > 20 ? 'amber' as const : 'green' as const, sub: data.exposure?.symbol_exposure?.[0]?.label ?? '' },
    { label: 'Top Sector', value: `${topSectorPct.toFixed(1)}%`, color: topSectorPct > 35 ? 'amber' as const : 'green' as const, sub: data.exposure?.category_exposure?.[0]?.label ?? '' },
    { label: 'Diversification', value: `${data.health?.diversification_score ?? 0}/100`, sub: 'Higher is better' },
    { label: 'Cash', value: `${((data.exposure?.cash_pct ?? 0) * 100).toFixed(1)}%`, sub: 'Available liquidity' }
  ];
</script>

<PageHeader
  title="Allocation Check"
  subtitle="Review how your portfolio is distributed across stocks, sectors, and asset types."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Allocation' }]}
/>

<div class="top-actions">
  <a class="button-secondary" href="/optimization/allocation/health"><Activity size={15} /> Health Report</a>
  <a class="button-secondary" href="/optimization/allocation/exposure"><Table2 size={15} /> Full Exposure</a>
  <form method="POST" action="?/refresh"><button class="button" type="submit"><RefreshCw size={15} /> Refresh</button></form>
</div>

<OptimizationStatStrip {stats} />

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<div class="layout">
  <main class="main-col">
    <AllocationHealthCard health={data.health} />
    <SectorExposureChart rows={data.exposure.category_exposure} title="Portfolio Style Exposure" />
    <SectorExposureChart rows={data.exposure.symbol_exposure} title="Single Holding Exposure" />
  </main>
  <aside class="side-col">
    <div class="style-card">
      <span>Detected Style</span>
      <PortfolioStyleBadge style={data.style.portfolio_style} />
      <p>{data.style.explanation}</p>
    </div>
    <DiversificationScoreCard score={data.health.diversification_score} />
    <CashEfficiencyCard score={data.health.cash_efficiency_score} cashPct={data.exposure.cash_pct} />
    <div class="suggestions">
      <h2>Allocation Suggestions</h2>
      {#each data.suggestions as suggestion}<AllocationSuggestionCard {suggestion} />{/each}
    </div>
  </aside>
</div>

<style>
  .top-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .notice { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 23rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  .style-card, .suggestions { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  .style-card { display: grid; gap: 10px; }
  .style-card span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  .style-card p { margin: 0; color: var(--muted); font-size: 0.74rem; line-height: 1.5; }
  .suggestions { display: grid; gap: 10px; }
  .suggestions h2 { margin: 0; color: var(--text); font-size: 0.9rem; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
</style>
