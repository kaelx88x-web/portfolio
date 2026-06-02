<!-- KeyStatsGrid.svelte -->
<script lang="ts">
  import type { StockDetailVM } from '$lib/services/stock-detail.service';
  import Unavailable from './Unavailable.svelte';
  export let stats: StockDetailVM['stats'];
  const f = (n: number | null | undefined, d = 2) => n == null ? '—' : n.toFixed(d);
  const cap = (n: number | null | undefined) => n == null ? '—' : n >= 1e12 ? (n/1e12).toFixed(2)+'T' : n >= 1e9 ? (n/1e9).toFixed(1)+'B' : (n/1e6).toFixed(0)+'M';
</script>
{#if stats.status === 'ok' && stats.data}
  <div class="ks">
    <div class="ks-h">Key Stats</div>
    <div class="ks-grid">
      <div><span>PE</span><b>{f(stats.data.pe)}</b></div>
      <div><span>PB</span><b>{f(stats.data.pb)}</b></div>
      <div><span>EPS</span><b>{f(stats.data.eps)}</b></div>
      <div><span>Mkt Cap</span><b>{cap(stats.data.marketCap)}</b></div>
      <div><span>52w High</span><b>{f(stats.data.high52)}</b></div>
      <div><span>52w Low</span><b>{f(stats.data.low52)}</b></div>
    </div>
  </div>
{:else}<Unavailable label="Key Stats" />{/if}
<style>
  .ks { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:14px; }
  .ks-h { font-size:.7rem; font-weight:600; color:var(--text); margin-bottom:10px; }
  .ks-grid { display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; }
  .ks-grid div { background:var(--bg, rgba(255,255,255,.02)); border-radius:6px; padding:6px 8px; }
  .ks-grid span { display:block; font-size:.6rem; color:var(--muted); text-transform:uppercase; }
  .ks-grid b { font-size:.85rem; color:var(--text); }
</style>
