<script lang="ts">
  import type { OptimizationAllocation } from '$lib/services/optimization-engine.service';

  export let allocation: OptimizationAllocation[] = [];

  $: rows = allocation.slice(0, 10).map((r) => ({
    ...r,
    delta: r.targetPct - r.currentPct,
    maxPct: Math.max(r.currentPct, r.targetPct, 1)
  }));
  $: maxPct = Math.max(1, ...rows.map((r) => r.maxPct));
</script>

<article class="card">
  <div class="head">
    <div>
      <span class="label">Allocation Comparison</span>
      <p class="sub">Current vs. scenario target per holding</p>
    </div>
    <div class="legend">
      <span class="dot current"></span>Current
      <span class="dot target"></span>Target
    </div>
  </div>

  <div class="rows">
    {#each rows as row}
      {@const delta = row.delta}
      <div class="row">
        <div class="row-meta">
          <span class="sym">{row.label}</span>
          <span class="delta" class:up={delta > 0.05} class:down={delta < -0.05} class:flat={Math.abs(delta) <= 0.05}>
            {#if Math.abs(delta) > 0.05}{delta > 0 ? '▲' : '▼'} {Math.abs(delta).toFixed(1)}%{:else}—{/if}
          </span>
        </div>
        <div class="bars">
          <div class="bar-row">
            <span class="bar-label">Now</span>
            <div class="bar-wrap">
              <div class="bar current" style="width:{(row.currentPct / maxPct) * 100}%"></div>
            </div>
            <span class="bar-val">{row.currentPct.toFixed(1)}%</span>
          </div>
          <div class="bar-row">
            <span class="bar-label">Target</span>
            <div class="bar-wrap">
              <div class="bar target" style="width:{(row.targetPct / maxPct) * 100}%"></div>
            </div>
            <span class="bar-val">{row.targetPct.toFixed(1)}%</span>
          </div>
        </div>
      </div>
    {/each}
  </div>
</article>

<style>
  .card { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 16px; display: grid; gap: 14px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
  .label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; }
  .sub { margin: 3px 0 0; font-size: 0.68rem; color: var(--muted); }
  .legend { display: flex; align-items: center; gap: 6px; font-size: 0.65rem; color: var(--muted); flex-wrap: wrap; justify-content: flex-end; }
  .dot { width: 10px; height: 4px; border-radius: 999px; display: inline-block; }
  .dot.current { background: var(--muted); opacity: 0.6; }
  .dot.target { background: var(--primary); }

  .rows { display: grid; gap: 10px; }
  .row { display: grid; gap: 5px; }
  .row-meta { display: flex; justify-content: space-between; align-items: center; }
  .sym { font-size: 0.76rem; font-weight: 600; color: var(--text); }
  .delta { font-size: 0.68rem; font-weight: 700; color: var(--muted); }
  .delta.up { color: var(--success); }
  .delta.down { color: var(--danger); }
  .delta.flat { opacity: 0.4; }

  .bars { display: grid; gap: 3px; }
  .bar-row { display: grid; grid-template-columns: 3rem 1fr 3rem; align-items: center; gap: 6px; }
  .bar-label { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; color: var(--muted); letter-spacing: 0.04em; text-align: right; }
  .bar-wrap { height: 6px; border-radius: 999px; background: var(--surface-1); overflow: hidden; }
  .bar { height: 100%; border-radius: inherit; transition: width 0.3s ease; }
  .bar.current { background: var(--muted); opacity: 0.55; }
  .bar.target { background: var(--primary); }
  .bar-val { font-size: 0.65rem; color: var(--muted); }
</style>
