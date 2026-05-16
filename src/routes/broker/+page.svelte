<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import { RefreshCw } from 'lucide-svelte';

  export let data: PageData;
  export let form: ActionData = null;

  $: status = data.status;
  $: syncLogs = data.syncLogs ?? [];
  $: holdings = form?.holdings ?? [];
  $: accountInfo = form?.account_info ?? null;

  let syncing = false;

  function fmt(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }

  function relativeTime(date: string) {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }
</script>

<PageHeader title="Broker Sync" subtitle="Moomoo OpenD — sync live positions into your portfolio." />

<!-- Action bar -->
<div class="action-bar">
  <form
    method="POST"
    action="?/sync"
    use:enhance={() => {
      syncing = true;
      return async ({ update }) => {
        try { await update(); } finally { syncing = false; }
      };
    }}
  >
    <button class="button-primary" disabled={!status?.connected || syncing}>
      <RefreshCw size={14} class={syncing ? 'spin' : ''} />
      {syncing ? 'Syncing…' : 'Sync Moomoo'}
    </button>
  </form>
</div>

<!-- Feedback message -->
{#if form?.message}
  <div class="msg-banner" class:success={form.success} class:error={!form.success}>
    {form.message}
    {#if form.synced_at}
      <span class="msg-time">at {new Date(form.synced_at).toLocaleTimeString()}</span>
    {/if}
  </div>
{/if}

<!-- Status cards -->
<div class="status-grid">
  <div class="card stat-card">
    <div class="stat-label">OpenD</div>
    <div class="stat-row-inner">
      <span class="dot" class:dot-ok={status?.connected} class:dot-err={!status?.connected}></span>
      <span class="stat-val">{status?.connected ? 'Connected' : (status ? 'Disconnected' : 'Unreachable')}</span>
    </div>
    <p class="stat-sub">{status?.message ?? 'Start OpenD to connect'}</p>
  </div>

  <div class="card stat-card">
    <div class="stat-label">Quote Feed</div>
    <div class="stat-row-inner">
      <span class="dot" class:dot-ok={status?.quote_logged_in} class:dot-warn={!status?.quote_logged_in}></span>
      <span class="stat-val">{status?.quote_logged_in ? 'Logged in' : '—'}</span>
    </div>
  </div>

  <div class="card stat-card">
    <div class="stat-label">Trade API</div>
    <div class="stat-row-inner">
      <span class="dot" class:dot-ok={status?.trade_logged_in} class:dot-warn={!status?.trade_logged_in}></span>
      <span class="stat-val">{status?.trade_logged_in ? 'Logged in' : '—'}</span>
    </div>
  </div>

  <div class="card stat-card">
    <div class="stat-label">Total Assets</div>
    <span class="stat-val">{accountInfo?.total_assets ? fmt(accountInfo.total_assets) : '—'}</span>
    {#if accountInfo?.cash}
      <p class="stat-sub">Cash: {fmt(accountInfo.cash)}</p>
    {/if}
  </div>
</div>

<!-- Synced holdings preview (only after a sync action) -->
{#if holdings.length > 0}
  <div class="card section-card">
    <div class="section-header">
      <span class="section-title">Synced Positions</span>
      <span class="badge-count">{holdings.length}</span>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Name</th>
            <th class="th-r">Qty</th>
            <th class="th-r">Avg Cost</th>
            <th class="th-r">Mkt Value</th>
            <th class="th-r">Unr. P&amp;L</th>
          </tr>
        </thead>
        <tbody>
          {#each holdings as h}
            <tr>
              <td class="td-symbol">{h.symbol}</td>
              <td class="td-muted">{h.name ?? '—'}</td>
              <td class="td-r">{h.quantity}</td>
              <td class="td-r">{fmt(h.average_cost)}</td>
              <td class="td-r">{fmt(h.market_value)}</td>
              <td class="td-r" class:positive={h.unrealized_pl >= 0} class:negative={h.unrealized_pl < 0}>
                {fmt(h.unrealized_pl)}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}

<!-- Sync activity log from DB -->
<div class="card section-card">
  <div class="section-header">
    <span class="section-title">Sync History</span>
  </div>
  {#if syncLogs.length === 0}
    <p class="empty-text">No sync activity yet. Press "Sync Moomoo" to start.</p>
  {:else}
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Time</th>
            <th>Broker</th>
            <th>Event</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {#each syncLogs as log}
            <tr>
              <td class="td-muted td-sm">{relativeTime(log.createdAt.toString())}</td>
              <td>{log.broker}</td>
              <td class="td-muted">
                {#if log.status === 'success'}
                  Imported {log.recordCount} position{log.recordCount !== 1 ? 's' : ''}
                {:else}
                  {log.errorMessage ?? 'Sync failed'}
                {/if}
              </td>
              <td>
                <span class="badge" class:badge-ok={log.status === 'success'} class:badge-err={log.status !== 'success'}>
                  {log.status}
                </span>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>

<style>
  .action-bar   { display: flex; justify-content: flex-end; margin-bottom: 16px; }

  .button-primary {
    display: flex; align-items: center; gap: 6px;
    padding: 8px 16px; border-radius: 8px;
    background: var(--primary); border: none;
    font-size: 0.8rem; font-weight: 600; color: #fff;
    cursor: pointer; transition: opacity 0.15s;
  }
  .button-primary:disabled { opacity: 0.45; cursor: not-allowed; }
  .button-primary:not(:disabled):hover { opacity: 0.85; }

  :global(.spin) { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }

  .msg-banner {
    margin-bottom: 16px; padding: 10px 14px;
    border-radius: 8px; font-size: 0.8rem; font-weight: 500;
    border: 1px solid;
  }
  .msg-banner.success { background: rgba(45,212,160,0.08); border-color: rgba(45,212,160,0.3); color: #2dd4a0; }
  .msg-banner.error   { background: rgba(249,107,126,0.08); border-color: rgba(249,107,126,0.3); color: #f96b7e; }
  .msg-time { font-size: 0.7rem; opacity: 0.7; margin-left: 8px; }

  .status-grid  { display: grid; grid-template-columns: repeat(2,1fr); gap: 12px; margin-bottom: 16px; }
  @media (min-width: 900px) { .status-grid { grid-template-columns: repeat(4,1fr); } }

  .stat-card { padding: 14px 16px; }
  .stat-label { font-size: 0.65rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 8px; }
  .stat-row-inner { display: flex; align-items: center; gap: 6px; }
  .stat-val { font-size: 0.95rem; font-weight: 700; color: var(--text); }
  .stat-sub { font-size: 0.7rem; color: var(--muted); margin-top: 4px; }

  .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .dot-ok   { background: var(--success); }
  .dot-warn { background: var(--muted); }
  .dot-err  { background: var(--danger); }

  .section-card   { padding: 16px; margin-bottom: 16px; }
  .section-header { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
  .section-title  { font-size: 0.85rem; font-weight: 600; color: var(--text); }
  .badge-count    { font-size: 0.65rem; font-weight: 700; padding: 2px 7px; border-radius: 20px; background: rgba(var(--primary-rgb),0.12); color: var(--primary); }

  .empty-text  { font-size: 0.78rem; color: var(--muted); }

  .th-r      { text-align: right; }
  .td-r      { text-align: right; }
  .td-symbol { font-weight: 700; color: var(--primary); }
  .td-muted  { color: var(--muted); }
  .td-sm     { font-size: 0.72rem; }
  .positive  { color: var(--success); }
  .negative  { color: var(--danger); }

  .badge { font-size: 0.65rem; font-weight: 700; padding: 2px 7px; border-radius: 20px; }
  .badge-ok  { background: rgba(var(--success-rgb),0.12); color: var(--success); }
  .badge-err { background: rgba(var(--danger-rgb),0.12); color: var(--danger); }
</style>
