<script lang="ts">
  import { Activity, ArrowRight, RefreshCw, Table2 } from 'lucide-svelte';
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
  $: healthScore = data.health?.allocation_score ?? 0;
  $: cashPct = data.exposure?.cash_pct ?? 0;

  $: stats = [
    {
      label: 'Allocation Health',
      value: `${healthScore}/100`,
      color: healthScore >= 75 ? ('green' as const) : healthScore >= 55 ? ('amber' as const) : ('red' as const)
    },
    {
      label: 'Largest Holding',
      value: `${largestPct.toFixed(1)}%`,
      color: largestPct > 20 ? ('amber' as const) : ('green' as const),
      sub: data.exposure?.symbol_exposure?.[0]?.label ?? ''
    },
    {
      label: 'Top Sector',
      value: `${topSectorPct.toFixed(1)}%`,
      color: topSectorPct > 35 ? ('amber' as const) : ('green' as const),
      sub: data.exposure?.category_exposure?.[0]?.label ?? ''
    },
    {
      label: 'Diversification',
      value: `${data.health?.diversification_score ?? 0}/100`,
      color: (data.health?.diversification_score ?? 0) >= 70 ? ('green' as const) : ('amber' as const)
    },
    {
      label: 'Cash Reserve',
      value: `${cashPct.toFixed(1)}%`,
      color: cashPct < 5 ? ('red' as const) : ('green' as const)
    }
  ];
</script>

<PageHeader
  title="Allocation Check"
  subtitle="Review how your portfolio is distributed across stocks, sectors, and asset types."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Allocation' }]}
/>

<div class="actions-bar">
  <div class="actions-left">
    <a class="tab-btn" href="/optimization/allocation/health"><Activity size={13} /> Health</a>
    <a class="tab-btn" href="/optimization/allocation/exposure"><Table2 size={13} /> Exposure</a>
  </div>
  <form method="POST" action="?/refresh">
    <button class="button" type="submit"><RefreshCw size={13} /> Refresh Data</button>
  </form>
</div>

<OptimizationStatStrip {stats} />

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<div class="layout">
  <main class="main-col">
    <AllocationHealthCard health={data.health} />

    <div class="charts-row">
      <SectorExposureChart rows={data.exposure.category_exposure} title="Style / Category Exposure" />
      <SectorExposureChart rows={data.exposure.symbol_exposure} title="Single Holding Exposure" />
    </div>

    <div class="next-step">
      <div class="next-text">
        <strong>Explore optimization history</strong>
        <span>Compare how your allocation scores and targets have changed over past runs.</span>
      </div>
      <a class="button" href="/optimization/history">View History <ArrowRight size={13} /></a>
    </div>
  </main>

  <aside class="side-col">
    <div class="style-card">
      <div class="style-head">
        <span class="label">Portfolio Style</span>
        <PortfolioStyleBadge style={data.style.portfolio_style} />
      </div>
      <p>{data.style.explanation}</p>
      {#if data.style.signals?.length}
        <ul class="signals">
          {#each data.style.signals as signal}<li>{signal}</li>{/each}
        </ul>
      {/if}
    </div>

    <DiversificationScoreCard score={data.health.diversification_score} />
    <CashEfficiencyCard score={data.health.cash_efficiency_score} cashPct={data.exposure.cash_pct} />

    {#if data.suggestions.length}
      <div class="suggestions">
        <div class="suggestions-head">
          <span class="label">Suggestions</span>
          {#if data.suggestions.length > 3}
            <a href="/optimization/allocation/health">View all {data.suggestions.length}</a>
          {/if}
        </div>
        {#each data.suggestions.slice(0, 3) as suggestion}
          <AllocationSuggestionCard {suggestion} />
        {/each}
      </div>
    {/if}
  </aside>
</div>

<style>
  .actions-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .actions-left { display: flex; gap: 6px; flex-wrap: wrap; }
  .tab-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; color: var(--muted); background: var(--surface-1); border: 1px solid var(--border); text-decoration: none; transition: all 0.12s; }
  .tab-btn:hover { color: var(--text); border-color: var(--primary); }

  .notice { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }

  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 22rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }

  .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  .next-step { display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid rgba(var(--primary-rgb), 0.22); border-radius: 8px; background: rgba(var(--primary-rgb), 0.05); padding: 14px 16px; }
  .next-text { display: grid; gap: 3px; }
  .next-text strong { font-size: 0.82rem; color: var(--text); }
  .next-text span { font-size: 0.72rem; color: var(--muted); }

  .style-card { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 14px 16px; display: grid; gap: 10px; }
  .style-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; }
  .style-card p { margin: 0; color: var(--muted); font-size: 0.73rem; line-height: 1.5; }
  .signals { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }
  .signals li { font-size: 0.68rem; color: var(--muted); padding-left: 12px; position: relative; }
  .signals li::before { content: '·'; position: absolute; left: 2px; color: var(--primary); }

  .suggestions { display: grid; gap: 8px; }
  .suggestions-head { display: flex; justify-content: space-between; align-items: center; }
  .suggestions-head a { font-size: 0.68rem; color: var(--primary); text-decoration: none; }
  .suggestions-head a:hover { text-decoration: underline; }

  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
  @media (max-width: 700px) { .charts-row { grid-template-columns: 1fr; } }
  @media (max-width: 600px) { .actions-bar { flex-direction: column; align-items: flex-start; } }
</style>
