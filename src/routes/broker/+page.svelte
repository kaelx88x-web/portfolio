<script lang="ts">
  import { enhance } from '$app/forms';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData = null;

  $: status = data.status;
  $: holdings = form?.holdings ?? [];
  $: accountInfo = form?.account_info ?? {};

  let syncing = false;

  function fmt(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }
  function pct(n: number) {
    return (n >= 0 ? '+' : '') + (n * 100).toFixed(2) + '%';
  }
</script>

<div class="mb-6 flex flex-wrap items-start justify-between gap-4">
  <div>
    <h1 class="text-2xl font-bold">Broker Sync</h1>
    <p class="mt-1 text-sm text-slate-500">Moomoo OpenD — sync live positions into your portfolio.</p>
  </div>

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
    <button class="button" disabled={!status?.connected || syncing}>
      {syncing ? 'Syncing…' : 'Sync Moomoo'}
    </button>
  </form>
</div>

{#if form?.message}
  <div class="mb-5 rounded-md border px-4 py-3 text-sm {form.success ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}">
    {form.message}
    {#if form.synced_at}
      <span class="ml-2 text-xs opacity-60">at {new Date(form.synced_at).toLocaleTimeString()}</span>
    {/if}
  </div>
{/if}

<!-- Status Cards -->
<div class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
  <div class="card p-4">
    <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">OpenD</div>
    <div class="mt-2 flex items-center gap-2">
      <span class="h-2.5 w-2.5 rounded-full {status?.connected ? 'bg-green-500' : 'bg-red-400'}"></span>
      <span class="font-semibold">{status?.connected ? 'Connected' : 'Disconnected'}</span>
    </div>
    <p class="mt-1 truncate text-xs text-slate-400">{status?.message ?? '—'}</p>
  </div>

  <div class="card p-4">
    <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Quote</div>
    <div class="mt-2 font-semibold">{status?.quote_logged_in ? 'Logged in' : '—'}</div>
  </div>

  <div class="card p-4">
    <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Trade</div>
    <div class="mt-2 font-semibold">{status?.trade_logged_in ? 'Logged in' : '—'}</div>
  </div>

  <div class="card p-4">
    <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Assets</div>
    <div class="mt-2 font-semibold">{accountInfo.total_assets ? fmt(accountInfo.total_assets) : '—'}</div>
    {#if accountInfo.cash}
      <p class="mt-0.5 text-xs text-slate-400">Cash: {fmt(accountInfo.cash)}</p>
    {/if}
  </div>
</div>

<!-- Holdings Table -->
<div class="card">
  <div class="border-b border-line px-5 py-4">
    <h2 class="font-bold">Live Holdings {holdings.length ? `(${holdings.length})` : ''}</h2>
    <p class="mt-0.5 text-xs text-slate-500">
      {#if holdings.length}
        From last sync. Click Sync Moomoo to refresh.
      {:else}
        Click Sync Moomoo to load positions from OpenD.
      {/if}
    </p>
  </div>

  {#if holdings.length === 0}
    <div class="px-5 py-12 text-center text-sm text-slate-400">
      {status?.connected ? 'Click "Sync Moomoo" to pull live positions.' : 'Start Moomoo OpenD first, then sync.'}
    </div>
  {:else}
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Type</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Avg Cost</th>
            <th class="text-right">Price</th>
            <th class="text-right">Market Value</th>
            <th class="text-right">Unrealized P/L</th>
            <th class="text-right">P/L %</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          {#each holdings as h}
            <tr>
              <td class="font-semibold">{h.symbol}</td>
              <td class="text-xs text-slate-500">{h.asset_type}</td>
              <td class="text-right">{h.quantity}</td>
              <td class="text-right">{fmt(h.average_cost)}</td>
              <td class="text-right">{fmt(h.market_price)}</td>
              <td class="text-right font-semibold">{fmt(h.market_value)}</td>
              <td class="text-right {h.unrealized_pl >= 0 ? 'positive' : 'negative'}">{fmt(h.unrealized_pl)}</td>
              <td class="text-right {h.unrealized_pl_percent >= 0 ? 'positive' : 'negative'}">{pct(h.unrealized_pl_percent)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
