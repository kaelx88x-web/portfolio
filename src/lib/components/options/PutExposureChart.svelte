<script lang="ts">
  import type { PutExposureRow } from '$lib/services/options-intelligence.service';
  export let rows: PutExposureRow[] = [];

  const riskClass = (l: string) => l === 'high' ? 'red' : l === 'medium' ? 'amber' : 'green';
  const money = (n: number) => '$' + n.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const cleanSym = (s: string) => s.replace(/^US\./, '');
</script>

<article class="card">
  <div class="card-head">
    <div class="title">Put Exposure</div>
    <div class="count">{rows.length} contract{rows.length !== 1 ? 's' : ''}</div>
  </div>

  {#if rows.length > 0}
    <div class="list">
      {#each rows as row}
        <div class="row">
          <div class="row-top">
            <div class="left">
              <span class="sym">{cleanSym(row.symbol)}</span>
              <span class="strike">${row.strike.toFixed(2)} strike</span>
              <span class="exp">{row.expiration_date}</span>
            </div>
            <div class="right">
              <span class="collateral">{money(row.collateral)}</span>
              <span class="badge {riskClass(row.risk_level)}">{row.risk_level.toUpperCase()}</span>
            </div>
          </div>

          <div class="bar-wrap">
            <div class="bar-fill {riskClass(row.risk_level)}" style="width:{Math.min(100, row.assignment_probability * 100)}%"></div>
          </div>

          <div class="row-meta">
            <span>{(row.assignment_probability * 100).toFixed(0)}% assignment risk</span>
            <span class="sep">·</span>
            <span class="yield">{row.annualized_yield.toFixed(1)}% ann. yield</span>
            <span class="sep">·</span>
            <span>{row.contracts} contract{row.contracts !== 1 ? 's' : ''}</span>
            <span class="sep">·</span>
            <span>Premium {money(row.premium)}</span>
          </div>
        </div>
      {/each}
    </div>
  {:else}
    <div class="empty">No put positions detected.</div>
  {/if}
</article>

<style>
  .card { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 16px; display: grid; gap: 12px; }
  .card-head { display: flex; justify-content: space-between; align-items: center; }
  .title { font-size: 0.78rem; font-weight: 700; color: var(--text); }
  .count { font-size: 0.68rem; color: var(--muted); }

  .list { display: grid; gap: 10px; }
  .row { display: grid; gap: 6px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface-1); }

  .row-top { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
  .left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .right { display: flex; align-items: center; gap: 8px; }

  .sym { font-size: 0.82rem; font-weight: 800; color: var(--text); }
  .strike { font-size: 0.72rem; color: var(--muted); }
  .exp { font-size: 0.68rem; color: var(--muted); }
  .collateral { font-size: 0.8rem; font-weight: 700; color: var(--text); }

  .badge { font-size: 0.58rem; font-weight: 800; letter-spacing: 0.06em; padding: 3px 8px; border-radius: 999px; }
  .badge.red { background: rgba(var(--danger-rgb), 0.12); color: var(--danger); }
  .badge.amber { background: rgba(var(--warning-rgb), 0.12); color: var(--warning); }
  .badge.green { background: rgba(var(--success-rgb), 0.12); color: var(--success); }

  .bar-wrap { height: 5px; border-radius: 999px; background: var(--border); overflow: hidden; }
  .bar-fill { height: 100%; border-radius: 999px; transition: width 0.4s ease; }
  .bar-fill.green { background: var(--success); }
  .bar-fill.amber { background: var(--warning); }
  .bar-fill.red { background: var(--danger); }

  .row-meta { display: flex; flex-wrap: wrap; gap: 4px; font-size: 0.68rem; color: var(--muted); }
  .yield { color: var(--success); font-weight: 700; }
  .sep { opacity: 0.4; }

  .empty { font-size: 0.76rem; color: var(--muted); padding: 16px 0; text-align: center; }
</style>
