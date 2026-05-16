<script lang="ts">
  import type { PageData } from './$types';
  import type { GlobalMarket, MarketIndex } from '$lib/services/broker.service';
  import { onMount, onDestroy } from 'svelte';

  export let data: PageData;

  let markets: GlobalMarket[] = data.markets;
  let fetchedAt: string = data.fetched_at;
  let loading = false;
  let timer: ReturnType<typeof setInterval>;

  async function refresh() {
    loading = true;
    try {
      const res = await fetch('/api/global-markets');
      if (res.ok) {
        const body = await res.json();
        markets = body.markets ?? markets;
        fetchedAt = body.fetched_at ?? fetchedAt;
      }
    } finally {
      loading = false;
    }
  }

  onMount(() => { timer = setInterval(refresh, 60_000); });
  onDestroy(() => clearInterval(timer));

  const FLAGS: Record<string, string> = { us: '🇺🇸', hk: '🇭🇰', sh: '🇨🇳', sz: '🇨🇳' };

  const STATUS_LABEL: Record<string, string> = {
    open:   'Open',
    pre:    'Pre-Market',
    after:  'After-Hours',
    break:  'Lunch Break',
    closed: 'Closed',
  };

  function localTime(timezone: string): string {
    try {
      return new Date().toLocaleTimeString('en-US', {
        timeZone: timezone, hour: '2-digit', minute: '2-digit', hour12: true,
      });
    } catch { return ''; }
  }

  function fmtPrice(v: number | null, currency: string): string {
    if (v === null) return '—';
    const sym = currency === 'HKD' ? 'HK$' : currency === 'CNY' ? '¥' : '';
    if (v >= 1000) return `${sym}${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    return `${sym}${v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }

  function indexShortName(idx: MarketIndex): string {
    if (idx.code === 'US.SPY') return 'S&P 500 (SPY)';
    if (idx.code === 'US.QQQ') return 'Nasdaq 100 (QQQ)';
    if (idx.code === 'US.DIA') return 'Dow Jones (DIA)';
    if (idx.code === 'HK.800000') return 'Hang Seng';
    if (idx.code === 'SH.000001') return 'SSE Composite';
    if (idx.code === 'SZ.399001') return 'SZSE Component';
    const label = idx.name || idx.code;
    return label;
  }

  $: lastUpdated = fetchedAt
    ? new Date(fetchedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })
    : '—';
</script>

<div class="page">
  <div class="page-head">
    <div>
      <div class="page-title">Global Markets</div>
      <div class="page-sub">Real-time market status and major indices</div>
    </div>
    <div class="meta">
      <span class="updated-label">Updated {lastUpdated}</span>
      <button class="refresh-btn" on:click={refresh} disabled={loading}>
        {loading ? 'Refreshing…' : 'Refresh'}
      </button>
    </div>
  </div>

  {#if markets.length === 0}
    <div class="empty">No market data available — ensure the bridge service is running.</div>
  {:else}
    <div class="grid">
      {#each markets as mkt}
        {@const flag = FLAGS[mkt.key] ?? '🌐'}
        <div class="market-card status-{mkt.status}">
          <div class="card-head">
            <div class="market-id">
              <span class="flag">{flag}</span>
              <div>
                <div class="market-name">{mkt.name}</div>
                <div class="market-short">{mkt.short} · {mkt.currency}</div>
              </div>
            </div>
            <div class="status-block">
              <span class="status-dot"></span>
              <span class="status-label">{STATUS_LABEL[mkt.status] ?? mkt.state}</span>
            </div>
          </div>

          <div class="local-time">{localTime(mkt.timezone)}</div>

          {#if mkt.indices.length > 0}
            <div class="indices">
              {#each mkt.indices as idx}
                {@const up = idx.change_pct !== null && idx.change_pct > 0}
                {@const dn = idx.change_pct !== null && idx.change_pct < 0}
                <div class="index-row">
                  <span class="index-name">{indexShortName(idx)}</span>
                  <div class="index-vals">
                    <span class="index-price">{fmtPrice(idx.last_price, mkt.currency)}</span>
                    <span class="index-chg" class:up class:dn>
                      {idx.change_pct === null ? '—'
                        : (idx.change_pct >= 0 ? '+' : '') + idx.change_pct.toFixed(2) + '%'}
                    </span>
                  </div>
                </div>
              {/each}
            </div>
          {:else}
            <div class="no-indices">No index data</div>
          {/if}
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  .page { display: flex; flex-direction: column; }

  .page-head {
    display: flex; justify-content: space-between; align-items: flex-start;
    margin-bottom: 20px; flex-wrap: wrap; gap: 12px;
  }
  .page-title { font-size: 1.1rem; font-weight: 700; color: var(--text); }
  .page-sub   { font-size: 0.72rem; color: var(--muted); margin-top: 2px; }

  .meta { display: flex; align-items: center; gap: 10px; }
  .updated-label { font-size: 0.7rem; color: var(--muted); }
  .refresh-btn {
    padding: 5px 12px; border-radius: 6px; font-size: 0.72rem; font-weight: 600;
    border: 1px solid var(--border); background: var(--surface-1); color: var(--text);
    cursor: pointer; transition: background 0.15s;
  }
  .refresh-btn:hover:not(:disabled) { background: var(--card); }
  .refresh-btn:disabled { opacity: 0.5; cursor: default; }

  .empty { color: var(--muted); font-size: 0.82rem; padding: 40px; text-align: center; }

  /* ── Grid ── */
  .grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 14px;
  }

  /* ── Market card ── */
  .market-card {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 14px; padding: 18px 20px;
    display: flex; flex-direction: column; gap: 14px;
  }

  .card-head { display: flex; justify-content: space-between; align-items: flex-start; }

  .market-id { display: flex; align-items: center; gap: 10px; }
  .flag       { font-size: 1.5rem; line-height: 1; }
  .market-name  { font-size: 0.9rem; font-weight: 700; color: var(--text); }
  .market-short { font-size: 0.65rem; color: var(--muted); margin-top: 1px; }

  /* Status */
  .status-block { display: flex; align-items: center; gap: 5px; }
  .status-dot {
    width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0;
    background: var(--muted);
  }
  .status-label { font-size: 0.68rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); }

  /* open */
  .status-open .status-dot  { background: var(--success); box-shadow: 0 0 0 3px rgba(34,197,94,0.2); animation: pulse 2s infinite; }
  .status-open .status-label { color: var(--success); }
  /* pre */
  .status-pre .status-dot   { background: #f59e0b; }
  .status-pre .status-label  { color: #f59e0b; }
  /* after */
  .status-after .status-dot  { background: #818cf8; }
  .status-after .status-label { color: #818cf8; }
  /* break */
  .status-break .status-dot  { background: #fb923c; }
  .status-break .status-label { color: #fb923c; }

  @keyframes pulse {
    0%, 100% { box-shadow: 0 0 0 3px rgba(34,197,94,0.2); }
    50%       { box-shadow: 0 0 0 6px rgba(34,197,94,0.0); }
  }

  /* Local time */
  .local-time {
    font-size: 1.4rem; font-weight: 300; color: var(--text);
    letter-spacing: -0.02em; font-variant-numeric: tabular-nums;
  }

  /* Indices */
  .indices { display: flex; flex-direction: column; gap: 8px; }
  .index-row {
    display: flex; justify-content: space-between; align-items: center;
    padding: 7px 10px; background: var(--surface-1); border-radius: 8px;
  }
  .index-name  { font-size: 0.72rem; color: var(--muted); font-weight: 500; }
  .index-vals  { display: flex; align-items: center; gap: 8px; }
  .index-price { font-size: 0.8rem; font-weight: 600; color: var(--text); font-variant-numeric: tabular-nums; }
  .index-chg   { font-size: 0.72rem; font-weight: 600; color: var(--muted); font-variant-numeric: tabular-nums; }
  .index-chg.up { color: var(--success); }
  .index-chg.dn { color: var(--danger); }

  .no-indices { font-size: 0.72rem; color: var(--muted); text-align: center; padding: 8px 0; }
</style>
