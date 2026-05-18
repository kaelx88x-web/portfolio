<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AllocationComparisonChart from '$lib/components/optimization/AllocationComparisonChart.svelte';
  import OptimizationStatStrip from '$lib/components/optimization/OptimizationStatStrip.svelte';
  import RebalanceSuggestionCard from '$lib/components/optimization/RebalanceSuggestionCard.svelte';
  import RebalanceProjectionCard from '$lib/components/simulation/RebalanceProjectionCard.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  const modeLabel: Record<string, string> = {
    stock: 'Stocks Only',
    hybrid: 'Hybrid',
    options: 'Active Options'
  };

  $: riskReduction = data.rebalanceProjection?.riskReduction ?? 0;
  $: stats = [
    { label: 'Suggestions', value: String(data.rebalance.length), sub: data.rebalance.length > 0 ? 'Actions available' : 'None needed' },
    { label: 'Status', value: data.rebalance.length > 0 ? 'Needs Action' : 'Up to Date', color: data.rebalance.length > 0 ? 'amber' as const : 'green' as const },
    { label: 'Risk Reduction', value: data.rebalanceProjection ? `${riskReduction > 0 ? '−' : '+'}${Math.abs(riskReduction).toFixed(1)} pts` : '—', color: riskReduction > 0 ? 'green' as const : 'amber' as const, sub: 'After rebalance' }
  ];
</script>

<PageHeader
  title="Rebalance Suggestions"
  subtitle="What to buy, reduce, or add to move your portfolio toward the target allocation."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Rebalance' }]}
/>

<OptimizationStatStrip {stats} />

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<div class="layout">
  <main class="list">
    {#each data.rebalance as suggestion}<RebalanceSuggestionCard {suggestion} />{/each}
    {#if data.rebalance.length === 0}<div class="empty">No rebalance actions needed at this time.</div>{/if}

    <div class="next-step">
      <div class="next-text">
        <strong>Want to see the numbers over time?</strong>
        <span>Run a projection to see how this rebalance affects your portfolio value in 1–5 years.</span>
      </div>
      <a class="button" href="/optimization/projection">View Portfolio Projection →</a>
    </div>
  </main>
  <aside>
    <form method="POST" action="?/simulate" class="simulate-card">
      <div class="mode-label">Simulate for Portfolio Mode</div>
      <div class="pills">
        {#each data.portfolioModes as mode}
          <label class="pill">
            <input type="radio" name="portfolioMode" value={mode} checked={mode === data.portfolioMode} />
            <span>{modeLabel[mode] ?? mode}</span>
          </label>
        {/each}
      </div>
      <button class="button" type="submit">Simulate Rebalance</button>
    </form>
    {#if data.rebalanceProjection}<RebalanceProjectionCard projection={data.rebalanceProjection} />{/if}
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
  .mode-label { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  .pills { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill input { display: none; }
  .pill span { display: block; border: 1px solid var(--border); border-radius: 999px; padding: 5px 12px; font-size: 0.72rem; font-weight: 700; color: var(--muted); cursor: pointer; background: var(--bg); transition: all 0.12s; }
  .pill input:checked + span { background: var(--primary); border-color: var(--primary); color: #fff; }
  .pill span:hover { border-color: var(--primary); color: var(--primary); }

  .next-step { display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid rgba(var(--primary-rgb), 0.22); border-radius: 8px; background: rgba(var(--primary-rgb), 0.05); padding: 14px 16px; }
  .next-text { display: grid; gap: 3px; }
  .next-text strong { font-size: 0.82rem; color: var(--text); }
  .next-text span { font-size: 0.72rem; color: var(--muted); }
  @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
  @media (max-width: 600px) { .next-step { flex-direction: column; align-items: flex-start; } }
</style>
