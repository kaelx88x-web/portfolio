<script lang="ts">
  import type { PageData } from './$types';
  import type { InsiderTransaction } from '$lib/server/finnhub';

  export let data: PageData;

  let symbol = data.symbol ?? '';
  let searchInput = data.symbol ?? '';
  let transactions: InsiderTransaction[] = data.transactions ?? [];
  let error: string | null = data.error ?? null;
  let loading = false;
  let filter: 'all' | 'P' | 'S' = 'all';

  async function search() {
    const s = searchInput.trim().toUpperCase();
    if (!s) return;
    loading = true;
    error = null;
    try {
      const res = await fetch(`/api/insider?symbol=${encodeURIComponent(s)}`);
      const body = await res.json();
      if (body.error) { error = body.error; transactions = []; }
      else { symbol = body.symbol; transactions = body.transactions ?? []; }
    } catch (e) {
      error = String(e);
    } finally {
      loading = false;
    }
  }

  function onKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter') search();
  }

  const CODE_COLOR: Record<string, string> = { P: 'buy', S: 'sell' };

  function codeLabel(code: string): string {
    const MAP: Record<string, string> = {
      P: 'Purchase', S: 'Sale', A: 'Award', D: 'Disposition',
      F: 'Tax Withholding', G: 'Gift', M: 'Option Exercise',
      X: 'Derivative Exercise', Z: 'Rule 10b5-1', C: 'Conversion', E: 'Expiration',
    };
    return MAP[code?.toUpperCase()] ?? code ?? '—';
  }

  function fmtNum(n: number | null | undefined): string {
    if (n == null || n === 0) return '—';
    return Math.abs(n).toLocaleString('en-US');
  }

  function fmtValue(n: number | null | undefined): string {
    if (n == null || n === 0) return '—';
    const abs = Math.abs(n);
    if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000) return `$${(abs / 1_000).toFixed(1)}K`;
    return `$${abs.toLocaleString('en-US')}`;
  }

  function fmtDate(d: string): string {
    if (!d) return '—';
    try { return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); }
    catch { return d; }
  }

  $: filtered = filter === 'all'
    ? transactions
    : transactions.filter(t => t.transactionCode?.toUpperCase() === filter);

  $: buys  = transactions.filter(t => t.transactionCode?.toUpperCase() === 'P').length;
  $: sells = transactions.filter(t => t.transactionCode?.toUpperCase() === 'S').length;
  $: totalBuyValue  = transactions.filter(t => t.transactionCode === 'P').reduce((s, t) => s + Math.abs(t.value ?? 0), 0);
  $: totalSellValue = transactions.filter(t => t.transactionCode === 'S').reduce((s, t) => s + Math.abs(t.value ?? 0), 0);
</script>

<div class="page">
  <div class="page-head">
    <div>
      <div class="page-title">Insider Transactions</div>
      <div class="page-sub">SEC Form 4 filings — insider buying &amp; selling activity</div>
    </div>
  </div>

  <!-- Search -->
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
  {:else if symbol && transactions.length > 0}
    <!-- Summary cards -->
    <div class="summary-row">
      <div class="stat-card buy-card">
        <div class="stat-label">Insider Purchases</div>
        <div class="stat-val">{buys}</div>
        <div class="stat-sub">{fmtValue(totalBuyValue)} total</div>
      </div>
      <div class="stat-card sell-card">
        <div class="stat-label">Insider Sales</div>
        <div class="stat-val">{sells}</div>
        <div class="stat-sub">{fmtValue(totalSellValue)} total</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Total Filings</div>
        <div class="stat-val">{transactions.length}</div>
        <div class="stat-sub">all transaction types</div>
      </div>
    </div>

    <!-- Filter chips -->
    <div class="filter-row">
      <button class="chip" class:active={filter === 'all'} on:click={() => filter = 'all'}>All ({transactions.length})</button>
      <button class="chip buy" class:active={filter === 'P'} on:click={() => filter = 'P'}>Purchases ({buys})</button>
      <button class="chip sell" class:active={filter === 'S'} on:click={() => filter = 'S'}>Sales ({sells})</button>
    </div>

    <!-- Table -->
    <div class="table-wrap">
      <table class="tx-table">
        <thead>
          <tr>
            <th>Date</th>
            <th>Insider</th>
            <th>Type</th>
            <th class="num">Shares</th>
            <th class="num">Value</th>
            <th>Filed</th>
          </tr>
        </thead>
        <tbody>
          {#each filtered as tx}
            {@const colorClass = CODE_COLOR[tx.transactionCode?.toUpperCase()] ?? ''}
            <tr>
              <td class="date">{fmtDate(tx.transactionDate)}</td>
              <td class="name">{tx.name || '—'}</td>
              <td>
                <span class="code-tag {colorClass}">{codeLabel(tx.transactionCode)}</span>
              </td>
              <td class="num" class:neg={tx.change < 0}>{fmtNum(tx.share)}</td>
              <td class="num">{fmtValue(tx.value)}</td>
              <td class="date muted">{fmtDate(tx.filingDate)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>

  {:else if symbol && transactions.length === 0 && !loading}
    <div class="empty">No insider transactions found for <strong>{symbol}</strong>.</div>
  {:else if !symbol}
    <div class="empty">Enter a stock symbol above to view insider activity.</div>
  {/if}
</div>

<style>
  .page { display: flex; flex-direction: column; gap: 16px; }

  .page-head { margin-bottom: 4px; }
  .page-title { font-size: 1.1rem; font-weight: 700; color: var(--text); }
  .page-sub   { font-size: 0.72rem; color: var(--muted); margin-top: 2px; }

  /* Search */
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

  /* Summary cards */
  .summary-row { display: flex; gap: 12px; flex-wrap: wrap; }
  .stat-card {
    background: var(--card); border: 1px solid var(--border);
    border-radius: 12px; padding: 14px 18px; min-width: 140px;
  }
  .buy-card  { border-color: rgba(34,197,94,0.25); }
  .sell-card { border-color: rgba(239,68,68,0.25); }
  .stat-label { font-size: 0.68rem; color: var(--muted); font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; }
  .stat-val   { font-size: 1.6rem; font-weight: 700; color: var(--text); line-height: 1.2; margin-top: 4px; }
  .stat-sub   { font-size: 0.68rem; color: var(--muted); margin-top: 2px; }
  .buy-card  .stat-val { color: var(--success); }
  .sell-card .stat-val { color: var(--danger); }

  /* Filter chips */
  .filter-row { display: flex; gap: 6px; flex-wrap: wrap; }
  .chip {
    padding: 5px 12px; border-radius: 20px; font-size: 0.73rem; font-weight: 600;
    border: 1px solid var(--border); background: var(--surface-1); color: var(--muted);
    cursor: pointer; transition: all 0.15s;
  }
  .chip:hover { color: var(--text); }
  .chip.active { background: var(--card); color: var(--text); border-color: var(--primary); }
  .chip.buy.active  { border-color: var(--success); color: var(--success); }
  .chip.sell.active { border-color: var(--danger);  color: var(--danger); }

  /* Table */
  .table-wrap { overflow-x: auto; }
  .tx-table {
    width: 100%; border-collapse: collapse;
    font-size: 0.8rem;
  }
  .tx-table th {
    text-align: left; padding: 8px 12px;
    font-size: 0.65rem; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.05em; color: var(--muted);
    border-bottom: 1px solid var(--border);
  }
  .tx-table th.num, .tx-table td.num { text-align: right; }
  .tx-table td {
    padding: 10px 12px; color: var(--text);
    border-bottom: 1px solid rgba(var(--border-rgb, 255,255,255), 0.05);
  }
  .tx-table tbody tr:hover { background: rgba(var(--primary-rgb),0.04); }

  .date { color: var(--text); font-variant-numeric: tabular-nums; white-space: nowrap; }
  .muted { color: var(--muted) !important; }
  .name { font-weight: 500; max-width: 200px; }
  .num  { font-variant-numeric: tabular-nums; }
  .neg  { color: var(--danger); }

  .code-tag {
    display: inline-block; padding: 2px 8px; border-radius: 4px;
    font-size: 0.68rem; font-weight: 700;
    background: rgba(var(--muted-rgb,150,150,150),0.12); color: var(--muted);
  }
  .code-tag.buy  { background: rgba(34,197,94,0.12); color: var(--success); }
  .code-tag.sell { background: rgba(239,68,68,0.12); color: var(--danger); }

  .error-box {
    padding: 14px 16px; border-radius: 10px;
    background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
    color: var(--danger); font-size: 0.82rem;
  }
  .empty { color: var(--muted); font-size: 0.83rem; padding: 40px; text-align: center; }
</style>
