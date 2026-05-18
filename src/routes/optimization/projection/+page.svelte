<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import OptimizationStatStrip from '$lib/components/optimization/OptimizationStatStrip.svelte';
  import PortfolioProjectionChart from '$lib/components/simulation/PortfolioProjectionChart.svelte';
  import RebalanceProjectionCard from '$lib/components/simulation/RebalanceProjectionCard.svelte';
  import RiskProjectionCard from '$lib/components/simulation/RiskProjectionCard.svelte';
  import VolatilityProjectionChart from '$lib/components/simulation/VolatilityProjectionChart.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  function money(value: number) {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }

  $: riskLevel = data.projection.risk_summary.risk_level;
  $: riskColor = riskLevel === 'high' ? 'red' as const : riskLevel === 'medium' ? 'amber' as const : 'green' as const;
  $: incomeLabel = data.projection.projected_options_premium > 0 ? 'Dividends + premium' : 'Dividends & income';

  $: stats = [
    { label: '5-Year Target', value: money(data.projection.points.at(-1)?.expectedValue ?? data.projection.base_value), sub: 'Expected portfolio value' },
    { label: 'Annual Return', value: `${data.projection.expected_annual_return > 0 ? '+' : ''}${data.projection.expected_annual_return.toFixed(1)}%`, sub: 'Based on current rate' },
    { label: 'Projected Income', value: money(data.projection.projected_income), sub: incomeLabel },
    { label: 'Risk Score', value: `${data.projection.risk_summary.scenario_risk_score}/100`, color: riskColor, sub: riskLevel === 'high' ? 'High risk' : riskLevel === 'medium' ? 'Moderate' : 'Low risk' }
  ];
</script>

<PageHeader
  title="Portfolio Projection"
  subtitle="Expected portfolio value in 1, 3, and 5 years based on current return rates."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Projection' }]}
/>

<OptimizationStatStrip {stats} />

<div class="layout">
  <main class="main-col">
    <PortfolioProjectionChart projection={data.projection} />
    <VolatilityProjectionChart points={data.projection.points} />

    <div class="next-step">
      <div class="next-text">
        <strong>How does your portfolio hold up in a crash?</strong>
        <span>Run a stress test to see worst-case scenarios — market crash, rate shock, sector selloff.</span>
      </div>
      <a class="button" href="/optimization/stress-test">View Stress Test →</a>
    </div>
  </main>
  <aside class="side-col">
    <RiskProjectionCard summary={data.projection.risk_summary} />
    {#if data.rebalanceProjection}<RebalanceProjectionCard projection={data.rebalanceProjection} />{/if}
    <div class="guardrail">{data.projection.guardrail}</div>
  </aside>
</div>

<style>
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 23rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  .guardrail { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; color: var(--muted); font-size: 0.72rem; line-height: 1.5; }
  .next-step { display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid rgba(var(--primary-rgb), 0.22); border-radius: 8px; background: rgba(var(--primary-rgb), 0.05); padding: 14px 16px; }
  .next-text { display: grid; gap: 3px; }
  .next-text strong { font-size: 0.82rem; color: var(--text); }
  .next-text span { font-size: 0.72rem; color: var(--muted); }
  @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
  @media (max-width: 600px) { .next-step { flex-direction: column; align-items: flex-start; } }
</style>
