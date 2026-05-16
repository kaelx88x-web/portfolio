<script lang="ts">
  import { date, money, percent } from '$lib/format';
  import type { PortfolioMetricSummary } from '$lib/services/portfolio-metrics.service';

  export let summary: PortfolioMetricSummary;

  function signedPercent(value: number) {
    return `${value >= 0 ? '+' : ''}${percent(value)}`;
  }
</script>

<section class="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
  <div class="card p-5">
    <div class="label">Total portfolio value</div>
    <div class="mt-3 text-2xl font-bold">{money(summary.portfolioValue, summary.currency)}</div>
    <div class="mt-1 text-xs text-slate-500">
      {summary.snapshotDate ? `Snapshot ${date(summary.snapshotDate)}` : 'Current transaction view'}
    </div>
  </div>
  <div class="card p-5">
    <div class="label">Cash balance</div>
    <div class="mt-3 text-2xl font-bold">{money(summary.cashValue, summary.currency)}</div>
    <div class="mt-1 text-xs text-slate-500">{percent(summary.cashValue / Math.max(summary.portfolioValue, 1) * 100)} of portfolio</div>
  </div>
  <div class="card p-5">
    <div class="label">Market value</div>
    <div class="mt-3 text-2xl font-bold">{money(summary.marketValue, summary.currency)}</div>
    <div class="mt-1 text-xs text-slate-500">{summary.holdingsCount} active holding{summary.holdingsCount === 1 ? '' : 's'}</div>
  </div>
  <div class="card p-5">
    <div class="label">Cost basis</div>
    <div class="mt-3 text-2xl font-bold">{money(summary.costBasis, summary.currency)}</div>
    <div class="mt-1 text-xs text-slate-500">Snapshot-based open position cost</div>
  </div>
</section>

<section class="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
  <div class="card p-5">
    <div class="label">Unrealized P/L</div>
    <div class:positive={summary.unrealizedPnl >= 0} class:negative={summary.unrealizedPnl < 0} class="mt-3 text-2xl font-bold">
      {money(summary.unrealizedPnl, summary.currency)}
    </div>
    <div class="mt-1 text-xs text-slate-500">{signedPercent(summary.unrealizedPnlPercent)}</div>
  </div>
  <div class="card p-5">
    <div class="label">Realized P/L</div>
    <div class:positive={summary.realizedPnl >= 0} class:negative={summary.realizedPnl < 0} class="mt-3 text-2xl font-bold">
      {money(summary.realizedPnl, summary.currency)}
    </div>
    <div class="mt-1 text-xs text-slate-500">From sell transactions</div>
  </div>
  <div class="card p-5">
    <div class="label">Total return</div>
    <div class:positive={summary.totalReturn >= 0} class:negative={summary.totalReturn < 0} class="mt-3 text-2xl font-bold">
      {money(summary.totalReturn, summary.currency)}
    </div>
    <div class="mt-1 text-xs text-slate-500">{signedPercent(summary.totalReturnPercent)}</div>
  </div>
  <div class="card p-5">
    <div class="label">YTD return</div>
    <div class:positive={summary.ytdReturn >= 0} class:negative={summary.ytdReturn < 0} class="mt-3 text-2xl font-bold">
      {signedPercent(summary.ytdReturn)}
    </div>
    <div class="mt-1 text-xs text-slate-500">Daily {signedPercent(summary.dailyReturn)} / MTD {signedPercent(summary.monthlyReturn)}</div>
  </div>
</section>
