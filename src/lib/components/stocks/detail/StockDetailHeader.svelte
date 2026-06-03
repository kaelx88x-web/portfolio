<!-- StockDetailHeader.svelte -->
<script lang="ts">
  import { onDestroy } from 'svelte';
  import type { StockDetailVM } from '$lib/services/stock-detail.service';
  import { subscribeQuotes, liveQuotes } from '$lib/stores/live-quotes';
  import LiveDot from '$lib/components/LiveDot.svelte';

  export let detail: StockDetailVM;
  export let code: string = '';
  export let timezone: string | null = null;   // market TZ from getGlobalMarkets, set by page
  export let onRefresh: () => void = () => {};
  export let refreshing = false;

  const un = subscribeQuotes([code]);
  onDestroy(un);

  $: live = $liveQuotes.get(code.trim().toUpperCase());
  $: h = detail.header.data;
  $: displayPrice = live?.last ?? h?.lastPrice ?? null;
  $: displayChangePct = live?.changePct ?? h?.changePct ?? null;
  $: up = (displayChangePct ?? 0) >= 0;
  $: stateLabel = mapState(detail.marketState);
  $: open = detail.marketState?.toUpperCase().includes('OPEN') ?? false;

  function mapState(s: string | null): string {
    const v = (s ?? '').toUpperCase();
    if (v.includes('PRE')) return 'Pre-market';
    if (v.includes('AFTER') || v.includes('POST')) return 'After-hours';
    if (v.includes('OPEN') || v.includes('TRADING')) return 'Open';
    return 'Closed';
  }
  function lastUpdated(): string {
    try {
      return new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', timeZone: timezone ?? undefined, timeZoneName: 'short' }).format(new Date());
    } catch { return new Date().toLocaleTimeString(); }
  }
  // Recompute the "Updated" stamp whenever the data reloads (new `detail` object
  // after invalidateAll) or the market timezone changes — so it never shows a
  // stale mount-time clock.
  $: updatedAt = (detail, timezone, lastUpdated());
</script>

<header class="dh">
  <div class="dh-id">
    <h1>{detail.asset.symbol}</h1>
    <span class="dh-name">{detail.asset.name}</span>
    <span class="dh-state" class:open>{stateLabel}</span>
  </div>
  {#if displayPrice !== null}
    <div class="dh-px">
      <span class="px">{displayPrice.toFixed(2)} <small>{detail.asset.currency}</small></span>
      <span class="chg" class:up class:down={!up}>{up ? '+' : ''}{(displayChangePct ?? 0).toFixed(2)}%</span>
      {#if detail.header.status === 'stale' && !live}<span class="stale">stale</span>{/if}
      <LiveDot {code} />
    </div>
  {:else}
    <span class="chg down">Price Not Available</span>
  {/if}
  <div class="dh-meta">
    <span>Updated {updatedAt}</span>
    <button class="rf" on:click={onRefresh} disabled={refreshing}>
      {refreshing ? 'Refreshing…' : open ? 'Refresh' : 'Refresh (market closed)'}
    </button>
  </div>
</header>

<style>
  .dh { display:flex; flex-wrap:wrap; align-items:center; gap:14px; justify-content:space-between; background:var(--card); border:1px solid var(--border); border-radius:12px; padding:16px; }
  .dh-id { display:flex; align-items:baseline; gap:10px; }
  .dh-id h1 { font-size:1.4rem; margin:0; color:var(--text); }
  .dh-name { color:var(--muted); font-size:.82rem; }
  .dh-state { font-size:.62rem; font-weight:700; text-transform:uppercase; padding:2px 8px; border-radius:6px; background:rgba(255,255,255,.06); color:var(--muted); }
  .dh-state.open { background:rgba(57,217,138,.14); color:#39d98a; }
  .dh-px { display:flex; align-items:baseline; gap:10px; }
  .px { font-size:1.3rem; font-weight:700; color:var(--text); } .px small { font-size:.7rem; color:var(--muted); }
  .chg { font-size:.9rem; font-weight:700; } .chg.up { color:#39d98a; } .chg.down { color:#f6685e; }
  .stale { font-size:.6rem; color:#f5b450; border:1px solid #f5b45055; border-radius:4px; padding:1px 5px; }
  .dh-meta { display:flex; align-items:center; gap:10px; font-size:.7rem; color:var(--muted); }
  .rf { font-size:.7rem; font-weight:600; padding:5px 10px; border-radius:7px; border:1px solid var(--border); background:none; color:var(--text); cursor:pointer; }
  .rf:disabled { opacity:.5; cursor:default; }
</style>
