<script lang="ts">
  import type { OptimizationScenario } from '$lib/services/optimization-engine.service';

  export let scenario: OptimizationScenario;
  export let active = false;

  $: sharpeLabel = scenario.sharpeRatio >= 1 ? 'excellent' : scenario.sharpeRatio >= 0.5 ? 'good' : scenario.sharpeRatio >= 0 ? 'fair' : 'poor';
  $: sharpeColor =
    scenario.sharpeRatio >= 0.5 ? 'var(--success)' : scenario.sharpeRatio >= 0 ? 'var(--warning)' : 'var(--danger)';
  $: returnColor = scenario.expectedReturn > 0 ? 'var(--success)' : scenario.expectedReturn < 0 ? 'var(--danger)' : 'var(--text)';

  function deltaLabel(delta: number) {
    if (Math.abs(delta) < 0.05) return '—';
    return (delta > 0 ? '+' : '') + delta.toFixed(1) + '%';
  }
</script>

<article class="card" class:active>
  <div class="head">
    <div>
      <div class="label">{scenario.scenarioName}</div>
      <div class="big" style="color:{returnColor}">
        {scenario.expectedReturn > 0 ? '+' : ''}{scenario.expectedReturn.toFixed(1)}<span class="unit">%</span>
      </div>
    </div>
    <div class="sharpe-badge" style="--sc:{sharpeColor}">
      {scenario.sharpeRatio.toFixed(2)} · {sharpeLabel}
    </div>
  </div>

  {#if scenario.metadata.explanation}
    <p class="explanation">{scenario.metadata.explanation}</p>
  {/if}

  <div class="metrics">
    <div class="metric">
      <span>Expected Return</span>
      <strong style="color:{returnColor}">{scenario.expectedReturn > 0 ? '+' : ''}{scenario.expectedReturn.toFixed(2)}%</strong>
    </div>
    <div class="metric">
      <span>Volatility</span>
      <strong>{scenario.expectedVolatility.toFixed(2)}%</strong>
    </div>
    <div class="metric">
      <span>Sharpe Ratio</span>
      <strong style="color:{sharpeColor}">{scenario.sharpeRatio.toFixed(2)}</strong>
    </div>
    <div class="metric">
      <span>Holdings</span>
      <strong>{scenario.allocation.length}</strong>
    </div>
  </div>

  <div class="alloc">
    <div class="alloc-head"><span>Holding</span><span>Target</span><span>Change</span></div>
    {#each scenario.allocation.slice(0, 6) as row}
      <div class="alloc-row">
        <span class="sym">{row.label}</span>
        <strong>{row.targetPct.toFixed(1)}%</strong>
        <span
          class="delta"
          class:up={row.deltaPct > 0.05}
          class:down={row.deltaPct < -0.05}
        >{deltaLabel(row.deltaPct)}</span>
        <div class="bar-wrap"><div class="bar-fill" style="width:{Math.min(100, Math.max(2, row.targetPct))}%"></div></div>
      </div>
    {/each}
  </div>

  {#if scenario.optionsAllocation && scenario.optionsAllocation.length > 0}
    <div class="opts">
      <span class="opts-label">Options Allocation</span>
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
  .card {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--card);
    padding: 16px;
    display: grid;
    gap: 14px;
    transition: border-color 0.12s, box-shadow 0.12s;
  }
  .card.active {
    border-color: rgba(var(--primary-rgb), 0.5);
    box-shadow: 0 0 0 1px rgba(var(--primary-rgb), 0.15);
  }
  .card:not(.active):hover { border-color: rgba(var(--primary-rgb), 0.3); }

  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; margin-bottom: 4px; }
  .big { font-size: 2.2rem; font-weight: 800; line-height: 1; }
  .unit { font-size: 1rem; font-weight: 600; color: var(--muted); margin-left: 1px; }
  .sharpe-badge {
    flex: 0 0 auto;
    font-size: 0.6rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 4px 9px; border-radius: 999px;
    background: rgba(from var(--sc) r g b / 0.12);
    color: var(--sc);
    border: 1px solid rgba(from var(--sc) r g b / 0.25);
    white-space: nowrap;
  }

  .explanation { margin: 0; font-size: 0.72rem; color: var(--muted); line-height: 1.5; }

  .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
  .metric { border: 1px solid var(--border); border-radius: 8px; padding: 9px 11px; }
  .metric span { font-size: 0.6rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em; }
  .metric strong { display: block; margin-top: 4px; font-size: 0.88rem; font-weight: 700; color: var(--text); }

  .alloc { display: grid; gap: 7px; }
  .alloc-head { display: grid; grid-template-columns: minmax(0, 1fr) 3.5rem 3.2rem; font-size: 0.58rem; font-weight: 800; text-transform: uppercase; color: var(--muted); padding-bottom: 2px; border-bottom: 1px solid var(--border); }
  .alloc-row { display: grid; grid-template-columns: minmax(0, 1fr) 3.5rem 3.2rem; gap: 0; align-items: center; font-size: 0.72rem; }
  .sym { color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .alloc-row strong { color: var(--text); font-weight: 600; }
  .delta { font-size: 0.68rem; font-weight: 700; color: var(--muted); }
  .delta.up { color: var(--success); }
  .delta.down { color: var(--danger); }
  .bar-wrap { grid-column: 1 / -1; height: 3px; border-radius: 999px; background: var(--surface-1); overflow: hidden; margin-top: 3px; }
  .bar-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--primary), var(--success)); opacity: 0.6; }

  .opts { border-top: 1px solid var(--border); padding-top: 10px; display: grid; gap: 7px; }
  .opts-label { font-size: 0.58rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; }
  .opt-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 2px; font-size: 0.72rem; }
  .opt-row span { color: var(--muted); }
  .opt-row strong { color: var(--text); }
  .opt-row p { grid-column: 1 / -1; margin: 0; color: var(--muted); font-size: 0.65rem; line-height: 1.4; opacity: 0.8; }
</style>
