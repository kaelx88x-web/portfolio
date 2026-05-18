<script lang="ts">
  import type { SimulationRiskSummary } from '$lib/services/scenario-simulation.service';

  export let title = 'Risk Score';
  export let summary: SimulationRiskSummary;

  $: score = Math.min(100, Math.max(0, summary.scenario_risk_score));
  $: barColor = summary.risk_level === 'high' ? 'var(--danger)' : summary.risk_level === 'medium' ? 'var(--warning)' : 'var(--success)';
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
  p { margin: 0; color: var(--muted); font-size: 0.74rem; line-height: 1.5; }
</style>
