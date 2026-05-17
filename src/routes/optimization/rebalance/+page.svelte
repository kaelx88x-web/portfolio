<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AllocationComparisonChart from '$lib/components/optimization/AllocationComparisonChart.svelte';
  import OptimizationStatStrip from '$lib/components/optimization/OptimizationStatStrip.svelte';
  import RebalanceSuggestionCard from '$lib/components/optimization/RebalanceSuggestionCard.svelte';
  import RebalanceProjectionCard from '$lib/components/simulation/RebalanceProjectionCard.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  $: stats = [
    { label: 'Suggestions', value: String(data.rebalance.length), sub: data.rebalance.length > 0 ? 'Actions available' : 'None needed' },
    { label: 'Status', value: data.rebalance.length > 0 ? 'Needs Action' : 'Up to Date', color: data.rebalance.length > 0 ? 'amber' as const : 'green' as const },
    { label: 'Est. Risk Reduction', value: data.rebalanceProjection ? `${data.rebalanceProjection.riskReduction > 0 ? '-' : ''}${Math.abs(data.rebalanceProjection.riskReduction).toFixed(1)}%` : '—', sub: 'After rebalance' }
  ];
</script>

<PageHeader
  title="Rebalance Suggestions"
  subtitle="Actions to bring your portfolio closer to the target allocation."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Rebalance' }]}
/>

<OptimizationStatStrip {stats} />

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<div class="layout">
  <main class="list">
    {#each data.rebalance as suggestion}<RebalanceSuggestionCard {suggestion} />{/each}
    {#if data.rebalance.length === 0}<div class="empty">No rebalance actions needed at this time.</div>{/if}
  </main>
  <aside>
    <form method="POST" action="?/simulate" class="simulate-card">
      <label>
        <span>Portfolio Mode</span>
        <select name="portfolioMode">
          {#each data.portfolioModes as mode}
            <option value={mode} selected={mode === data.portfolioMode}>{mode}</option>
          {/each}
        </select>
      </label>
      <button class="button" type="submit">Simulate Rebalance</button>
    </form>
    <RebalanceProjectionCard projection={data.rebalanceProjection} />
    {#if data.rebalance[0]}<AllocationComparisonChart allocation={data.rebalance[0].targetAllocation} />{/if}
  </aside>
</div>

<style>
  .notice { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 24rem; gap: 12px; }
  .list { display: grid; gap: 12px; align-content: start; }
  .empty { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 20px; color: var(--muted); font-size: 0.78rem; text-align: center; }
  aside { display: grid; align-content: start; gap: 12px; }
  .simulate-card { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 10px; }
  label { display: grid; gap: 5px; }
  label span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  select { height: 34px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); padding: 0 10px; font-size: 0.78rem; }
  @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
</style>
