<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import OptimizationStatStrip from '$lib/components/optimization/OptimizationStatStrip.svelte';
  import PortfolioProjectionChart from '$lib/components/simulation/PortfolioProjectionChart.svelte';
  import RebalanceProjectionCard from '$lib/components/simulation/RebalanceProjectionCard.svelte';
  import RiskProjectionCard from '$lib/components/simulation/RiskProjectionCard.svelte';
  import ScenarioSelector from '$lib/components/simulation/ScenarioSelector.svelte';
  import ScenarioSimulationCard from '$lib/components/simulation/ScenarioSimulationCard.svelte';
  import StressTestChart from '$lib/components/simulation/StressTestChart.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  type Color = 'red' | 'amber' | 'green';
  function statusColor(status: string): Color {
    return status === 'high' ? 'red' : status === 'medium' ? 'amber' : 'green';
  }

  $: stats = data.widgets.map((w) => ({
    label: w.label,
    value: w.value,
    color: statusColor(w.status)
  }));
</script>

<PageHeader
  title="Scenario Simulation"
  subtitle="Run what-if scenarios to see how allocation changes affect risk and return."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Simulation' }]}
/>

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<ScenarioSelector
  scenarioTypes={data.scenarioTypes}
  portfolioModes={data.portfolioModes}
  activeScenario={data.latestRun?.scenarioType ?? 'bear_market'}
  activeMode={data.portfolioMode}
/>

<OptimizationStatStrip {stats} />

<div class="layout">
  <main class="main-col">
    {#each data.results as result}<ScenarioSimulationCard {result} />{/each}
    <StressTestChart stressTest={data.stressTest} />

    {#if data.portfolioMode === 'hybrid' || data.portfolioMode === 'options'}
      <div class="next-step">
        <div class="next-text">
          <strong>Optimize your options strategy</strong>
          <span>Review covered call and cash-secured put opportunities based on your current holdings.</span>
        </div>
        <a class="button" href="/optimization/options">Options Intelligence →</a>
      </div>
    {:else}
      <div class="next-step">
        <div class="next-text">
          <strong>Review past optimization runs</strong>
          <span>Compare how your portfolio metrics have changed over time.</span>
        </div>
        <a class="button" href="/optimization/history">View History →</a>
      </div>
    {/if}
  </main>
  <aside class="side-col">
    {#if data.stressTest.worst_case}<RiskProjectionCard summary={data.stressTest.worst_case.riskSummary} />{/if}
    <PortfolioProjectionChart projection={data.projection} />
    {#if data.rebalanceProjection}<RebalanceProjectionCard projection={data.rebalanceProjection} />{/if}
  </aside>
</div>

<style>
  .notice { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .next-step { display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid rgba(var(--primary-rgb), 0.22); border-radius: 8px; background: rgba(var(--primary-rgb), 0.05); padding: 14px 16px; }
  .next-text { display: grid; gap: 3px; }
  .next-text strong { font-size: 0.82rem; color: var(--text); }
  .next-text span { font-size: 0.72rem; color: var(--muted); }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 24rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
</style>
