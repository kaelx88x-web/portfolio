<script lang="ts">
  import { money, number, percent } from '$lib/format';

  export let data;
</script>

<div class="mb-6">
  <h1 class="text-2xl font-bold">Holdings</h1>
  <p class="mt-1 text-sm text-slate-500">Positions are calculated from buy and sell transactions.</p>
</div>

<div class="mb-6 grid gap-4 sm:grid-cols-3">
  <div class="card p-5">
    <div class="label">Invested market value</div>
    <div class="mt-2 text-xl font-bold">{money(data.holdings.reduce((sum, holding) => sum + holding.marketValue, 0))}</div>
  </div>
  <div class="card p-5">
    <div class="label">Cash balance</div>
    <div class="mt-2 text-xl font-bold">{money(data.cashBalance)}</div>
  </div>
  <div class="card p-5">
    <div class="label">Open positions</div>
    <div class="mt-2 text-xl font-bold">{data.holdings.length}</div>
  </div>
</div>

<div class="table-wrap">
  <table class="data-table">
    <thead>
      <tr>
        <th>Symbol</th>
        <th>Name</th>
        <th>Quantity</th>
        <th>Avg cost</th>
        <th>Current price</th>
        <th>Market value</th>
        <th>Unrealized P/L</th>
        <th>Allocation</th>
        <th>Account</th>
      </tr>
    </thead>
    <tbody class="divide-y divide-line">
      {#each data.holdings as holding}
        <tr>
          <td class="font-semibold text-ink">{holding.symbol}</td>
          <td>{holding.name}</td>
          <td>{number(holding.quantity)}</td>
          <td>{money(holding.averageCost, holding.currency)}</td>
          <td>{money(holding.marketPrice, holding.currency)}</td>
          <td class="font-semibold text-ink">{money(holding.marketValue, holding.currency)}</td>
          <td class:positive={holding.unrealizedPnl >= 0} class:negative={holding.unrealizedPnl < 0}>
            {money(holding.unrealizedPnl, holding.currency)}
          </td>
          <td>{percent(holding.allocationPercentage)}</td>
          <td>{holding.accountName}</td>
        </tr>
      {/each}
      {#if data.holdings.length === 0}
        <tr><td colspan="9" class="text-center text-slate-500">No holdings yet. Add buy transactions first.</td></tr>
      {/if}
    </tbody>
  </table>
</div>
