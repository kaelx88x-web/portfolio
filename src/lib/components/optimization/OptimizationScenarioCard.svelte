<script lang="ts">
  import { Gauge, TrendingUp } from 'lucide-svelte';
  import type { OptimizationScenario } from '$lib/services/optimization-engine.service';

  export let scenario: OptimizationScenario;

  $: sharpeLabel = scenario.sharpeRatio >= 1 ? 'excellent' : scenario.sharpeRatio >= 0.5 ? 'good' : scenario.sharpeRatio >= 0 ? 'watch this' : 'poor';
  $: sharpeColor = scenario.sharpeRatio >= 0.5 ? 'good' : scenario.sharpeRatio >= 0 ? 'warn' : 'bad';

  function deltaLabel(delta: number) {
    if (Math.abs(delta) < 0.05) return '—';
    return (delta > 0 ? '+' : '') + delta.toFixed(1) + '%';
  }
</script>

<article class="scenario">
  <div class="head">
    <div>
      <h2>{scenario.scenarioName}</h2>
      <p>{scenario.metadata.explanation}</p>
    </div>
    <span class="sharpe" class:good={sharpeColor === 'good'} class:warn={sharpeColor === 'warn'} class:bad={sharpeColor === 'bad'}>
      Sharpe {scenario.sharpeRatio.toFixed(2)} · {sharpeLabel}
    </span>
  </div>

  <div class="metrics">
    <div><TrendingUp size={14} /><span>Expected Return</span><strong class:pos={scenario.expectedReturn > 0} class:neg={scenario.expectedReturn < 0}>{scenario.expectedReturn > 0 ? '+' : ''}{scenario.expectedReturn.toFixed(2)}%</strong></div>
    <div><Gauge size={14} /><span>Price Swings</span><strong>{scenario.expectedVolatility.toFixed(2)}%</strong></div>
  </div>

  <div class="alloc">
    <div class="alloc-head"><span>Holding</span><span>Target</span><span>Change</span></div>
    {#each scenario.allocation.slice(0, 6) as row}
      <div class="alloc-row">
        <span class="label">{row.label}</span>
        <strong>{row.targetPct.toFixed(1)}%</strong>
        <span class="delta" class:up={row.deltaPct > 0.05} class:down={row.deltaPct < -0.05}>{deltaLabel(row.deltaPct)}</span>
        <i style={`width:${Math.min(100, Math.max(2, row.targetPct))}%`}></i>
      </div>
    {/each}
  </div>

  {#if scenario.optionsAllocation && scenario.optionsAllocation.length > 0}
    <div class="options-alloc">
      <div class="section-label">Options Allocation</div>
      {#each scenario.optionsAllocation as row}
        <div class="opt-row">
          <span>{row.label}</span>
          <strong>{row.percentage.toFixed(1)}%</strong>
          <p>{row.note}</p>
        </div>
      {/each}
    </div>
  {/if}
</article>

<style>
  .scenario { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 12px; }
  .head { display: flex; justify-content: space-between; gap: 10px; align-items: flex-start; }
  h2 { margin: 0; color: var(--text); font-size: 0.9rem; }
  p { margin: 5px 0 0; color: var(--muted); font-size: 0.73rem; line-height: 1.45; }
  .sharpe { flex: 0 0 auto; border-radius: 999px; padding: 4px 8px; font-size: 0.65rem; font-weight: 800; }
  .sharpe.good { color: var(--success); background: rgba(var(--success-rgb), 0.1); }
  .sharpe.warn { color: var(--warning); background: rgba(var(--warning-rgb), 0.1); }
  .sharpe.bad { color: var(--danger); background: rgba(var(--danger-rgb), 0.1); }

  .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .metrics div { border: 1px solid var(--border); border-radius: 6px; padding: 9px; display: grid; gap: 3px; color: var(--muted); }
  .metrics strong { font-size: 0.95rem; color: var(--text); }
  .metrics strong.pos { color: var(--success); }
  .metrics strong.neg { color: var(--danger); }
  .metrics span { font-size: 0.65rem; text-transform: uppercase; font-weight: 700; }

  .alloc { display: grid; gap: 6px; }
  .alloc-head { display: grid; grid-template-columns: minmax(0, 1fr) 3.5rem 3rem; font-size: 0.6rem; font-weight: 800; text-transform: uppercase; color: var(--muted); padding-bottom: 2px; }
  .alloc-row { display: grid; grid-template-columns: minmax(0, 1fr) 3.5rem 3rem; gap: 0; align-items: center; font-size: 0.72rem; color: var(--muted); }
  .alloc-row .label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .alloc-row strong { color: var(--text); }
  .delta { font-size: 0.68rem; font-weight: 700; color: var(--muted); }
  .delta.up { color: var(--success); }
  .delta.down { color: var(--danger); }
  .alloc-row i { grid-column: 1 / -1; height: 3px; border-radius: 999px; background: linear-gradient(90deg, var(--primary), var(--success)); margin-top: 4px; }

  .options-alloc { border-top: 1px solid var(--border); padding-top: 10px; display: grid; gap: 8px; }
  .section-label { font-size: 0.6rem; font-weight: 800; text-transform: uppercase; color: var(--muted); }
  .opt-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px; font-size: 0.72rem; }
  .opt-row span { color: var(--muted); }
  .opt-row strong { color: var(--text); }
  .opt-row p { grid-column: 1 / -1; margin: 0; color: var(--muted); font-size: 0.65rem; line-height: 1.4; opacity: 0.8; }
</style>
