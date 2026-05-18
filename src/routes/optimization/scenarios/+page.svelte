<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AllocationComparisonChart from '$lib/components/optimization/AllocationComparisonChart.svelte';
  import EfficientFrontierChart from '$lib/components/optimization/EfficientFrontierChart.svelte';
  import OptimizationScenarioCard from '$lib/components/optimization/OptimizationScenarioCard.svelte';
  import OptimizationStatStrip from '$lib/components/optimization/OptimizationStatStrip.svelte';
  import ScenarioSelector from '$lib/components/optimization/ScenarioSelector.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  $: best = data.scenarios.length ? data.scenarios.reduce((a: typeof data.scenarios[0], b: typeof data.scenarios[0]) => (a.expectedReturn > b.expectedReturn ? a : b)) : null;
  $: lowest = data.scenarios.length ? data.scenarios.reduce((a: typeof data.scenarios[0], b: typeof data.scenarios[0]) => (a.expectedVolatility < b.expectedVolatility ? a : b)) : null;
  $: topSharpe = data.scenarios.length ? data.scenarios.reduce((a: typeof data.scenarios[0], b: typeof data.scenarios[0]) => (a.sharpeRatio > b.sharpeRatio ? a : b)) : null;
  $: stats = data.scenarios.length
    ? [
        { label: 'Best Return', value: `${(best?.expectedReturn ?? 0) > 0 ? '+' : ''}${best?.expectedReturn.toFixed(1) ?? '—'}%`, color: 'green' as const, sub: best?.scenarioName ?? '' },
        { label: 'Lowest Volatility', value: `${lowest?.expectedVolatility.toFixed(1) ?? '—'}%`, sub: lowest?.scenarioName ?? '' },
        { label: 'Best Sharpe', value: topSharpe?.sharpeRatio.toFixed(2) ?? '—', sub: '>0.5 is good' },
        { label: 'Active Scenario', value: data.activeScenarioName || 'Balanced', sub: 'Currently selected' }
      ]
    : [];
</script>

<PageHeader
  title="Portfolio Scenarios"
  subtitle="Compare three allocation strategies and pick what fits your goals."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Scenarios' }]}
/>

<OptimizationStatStrip {stats} />

<ScenarioSelector scenarios={data.scenarios} active={data.activeScenarioName} />

<div class="grid">
  {#each data.scenarios as scenario}<OptimizationScenarioCard {scenario} />{/each}
</div>

<EfficientFrontierChart points={data.efficientFrontier} />

{#if data.activeScenario}
  <AllocationComparisonChart allocation={data.activeScenario.allocation} />

  <div class="next-step">
    <div class="next-text">
      <strong>Ready to act on this?</strong>
      <span>See exactly what to buy and sell to move your portfolio toward the {data.activeScenario.scenarioName} target.</span>
    </div>
    <a class="button" href="/optimization/rebalance">View Rebalance Suggestions →</a>
  </div>
{/if}

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin: 12px 0; }
  .next-step { display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid rgba(var(--primary-rgb), 0.22); border-radius: 8px; background: rgba(var(--primary-rgb), 0.05); padding: 14px 16px; margin-top: 12px; }
  .next-text { display: grid; gap: 3px; }
  .next-text strong { font-size: 0.82rem; color: var(--text); }
  .next-text span { font-size: 0.72rem; color: var(--muted); }
  @media (max-width: 600px) { .next-step { flex-direction: column; align-items: flex-start; } }
</style>
