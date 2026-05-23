<!-- src/lib/components/optimization/BehavioralDimensionScores.svelte -->
<script lang="ts">
  import type { BehavioralDimension } from '$lib/services/behavioral-profile.service';
  export let dimensions: BehavioralDimension[];
</script>

<div class="panel">
  <div class="panel-head">Skor Dimensi</div>
  <div class="rows">
    {#each dimensions as dim}
      <div class="row">
        <span class="dim-label">{dim.label}</span>
        <div class="bar-wrap">
          <div
            class="bar-fill {dim.color}"
            style="width: {dim.score}%"
          ></div>
        </div>
        <span class="pct {dim.color}">{dim.score}%</span>
      </div>
    {/each}
  </div>
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
  .rows   { display: grid; gap: 12px; }
  .row    { display: grid; grid-template-columns: 1fr 1fr auto; align-items: center; gap: 10px; }
  .dim-label { color: var(--text); font-size: 0.74rem; font-weight: 600; }
  .bar-wrap  { height: 8px; background: var(--border); border-radius: 999px; overflow: hidden; }
  .bar-fill  { height: 100%; border-radius: 999px; transition: width 0.5s ease; }
  .bar-fill.red   { background: var(--danger); }
  .bar-fill.amber { background: var(--warning); }
  .bar-fill.green { background: var(--success); }
  .pct { font-size: 0.74rem; font-weight: 800; text-align: right; }
  .pct.red   { color: var(--danger); }
  .pct.amber { color: var(--warning); }
  .pct.green { color: var(--success); }
</style>
