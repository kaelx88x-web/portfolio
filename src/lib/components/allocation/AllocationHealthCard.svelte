<script lang="ts">
  import PortfolioStyleBadge from './PortfolioStyleBadge.svelte';
  import type { AllocationHealthReport } from '$lib/services/smart-allocation.service';

  export let health: AllocationHealthReport;

  const levelColor = (l: string) =>
    l === 'critical' ? 'var(--danger)' : l === 'watch' ? 'var(--warning)' : l === 'moderate' ? 'var(--primary)' : 'var(--success)';
</script>

<article class="card">
  <div class="head">
    <div>
      <div class="label">Allocation Health</div>
      <div class="big">{health.allocation_score}<span class="unit">/100</span></div>
    </div>
    <div class="badge" style="--lc:{levelColor(health.health_level)}">{health.health_level}</div>
  </div>

  <div class="bar-wrap">
    <div class="bar-fill" style="width:{health.allocation_score}%"></div>
  </div>

  <div class="metrics">
    <div class="metric">
      <span>Diversification</span>
      <strong>{health.diversification_score}/100</strong>
    </div>
    <div class="metric">
      <span>Cash Efficiency</span>
      <strong>{health.cash_efficiency_score}/100</strong>
    </div>
    <div class="metric">
      <span>Volatility Balance</span>
      <strong>{health.volatility_balance_score}/100</strong>
    </div>
    <div class="metric style-metric">
      <span>Portfolio Style</span>
      <strong><PortfolioStyleBadge style={health.portfolio_style} /></strong>
    </div>
  </div>

  {#if health.warnings.length > 0}
    <ul class="warnings">
      {#each health.warnings.slice(0, 4) as w}<li>{w}</li>{/each}
    </ul>
  {/if}

  <p class="note">{health.explanation}</p>
</article>

<style>
  .card { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 16px; display: grid; gap: 14px; }

  .head { display: flex; justify-content: space-between; align-items: flex-start; }
  .label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; margin-bottom: 4px; }
  .big { font-size: 2.4rem; font-weight: 800; color: var(--text); line-height: 1; }
  .unit { font-size: 1rem; font-weight: 600; color: var(--muted); margin-left: 2px; }
  .badge {
    font-size: 0.62rem; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase;
    padding: 4px 10px; border-radius: 999px;
    background: rgba(from var(--lc) r g b / 0.12);
    color: var(--lc);
    border: 1px solid rgba(from var(--lc) r g b / 0.25);
  }

  .bar-wrap { height: 6px; border-radius: 999px; background: var(--surface-1); overflow: hidden; }
  .bar-fill { height: 100%; border-radius: inherit; background: linear-gradient(90deg, var(--danger), var(--warning) 50%, var(--success)); transition: width 0.4s ease; }

  .metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .metric { border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px; }
  .metric span { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em; }
  .metric strong { display: block; margin-top: 5px; font-size: 0.9rem; color: var(--text); }
  .style-metric strong { display: flex; margin-top: 5px; }

  .warnings { margin: 0; padding: 0; list-style: none; display: grid; gap: 4px; }
  .warnings li { font-size: 0.72rem; color: var(--warning); padding-left: 16px; position: relative; line-height: 1.4; }
  .warnings li::before { content: '⚠'; position: absolute; left: 0; font-size: 0.65rem; }

  .note { margin: 0; font-size: 0.72rem; color: var(--muted); line-height: 1.5; }
</style>
