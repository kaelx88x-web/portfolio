<script lang="ts">
  import { money, percent } from '$lib/format';
  import type { PortfolioHistoryPoint } from '$lib/services/portfolio-metrics.service';

  export let history: PortfolioHistoryPoint[] = [];
  export let currency = 'USD';

  $: maxValue = Math.max(...history.map((point) => point.portfolioValue), 1);
</script>

<div class="card p-5">
  <div class="mb-4 flex flex-wrap items-start justify-between gap-3">
    <div>
      <h2 class="font-bold">Portfolio Growth</h2>
      <p class="mt-1 text-xs text-slate-500">{history.length} snapshot{history.length === 1 ? '' : 's'} in this view</p>
    </div>
    <div class="text-right text-sm">
      <div class="font-semibold">{money(history.at(-1)?.portfolioValue ?? 0, currency)}</div>
      <div class="text-xs text-slate-500">Latest value</div>
    </div>
  </div>

  {#if history.length === 0}
    <div class="rounded-md border border-line bg-panel px-4 py-12 text-center text-sm text-slate-500">
      Create snapshots to build the growth timeline.
    </div>
  {:else}
    <div class="flex h-64 items-end gap-2 border-b border-line px-1">
      {#each history as point}
        <div class="group flex min-w-6 flex-1 flex-col items-center justify-end">
          <div
            class="w-full rounded-t bg-accent transition group-hover:bg-ink"
            style={`height:${Math.max((point.portfolioValue / maxValue) * 100, 4)}%`}
            title={`${point.date}: ${money(point.portfolioValue, currency)} (${percent(point.cumulativeReturn)})`}
          ></div>
        </div>
      {/each}
    </div>
    <div class="mt-3 flex justify-between text-xs text-slate-500">
      <span>{history[0]?.date}</span>
      <span>{history.at(-1)?.date}</span>
    </div>
  {/if}
</div>
