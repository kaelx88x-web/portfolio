<script lang="ts">
  import EmptyState from '../EmptyState.svelte';

  type WatchItem = {
    id: string;
    symbol: string;
    name?: string;
    price?: number;
    dayChange?: number;
    dayChangePct?: number;
    conviction?: string;
    notes?: string;
  };

  export let items: WatchItem[] = [];
  export let loading = false;
  export let compact = false;
</script>

{#if loading}
  <div style="padding:16px;color:var(--muted);font-size:0.8rem">Loading…</div>
{:else if items.length === 0}
  <EmptyState
    icon="◎"
    title="Watchlist is empty"
    description="Add symbols to track ideas before they become holdings."
  />
{:else if compact}
  <div class="wl-list">
    {#each items as item}
      <div class="wl-row">
        <div class="wl-row-left">
          <span class="wl-symbol">{item.symbol}</span>
          {#if item.name}<span class="wl-name">{item.name}</span>{/if}
        </div>
        <div class="wl-row-right">
          {#if item.price != null}
            <span class="wl-price">${item.price.toFixed(2)}</span>
          {/if}
          {#if item.dayChangePct != null}
            <span class="wl-change" class:positive={item.dayChangePct >= 0} class:negative={item.dayChangePct < 0}>
              {item.dayChangePct >= 0 ? '+' : ''}{item.dayChangePct.toFixed(2)}%
            </span>
          {/if}
          {#if item.conviction}
            <span class="wl-conviction" data-lvl={item.conviction.toLowerCase()}>{item.conviction}</span>
          {/if}
        </div>
      </div>
    {/each}
  </div>
{:else}
  <div class="wl-grid">
    {#each items as item}
      <div class="wl-card">
        <div class="wl-top">
          <span class="wl-symbol">{item.symbol}</span>
          {#if item.conviction}
            <span class="wl-conviction" data-lvl={item.conviction.toLowerCase()}>{item.conviction}</span>
          {/if}
        </div>
        {#if item.name}<div class="wl-name">{item.name}</div>{/if}
        {#if item.price != null}
          <div class="wl-price">${item.price.toFixed(2)}</div>
          {#if item.dayChangePct != null}
            <div class="wl-change" class:positive={item.dayChangePct >= 0} class:negative={item.dayChangePct < 0}>
              {item.dayChangePct >= 0 ? '+' : ''}{item.dayChangePct.toFixed(2)}%
            </div>
          {/if}
        {/if}
        {#if item.notes}<p class="wl-notes">{item.notes}</p>{/if}
      </div>
    {/each}
  </div>
{/if}

<style>
  /* Compact list mode (dashboard widget) */
  .wl-list { display: flex; flex-direction: column; }
  .wl-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 9px 4px;
    border-bottom: 1px solid var(--border);
    gap: 12px;
  }
  .wl-row:last-child { border-bottom: none; }
  .wl-row-left  { display: flex; align-items: center; gap: 8px; min-width: 0; }
  .wl-row-right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }

  /* Card grid mode (full watchlist page) */
  .wl-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:12px; }
  .wl-card { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:4px; }
  .wl-top  { display:flex; align-items:center; justify-content:space-between; }

  /* Shared */
  .wl-symbol { font-size:0.85rem; font-weight:700; color:var(--primary); flex-shrink: 0; }
  .wl-name   { font-size:0.72rem; color:var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .wl-price  { font-size:0.85rem; font-weight:700; color:var(--text); }
  .wl-change { font-size:0.72rem; font-weight:600; }
  .wl-notes  { font-size:0.7rem; color:var(--muted); margin:4px 0 0; line-height:1.5; }
  .wl-conviction { font-size:0.55rem; font-weight:700; padding:2px 7px; border-radius:20px; text-transform:uppercase; }
  [data-lvl="high"]   { background:rgba(var(--success-rgb),0.12); color:var(--success); }
  [data-lvl="medium"] { background:rgba(var(--warning-rgb),0.12); color:var(--warning); }
  [data-lvl="low"]    { background:rgba(var(--primary-rgb),0.08); color:var(--muted); }
  .positive { color:var(--success); }
  .negative { color:var(--danger); }
</style>
