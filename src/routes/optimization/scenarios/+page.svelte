<script lang="ts">
  import { ArrowLeft, ArrowRight } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AllocationComparisonChart from '$lib/components/optimization/AllocationComparisonChart.svelte';
  import EfficientFrontierChart from '$lib/components/optimization/EfficientFrontierChart.svelte';
  import OptimizationScenarioCard from '$lib/components/optimization/OptimizationScenarioCard.svelte';
  import OptimizationStatStrip from '$lib/components/optimization/OptimizationStatStrip.svelte';
  import ScenarioSelector from '$lib/components/optimization/ScenarioSelector.svelte';
  import type { OptimizationScenario } from '$lib/services/optimization-engine.service';
  import type { PageData } from './$types';

  export let data: PageData;

  $: best = data.scenarios.length
    ? data.scenarios.reduce((a: OptimizationScenario, b: OptimizationScenario) => (a.expectedReturn > b.expectedReturn ? a : b))
    : null;
  $: lowest = data.scenarios.length
    ? data.scenarios.reduce((a: OptimizationScenario, b: OptimizationScenario) => (a.expectedVolatility < b.expectedVolatility ? a : b))
    : null;
  $: topSharpe = data.scenarios.length
    ? data.scenarios.reduce((a: OptimizationScenario, b: OptimizationScenario) => (a.sharpeRatio > b.sharpeRatio ? a : b))
    : null;

  $: stats = data.scenarios.length
    ? [
        {
          label: 'Best Return',
          value: `${(best?.expectedReturn ?? 0) > 0 ? '+' : ''}${best?.expectedReturn.toFixed(1) ?? '—'}%`,
          color: 'green' as const,
          sub: best?.scenarioName ?? ''
        },
        {
          label: 'Lowest Volatility',
          value: `${lowest?.expectedVolatility.toFixed(1) ?? '—'}%`,
          sub: lowest?.scenarioName ?? ''
        },
        {
          label: 'Best Sharpe',
          value: topSharpe?.sharpeRatio.toFixed(2) ?? '—',
          color: (topSharpe?.sharpeRatio ?? 0) >= 0.5 ? ('green' as const) : ('amber' as const),
          sub: '≥0.5 is good'
        },
        {
          label: 'Scenarios',
          value: `${data.scenarios.length}`,
          sub: 'Available plans'
        }
      ]
    : [];
</script>

<PageHeader
  title="Portfolio Scenarios"
  subtitle="Compare allocation strategies and pick what fits your goals."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Scenarios' }]}
/>

<div class="actions-bar">
  <div class="actions-left">
    <a class="tab-btn" href="/optimization"><ArrowLeft size={13} /> Back to Engine</a>
  </div>
</div>

{#if data.scenarios.length === 0}
  <div class="empty">
    <div class="empty-icon">📊</div>
    <strong>No scenarios yet</strong>
    <p>Run the optimization engine to generate portfolio scenarios.</p>
    <a class="button" href="/optimization">Run Optimization</a>
  </div>
{:else}
  <OptimizationStatStrip {stats} />

  <div class="selector-row">
    <ScenarioSelector scenarios={data.scenarios} active={data.activeScenarioName} />
  </div>

  <div class="layout">
    <main class="main-col">
      <div class="cards-grid">
        {#each data.scenarios as scenario}
          <OptimizationScenarioCard {scenario} active={scenario.scenarioName === data.activeScenarioName} />
        {/each}
      </div>

      <EfficientFrontierChart points={data.efficientFrontier} />
    </main>

    <aside class="side-col">
      {#if data.activeScenario}
        <div class="active-label">
          <span class="label">Active Scenario</span>
          <strong>{data.activeScenario.scenarioName}</strong>
        </div>

        <AllocationComparisonChart allocation={data.activeScenario.allocation} />

        <div class="next-step">
          <div class="next-text">
            <strong>Ready to act on this?</strong>
            <span>See what to buy and sell to reach the {data.activeScenario.scenarioName} target.</span>
          </div>
          <a class="button" href="/optimization/rebalance">Rebalance <ArrowRight size={13} /></a>
        </div>
      {/if}
    </aside>
  </div>
{/if}

<style>
  .actions-bar { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 16px; }
  .actions-left { display: flex; gap: 6px; }
  .tab-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; color: var(--muted); background: var(--surface-1); border: 1px solid var(--border); text-decoration: none; transition: all 0.12s; }
  .tab-btn:hover { color: var(--text); border-color: var(--primary); }

  .selector-row { margin-bottom: 14px; }

  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 24rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }

  .cards-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; }

  .active-label { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 12px 16px; display: grid; gap: 4px; }
  .label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; }
  .active-label strong { font-size: 0.9rem; color: var(--text); text-transform: capitalize; }

  .next-step { display: flex; align-items: center; justify-content: space-between; gap: 12px; border: 1px solid rgba(var(--primary-rgb), 0.22); border-radius: 10px; background: rgba(var(--primary-rgb), 0.05); padding: 14px 16px; }
  .next-text { display: grid; gap: 3px; }
  .next-text strong { font-size: 0.82rem; color: var(--text); }
  .next-text span { font-size: 0.72rem; color: var(--muted); }

  .empty { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 10px; padding: 64px 24px; border: 1px solid var(--border); border-radius: 10px; background: var(--card); text-align: center; }
  .empty-icon { font-size: 2rem; }
  .empty strong { font-size: 0.9rem; color: var(--text); }
  .empty p { margin: 0; font-size: 0.76rem; color: var(--muted); }

  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
  @media (max-width: 700px) { .cards-grid { grid-template-columns: 1fr; } }
</style>
