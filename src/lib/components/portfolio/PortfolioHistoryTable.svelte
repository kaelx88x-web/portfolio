<script lang="ts">
  import { money, percent } from '$lib/format';
  import type { PortfolioHistoryPoint } from '$lib/services/portfolio-metrics.service';

  export let history: PortfolioHistoryPoint[] = [];
  export let currency = 'USD';

  function signedPercent(value: number) {
    return `${value >= 0 ? '+' : ''}${percent(value)}`;
  }
</script>

<div class="card p-5">
  <h2 class="font-bold">Snapshot Timeline</h2>
  <div class="mt-4 table-wrap border-0 shadow-none">
    <table class="data-table">
      <thead>
        <tr>
          <th>Date</th>
          <th class="text-right">Portfolio</th>
          <th class="text-right">Cash</th>
          <th class="text-right">Market</th>
          <th class="text-right">Daily return</th>
          <th class="text-right">Cumulative</th>
        </tr>
      </thead>
      <tbody class="divide-y divide-line">
        {#each [...history].reverse() as point}
          <tr>
            <td class="font-semibold">{point.date}</td>
            <td class="text-right">{money(point.portfolioValue, currency)}</td>
            <td class="text-right">{money(point.cashValue, currency)}</td>
            <td class="text-right">{money(point.marketValue, currency)}</td>
            <td class:positive={point.dailyReturn >= 0} class:negative={point.dailyReturn < 0} class="text-right font-semibold">
              {signedPercent(point.dailyReturn)}
            </td>
            <td class:positive={point.cumulativeReturn >= 0} class:negative={point.cumulativeReturn < 0} class="text-right font-semibold">
              {signedPercent(point.cumulativeReturn)}
            </td>
          </tr>
        {/each}
        {#if history.length === 0}
          <tr><td colspan="6" class="text-center text-slate-500">No snapshots yet.</td></tr>
        {/if}
      </tbody>
    </table>
  </div>
</div>
