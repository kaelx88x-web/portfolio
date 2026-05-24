<script lang="ts">
  export let rows: Array<{ label: string; targetWeightPct: number; riskContributionPct: number; targetContributionPct: number }> = [];
</script>

<article class="parity">
  <h2>Risk Parity</h2>
  <div class="rows">
    {#each rows.slice(0, 8) as row}
      <div class="row">
        <span>{row.label}</span>
        <strong>{row.riskContributionPct.toFixed(2)}%</strong>
        <i><b style={`width:${Math.min(100, row.riskContributionPct)}%`}></b></i>
      </div>
    {/each}
  </div>
</article>

<style>
  .parity { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  h2 { margin: 0 0 12px; color: var(--text); font-size: 0.9rem; }
  .rows { display: grid; gap: 9px; }
  .row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 8px; color: var(--muted); font-size: 0.72rem; }
  .row strong { color: var(--text); }
  i { grid-column: 1 / -1; height: 5px; border-radius: 999px; background: var(--surface-1); overflow: hidden; }
  b { display: block; height: 100%; border-radius: inherit; background: var(--success); }
</style>
