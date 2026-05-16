<script lang="ts">
  import { enhance } from '$app/forms';
  import { date, money, number } from '$lib/format';

  export let data;
  export let form;

  $: active = data.activeAccount;
  $: canTrade = active?.canTrade;
  $: recentSymbol = data.holdings[0]?.symbol ?? 'US.NIO';
  $: recentPrice = data.holdings[0]?.marketPrice ?? 5;

  let submitting = false;

  function accountTypeLabel(type: string) {
    return type === 'paper' ? 'Simulated' : type === 'brokerage' ? 'Brokerage' : type;
  }
</script>

<div class="mb-6 flex flex-wrap items-start justify-between gap-4">
  <div>
    <h1 class="text-2xl font-bold">Paper Trading</h1>
    <p class="mt-1 text-sm text-slate-500">Sandbox account switching and simulated buy/sell testing.</p>
  </div>
  <div class="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-emerald-800">
    Sandbox Mode
  </div>
</div>

{#if form?.message}
  <div class="mb-4 rounded-md border border-line bg-white px-4 py-3 text-sm">{form.message}</div>
{/if}

<section class="mb-6 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
  <div class="card p-5">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
      <div>
        <div class="label">Current active account</div>
        <div class="mt-1 text-xl font-bold">{active.name}</div>
        <div class="mt-1 text-sm text-slate-500">
          {active.brokerName} - {accountTypeLabel(active.accountType)} - {active.currency}
        </div>
      </div>
      <span class="rounded-md border px-3 py-1 text-xs font-bold {canTrade ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700'}">
        {canTrade ? 'Paper trading enabled' : 'Read-only account'}
      </span>
    </div>

    <form method="POST" action="?/switch" class="grid gap-3 sm:grid-cols-[1fr_auto]">
      <select name="accountId" class="field" aria-label="Active account">
        {#each data.accounts as account}
          <option value={account.id} selected={account.id === active.id}>
            {account.name} - {account.accountType === 'paper' ? 'Sandbox' : 'Read-only'}
          </option>
        {/each}
      </select>
      <button class="button-secondary">Switch account</button>
    </form>
  </div>

  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
    <div class="card p-5">
      <div class="label">Total sandbox value</div>
      <div class="mt-2 text-2xl font-bold">{money(data.summary.totalValue, active.currency)}</div>
    </div>
    <div class="card p-5">
      <div class="label">Cash balance</div>
      <div class="mt-2 text-2xl font-bold">{money(data.summary.cashBalance, active.currency)}</div>
    </div>
  </div>
</section>

<section class="mb-6 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
  <form
    method="POST"
    class="card space-y-4 p-5"
    use:enhance={() => {
      submitting = true;
      return async ({ update }) => {
        try {
          await update();
        } finally {
          submitting = false;
        }
      };
    }}
  >
    <div class="flex items-center justify-between gap-3">
      <h2 class="font-bold">Paper order ticket</h2>
      <span class="text-xs font-semibold uppercase tracking-wide text-slate-500">Immediate fill</span>
    </div>

    <fieldset disabled={!canTrade || submitting} class="space-y-4">
      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="symbol">Symbol</label>
          <input id="symbol" name="symbol" class="field mt-1" value={recentSymbol} required />
        </div>
        <div>
          <label class="label" for="price">Price</label>
          <input id="price" name="price" class="field mt-1" type="number" step="0.0001" min="0.0001" value={recentPrice} required />
        </div>
      </div>

      <div class="grid gap-4 sm:grid-cols-2">
        <div>
          <label class="label" for="quantity">Quantity</label>
          <input id="quantity" name="quantity" class="field mt-1" type="number" step="0.000001" min="0.000001" value="1" required />
        </div>
        <div>
          <label class="label" for="fee">Fee</label>
          <input id="fee" name="fee" class="field mt-1" type="number" step="0.0001" min="0" value="0" required />
        </div>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <button class="button" formaction="?/buy">Buy</button>
        <button class="button-secondary" formaction="?/sell">Sell</button>
      </div>
    </fieldset>

    {#if !canTrade}
      <div class="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
        Real accounts are read-only. Switch to a paper account to enable simulated orders.
      </div>
    {/if}
  </form>

  <div class="card">
    <div class="border-b border-line px-5 py-4">
      <h2 class="font-bold">Paper positions</h2>
    </div>
    <div class="table-wrap border-0 shadow-none">
      <table class="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Avg cost</th>
            <th class="text-right">Price</th>
            <th class="text-right">Value</th>
            <th class="text-right">P/L</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          {#each data.holdings as holding}
            <tr>
              <td class="font-semibold">{holding.symbol}</td>
              <td class="text-right">{number(holding.quantity)}</td>
              <td class="text-right">{money(holding.averageCost, holding.currency)}</td>
              <td class="text-right">{money(holding.marketPrice, holding.currency)}</td>
              <td class="text-right font-semibold">{money(holding.marketValue, holding.currency)}</td>
              <td class="text-right" class:positive={holding.unrealizedPnl >= 0} class:negative={holding.unrealizedPnl < 0}>
                {money(holding.unrealizedPnl, holding.currency)}
              </td>
            </tr>
          {/each}
          {#if data.holdings.length === 0}
            <tr><td colspan="6" class="text-center text-slate-500">No paper positions yet.</td></tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>
</section>

<div class="card">
  <div class="border-b border-line px-5 py-4">
    <h2 class="font-bold">Paper order history</h2>
  </div>
  <div class="table-wrap border-0 shadow-none">
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th>Symbol</th>
          <th>Side</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Price</th>
          <th class="text-right">Fee</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-line">
        {#each data.orders as order}
          <tr>
            <td>{date(order.tradeDate)}</td>
            <td class="font-semibold">{order.asset?.symbol ?? '-'}</td>
            <td class="capitalize">{order.type}</td>
            <td class="text-right">{number(order.quantity)}</td>
            <td class="text-right">{money(order.price, order.currency)}</td>
            <td class="text-right">{money(order.fee, order.currency)}</td>
          </tr>
        {/each}
        {#if data.orders.length === 0}
          <tr><td colspan="6" class="text-center text-slate-500">No paper orders yet.</td></tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>
