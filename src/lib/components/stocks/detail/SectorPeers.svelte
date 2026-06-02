<!-- SectorPeers.svelte -->
<script lang="ts">
  import type { StockDetailVM } from '$lib/services/stock-detail.service';
  import Unavailable from './Unavailable.svelte';
  export let peers: StockDetailVM['peers'];
  const code = (c: string) => c.includes('.') ? c.split('.')[1] : c;
</script>
{#if peers.status === 'ok' && peers.data?.length}
  <div class="pe">
    <div class="pe-h">Sector Peers</div>
    {#each peers.data as p}
      <a class="pe-row" href={`/stocks/${encodeURIComponent(code(p.symbol))}`}>
        <span class="pe-sym">{code(p.symbol)}</span>
        <span class="pe-name">{p.name}</span>
        <span class="pe-chg" class:up={(p.changePct??0)>=0} class:down={(p.changePct??0)<0}>{p.changePct==null?'—':(p.changePct>=0?'+':'')+p.changePct.toFixed(2)+'%'}</span>
      </a>
    {/each}
  </div>
{:else}<Unavailable label="Sector Peers" />{/if}
<style>
  .pe { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:14px; }
  .pe-h { font-size:.7rem; font-weight:600; color:var(--text); margin-bottom:8px; }
  .pe-row { display:flex; align-items:center; gap:10px; padding:6px 0; border-bottom:1px solid var(--border); text-decoration:none; }
  .pe-row:last-child { border-bottom:none; }
  .pe-sym { font-size:.76rem; font-weight:700; color:var(--text); min-width:64px; }
  .pe-name { font-size:.7rem; color:var(--muted); flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .pe-chg.up { color:#39d98a; } .pe-chg.down { color:#f6685e; font-size:.76rem; }
</style>
