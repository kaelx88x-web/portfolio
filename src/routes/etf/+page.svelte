<script lang="ts">
  import { Search } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  let query = '';
  type EtfRow = PageData['etfs'][number];

  const GROUPS: Record<string, string[]> = {
    'Broad Market':  ['US.SPY','US.QQQ','US.VTI','US.VOO','US.IWM','US.DIA'],
    'Sector':        ['US.XLK','US.XLF','US.XLE','US.XLV','US.XLY','US.XLI'],
    'International': ['US.EFA','US.EEM','US.VEA','US.VWO'],
    'Bond':          ['US.AGG','US.BND','US.TLT','US.HYG'],
    'Thematic':      ['US.GLD','US.SLV','US.ARKK','US.SCHD'],
  };

  const etfMap = new Map(data.etfs.map((e) => [e.code, e]));
  const isEtfRow = (value: EtfRow | undefined): value is EtfRow => Boolean(value);

  $: filtered = query.trim()
    ? data.etfs.filter(
        (e) =>
          e.ticker.includes(query.toUpperCase()) ||
          e.name.toLowerCase().includes(query.toLowerCase())
      )
    : null;

  function fmt(n: number | null, decimals = 2): string {
    if (n === null || n === undefined) return '—';
    return n.toFixed(decimals);
  }

  function fmtMoney(n: number | null): string {
    if (!n) return '—';
    if (n >= 1e12) return `$${(n / 1e12).toFixed(2)}T`;
    if (n >= 1e9)  return `$${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6)  return `$${(n / 1e6).toFixed(1)}M`;
    return `$${n.toFixed(0)}`;
  }

  function fmtFlow(n: number | null): string {
    if (n === null || n === undefined) return '—';
    const abs = Math.abs(n);
    const sign = n >= 0 ? '+' : '-';
    if (abs >= 1e9) return `${sign}$${(abs / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `${sign}$${(abs / 1e6).toFixed(1)}M`;
    return `${sign}$${abs.toFixed(0)}`;
  }
</script>

<PageHeader
  title="ETF Screener"
  subtitle="Real-time price, capital flow, and performance for popular ETFs via Moomoo."
  breadcrumb={[{ label: 'ETF Screener' }]}
/>

{#if data.error}
  <div class="error-bar">{data.error}</div>
{/if}

<!-- Search -->
<div class="search-wrap">
  <Search size={15} class="search-icon" />
  <input
    class="search-input"
    type="text"
    placeholder="Search ticker or name — e.g. SPY, Technology…"
    bind:value={query}
  />
</div>

{#if filtered}
  <!-- Search results as flat table -->
  <div class="section-label">Search results for "{query}"</div>
  <div class="table-wrap">
    <table class="data-table">
      <thead>
        <tr>
          <th>Ticker</th>
          <th>Name</th>
          <th class="right">Price</th>
          <th class="right">Change</th>
          <th class="right">Change %</th>
          <th class="right">Market Cap</th>
          <th class="right">Net Flow</th>
        </tr>
      </thead>
      <tbody>
        {#each filtered as e}
          <tr>
            <td><a class="ticker-link" href="/holdings/{e.ticker}">{e.ticker}</a></td>
            <td class="name-cell">{e.name}</td>
            <td class="right">{e.last_price ? `$${fmt(e.last_price)}` : '—'}</td>
            <td class="right" class:pos={e.change !== null && e.change >= 0} class:neg={e.change !== null && e.change < 0}>
              {e.change !== null ? (e.change >= 0 ? '+' : '') + fmt(e.change) : '—'}
            </td>
            <td class="right" class:pos={e.change_pct !== null && e.change_pct >= 0} class:neg={e.change_pct !== null && e.change_pct < 0}>
              {e.change_pct !== null ? (e.change_pct >= 0 ? '+' : '') + fmt(e.change_pct) + '%' : '—'}
            </td>
            <td class="right muted">{fmtMoney(e.market_cap)}</td>
            <td class="right" class:pos={e.in_flow !== null && e.in_flow >= 0} class:neg={e.in_flow !== null && e.in_flow < 0}>
              {fmtFlow(e.in_flow)}
            </td>
          </tr>
        {/each}
        {#if filtered.length === 0}
          <tr><td colspan="7" class="empty-row">No ETF matched "{query}"</td></tr>
        {/if}
      </tbody>
    </table>
  </div>

{:else}
  <!-- Grouped view -->
  {#each Object.entries(GROUPS) as [group, codes]}
    {@const etfs = codes.map((c) => etfMap.get(c)).filter(isEtfRow)}
    <div class="group">
      <div class="group-label">{group}</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Ticker</th>
              <th>Name</th>
              <th class="right">Price</th>
              <th class="right">Change %</th>
              <th class="right">Mkt Cap</th>
              <th class="right">Net Flow</th>
              <th class="right">Main Flow</th>
            </tr>
          </thead>
          <tbody>
            {#each etfs as e}
              <tr>
                <td><a class="ticker-link" href="/holdings/{e.ticker}">{e.ticker}</a></td>
                <td class="name-cell">{e.name || '—'}</td>
                <td class="right price">{e.last_price ? `$${fmt(e.last_price)}` : '—'}</td>
                <td class="right" class:pos={e.change_pct !== null && e.change_pct >= 0} class:neg={e.change_pct !== null && e.change_pct < 0}>
                  {e.change_pct !== null ? (e.change_pct >= 0 ? '+' : '') + fmt(e.change_pct) + '%' : '—'}
                </td>
                <td class="right muted">{fmtMoney(e.market_cap)}</td>
                <td class="right" class:pos={e.in_flow !== null && e.in_flow >= 0} class:neg={e.in_flow !== null && e.in_flow < 0}>
                  {fmtFlow(e.in_flow)}
                </td>
                <td class="right" class:pos={e.main_in_flow !== null && e.main_in_flow >= 0} class:neg={e.main_in_flow !== null && e.main_in_flow < 0}>
                  {fmtFlow(e.main_in_flow)}
                </td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    </div>
  {/each}
{/if}

<style>
  .error-bar {
    padding: 10px 14px; border-radius: 8px; margin-bottom: 16px;
    background: rgba(var(--danger-rgb),0.08); border: 1px solid rgba(var(--danger-rgb),0.25);
    color: var(--danger); font-size: 0.8rem;
  }

  /* Search */
  .search-wrap {
    position: relative; margin-bottom: 20px; max-width: 480px;
  }
  .search-wrap :global(.search-icon) {
    position: absolute; left: 12px; top: 50%; transform: translateY(-50%);
    color: var(--muted); pointer-events: none;
  }
  .search-input {
    width: 100%; padding: 9px 12px 9px 36px;
    border: 1px solid var(--border); border-radius: 8px;
    background: var(--surface-1); color: var(--text);
    font-size: 0.83rem; outline: none; transition: border-color 0.15s;
  }
  .search-input:focus { border-color: var(--primary); }
  .search-input::placeholder { color: var(--muted); }

  /* Groups */
  .group { margin-bottom: 20px; }
  .group-label {
    font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.08em; color: var(--muted); margin-bottom: 8px;
  }
  .section-label {
    font-size: 0.78rem; color: var(--muted); margin-bottom: 10px;
  }

  /* Table overrides */
  .table-wrap { border-radius: 10px; overflow: hidden; }
  .right { text-align: right !important; }
  .muted { color: var(--muted) !important; }
  .price { font-weight: 600; }
  .name-cell { color: var(--muted); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty-row { text-align: center; color: var(--muted); padding: 24px !important; }

  .ticker-link {
    font-weight: 700; color: var(--primary);
    text-decoration: none;
  }
  .ticker-link:hover { text-decoration: underline; }

  .pos { color: var(--success) !important; }
  .neg { color: var(--danger) !important; }

  @media (max-width: 640px) {
    .name-cell { display: none; }
  }
</style>
