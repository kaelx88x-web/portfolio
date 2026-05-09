<script lang="ts">
  import { date, money, number, percent } from '$lib/format';

  export let data;

  const colors = ['#2563eb', '#147d52', '#b45309', '#7c3aed', '#0f766e'];
</script>

<div class="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
  <div>
    <h1 class="text-2xl font-bold tracking-normal">Portfolio Dashboard</h1>
    <p class="mt-1 text-sm text-slate-500">Manual tracker with mock prices and calculated holdings.</p>
  </div>
  <a href="/transactions" class="button">Add transaction</a>
</div>

<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
  <div class="card p-5">
    <div class="label">Total portfolio value</div>
    <div class="mt-3 text-2xl font-bold">{money(data.summary.totalPortfolioValue)}</div>
  </div>
  <div class="card p-5">
    <div class="label">Today change</div>
    <div class="mt-3 text-2xl font-bold positive">{money(data.summary.todayChange)}</div>
  </div>
  <div class="card p-5">
    <div class="label">Total gain / loss</div>
    <div class:positive={data.summary.totalGainLoss >= 0} class:negative={data.summary.totalGainLoss < 0} class="mt-3 text-2xl font-bold">
      {money(data.summary.totalGainLoss)}
    </div>
  </div>
  <div class="card p-5">
    <div class="label">Cash balance</div>
    <div class="mt-3 text-2xl font-bold">{money(data.summary.cashBalance)}</div>
  </div>
</section>

<section class="mt-6 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
  <div class="card p-5">
    <div class="mb-4 flex items-center justify-between gap-3">
      <h2 class="font-bold">Top holdings</h2>
      <a href="/holdings" class="text-sm font-semibold text-accent">View all</a>
    </div>
    <div class="table-wrap border-0 shadow-none">
      <table class="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Quantity</th>
            <th>Value</th>
            <th>P/L</th>
            <th>Allocation</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          {#each data.topHoldings as holding}
            <tr>
              <td>
                <div class="font-semibold text-ink">{holding.symbol}</div>
                <div class="text-xs text-slate-500">{holding.name}</div>
              </td>
              <td>{number(holding.quantity)}</td>
              <td>{money(holding.marketValue, holding.currency)}</td>
              <td class:positive={holding.unrealizedPnl >= 0} class:negative={holding.unrealizedPnl < 0}>
                {money(holding.unrealizedPnl, holding.currency)}
              </td>
              <td>{percent(holding.allocationPercentage)}</td>
            </tr>
          {/each}
          {#if data.topHoldings.length === 0}
            <tr><td colspan="5" class="text-center text-slate-500">No holdings yet.</td></tr>
          {/if}
        </tbody>
      </table>
    </div>
  </div>

  <div class="card p-5">
    <h2 class="font-bold">Allocation by symbol</h2>
    <div class="mt-5 space-y-4">
      {#each data.allocationBySymbol as slice, index}
        <div>
          <div class="mb-2 flex items-center justify-between text-sm">
            <span class="font-semibold">{slice.label}</span>
            <span class="text-slate-500">{percent(slice.percentage)}</span>
          </div>
          <div class="h-3 overflow-hidden rounded-md bg-panel">
            <div class="h-full rounded-md" style={`width:${slice.percentage}%;background:${colors[index % colors.length]}`}></div>
          </div>
        </div>
      {/each}
      {#if data.allocationBySymbol.length === 0}
        <p class="text-sm text-slate-500">Add buy transactions to build allocation.</p>
      {/if}
    </div>
  </div>
</section>

<section class="mt-6 grid gap-6 xl:grid-cols-2">
  <div class="card p-5">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="font-bold">Recent transactions</h2>
      <a href="/transactions" class="text-sm font-semibold text-accent">Manage</a>
    </div>
    <div class="space-y-3">
      {#each data.recentTransactions as transaction}
        <div class="flex items-center justify-between gap-3 rounded-md border border-line p-3">
          <div>
            <div class="text-sm font-semibold">{transaction.asset?.symbol ?? transaction.type.toUpperCase()}</div>
            <div class="text-xs text-slate-500">{transaction.account.name} - {date(transaction.tradeDate)}</div>
          </div>
          <div class="text-right text-sm">
            <div class="font-semibold capitalize">{transaction.type}</div>
            <div class="text-slate-500">{number(transaction.quantity)} @ {money(transaction.price, transaction.currency)}</div>
          </div>
        </div>
      {/each}
    </div>
  </div>

  <div class="card p-5">
    <div class="mb-4 flex items-center justify-between">
      <h2 class="font-bold">Watchlist</h2>
      <a href="/watchlist" class="text-sm font-semibold text-accent">Open</a>
    </div>
    <div class="space-y-3">
      {#each data.watchlists.flatMap((watchlist) => watchlist.items) as item}
        <div class="flex items-center justify-between rounded-md border border-line p-3">
          <div>
            <div class="text-sm font-semibold">{item.asset.symbol}</div>
            <div class="text-xs text-slate-500">{item.asset.name}</div>
          </div>
          <div class="text-sm font-semibold">{money(item.asset.latestPrice, item.asset.currency)}</div>
        </div>
      {/each}
      {#if data.watchlists.flatMap((watchlist) => watchlist.items).length === 0}
        <p class="text-sm text-slate-500">No watchlist items yet.</p>
      {/if}
    </div>
  </div>
</section>
