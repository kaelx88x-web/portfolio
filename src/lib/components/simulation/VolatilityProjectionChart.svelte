<script lang="ts">
  import type { ProjectionPoint } from '$lib/services/scenario-simulation.service';

  export let points: ProjectionPoint[] = [];

  // Annual volatility is constant across all horizons.
  // The uncertainty RANGE (upside − downside) widens over time via √t scaling.
  $: annualVol = points[0]?.volatilityPct ?? 0;
  $: volLevel = annualVol >= 50 ? 'high' : annualVol >= 25 ? 'medium' : 'low';
  $: volLabel = volLevel === 'high' ? 'High' : volLevel === 'medium' ? 'Moderate' : 'Low';

  function pct(value: number) {
    return `${value.toFixed(1)}%`;
  }

  function money(value: number) {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }
</script>

<article class="vol">
  <div class="head">
    <div>
      <span>Volatility Forecast</span>
      <h2>Annual Volatility</h2>
    </div>
    <div class="badge" class:high={volLevel === 'high'} class:medium={volLevel === 'medium'}>
      {volLabel} · {pct(annualVol)}
    </div>
  </div>

  <div class="rows">
    {#each points as point}
      {@const rangeWidth = point.upsideValue - point.downsideValue}
      {@const barPct = Math.min(100, (rangeWidth / Math.max(point.expectedValue, 1)) * 33)}
      <div class="row">
        <div class="meta">
          <span>{point.label}</span>
          <strong>{money(point.downsideValue)} – {money(point.upsideValue)}</strong>
        </div>
        <i><b style={`width:${barPct}%`}></b></i>
        <div class="sub">Outcome range width: {pct((rangeWidth / Math.max(point.expectedValue, 1)) * 100)}</div>
      </div>
    {/each}
  </div>

  <p>Annual volatility stays constant at {pct(annualVol)} — the outcome range widens over longer horizons because uncertainty accumulates over time.</p>
</article>

<style>
  .vol { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 12px; }
  .head { display: flex; justify-content: space-between; align-items: start; gap: 12px; }
  .head > div:first-child { display: grid; gap: 3px; }
  .head span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  h2 { margin: 0; color: var(--text); font-size: 0.95rem; }
  .badge { border-radius: 999px; padding: 4px 11px; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; border: 1px solid rgba(var(--success-rgb), 0.28); color: var(--success); background: rgba(var(--success-rgb), 0.08); white-space: nowrap; }
  .badge.medium { border-color: rgba(var(--warning-rgb), 0.28); color: var(--warning); background: rgba(var(--warning-rgb), 0.08); }
  .badge.high { border-color: rgba(var(--danger-rgb), 0.28); color: var(--danger); background: rgba(var(--danger-rgb), 0.08); }
  .rows { display: grid; gap: 10px; }
  .row { display: grid; gap: 4px; }
  .meta { display: flex; justify-content: space-between; gap: 10px; font-size: 0.72rem; }
  .meta span { color: var(--muted); }
  .meta strong { color: var(--text); font-size: 0.68rem; }
  i { display: block; height: 6px; border-radius: 999px; overflow: hidden; background: var(--surface-1); }
  b { display: block; height: 100%; border-radius: inherit; background: var(--primary); }
  .sub { font-size: 0.6rem; color: var(--muted); opacity: 0.7; }
  p { margin: 0; color: var(--muted); font-size: 0.72rem; line-height: 1.5; }
</style>
