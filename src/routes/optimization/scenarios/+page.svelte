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
{/if}

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin: 12px 0; }
</style>
