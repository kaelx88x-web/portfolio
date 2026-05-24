<script lang="ts">
  import type { DynamicPortfolioMode } from '$lib/services/strategy-orchestrator.service';

  export let mode: DynamicPortfolioMode;

  $: rows = [
    { label: 'Income', value: mode.incomeWeight },
    { label: 'Growth', value: mode.growthWeight },
    { label: 'Defensive', value: mode.defensiveWeight },
    { label: 'Options', value: mode.optionsWeight }
  ];
</script>

<article class="chart">
  <span>Income vs Growth Balance</span>
  <h2>{mode.label}</h2>
  <div class="rows">
    {#each rows as row}
      <div class="row">
        <div><span>{row.label}</span><strong>{row.value}%</strong></div>
        <i><b style={`width:${row.value}%`}></b></i>
      </div>
    {/each}
  </div>
  <p>{mode.explanation}</p>
</article>

<style>
  .chart { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 12px; }
  .chart > span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  h2 { margin: -8px 0 0; color: var(--text); font-size: 0.95rem; }
  .rows { display: grid; gap: 9px; }
  .row div { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 5px; }
  .row span { color: var(--muted); font-size: 0.72rem; }
  .row strong { color: var(--text); font-size: 0.72rem; }
  i { display: block; height: 7px; border-radius: 999px; background: var(--surface-1); overflow: hidden; }
  b { display: block; height: 100%; border-radius: inherit; background: var(--primary); }
  p { margin: 0; color: var(--muted); font-size: 0.74rem; line-height: 1.5; }
</style>
