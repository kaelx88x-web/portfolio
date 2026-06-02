<!-- MoneyFlowPanel.svelte -->
<script lang="ts">
  import type { StockDetailVM } from '$lib/services/stock-detail.service';
  import Unavailable from './Unavailable.svelte';
  export let flow: StockDetailVM['flow'];
  const money = (n: number | null) => n == null ? '—' : (Math.abs(n) >= 1e6 ? (n/1e6).toFixed(1)+'M' : (n/1e3).toFixed(0)+'K');
</script>
{#if flow.status === 'ok' && flow.data}
  <div class="mf">
    <div class="mf-h">Money Flow (today)</div>
    <div class="mf-row"><span>Net inflow</span><b class:pos={(flow.data.inFlow??0)>=0} class:neg={(flow.data.inFlow??0)<0}>{money(flow.data.inFlow)}</b></div>
    <div class="mf-row"><span>Main inflow</span><b class:pos={(flow.data.mainInFlow??0)>=0} class:neg={(flow.data.mainInFlow??0)<0}>{money(flow.data.mainInFlow)}</b></div>
  </div>
{:else}<Unavailable label="Money Flow" />{/if}
<style>
  .mf { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:14px; }
  .mf-h { font-size:.7rem; font-weight:600; color:var(--text); margin-bottom:8px; }
  .mf-row { display:flex; justify-content:space-between; font-size:.78rem; padding:4px 0; color:var(--muted); }
  .mf-row b.pos { color:#39d98a; } .mf-row b.neg { color:#f6685e; }
</style>
