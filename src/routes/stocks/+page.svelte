<!-- src/routes/stocks/+page.svelte -->
<script lang="ts">
  import type { PageData } from './$types';
  import type { Asset } from '@prisma/client';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import MarketStatusBadge from '$lib/components/stocks/MarketStatusBadge.svelte';
  import TrendingStrip from '$lib/components/stocks/TrendingStrip.svelte';
  import StockCard from '$lib/components/stocks/StockCard.svelte';
  import AddDrawer from '$lib/components/stocks/AddDrawer.svelte';
  import { getStockMeta } from '$lib/data/stock-metadata';

  export let data: PageData;

  type Tab = 'all' | 'us-stocks' | 'us-etfs' | 'my' | 'hk';
  const TABS: { id: Tab; label: string }[] = [
    { id: 'all',      label: 'All' },
    { id: 'us-stocks', label: 'US Stocks' },
    { id: 'us-etfs',  label: 'US ETFs' },
    { id: 'my',       label: 'MY Market' },
    { id: 'hk',       label: 'HK Market' },
  ];

  let activeTab: Tab = 'all';
  let query = '';
  let searchResults: { symbol: string; name: string; exchange: string; type: string }[] = [];
  let searching = false;
  let searchTimer: ReturnType<typeof setTimeout>;

  let drawerOpen = false;
  let selectedAsset: Asset | null = null;

  // Local reactive copies for optimistic watchlist toggle
  let watchlistSet = new Set(data.watchlistSet);

  $: filteredAssets = data.assets.filter(a => {
    if (activeTab === 'all')       return true;
    if (activeTab === 'us-stocks') return a.country === 'US' && a.assetType === 'stock';
    if (activeTab === 'us-etfs')   return a.country === 'US' && a.assetType === 'etf';
    if (activeTab === 'my')        return a.country === 'MY';
    if (activeTab === 'hk')        return a.country === 'HK';
    return true;
  });

  $: tabCounts = {
    all:          data.assets.length,
    'us-stocks':  data.assets.filter(a => a.country === 'US' && a.assetType === 'stock').length,
    'us-etfs':    data.assets.filter(a => a.country === 'US' && a.assetType === 'etf').length,
    my:           data.assets.filter(a => a.country === 'MY').length,
    hk:           data.assets.filter(a => a.country === 'HK').length,
  };

  // Debounced search
  $: {
    clearTimeout(searchTimer);
    if (query.length >= 2) {
      searchTimer = setTimeout(doSearch, 400);
    } else {
      searchResults = [];
      searching = false;
    }
  }

  async function doSearch() {
    searching = true;
    try {
      const res = await fetch(`/api/stocks/search?q=${encodeURIComponent(query)}`);
      const body = await res.json();
      searchResults = body.results ?? [];
    } catch {
      searchResults = [];
    } finally {
      searching = false;
    }
  }

  function openDrawer(asset: Asset) {
    selectedAsset = asset;
    drawerOpen = true;
  }

  async function openDrawerFromSearch(r: { symbol: string; name: string; exchange: string; type: string }) {
    // Ensure asset exists in DB first
    try {
      const res = await fetch('/api/stocks/ensure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(r),
      });
      const body = await res.json();
      if (!body.assetId) return;

      // Find asset in data.assets or create a minimal one for the drawer
      const existing = data.assets.find(a => a.symbol === r.symbol);
      if (existing) {
        openDrawer(existing);
      } else {
        // Create minimal Asset-like object — page will refresh on submit
        openDrawer({
          id: body.assetId, symbol: r.symbol, name: r.name,
          assetType: r.type, exchange: r.exchange,
          currency: r.symbol.endsWith('.KL') ? 'MYR' : r.symbol.endsWith('.HK') ? 'HKD' : 'USD',
          country:  r.symbol.endsWith('.KL') ? 'MY'  : r.symbol.endsWith('.HK') ? 'HK'  : 'US',
          sector: null, latestPrice: 0,
          createdAt: new Date(), updatedAt: new Date(),
        } as Asset);
      }
    } catch {
      // Silently fail — user can still navigate to /transactions
    }
  }
</script>

<PageHeader
  title="Stocks"
  subtitle="Discover and add securities to your portfolio"
  breadcrumb={[{ label: 'Portfolio', href: '/dashboard' }, { label: 'Stocks' }]}
/>

<MarketStatusBadge />

<TrendingStrip assets={data.assets} on:add={(e) => openDrawer(e.detail)} />

<!-- Search -->
<div class="search-bar">
  <span class="search-icon">🔍</span>
  <input
    class="search-input"
    type="text"
    placeholder="Search any symbol or company name…"
    bind:value={query}
    autocomplete="off"
    spellcheck="false"
  />
  {#if query}
    <button class="search-clear" on:click={() => query = ''} aria-label="Clear search">✕</button>
  {/if}
</div>

<!-- Search results -->
{#if query.length >= 2}
  <div class="search-results" class:visible={true}>
    {#if searching}
      <div class="search-loading">
        {#each Array(3) as _}
          <div class="skel-row-item">
            <div class="skel" style="width:60px;height:12px"></div>
            <div class="skel" style="width:40px;height:20px;border-radius:4px"></div>
          </div>
        {/each}
      </div>
    {:else if searchResults.length === 0}
      <div class="search-empty">No results for "<strong>{query}</strong>"</div>
    {:else}
      {#each searchResults as r}
        <div class="search-row">
          <div class="search-row-info">
            <span class="search-symbol">{r.symbol}</span>
            <span class="search-name">{r.name}</span>
            {#if r.exchange}<span class="search-exchange">{r.exchange}</span>{/if}
          </div>
          <button class="search-add-btn" on:click={() => openDrawerFromSearch(r)}>+ Add</button>
        </div>
      {/each}
    {/if}
  </div>
{:else}
  <!-- Tabs -->
  <div class="tabs" role="tablist">
    {#each TABS as t}
      <button
        class="tab-btn"
        class:active={activeTab === t.id}
        role="tab"
        aria-selected={activeTab === t.id}
        on:click={() => activeTab = t.id}
      >
        {t.label}
        <span class="tab-count">{tabCounts[t.id as keyof typeof tabCounts] ?? 0}</span>
      </button>
    {/each}
  </div>

  <!-- Card grid -->
  {#if filteredAssets.length === 0}
    <div class="empty-state">
      No assets found. Run <code>npx tsx prisma/seed-stocks.ts</code> to populate the browser.
    </div>
  {:else}
    <div class="stock-grid">
      {#each filteredAssets as asset, i (asset.id)}
        <div style="animation-delay:{Math.min(i * 30, 300)}ms" class="card-wrapper">
          <StockCard
            {asset}
            meta={getStockMeta(asset.symbol, asset.sector)}
            owned={data.ownedMap[asset.id]}
            watchlisted={watchlistSet.has(asset.id)}
            onAdd={() => openDrawer(asset)}
            onWatchlist={(val) => {
              if (val) watchlistSet.add(asset.id);
              else watchlistSet.delete(asset.id);
              watchlistSet = watchlistSet;
            }}
          />
        </div>
      {/each}
    </div>
  {/if}
{/if}

<!-- Add drawer -->
<AddDrawer bind:open={drawerOpen} bind:selectedAsset />

<style>
  .search-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 14px;
    margin-bottom: 16px;
    transition: border-color 0.15s;
  }
  .search-bar:focus-within { border-color: var(--primary); }
  .search-icon { font-size: 1rem; flex-shrink: 0; }
  .search-input {
    flex: 1;
    background: none;
    border: none;
    outline: none;
    color: var(--text);
    font-size: 0.88rem;
    min-width: 0;
  }
  .search-input::placeholder { color: var(--muted); }
  .search-input { font-size: 1rem; } /* ≥16px prevents iOS zoom */
  .search-clear {
    background: none; border: none; cursor: pointer;
    color: var(--muted); font-size: 0.75rem; padding: 2px;
    transition: color 0.1s;
  }
  .search-clear:hover { color: var(--text); }

  .search-results {
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 10px;
    margin-bottom: 16px;
    overflow: hidden;
    animation: fadeIn 0.15s ease;
  }
  @keyframes fadeIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }
  .search-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 14px;
    border-bottom: 1px solid var(--border);
    transition: background 0.1s;
  }
  .search-row:last-child { border-bottom: none; }
  .search-row:hover { background: rgba(255,255,255,0.02); }
  .search-row-info { display: flex; align-items: center; gap: 10px; }
  .search-symbol   { font-size: 0.82rem; font-weight: 700; color: var(--text); min-width: 80px; }
  .search-name     { font-size: 0.75rem; color: var(--muted); }
  .search-exchange { font-size: 0.68rem; color: var(--muted); }
  .search-add-btn {
    font-size: 0.72rem; font-weight: 600;
    padding: 4px 12px; border-radius: 6px;
    border: 1px solid rgba(108,143,255,0.3);
    background: rgba(108,143,255,0.08);
    color: var(--primary); cursor: pointer;
    transition: background 0.12s;
  }
  .search-add-btn:hover { background: rgba(108,143,255,0.18); }
  .search-empty { padding: 16px 14px; font-size: 0.78rem; color: var(--muted); }
  .search-loading { padding: 8px 14px; display: flex; flex-direction: column; gap: 8px; }
  .skel-row-item  { display: flex; justify-content: space-between; align-items: center; padding: 4px 0; }
  .skel {
    background: linear-gradient(90deg, var(--border) 25%, rgba(255,255,255,0.06) 50%, var(--border) 75%);
    background-size: 200% 100%;
    animation: shimmer 1.4s infinite;
    border-radius: 4px;
  }
  @keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  .tabs {
    display: flex;
    gap: 4px;
    margin-bottom: 16px;
    flex-wrap: wrap;
  }
  .tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: none;
    color: var(--muted);
    font-size: 0.75rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s, border-color 0.15s, color 0.15s;
  }
  .tab-btn.active {
    background: rgba(108,143,255,0.12);
    border-color: var(--primary);
    color: var(--primary);
  }
  .tab-count {
    font-size: 0.62rem;
    background: rgba(255,255,255,0.08);
    border-radius: 10px;
    padding: 1px 5px;
  }

  .stock-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 14px;
  }
  .card-wrapper {
    animation: cardIn 0.25s ease both;
  }
  @keyframes cardIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }

  .empty-state {
    padding: 32px;
    text-align: center;
    color: var(--muted);
    font-size: 0.82rem;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 12px;
  }

  @media (max-width: 1023px) {
    .stock-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 767px) {
    .stock-grid { grid-template-columns: 1fr; }
    .tabs { overflow-x: auto; flex-wrap: nowrap; }
  }
</style>
