<script lang="ts">
  import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-svelte';
  import type { ScenarioSimulationResult } from '$lib/services/scenario-simulation.service';

  export let result: ScenarioSimulationResult;

  // Filter out option contracts (negative projected pct) from allocation display
  $: visibleAllocation = result.allocation
    .filter((row) => row.projectedPct > 0 && !/\d{6}[CP]\d+/.test(row.label))
    .slice(0, 6);
</script>

<article class="card">
  <div class="head">
    <div>
      <span class="eyebrow">{result.riskSummary.risk_level} risk</span>
      <h2>{result.scenarioName}</h2>
    </div>
    <span class:risk-high={result.riskSummary.risk_level === 'high'} class:risk-medium={result.riskSummary.risk_level === 'medium'} class="score">
      {result.riskSummary.scenario_risk_score}/100
    </span>
  </div>

  <div class="metrics">
    <div>
      <TrendingUp size={15} />
      <span>Return</span>
      <strong class:pos={result.projectedReturn > 0} class:neg={result.projectedReturn < 0}>
        {result.projectedReturn > 0 ? '+' : ''}{result.projectedReturn.toFixed(2)}%
      </strong>
    </div>
    <div>
      <AlertTriangle size={15} />
      <span>Volatility</span>
      <strong>{result.projectedVolatility.toFixed(2)}%</strong>
    </div>
    <div>
      <TrendingDown size={15} />
      <span>Drawdown</span>
      <strong class:neg={result.projectedDrawdown < 0}>{result.projectedDrawdown.toFixed(2)}%</strong>
    </div>
  </div>

  <p>{result.riskSummary.ai_explanation}</p>

  {#if visibleAllocation.length > 0}
    <div class="allocations">
      {#each visibleAllocation as row}
        <div class="allocation-row">
          <div class="meta">
            <span>{row.label}</span>
            <strong>{row.projectedPct.toFixed(1)}%</strong>
          </div>
          <i><b style={`width:${Math.min(100, row.projectedPct)}%`}></b></i>
        </div>
      {/each}
    </div>
  {/if}
</article>

<style>
  .card { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 12px; }
  .head { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
  .eyebrow { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  h2 { margin: 3px 0 0; color: var(--text); font-size: 0.95rem; }
  .score { border: 1px solid rgba(var(--success-rgb), 0.28); border-radius: 999px; color: var(--success); background: rgba(var(--success-rgb), 0.08); padding: 4px 8px; font-size: 0.72rem; font-weight: 800; white-space: nowrap; }
  .score.risk-medium { border-color: rgba(var(--warning-rgb), 0.28); color: var(--warning); background: rgba(var(--warning-rgb), 0.08); }
  .score.risk-high { border-color: rgba(var(--danger-rgb), 0.28); color: var(--danger); background: rgba(var(--danger-rgb), 0.08); }
  .metrics { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
  .metrics div { border: 1px solid var(--border); border-radius: 8px; background: var(--surface-1); padding: 10px; display: grid; gap: 5px; color: var(--muted); font-size: 0.68rem; min-width: 0; }
  .metrics strong { color: var(--text); font-size: 0.86rem; }
  .metrics strong.pos { color: var(--success); }
  .metrics strong.neg { color: var(--danger); }
  p { margin: 0; color: var(--muted); font-size: 0.74rem; line-height: 1.5; }
  .allocations { display: grid; gap: 8px; }
  .allocation-row { display: grid; gap: 5px; }
  .meta { display: flex; justify-content: space-between; gap: 10px; color: var(--muted); font-size: 0.7rem; }
  .meta span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .meta strong { color: var(--text); flex-shrink: 0; }
  i { height: 6px; border-radius: 999px; overflow: hidden; background: var(--surface-1); }
  b { display: block; height: 100%; border-radius: inherit; background: var(--primary); }
  @media (max-width: 720px) { .metrics { grid-template-columns: 1fr; } }
</style>
