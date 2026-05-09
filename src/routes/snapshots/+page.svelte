<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;
  $: snapshots = data.snapshots ?? [];

  function fmt(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }
  function fmtDate(d: string | Date) {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
</script>

<div class="mb-6">
  <h1 class="text-2xl font-bold">Portfolio Snapshots</h1>
  <p class="mt-1 text-sm text-slate-500">Point-in-time portfolio state recorded after each Moomoo sync.</p>
</div>

{#if snapshots.length === 0}
  <div class="card px-6 py-16 text-center text-sm text-slate-400">
    No snapshots yet. Go to <a href="/broker" class="underline">Broker Sync</a> and click Sync Moomoo to create the first one.
  </div>
{:else}
  <div class="card">
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th class="text-right">Total Value</th>
            <th class="text-right">Cash</th>
            <th class="text-right">Holdings</th>
            <th>Top Allocations</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          {#each snapshots as snap}
            {@const allocation = JSON.parse(snap.allocationJson)}
            {@const topAllocs = Object.entries(allocation)
              .sort((a, b) => Number(b[1]) - Number(a[1]))
              .slice(0, 5)}
            <tr>
              <td class="font-semibold">{fmtDate(snap.snapshotDate)}</td>
              <td class="text-right font-semibold">{fmt(snap.totalValue)}</td>
              <td class="text-right text-slate-500">{fmt(snap.cashBalance)}</td>
              <td class="text-right">{snap.holdingsCount}</td>
              <td>
                <div class="flex flex-wrap gap-1">
                  {#each topAllocs as [symbol, p]}
                    <span class="rounded bg-panel px-2 py-0.5 text-xs font-medium">
                      {symbol} {Number(p).toFixed(1)}%
                    </span>
                  {/each}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}
