<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import PortfolioProjectionChart from '$lib/components/simulation/PortfolioProjectionChart.svelte';
  import RebalanceProjectionCard from '$lib/components/simulation/RebalanceProjectionCard.svelte';
  import RiskProjectionCard from '$lib/components/simulation/RiskProjectionCard.svelte';
  import ScenarioSelector from '$lib/components/simulation/ScenarioSelector.svelte';
  import ScenarioSimulationCard from '$lib/components/simulation/ScenarioSimulationCard.svelte';
  import StressTestChart from '$lib/components/simulation/StressTestChart.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;
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

<div class="widget-row">
  {#each data.widgets as widget}
    <article class:high={widget.status === 'high'} class:medium={widget.status === 'medium'}>
      <span>{widget.label}</span>
      <strong>{widget.value}</strong>
    </article>
  {/each}
</div>

<div class="layout">
  <main class="main-col">
    <div class="ai-note">{data.aiExplanation}</div>
    {#each data.results as result}<ScenarioSimulationCard {result} />{/each}
    <StressTestChart stressTest={data.stressTest} />
  </main>
  <aside class="side-col">
    {#if data.stressTest.worst_case}<RiskProjectionCard summary={data.stressTest.worst_case.riskSummary} />{/if}
    <PortfolioProjectionChart projection={data.projection} />
    {#if data.rebalanceProjection}<RebalanceProjectionCard projection={data.rebalanceProjection} />{/if}
  </aside>
</div>

<style>
  .notice, .ai-note { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .ai-note { border-color: rgba(var(--primary-rgb), 0.22); background: rgba(var(--primary-rgb), 0.06); color: var(--muted); }
  .widget-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-bottom: 12px; }
  .widget-row article { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  .widget-row article.medium { border-color: rgba(var(--warning-rgb), 0.28); }
  .widget-row article.high { border-color: rgba(var(--danger-rgb), 0.28); }
  .widget-row span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  .widget-row strong { display: block; margin-top: 6px; color: var(--text); font-size: 1rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 24rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
</style>
