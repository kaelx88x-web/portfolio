<script lang="ts">
  import { ShieldCheck } from 'lucide-svelte';
  import type { RebalanceSuggestion } from '$lib/services/optimization-engine.service';

  export let suggestion: RebalanceSuggestion;

  // Derive concrete actions from targetAllocation deltas.
  // Never suggest REDUCE for option underlyings (role === 'options') — they are collateral.
  $: actions = suggestion.targetAllocation
    .filter((row) => Math.abs(row.deltaPct) >= 0.5)
    .filter((row) => !(row.role === 'options' && row.deltaPct < 0))
    .sort((a, b) => Math.abs(b.deltaPct) - Math.abs(a.deltaPct))
    .slice(0, 6)
    .map((row) => ({
      label: row.label,
      delta: row.deltaPct,
      from: row.currentPct,
      to: row.targetPct,
      action: row.currentPct < 0.05 ? 'ADD' : row.deltaPct > 0 ? 'INCREASE' : 'REDUCE'
    }));
</script>

<article class="suggestion">
  <div class="title"><ShieldCheck size={15} /><h2>{suggestion.title}</h2></div>
  <p>{suggestion.summary}</p>

  {#if actions.length > 0}
    <div class="actions-list">
      <div class="actions-head">Suggested Actions</div>
      {#each actions as a}
        <div class="action-row">
          <span class="badge" class:add={a.action === 'ADD'} class:increase={a.action === 'INCREASE'} class:reduce={a.action === 'REDUCE'}>{a.action}</span>
          <span class="action-label">{a.label}</span>
          <span class="action-delta" class:pos={a.delta > 0} class:neg={a.delta < 0}>
            {a.from < 0.05 ? `→ ${a.to.toFixed(1)}%` : `${a.from.toFixed(1)}% → ${a.to.toFixed(1)}%`}
          </span>
        </div>
      {/each}
    </div>
  {/if}

  <div class="impact">
    <div><span>Risk impact</span><strong>{suggestion.riskImpact}</strong></div>
    <div><span>Volatility impact</span><strong>{suggestion.volatilityImpact}</strong></div>
  </div>
  <small>Suggestion only. No automatic trading or order placement.</small>
</article>

<style>
  .suggestion { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 10px; }
  .title { display: flex; align-items: center; gap: 8px; color: var(--primary); }
  h2 { margin: 0; color: var(--text); font-size: 0.86rem; }
  p { margin: 0; color: var(--muted); font-size: 0.74rem; line-height: 1.5; }

  .actions-list { display: grid; gap: 6px; border: 1px solid var(--border); border-radius: 6px; padding: 10px; background: var(--bg); }
  .actions-head { font-size: 0.6rem; font-weight: 800; text-transform: uppercase; color: var(--muted); margin-bottom: 2px; }
  .action-row { display: flex; align-items: center; gap: 8px; font-size: 0.72rem; }
  .badge { flex: 0 0 auto; font-size: 0.58rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; text-transform: uppercase; }
  .badge.add { background: rgba(var(--success-rgb), 0.12); color: var(--success); }
  .badge.increase { background: rgba(var(--primary-rgb), 0.1); color: var(--primary); }
  .badge.reduce { background: rgba(var(--danger-rgb), 0.1); color: var(--danger); }
  .action-label { flex: 1; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .action-delta { flex: 0 0 auto; font-weight: 700; color: var(--muted); }
  .action-delta.pos { color: var(--success); }
  .action-delta.neg { color: var(--danger); }

  .impact { display: grid; gap: 8px; }
  .impact div { border: 1px solid var(--border); border-radius: 6px; padding: 9px; display: grid; gap: 4px; }
  .impact span { color: var(--muted); font-size: 0.63rem; text-transform: uppercase; font-weight: 800; }
  .impact strong { color: var(--text); font-size: 0.72rem; line-height: 1.45; }
  small { color: var(--warning); font-size: 0.68rem; }
</style>
