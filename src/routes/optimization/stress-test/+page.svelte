<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import OptimizationStatStrip from '$lib/components/optimization/OptimizationStatStrip.svelte';
  import RiskProjectionCard from '$lib/components/simulation/RiskProjectionCard.svelte';
  import ScenarioSimulationCard from '$lib/components/simulation/ScenarioSimulationCard.svelte';
  import StressTestChart from '$lib/components/simulation/StressTestChart.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  $: worst = data.stressTest.worst_case;
  $: stats = [
    { label: 'Stress Result', value: worst?.riskSummary.risk_level.toUpperCase() ?? 'N/A', color: worst?.riskSummary.risk_level === 'high' ? 'red' as const : worst?.riskSummary.risk_level === 'medium' ? 'amber' as const : 'green' as const, sub: 'Worst scenario' },
    { label: 'Worst Drawdown', value: worst ? `${worst.projectedDrawdown.toFixed(1)}%` : '—', color: 'red' as const, sub: worst?.scenarioName ?? '' },
    { label: 'Peak Volatility', value: `${Math.max(...data.stressTest.scenarios.map((s) => s.projectedVolatility), 0).toFixed(1)}%`, sub: 'Across all scenarios' },
    { label: 'Risk Score', value: worst ? `${worst.riskSummary.scenario_risk_score}/100` : '—', color: worst?.riskSummary.risk_level === 'high' ? 'red' as const : 'amber' as const, sub: 'Worst case score' }
  ];
</script>

<PageHeader
  title="Stress Test"
  subtitle="See how your portfolio holds up under market crashes, rate shocks, and sector selloffs."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Stress Test' }]}
/>

<OptimizationStatStrip {stats} />

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
    {#if worst}<RiskProjectionCard title="Worst Case Risk" summary={worst.riskSummary} />{/if}
    <div class="guardrail">{data.stressTest.guardrail}</div>
  </aside>
</div>

<style>
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 22rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  .guardrail { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; color: var(--muted); font-size: 0.72rem; line-height: 1.5; }
  .next-step { display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid rgba(var(--primary-rgb), 0.22); border-radius: 8px; background: rgba(var(--primary-rgb), 0.05); padding: 14px 16px; }
  .next-text { display: grid; gap: 3px; }
  .next-text strong { font-size: 0.82rem; color: var(--text); }
  .next-text span { font-size: 0.72rem; color: var(--muted); }
  @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
  @media (max-width: 600px) { .next-step { flex-direction: column; align-items: flex-start; } }
</style>
