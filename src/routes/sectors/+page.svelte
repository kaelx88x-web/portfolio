<script lang="ts">
  import type { PageData } from './$types';
  import type { PlateItem, PlateStock } from '$lib/services/broker.service';
  import { Search } from 'lucide-svelte';

  export let data: PageData;

  // ── State ─────────────────────────────────────────────
  let market      = 'US';
  let plateClass  = 'INDUSTRY';
  let plates: PlateItem[]  = data.plates;
  let plateSearch = '';

  let selectedPlate: PlateItem | null = null;
  let stocks: PlateStock[] = [];
  let loadingPlates  = false;
  let loadingStocks  = false;
  let stockSearch    = '';
  let sortCol: keyof PlateStock = 'market_cap';
  let sortAsc = false;

  // ── Plate filtering ────────────────────────────────────
  $: filteredPlates = plateSearch
    ? plates.filter(p => p.name.toLowerCase().includes(plateSearch.toLowerCase()))
    : plates;

  // ── Stock sorting + filtering ──────────────────────────
  $: filteredStocks = stockSearch
    ? stocks.filter(s => s.code.includes(stockSearch.toUpperCase()) || s.name.toLowerCase().includes(stockSearch.toLowerCase()))
    : stocks;

  $: sortedStocks = [...filteredStocks].sort((a, b) => {
    const av = a[sortCol] ?? (sortAsc ? Infinity : -Infinity);
    const bv = b[sortCol] ?? (sortAsc ? Infinity : -Infinity);
    if (typeof av === 'string' && typeof bv === 'string')
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  // ── Load plates (on market / class change) ────────────
  async function loadPlates() {
    loadingPlates = true;
    selectedPlate = null;
    stocks = [];
    try {
      const res = await fetch(`/api/plates?market=${market}&plate_class=${plateClass}`);
      const body = await res.json();
      plates = body.plates ?? [];
    } finally {
      loadingPlates = false;
    }
  }

  // ── Load stocks for a plate ───────────────────────────
  async function selectPlate(plate: PlateItem) {
    selectedPlate = plate;
    stockSearch   = '';
    stocks        = [];
    loadingStocks = true;
    try {
      const res = await fetch(`/api/plate-stocks?code=${encodeURIComponent(plate.code)}`);
      const body = await res.json();
      stocks = body.stocks ?? [];
    } finally {
      loadingStocks = false;
    }
  }

  function sortBy(col: keyof PlateStock) {
    if (sortCol === col) sortAsc = !sortAsc;
    else { sortCol = col; sortAsc = col === 'code' || col === 'name'; }
  }

  // ── Formatters ────────────────────────────────────────
  function fmtPrice(v: number | null) {
    return v === null ? '—' : `$${v.toFixed(2)}`;
  }

  function fmtCap(v: number | null) {
    if (v === null) return '—';
    if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`;
    if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`;
    return `$${v.toLocaleString()}`;
  }

  function fmtVol(v: number | null) {
    if (v === null) return '—';
    if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
    return String(v);
  }

  function chgClass(v: number | null) {
    if (v === null) return '';
    return v > 0 ? 'up' : v < 0 ? 'dn' : '';
  }
</script>

<div class="page">

  <!-- ── Header ── -->
  <div class="page-head">
    <div>
      <div class="page-title">Sectors</div>
      <div class="page-sub">Browse stocks by market sector or concept theme</div>
    </div>

    <!-- Market + class controls -->
    <div class="controls">
      <div class="seg">
        {#each ['US', 'HK'] as m}
          <button class="seg-btn" class:active={market === m}
            on:click={() => { market = m; loadPlates(); }}>{m}</button>
        {/each}
      </div>
      <div class="seg">
        {#each ['INDUSTRY', 'CONCEPT'] as c}
          <button class="seg-btn" class:active={plateClass === c}
            on:click={() => { plateClass = c; loadPlates(); }}>{c}</button>
        {/each}
      </div>
    </div>
  </div>

  <!-- ── Two-column body ── -->
  <div class="body">

    <!-- Left: plate list -->
    <aside class="plate-panel">
      <div class="search-wrap">
        <Search size={12} class="search-ico" />
        <input class="search-inp" placeholder="Search sector…" bind:value={plateSearch} />
      </div>

      {#if loadingPlates}
        <div class="empty-msg">Loading…</div>
      {:else if filteredPlates.length === 0}
        <div class="empty-msg">No sectors found</div>
      {:else}
        <div class="plate-count">{filteredPlates.length} sectors</div>
        <ul class="plate-list">
          {#each filteredPlates as plate}
            <li>
              <button
                class="plate-btn"
                class:active={selectedPlate?.code === plate.code}
                on:click={() => selectPlate(plate)}
              >
                <span class="plate-name">{plate.name}</span>
                <span class="plate-code">{plate.code.split('.')[1] ?? ''}</span>
              </button>
            </li>
          {/each}
        </ul>
      {/if}
    </aside>

    <!-- Right: stocks -->
    <div class="stock-panel">
      {#if !selectedPlate}
        <div class="pick-prompt">
          <div class="pick-icon">◈</div>
          <div class="pick-title">Select a sector</div>
          <div class="pick-sub">Choose from the list on the left to see all stocks in that sector</div>
        </div>

      {:else if loadingStocks}
        <div class="loading-stocks">
          <div class="spinner"></div>
          <span>Loading stocks in <strong>{selectedPlate.name}</strong>…</span>
        </div>

      {:else}
        <div class="stock-head">
          <div>
            <div class="stock-sector-name">{selectedPlate.name}</div>
            <div class="stock-count">{sortedStocks.length} stocks{filteredStocks.length !== stocks.length ? ` (filtered from ${stocks.length})` : ''}</div>
          </div>
          <div class="search-wrap stock-search">
            <Search size={12} class="search-ico" />
            <input class="search-inp" placeholder="Filter stocks…" bind:value={stockSearch} />
          </div>
        </div>

        {#if sortedStocks.length === 0}
          <div class="empty-msg">No stocks match the filter</div>
        {:else}
          <div class="table-wrap">
            <table class="stocks-table">
              <thead>
                <tr>
                  <th class="th-left" on:click={() => sortBy('code')}>
                    Symbol {sortCol === 'code' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th class="th-left" on:click={() => sortBy('name')}>
                    Name {sortCol === 'name' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th on:click={() => sortBy('last_price')}>
                    Price {sortCol === 'last_price' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th on:click={() => sortBy('change_pct')}>
                    Change {sortCol === 'change_pct' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th on:click={() => sortBy('market_cap')}>
                    Mkt Cap {sortCol === 'market_cap' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th on:click={() => sortBy('pe_ttm')}>
                    P/E TTM {sortCol === 'pe_ttm' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                  <th on:click={() => sortBy('volume')}>
                    Volume {sortCol === 'volume' ? (sortAsc ? '↑' : '↓') : ''}
                  </th>
                </tr>
              </thead>
              <tbody>
                {#each sortedStocks as s}
                  <tr>
                    <td class="td-code">
                      <a href="/holdings/{encodeURIComponent(s.code)}" class="code-link">
                        {s.code.split('.')[1] ?? s.code}
                      </a>
                    </td>
                    <td class="td-name">{s.name}</td>
                    <td class="td-num">{fmtPrice(s.last_price)}</td>
                    <td class="td-num {chgClass(s.change_pct)}">
                      {s.change_pct === null ? '—' : (s.change_pct >= 0 ? '+' : '') + s.change_pct.toFixed(2) + '%'}
                    </td>
                    <td class="td-num">{fmtCap(s.market_cap)}</td>
                    <td class="td-num">{s.pe_ttm === null ? '—' : s.pe_ttm.toFixed(1) + '×'}</td>
                    <td class="td-num">{fmtVol(s.volume)}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}
      {/if}
    </div>

  </div>
</div>

<style>
  .page { display: flex; flex-direction: column; height: calc(100vh - 56px - 48px); min-height: 0; }

  /* ── Header ── */
  .page-head {
    display: flex; justify-content: space-between; align-items: flex-start;
    flex-shrink: 0; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;
  }
  .page-title { font-size: 1.1rem; font-weight: 700; color: var(--text); }
  .page-sub   { font-size: 0.72rem; color: var(--muted); margin-top: 2px; }

  .controls { display: flex; gap: 8px; }
  .seg { display: flex; gap: 2px; background: var(--surface-1); border-radius: 7px; padding: 2px; }
  .seg-btn {
    padding: 4px 10px; border-radius: 5px; font-size: 0.7rem; font-weight: 600;
    border: none; background: transparent; color: var(--muted); cursor: pointer; transition: all 0.15s;
  }
  .seg-btn.active { background: var(--card); color: var(--primary); border: 1px solid var(--border); }

  /* ── Body ── */
  .body { display: grid; grid-template-columns: 240px 1fr; gap: 10px; flex: 1; min-height: 0; }

  /* ── Plate panel ── */
  .plate-panel {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; display: flex; flex-direction: column;
    min-height: 0; overflow: hidden;
  }

  .search-wrap {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 10px; border-bottom: 1px solid var(--border); flex-shrink: 0;
  }
  :global(.search-ico) { color: var(--muted); flex-shrink: 0; }
  .search-inp {
    flex: 1; background: transparent; border: none; outline: none;
    font-size: 0.75rem; color: var(--text);
  }
  .search-inp::placeholder { color: var(--muted); }

  .plate-count { font-size: 0.62rem; color: var(--muted); padding: 6px 12px 2px; flex-shrink: 0; }
  .plate-list  { flex: 1; overflow-y: auto; padding: 4px 6px; margin: 0; list-style: none; }
  .plate-btn {
    display: flex; justify-content: space-between; align-items: center;
    width: 100%; padding: 6px 8px; border-radius: 6px;
    border: none; background: transparent; cursor: pointer;
    text-align: left; transition: background 0.12s;
  }
  .plate-btn:hover { background: rgba(var(--primary-rgb),0.07); }
  .plate-btn.active { background: rgba(var(--primary-rgb),0.12); }
  .plate-name { font-size: 0.76rem; color: var(--text); font-weight: 500; }
  .plate-btn.active .plate-name { color: var(--primary); font-weight: 600; }
  .plate-code { font-size: 0.6rem; color: var(--muted); font-family: monospace; }

  .empty-msg { font-size: 0.75rem; color: var(--muted); text-align: center; padding: 24px 12px; }

  /* ── Stock panel ── */
  .stock-panel {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; display: flex; flex-direction: column;
    min-height: 0; overflow: hidden;
  }

  .pick-prompt {
    flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;
    padding: 40px; text-align: center; gap: 8px;
  }
  .pick-icon  { font-size: 1.8rem; color: var(--primary); opacity: 0.3; margin-bottom: 8px; }
  .pick-title { font-size: 0.9rem; font-weight: 600; color: var(--text); }
  .pick-sub   { font-size: 0.73rem; color: var(--muted); max-width: 260px; line-height: 1.5; }

  .loading-stocks {
    flex: 1; display: flex; align-items: center; justify-content: center; gap: 10px;
    font-size: 0.8rem; color: var(--muted);
  }
  .spinner {
    width: 16px; height: 16px; border-radius: 50%;
    border: 2px solid var(--border); border-top-color: var(--primary);
    animation: spin 0.8s linear infinite; flex-shrink: 0;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  .stock-head {
    display: flex; justify-content: space-between; align-items: center;
    padding: 12px 16px; border-bottom: 1px solid var(--border); flex-shrink: 0; gap: 12px;
  }
  .stock-sector-name { font-size: 0.85rem; font-weight: 700; color: var(--text); }
  .stock-count       { font-size: 0.65rem; color: var(--muted); margin-top: 2px; }
  .stock-search      { border: 1px solid var(--border); border-radius: 7px; min-width: 180px; }

  /* ── Table ── */
  .table-wrap { flex: 1; overflow: auto; }
  .stocks-table { width: 100%; border-collapse: collapse; font-size: 0.78rem; }
  .stocks-table thead { position: sticky; top: 0; z-index: 1; background: var(--card); }
  .stocks-table th {
    padding: 8px 12px; text-align: right; font-size: 0.62rem; font-weight: 700;
    color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em;
    border-bottom: 1px solid var(--border); cursor: pointer; white-space: nowrap;
    user-select: none;
  }
  .stocks-table th:hover { color: var(--primary); }
  .th-left { text-align: left; }
  .stocks-table td { padding: 7px 12px; border-bottom: 1px solid rgba(255,255,255,0.03); }
  .stocks-table tbody tr:hover { background: rgba(var(--primary-rgb),0.04); }
  .td-code { font-family: monospace; font-size: 0.75rem; }
  .td-name { color: var(--muted); font-size: 0.73rem; max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .td-num  { text-align: right; font-variant-numeric: tabular-nums; }
  .code-link { color: var(--primary); text-decoration: none; font-weight: 700; }
  .code-link:hover { text-decoration: underline; }
  .up  { color: var(--success); }
  .dn  { color: var(--danger); }
</style>
