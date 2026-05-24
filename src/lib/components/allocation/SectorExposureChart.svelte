<script lang="ts">
  import type { ExposureRow } from '$lib/services/smart-allocation.service';

  export let rows: ExposureRow[] = [];
  export let title = 'Exposure';

  const riskColor = (r: string) => r === 'high' ? 'var(--danger)' : r === 'medium' ? 'var(--warning)' : 'var(--primary)';
</script>

<article class="card">
  <div class="head">
    <span class="label">{title}</span>
    <span class="count">{rows.length} item{rows.length !== 1 ? 's' : ''}</span>
  </div>
  {#if rows.length === 0}
    <p class="empty">No exposure data available.</p>
  {:else}
    <div class="rows">
      {#each rows.slice(0, 8) as row}
        {@const c = riskColor(row.risk_level)}
        <div class="row">
          <div class="meta">
            <span>{row.label}</span>
            <strong style="color:{c}">{row.percentage.toFixed(1)}%</strong>
          </div>
          <div class="bar-wrap">
            <div class="bar-fill" style="width:{Math.min(100, row.percentage)}%; background:{c}"></div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</article>

<style>
  .card { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 14px 16px; display: grid; gap: 12px; }
  .head { display: flex; justify-content: space-between; align-items: center; }
  .label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; }
  .count { font-size: 0.62rem; color: var(--muted); }
  .empty { margin: 0; font-size: 0.74rem; color: var(--muted); }
  .rows { display: grid; gap: 9px; }
  .row { display: grid; gap: 5px; }
  .meta { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .meta span { font-size: 0.76rem; color: var(--text); }
  .meta strong { font-size: 0.76rem; font-weight: 700; white-space: nowrap; }
  .bar-wrap { height: 5px; border-radius: 999px; background: var(--surface-1); overflow: hidden; }
  .bar-fill { height: 100%; border-radius: inherit; transition: width 0.3s ease; opacity: 0.75; }
</style>
