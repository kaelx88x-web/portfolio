<script lang="ts">
  import type { SimulationRiskSummary } from '$lib/services/scenario-simulation.service';

  export let title = 'Risk Score';
  export let summary: SimulationRiskSummary;

  $: score = Math.min(100, Math.max(0, summary.scenario_risk_score));
  $: barColor = summary.risk_level === 'high' ? 'var(--danger)' : summary.risk_level === 'medium' ? 'var(--warning)' : 'var(--success)';
  $: factors = summary.risk_factors ?? [];
</script>

<article class="risk">
  <span>{title}</span>
  <div class="score-row">
    <strong>{score}/100</strong>
    <div class="badge" class:high={summary.risk_level === 'high'} class:medium={summary.risk_level === 'medium'}>
      {summary.risk_level === 'high' ? 'High Risk' : summary.risk_level === 'medium' ? 'Moderate' : 'Low Risk'}
    </div>
  </div>
  <div class="bar-track">
    <div class="bar-fill" style={`width:${score}%; background:${barColor}`}></div>
  </div>

  {#if factors.length > 0}
    <div class="factors">
      <div class="factors-head">Risk Factors</div>
      {#each factors as factor}
        <div class="factor" class:fhigh={factor.severity === 'high'} class:fmedium={factor.severity === 'medium'}>
          <span class="dot"></span>
          <div class="factor-body">
            <strong>{factor.label}</strong>
            <span>{factor.value}</span>
          </div>
        </div>
      {/each}
    </div>
  {/if}

  <p>{summary.suggested_action}</p>
</article>

<style>
  .risk { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 10px; }
  span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  .score-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
  strong { color: var(--text); font-size: 1.3rem; }
  .badge { border-radius: 999px; padding: 3px 10px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; border: 1px solid rgba(var(--success-rgb), 0.28); color: var(--success); background: rgba(var(--success-rgb), 0.08); }
  .badge.medium { border-color: rgba(var(--warning-rgb), 0.28); color: var(--warning); background: rgba(var(--warning-rgb), 0.08); }
  .badge.high { border-color: rgba(var(--danger-rgb), 0.28); color: var(--danger); background: rgba(var(--danger-rgb), 0.08); }
  .bar-track { height: 8px; border-radius: 999px; background: var(--border); overflow: hidden; }
  .bar-fill { height: 100%; border-radius: inherit; transition: width 0.3s ease; }

  .factors { display: grid; gap: 6px; border: 1px solid var(--border); border-radius: 6px; padding: 10px; background: var(--bg); }
  .factors-head { font-size: 0.58rem; font-weight: 800; text-transform: uppercase; color: var(--muted); margin-bottom: 2px; }
  .factor { display: flex; align-items: start; gap: 8px; }
  .dot { flex-shrink: 0; width: 6px; height: 6px; border-radius: 50%; margin-top: 4px; background: var(--success); }
  .factor.fmedium .dot { background: var(--warning); }
  .factor.fhigh .dot { background: var(--danger); }
  .factor-body { display: grid; gap: 1px; }
  .factor-body strong { font-size: 0.72rem; font-weight: 700; color: var(--text); }
  .factor-body span { font-size: 0.66rem; font-weight: 400; color: var(--muted); text-transform: none; }

  p { margin: 0; color: var(--muted); font-size: 0.74rem; line-height: 1.5; }
</style>
