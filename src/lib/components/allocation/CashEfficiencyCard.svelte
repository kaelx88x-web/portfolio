<script lang="ts">
  export let score = 0;
  export let cashPct = 0;

  $: cashColor = cashPct < 5 ? 'var(--danger)' : cashPct > 30 ? 'var(--warning)' : 'var(--success)';
  $: cashStatus = cashPct < 5 ? 'low' : cashPct > 30 ? 'high' : 'ok';
</script>

<article class="card">
  <div class="top">
    <span class="label">Cash Efficiency</span>
    <div class="badge" style="--c:{cashColor}">{cashStatus}</div>
  </div>
  <div class="row">
    <div class="metric">
      <span>Score</span>
      <strong>{score}/100</strong>
    </div>
    <div class="metric accent" style="--c:{cashColor}">
      <span>Cash Reserve</span>
      <strong style="color:{cashColor}">{cashPct.toFixed(1)}%</strong>
    </div>
  </div>
  <p class="hint">
    {#if cashPct < 5}Under 5% — restore liquidity buffer to reduce forced-action risk.
    {:else if cashPct > 30}Over 30% — excess cash may be dragging returns.
    {:else}Reserve is within the 5–30% allocation target range.{/if}
  </p>
</article>

<style>
  .card { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 14px 16px; display: grid; gap: 10px; }
  .top { display: flex; justify-content: space-between; align-items: center; }
  .label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; }
  .badge {
    font-size: 0.58rem; font-weight: 800; letter-spacing: 0.06em; text-transform: uppercase;
    padding: 3px 8px; border-radius: 999px;
    background: rgba(from var(--c) r g b / 0.12);
    color: var(--c);
    border: 1px solid rgba(from var(--c) r g b / 0.25);
  }
  .row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
  .metric { border: 1px solid var(--border); border-radius: 8px; padding: 9px 11px; }
  .metric.accent { border-color: rgba(from var(--c) r g b / 0.3); background: rgba(from var(--c) r g b / 0.05); }
  .metric span { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em; }
  .metric strong { display: block; margin-top: 4px; font-size: 0.9rem; color: var(--text); }
  .hint { margin: 0; font-size: 0.7rem; color: var(--muted); line-height: 1.45; }
</style>
