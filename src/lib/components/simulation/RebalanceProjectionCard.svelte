<script lang="ts">
  import { ShieldCheck } from 'lucide-svelte';
  import type { RebalanceProjection } from '$lib/services/scenario-simulation.service';

  export let projection: RebalanceProjection;

  $: riskGood = projection.riskReduction > 0;
  $: returnGood = projection.expectedReturnChange >= 0;
  $: volGood = projection.volatilityChange <= 0;
</script>

<article class="rebalance">
  <div class="head">
    <div>
      <span>After Rebalance</span>
      <h2>Projected Impact</h2>
    </div>
    <ShieldCheck size={18} />
  </div>
  <div class="metrics">
    <div>
      <span>Risk Score</span>
      <strong class:good={riskGood} class:bad={!riskGood}>
        {riskGood ? '−' : '+'}{Math.abs(projection.riskReduction).toFixed(1)} pts
      </strong>
      <em>{riskGood ? 'Lower risk' : 'Higher risk'}</em>
    </div>
    <div>
      <span>Expected Return</span>
      <strong class:good={returnGood} class:bad={!returnGood}>
        {projection.expectedReturnChange >= 0 ? '+' : ''}{projection.expectedReturnChange.toFixed(2)}%
      </strong>
      <em>{returnGood ? 'Improves' : 'Decreases'}</em>
    </div>
    <div>
      <span>Price Swings</span>
      <strong class:good={volGood} class:bad={!volGood}>
        {projection.volatilityChange >= 0 ? '+' : ''}{projection.volatilityChange.toFixed(2)}%
      </strong>
      <em>{volGood ? 'Less volatile' : 'More volatile'}</em>
    </div>
  </div>
  <div class="rows">
    <div class="rows-head"><span>Holding</span><span>Now → After</span></div>
    {#each projection.projectedAllocation.slice(0, 7) as row}
      <div class="row">
        <span>{row.label}</span>
        <strong>{row.currentPct.toFixed(1)}% → {row.projectedPct.toFixed(1)}%</strong>
      </div>
    {/each}
  </div>
  {#if projection.metadata.ai_explanation}<p>{projection.metadata.ai_explanation}</p>{/if}
</article>

<style>
  .rebalance { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 12px; }
  .head { display: flex; justify-content: space-between; gap: 12px; color: var(--primary); }
  .head span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  h2 { margin: 3px 0 0; color: var(--text); font-size: 0.95rem; }

  .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .metrics div { border: 1px solid var(--border); border-radius: 8px; background: var(--surface-1); padding: 9px; display: grid; gap: 2px; min-width: 0; }
  .metrics span { color: var(--muted); font-size: 0.62rem; font-weight: 800; text-transform: uppercase; }
  .metrics strong { font-size: 0.88rem; }
  .metrics strong.good { color: var(--success); }
  .metrics strong.bad { color: var(--danger); }
  .metrics em { font-style: normal; font-size: 0.62rem; color: var(--muted); }

  .rows { display: grid; gap: 6px; }
  .rows-head { display: flex; justify-content: space-between; font-size: 0.6rem; font-weight: 800; text-transform: uppercase; color: var(--muted); padding-bottom: 2px; }
  .row { display: flex; justify-content: space-between; gap: 10px; font-size: 0.72rem; color: var(--muted); }
  .row span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .row strong { color: var(--text); flex-shrink: 0; }

  p { margin: 0; color: var(--muted); font-size: 0.72rem; line-height: 1.5; }
  @media (max-width: 720px) { .metrics { grid-template-columns: 1fr; } }
</style>
