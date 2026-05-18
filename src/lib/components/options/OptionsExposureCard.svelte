<script lang="ts">
  import type { OptionsExposureReport } from '$lib/services/options-intelligence.service';
  export let exposure: OptionsExposureReport;

  const riskColor = (l: string) => l === 'high' ? 'var(--danger)' : l === 'medium' ? 'var(--warning)' : 'var(--success)';
  const money = (n: number) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
</script>

<article class="card">
  <div class="card-head">
    <div>
      <div class="label">Options Exposure</div>
      <div class="big">{exposure.options_allocation.toFixed(1)}<span class="unit">%</span></div>
    </div>
    <div class="badge" style="--rc:{riskColor(exposure.risk_level)}">{exposure.risk_level.toUpperCase()}</div>
  </div>

  <div class="metrics">
    <div class="metric">
      <span>Put Exposure</span>
      <strong>{money(exposure.put_exposure)}</strong>
    </div>
    <div class="metric">
      <span>Call Exposure</span>
      <strong>{money(exposure.call_exposure)}</strong>
    </div>
    <div class="metric">
      <span>Collateral Locked</span>
      <strong>{money(exposure.collateral_locked)}</strong>
    </div>
    <div class="metric accent">
      <span>Monthly Premium</span>
      <strong>{money(exposure.premium_generated_monthly)}</strong>
    </div>
  </div>

  {#if exposure.warnings.length > 0}
    <ul class="warnings">
      {#each exposure.warnings as w}<li>{w}</li>{/each}
    </ul>
  {/if}

  <p class="note">{exposure.explanation}</p>
</article>

<style>
  .card { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 16px; display: grid; gap: 14px; }

  .card-head { display: flex; justify-content: space-between; align-items: flex-start; }
  .label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; margin-bottom: 4px; }
  .big { font-size: 2.2rem; font-weight: 800; color: var(--text); line-height: 1; }
  .unit { font-size: 1rem; font-weight: 600; color: var(--muted); margin-left: 2px; }
  .badge { font-size: 0.62rem; font-weight: 800; letter-spacing: 0.08em; padding: 4px 10px; border-radius: 999px; background: rgba(from var(--rc) r g b / 0.12); color: var(--rc); border: 1px solid rgba(from var(--rc) r g b / 0.25); }

  .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .metric { border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; }
  .metric.accent { border-color: rgba(var(--success-rgb), 0.3); background: rgba(var(--success-rgb), 0.05); }
  .metric span { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em; }
  .metric strong { display: block; margin-top: 4px; font-size: 0.9rem; color: var(--text); }
  .metric.accent strong { color: var(--success); }

  .warnings { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }
  .warnings li { font-size: 0.72rem; color: var(--warning); padding-left: 14px; position: relative; }
  .warnings li::before { content: '⚠'; position: absolute; left: 0; font-size: 0.65rem; }

  .note { margin: 0; font-size: 0.72rem; color: var(--muted); line-height: 1.5; }
</style>
