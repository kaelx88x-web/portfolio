<script lang="ts">
  import type { PageData } from './$types';
  import type { PeerCompany } from '$lib/server/finnhub';

  export let data: PageData;

  let searchInput = data.symbol ?? '';
  let symbol = data.symbol ?? '';
  let peers: PeerCompany[] = data.peers ?? [];
  let error: string | null = data.error ?? null;
  let loading = false;

  async function search() {
    const s = searchInput.trim().toUpperCase();
    if (!s) return;
    loading = true;
    error = null;
    try {
      const res = await fetch(`/api/supply-chain?symbol=${encodeURIComponent(s)}`);
      const body = await res.json();
      if (body.error) { error = body.error; peers = []; }
      else { symbol = body.symbol; peers = body.peers ?? []; }
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') search();
  }

  function fmtCap(v: number | null): string {
    if (!v) return '—';
    if (v >= 1000) return `$${(v / 1000).toFixed(1)}T`;
    if (v >= 1) return `$${v.toFixed(1)}B`;
    return `$${(v * 1000).toFixed(0)}M`;
  }

  function flagEmoji(country: string): string {
    if (!country || country.length !== 2) return '';
    return country.toUpperCase().split('').map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65)).join('');
  }
</script>

<div class="page">
  <div class="page-head">
    <div>
      <div class="page-title">Peer Research</div>
      <div class="page-sub">Comparable companies in the same industry — sorted by market cap</div>
    </div>
  </div>

  <div class="search-row">
    <div class="search-wrap">
      <input
        class="search-input"
        type="text"
        placeholder="Enter symbol — e.g. AAPL, NVDA, TSLA"
        bind:value={searchInput}
        on:keydown={onKeydown}
      />
      <button class="search-btn" on:click={search} disabled={loading}>
        {loading ? 'Loading…' : 'Search'}
      </button>
    </div>
  </div>

  {#if error}
    <div class="error-box">{error}</div>
  {:else if symbol && peers.length > 0}
    <div class="info-note">
      Showing <strong>{peers.length}</strong> peer companies for <strong>{symbol}</strong>
    </div>

    <div class="grid">
      {#each peers as p}
        <div class="peer-card">
          <div class="card-top">
            {#if p.logo}
              <img class="logo" src={p.logo} alt={p.name} loading="lazy" />
            {:else}
              <div class="logo-placeholder">{p.symbol.slice(0,2)}</div>
            {/if}
            <div class="company-info">
              <a class="peer-ticker" href="/holdings/{p.symbol}">{p.symbol}</a>
              <div class="peer-name">{p.name}</div>
            </div>
          </div>

          <div class="tags">
            {#if p.industry}<span class="tag">{p.industry}</span>{/if}
            {#if p.country}<span class="tag country-tag">{flagEmoji(p.country)} {p.country}</span>{/if}
            {#if p.exchange}<span class="tag">{p.exchange.split(' ')[0]}</span>{/if}
          </div>

          <div class="metrics">
            <div class="metric">
              <span class="metric-label">Market Cap</span>
              <span class="metric-val">{fmtCap(p.marketCap)}</span>
            </div>
            <div class="metric">
              <span class="metric-label">Currency</span>
              <span class="metric-val">{p.currency || '—'}</span>
            </div>
            {#if p.ipo}
              <div class="metric">
                <span class="metric-label">IPO</span>
                <span class="metric-val">{p.ipo}</span>
              </div>
            {/if}
          </div>

          {#if p.weburl}
            <a class="web-link" href={p.weburl} target="_blank" rel="noopener noreferrer">
              {p.weburl.replace(/^https?:\/\//, '').replace(/\/$/, '')}
            </a>
          {/if}
        </div>
      {/each}
    </div>

  {:else if symbol && !loading}
    <div class="empty">No peer data found for <strong>{symbol}</strong>.</div>
  {:else if !symbol}
    <div class="empty">Enter a stock symbol above to find peer companies.</div>
  {/if}
</div>

<style>
  .page { display: flex; flex-direction: column; gap: 16px; }

  .page-head { margin-bottom: 4px; }
  .page-title { font-size: 1.1rem; font-weight: 700; color: var(--text); }
  .page-sub   { font-size: 0.72rem; color: var(--muted); margin-top: 2px; }

  .search-row { display: flex; }
  .search-wrap { display: flex; gap: 8px; width: 100%; max-width: 520px; }
  .search-input {
    flex: 1; padding: 8px 12px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--surface-1);
    color: var(--text); font-size: 0.83rem; outline: none;
    transition: border-color 0.15s;
  }
  .search-input:focus { border-color: var(--primary); }
  .search-btn {
    padding: 8px 18px; border-radius: 8px; font-size: 0.8rem; font-weight: 600;
    background: var(--primary); color: #fff; border: none; cursor: pointer;
    transition: opacity 0.15s;
  }
  .search-btn:hover:not(:disabled) { opacity: 0.85; }
  .search-btn:disabled { opacity: 0.5; cursor: default; }

  .info-note { font-size: 0.78rem; color: var(--muted); }

  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
    gap: 12px;
  }

  .peer-card {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 14px; padding: 16px;
    display: flex; flex-direction: column; gap: 10px;
  }

  .card-top { display: flex; align-items: center; gap: 10px; }
  .logo { width: 36px; height: 36px; border-radius: 8px; object-fit: contain; background: #fff; flex-shrink: 0; }
  .logo-placeholder {
    width: 36px; height: 36px; border-radius: 8px; flex-shrink: 0;
    background: rgba(var(--primary-rgb),0.12); color: var(--primary);
    font-size: 0.75rem; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
  }
  .company-info { min-width: 0; }
  .peer-ticker {
    font-size: 0.9rem; font-weight: 700; color: var(--primary);
    text-decoration: none; display: block;
  }
  .peer-ticker:hover { text-decoration: underline; }
  .peer-name   { font-size: 0.7rem; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

  .tags { display: flex; flex-wrap: wrap; gap: 4px; }
  .tag {
    font-size: 0.62rem; padding: 2px 7px; border-radius: 4px;
    background: rgba(var(--primary-rgb),0.08); color: var(--muted);
  }
  .country-tag { background: rgba(var(--success-rgb, 34,197,94),0.08); }

  .metrics { display: flex; gap: 12px; flex-wrap: wrap; }
  .metric { display: flex; flex-direction: column; gap: 1px; }
  .metric-label { font-size: 0.6rem; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; }
  .metric-val   { font-size: 0.82rem; font-weight: 600; color: var(--text); }

  .web-link {
    font-size: 0.67rem; color: var(--primary); text-decoration: none;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .web-link:hover { text-decoration: underline; }

  .error-box {
    padding: 14px 16px; border-radius: 10px;
    background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
    color: var(--danger); font-size: 0.82rem;
  }
  .empty { color: var(--muted); font-size: 0.83rem; padding: 40px; text-align: center; }
</style>
