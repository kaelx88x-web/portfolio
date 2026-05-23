<!-- src/lib/components/optimization/BehavioralScenarioWeights.svelte -->
<script lang="ts">
  import type { ScenarioWeights } from '$lib/services/behavioral-profile.service';
  export let weights: ScenarioWeights;
</script>

<div class="panel">
  <div class="panel-head">Pemberat Scenario Optimizer (Dicadangkan)</div>

  <div class="weights-grid">
    <div class="weight-card danger">
      <span class="wlabel">Aggressive</span>
      <strong class="wpct">{weights.aggressive}%</strong>
    </div>
    <div class="weight-card primary">
      <span class="wlabel">Balanced</span>
      <strong class="wpct">{weights.balanced}%</strong>
    </div>
    <div class="weight-card success">
      <span class="wlabel">Conservative</span>
      <strong class="wpct">{weights.conservative}%</strong>
    </div>
  </div>

  <div class="params-grid">
    <div class="param-card">
      <span class="plabel">Cash floor minimum</span>
      <strong class="pval">{weights.cashFloorPct}% <span class="note">(bukan {weights.cashFloorPct === 3 ? 5 : weights.cashFloorPct === 10 ? 5 : 3}%)</span></strong>
    </div>
    <div class="param-card">
      <span class="plabel">Goal default</span>
      <strong class="pval">{weights.goalDefault}</strong>
    </div>
    <div class="param-card">
      <span class="plabel">Rebalance trigger</span>
      <strong class="pval">{weights.rebalanceTrigger}</strong>
    </div>
  </div>

  <small class="guardrail">Cadangan sahaja — tidak mengubah optimization constraints secara automatik.</small>
</div>

<style>
  .panel {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--card);
    padding: 16px;
    display: grid;
    gap: 14px;
  }
  .panel-head {
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }

  /* Weight cards */
  .weights-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .weight-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    padding: 12px 14px;
    display: grid;
    gap: 4px;
    text-align: center;
  }
  .wlabel { color: var(--muted); font-size: 0.66rem; font-weight: 700; text-transform: uppercase; }
  .wpct   { font-size: 1.25rem; font-weight: 800; }
  .weight-card.danger  .wpct { color: var(--danger); }
  .weight-card.primary .wpct { color: var(--primary); }
  .weight-card.success .wpct { color: var(--success); }

  /* Parameter cards */
  .params-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .param-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    padding: 12px 14px;
    display: grid;
    gap: 4px;
  }
  .plabel { color: var(--muted); font-size: 0.62rem; font-weight: 700; text-transform: uppercase; }
  .pval   { color: var(--text); font-size: 0.78rem; font-weight: 700; }
  .note   { color: var(--muted); font-size: 0.65rem; font-weight: 400; }

  small.guardrail { color: var(--warning); font-size: 0.65rem; }
</style>
