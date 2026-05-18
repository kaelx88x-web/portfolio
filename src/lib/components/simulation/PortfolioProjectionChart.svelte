<script lang="ts">
  import type { PortfolioProjection } from '$lib/services/scenario-simulation.service';

  export let projection: PortfolioProjection;

  function money(value: number) {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }
</script>

<article class="projection">
  <div class="head">
    <div>
      <span>Portfolio Projection</span>
      <h2>Expected Value Range</h2>
    </div>
    <strong>{projection.expected_annual_return.toFixed(2)}%</strong>
  </div>
  <div class="points">
    {#each projection.points as point}
      {@const range = point.upsideValue - point.downsideValue}
      {@const position = range > 0 ? Math.min(92, Math.max(8, ((point.expectedValue - point.downsideValue) / range) * 100)) : 50}
      <div class="point">
        <div class="point-head">
          <span>{point.label}</span>
          <strong>{money(point.expectedValue)}</strong>
        </div>
        <div class="range">
          <small class="down">{money(point.downsideValue)}</small>
          <i><b style={`width:${position}%`}></b></i>
          <small class="up">{money(point.upsideValue)}</small>
        </div>
        <div class="range-label"><span>Worst case</span><span>Best case</span></div>
      </div>
    {/each}
  </div>
  <p>{projection.ai_explanation}</p>
</article>

<style>
  .projection { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 12px; }
  .head { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
  .head span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  h2 { margin: 3px 0 0; color: var(--text); font-size: 0.95rem; }
  .head strong { color: var(--primary); font-size: 0.95rem; }
  .points { display: grid; gap: 10px; }
  .point { border: 1px solid var(--border); border-radius: 8px; background: var(--surface-1); padding: 10px; display: grid; gap: 6px; }
  .point-head { display: flex; justify-content: space-between; align-items: baseline; gap: 10px; }
  .point-head span { color: var(--muted); font-size: 0.68rem; font-weight: 800; text-transform: uppercase; }
  .point-head strong { color: var(--text); font-size: 0.88rem; }
  .range { display: grid; grid-template-columns: 5.5rem minmax(0, 1fr) 5.5rem; gap: 8px; align-items: center; }
  .range-label { display: flex; justify-content: space-between; font-size: 0.58rem; color: var(--muted); opacity: 0.6; }
  small { color: var(--muted); font-size: 0.64rem; }
  small.up { text-align: right; }
  i { height: 7px; border-radius: 999px; background: var(--border); overflow: hidden; }
  b { display: block; height: 100%; border-radius: inherit; background: var(--primary); }
  p { margin: 0; color: var(--muted); font-size: 0.74rem; line-height: 1.5; }
</style>
