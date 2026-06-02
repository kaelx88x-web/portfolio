<!-- BidAsk.svelte -->
<script lang="ts">
  import type { StockDetailVM } from '$lib/services/stock-detail.service';
  import Unavailable from './Unavailable.svelte';
  export let bidAsk: StockDetailVM['bidAsk'];
</script>
{#if bidAsk.status === 'ok' && bidAsk.data && (bidAsk.data.bid != null || bidAsk.data.ask != null)}
  <div class="ba">
    <div class="ba-c"><span>Bid</span><b class="bid">{bidAsk.data.bid?.toFixed(2) ?? '—'}</b></div>
    <div class="ba-c"><span>Ask</span><b class="ask">{bidAsk.data.ask?.toFixed(2) ?? '—'}</b></div>
  </div>
{:else}<Unavailable label="Bid / Ask" />{/if}
<style>
  .ba { display:flex; gap:8px; }
  .ba-c { flex:1; background:var(--card); border:1px solid var(--border); border-radius:10px; padding:12px; text-align:center; }
  .ba-c span { font-size:.6rem; color:var(--muted); text-transform:uppercase; }
  .ba-c b { display:block; font-size:1rem; } .bid { color:#39d98a; } .ask { color:#f6685e; }
</style>
