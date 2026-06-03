<script lang="ts">
  import { invalidateAll } from '$app/navigation';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import StockDetailHeader from '$lib/components/stocks/detail/StockDetailHeader.svelte';
  import PriceChart from '$lib/components/stocks/detail/PriceChart.svelte';
  import MoneyFlowPanel from '$lib/components/stocks/detail/MoneyFlowPanel.svelte';
  import KeyStatsGrid from '$lib/components/stocks/detail/KeyStatsGrid.svelte';
  import PositionActions from '$lib/components/stocks/detail/PositionActions.svelte';
  import SectorPeers from '$lib/components/stocks/detail/SectorPeers.svelte';
  import BidAsk from '$lib/components/stocks/detail/BidAsk.svelte';
  import AddDrawer from '$lib/components/stocks/AddDrawer.svelte';
  import OptionsPanel from '$lib/components/stocks/detail/OptionsPanel.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
  $: d = data.detail;
  let tab: 'overview' | 'options' = 'overview';
  let refreshing = false;
  let drawerOpen = false;

  async function refresh() { refreshing = true; try { await invalidateAll(); } finally { refreshing = false; } }
</script>

<PageHeader title={d.asset.symbol} subtitle={d.asset.name}
  breadcrumb={[{ label: 'Stocks', href: '/stocks' }, { label: d.asset.symbol }]} />

<StockDetailHeader detail={d} code={d.moomooCode} timezone={data.timezone} onRefresh={refresh} {refreshing} />

<div class="tabs" role="tablist">
  <button role="tab" aria-selected={tab==='overview'} class:active={tab==='overview'} on:click={() => tab='overview'}>Overview</button>
  <button role="tab" aria-selected={tab==='options'} class:active={tab==='options'} on:click={() => tab='options'}>Options</button>
</div>

{#if tab === 'overview'}
  <div class="grid">
    <div class="main">
      {#if d.candles.status === 'ok'}<PriceChart symbol={d.asset.symbol} initial={d.candles.data ?? []} />{/if}
      <MoneyFlowPanel flow={d.flow} />
      <SectorPeers peers={d.peers} />
    </div>
    <aside class="rail">
      <PositionActions detail={d} onAdd={() => drawerOpen = true} />
      <KeyStatsGrid stats={d.stats} />
      <BidAsk bidAsk={d.bidAsk} />
    </aside>
  </div>
{:else}
  <OptionsPanel symbol={d.asset.symbol} />
{/if}

<AddDrawer bind:open={drawerOpen} selectedAsset={{ id: d.asset.id, symbol: d.asset.symbol, name: d.asset.name, currency: d.asset.currency, country: d.asset.market, sector: d.asset.sector, assetType: 'stock', exchange: null, latestPrice: d.header.data?.lastPrice ?? 0, createdAt: new Date(), updatedAt: new Date() }} />

<style>
  .tabs { display:flex; gap:4px; margin:14px 0; }
  .tabs button { padding:6px 14px; border-radius:8px; border:1px solid var(--border); background:none; color:var(--muted); font-size:.78rem; font-weight:600; cursor:pointer; }
  .tabs button.active { background:rgba(var(--primary-rgb),.12); border-color:var(--primary); color:var(--primary); }
  .grid { display:grid; grid-template-columns:1.7fr 1fr; gap:14px; align-items:start; }
  .main, .rail { display:flex; flex-direction:column; gap:14px; }
  .rail { position:sticky; top:16px; }
  @media (max-width:1023px){ .grid { grid-template-columns:1fr; } .rail { position:static; } }
</style>
