<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import PortfolioProjectionChart from '$lib/components/simulation/PortfolioProjectionChart.svelte';
  import RebalanceProjectionCard from '$lib/components/simulation/RebalanceProjectionCard.svelte';
  import RiskProjectionCard from '$lib/components/simulation/RiskProjectionCard.svelte';
  import VolatilityProjectionChart from '$lib/components/simulation/VolatilityProjectionChart.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  function money(value: number) {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }
</script>

<PageHeader
  title="Portfolio Projection"
  subtitle="Expected portfolio value in 1, 3, and 5 years based on current return rates."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Projection' }]}
/>

<div class="widget-row">
  <article><span>Portfolio Projection</span><strong>{money(data.projection.points.at(-1)?.expectedValue ?? data.projection.base_value)}</strong></article>
  <article><span>Volatility Forecast</span><strong>{data.projection.expected_volatility.toFixed(2)}%</strong></article>
  <article><span>Projected Income</span><strong>{money(data.projection.projected_income)}</strong></article>
  <article><span>Options Premium</span><strong>{money(data.projection.projected_options_premium)}</strong></article>
</div>

<div class="layout">
  <main class="main-col">
    <PortfolioProjectionChart projection={data.projection} />
    <VolatilityProjectionChart points={data.projection.points} />
  </main>
  <aside class="side-col">
    <RiskProjectionCard summary={data.projection.risk_summary} />
    {#if data.rebalanceProjection}<RebalanceProjectionCard projection={data.rebalanceProjection} />{/if}
    <div class="guardrail">{data.projection.guardrail}</div>
  </aside>
</div>

<style>
  .widget-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 12px; }
  .widget-row article, .guardrail { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  .widget-row span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  .widget-row strong { display: block; margin-top: 6px; color: var(--text); font-size: 1rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 23rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  .guardrail { color: var(--muted); font-size: 0.74rem; line-height: 1.5; }
  @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
</style>
