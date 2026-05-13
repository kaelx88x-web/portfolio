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
</script>

{#if loading}
  <div style="padding:16px;color:#7a8fb0;font-size:0.8rem">Loading…</div>
{:else if items.length === 0}
  <EmptyState
    icon="◎"
    title="Watchlist is empty"
    description="Add symbols to track ideas before they become holdings."
  />
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
  .wl-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(180px,1fr)); gap:12px; }
  .wl-card { background:#0f1523; border:1px solid #1a2038; border-radius:10px; padding:14px; display:flex; flex-direction:column; gap:4px; }
  .wl-top  { display:flex; align-items:center; justify-content:space-between; }
  .wl-symbol { font-size:0.9rem; font-weight:700; color:#6c8fff; }
  .wl-name   { font-size:0.7rem; color:#7a8fb0; }
  .wl-price  { font-size:1rem; font-weight:700; color:#dce8ff; margin-top:4px; }
  .wl-change { font-size:0.72rem; font-weight:600; }
  .wl-notes  { font-size:0.7rem; color:#7a8fb0; margin:4px 0 0; line-height:1.5; }
  .wl-conviction { font-size:0.55rem; font-weight:700; padding:2px 7px; border-radius:20px; text-transform:uppercase; }
  [data-lvl="high"]   { background:rgba(45,212,160,0.12); color:#2dd4a0; }
  [data-lvl="medium"] { background:rgba(251,191,36,0.1);  color:#fbbf24; }
  [data-lvl="low"]    { background:rgba(122,143,176,0.1); color:#7a8fb0; }
  .positive { color:#2dd4a0; }
  .negative { color:#f96b7e; }
</style>
