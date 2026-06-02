<!-- PositionActions.svelte -->
<script lang="ts">
  import { invalidateAll, goto } from '$app/navigation';
  import { enhance } from '$app/forms';
  import type { StockDetailVM } from '$lib/services/stock-detail.service';
  export let detail: StockDetailVM;
  export let onAdd: () => void = () => {};
  $: pos = detail.position;
</script>
<div class="pa">
  <div class="pa-h">Your Position</div>
  {#if pos}
    <div class="pa-row"><span>Shares</span><b>{pos.owned}</b></div>
    <div class="pa-row"><span>Avg cost</span><b>{pos.avgCost.toFixed(2)}</b></div>
    <div class="pa-row"><span>Market value</span><b>{pos.marketValue.toFixed(2)}</b></div>
    <div class="pa-row"><span>Unrealized P/L</span><b class:up={pos.unrealizedPnl>=0} class:down={pos.unrealizedPnl<0}>{pos.unrealizedPnl>=0?'+':''}{pos.unrealizedPnl.toFixed(2)}</b></div>
  {:else}
    <p class="pa-empty">You don't hold {detail.asset.symbol}.</p>
  {/if}
  <div class="pa-actions">
    <button class="btn primary" on:click={onAdd}>Add to portfolio</button>
    <button class="btn" on:click={() => goto(`/paper-trading?symbol=${encodeURIComponent(detail.asset.symbol)}`)}>Paper trade</button>
    <form method="POST" action="?/toggleWatchlist" use:enhance={() => async ({ update }) => { await update(); await invalidateAll(); }}>
      <input type="hidden" name="assetId" value={detail.asset.id} />
      <button class="btn ghost" type="submit">{detail.watchlisted ? '★ Watchlisted' : '☆ Watchlist'}</button>
    </form>
  </div>
</div>
<style>
  .pa { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:14px; }
  .pa-h { font-size:.7rem; font-weight:600; color:var(--text); margin-bottom:8px; }
  .pa-row { display:flex; justify-content:space-between; font-size:.78rem; color:var(--muted); padding:3px 0; }
  .pa-row b.up { color:#39d98a; } .pa-row b.down { color:#f6685e; }
  .pa-empty { font-size:.74rem; color:var(--muted); }
  .pa-actions { display:flex; flex-direction:column; gap:6px; margin-top:10px; }
  .btn { font-size:.74rem; font-weight:600; padding:7px; border-radius:7px; border:1px solid var(--border); background:none; color:var(--text); cursor:pointer; }
  .btn.primary { background:var(--primary); color:#fff; border-color:var(--primary); }
  .btn.ghost { color:var(--muted); }
  .pa-actions form { margin:0; }
</style>
