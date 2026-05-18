<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import RiskProjectionCard from '$lib/components/simulation/RiskProjectionCard.svelte';
  import ScenarioSimulationCard from '$lib/components/simulation/ScenarioSimulationCard.svelte';
  import StressTestChart from '$lib/components/simulation/StressTestChart.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<PageHeader
  title="Stress Test"
  subtitle="See how your portfolio holds up under market crashes, rate shocks, and sector selloffs."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Stress Test' }]}
/>

<div class="widget-row">
  {#each data.stressTest.widgets as widget}
    <article class:high={widget.status === 'high'} class:medium={widget.status === 'medium'}>
      <span>{widget.label}</span><strong>{widget.value}</strong>
    </article>
  {/each}
</div>

<div class="layout">
  <main class="main-col">
    <StressTestChart stressTest={data.stressTest} />
    {#each data.stressTest.scenarios as result}<ScenarioSimulationCard {result} />{/each}

    <div class="next-step">
      <div class="next-text">
        <strong>Run a full Monte Carlo simulation</strong>
        <span>See thousands of possible outcomes based on your current portfolio composition and risk profile.</span>
      </div>
      <a class="button" href="/optimization/simulation">View Simulation →</a>
    </div>
  </main>
  <aside class="side-col">
    {#if data.stressTest.worst_case}<RiskProjectionCard title="Worst Case Risk" summary={data.stressTest.worst_case.riskSummary} />{/if}
    <div class="guardrail">{data.stressTest.guardrail}</div>
  </aside>
</div>

<style>
  .widget-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 12px; }
  .widget-row article, .guardrail { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  .widget-row article.medium { border-color: rgba(var(--warning-rgb), 0.28); }
  .widget-row article.high { border-color: rgba(var(--danger-rgb), 0.28); }
  .widget-row span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  .widget-row strong { display: block; margin-top: 6px; color: var(--text); font-size: 1rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 22rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  .guardrail { color: var(--muted); font-size: 0.74rem; line-height: 1.5; }
  .next-step { display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid rgba(var(--primary-rgb), 0.22); border-radius: 8px; background: rgba(var(--primary-rgb), 0.05); padding: 14px 16px; }
  .next-text { display: grid; gap: 3px; }
  .next-text strong { font-size: 0.82rem; color: var(--text); }
  .next-text span { font-size: 0.72rem; color: var(--muted); }
  @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
  @media (max-width: 600px) { .next-step { flex-direction: column; align-items: flex-start; } }
</style>
