<script lang="ts">
  import AllocationChart from '$lib/components/portfolio/AllocationChart.svelte';
  import MetricSummaryGrid from '$lib/components/portfolio/MetricSummaryGrid.svelte';
  import PortfolioGrowthChart from '$lib/components/portfolio/PortfolioGrowthChart.svelte';
  import PortfolioHistoryTable from '$lib/components/portfolio/PortfolioHistoryTable.svelte';
  import type {
    PortfolioMetricPeriod,
    PortfolioMetricsDashboard
  } from '$lib/services/portfolio-metrics.service';

  export let metrics: PortfolioMetricsDashboard;
  export let period: PortfolioMetricPeriod;
  export let periods: readonly PortfolioMetricPeriod[];
  export let title = 'Portfolio Metrics';
  export let subtitle = 'Portfolio value, P/L, return, allocation, and growth.';
  export let actionPath = '?/refresh';

  function periodUrl(value: string) {
    return `?period=${value}`;
  }
</script>

<div class="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
  <div>
    <h1 class="text-2xl font-bold tracking-normal">{title}</h1>
    <p class="mt-1 text-sm text-slate-500">{subtitle}</p>
  </div>

  <div class="flex flex-wrap items-center gap-2">
    <div class="flex rounded-md border border-line bg-white p-1">
      {#each periods as item}
        <a
          href={periodUrl(item)}
          class="rounded px-3 py-1.5 text-xs font-semibold transition {period === item ? 'bg-ink text-white' : 'text-slate-600 hover:bg-panel'}"
        >
          {item}
        </a>
      {/each}
    </div>
    <form method="POST" action={actionPath}>
      <button class="button h-9 px-3 text-xs" type="submit">Refresh</button>
    </form>
  </div>
</div>

{#if metrics.summary.status === 'insufficient_data'}
  <div class="mb-5 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
    {metrics.summary.message}
  </div>
{/if}

<MetricSummaryGrid summary={metrics.summary} />

<section class="mt-6 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
  <PortfolioGrowthChart history={metrics.history} currency={metrics.summary.currency} />
  <AllocationChart title="Allocation By Symbol" slices={metrics.allocation.bySymbol.slice(0, 8)} currency={metrics.summary.currency} />
</section>

<section class="mt-6 grid gap-6 xl:grid-cols-3">
  <AllocationChart title="By Asset Type" slices={metrics.allocation.byAssetType} currency={metrics.summary.currency} />
  <AllocationChart title="By Broker" slices={metrics.allocation.byBroker} currency={metrics.summary.currency} />
  <AllocationChart title="By Currency" slices={metrics.allocation.byCurrency} currency={metrics.summary.currency} />
</section>

<section class="mt-6">
  <PortfolioHistoryTable history={metrics.history} currency={metrics.summary.currency} />
</section>
