<script lang="ts">
  import type { Holding } from '$lib/types/portfolio';
  import LoadingSkeleton from '../LoadingSkeleton.svelte';
  import EmptyState from '../EmptyState.svelte';

  export let holdings: Holding[] = [];
  export let loading = false;

  let search = '';
  // Only numeric-sortable fields
  type NumericHoldingKey = 'quantity' | 'averageCost' | 'marketValue' | 'unrealizedPnl' | 'allocationPercentage';
  let sortKey: NumericHoldingKey = 'marketValue';
  let sortAsc = false;

  $: filtered = holdings
    .filter(h =>
      !search ||
      h.symbol.toLowerCase().includes(search.toLowerCase()) ||
      h.name.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) => {
      const av = a[sortKey] as number;
      const bv = b[sortKey] as number;
      return sortAsc ? av - bv : bv - av;
    });

  function sort(key: NumericHoldingKey) {
    if (sortKey === key) sortAsc = !sortAsc;
    else { sortKey = key; sortAsc = false; }
  }

  function money(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }
</script>

<div class="ht-bar">
  <input class="field ht-search" placeholder="Search symbol or name…" bind:value={search} />
  <a href="/holdings/export" class="button-secondary" style="font-size:0.75rem;height:36px;padding:0 12px">Export CSV</a>
</div>

<div class="table-wrap">
  {#if loading}
    <div style="padding:16px"><LoadingSkeleton variant="table" rows={8} /></div>
  {:else if filtered.length === 0}
    <EmptyState
      icon="◎"
      title="No holdings found"
      description="Import transactions or sync a broker to see positions here."
      ctaLabel="Import CSV"
      ctaHref="/import"
    />
  {:else}
    <table class="data-table">
      <thead>
        <tr>
          <th>Symbol</th>
          <th>Name</th>
          <th class="th-r" on:click={() => sort('quantity')} style="cursor:pointer">Qty</th>
          <th class="th-r" on:click={() => sort('averageCost')} style="cursor:pointer">Avg Cost</th>
          <th class="th-r" on:click={() => sort('marketValue')} style="cursor:pointer">Mkt Value</th>
          <th class="th-r" on:click={() => sort('unrealizedPnl')} style="cursor:pointer">Unr. P&amp;L</th>
          <th class="th-r" on:click={() => sort('allocationPercentage')} style="cursor:pointer">Alloc %</th>
          <th>Account</th>
        </tr>
      </thead>
      <tbody>
        {#each filtered as h}
          <tr>
            <td class="td-symbol">{h.symbol}</td>
            <td class="td-muted">{h.name}</td>
            <td class="td-r">{h.quantity.toFixed(4)}</td>
            <td class="td-r">{money(h.averageCost)}</td>
            <td class="td-r">{money(h.marketValue)}</td>
            <td class="td-r" class:positive={h.unrealizedPnl >= 0} class:negative={h.unrealizedPnl < 0}>
              {money(h.unrealizedPnl)}
            </td>
            <td class="td-r">{h.allocationPercentage.toFixed(1)}%</td>
            <td class="td-muted td-sm">{h.accountName}</td>
          </tr>
        {/each}
      </tbody>
    </table>
  {/if}
</div>

<style>
  .ht-bar    { display:flex; gap:8px; align-items:center; margin-bottom:12px; }
  .ht-search { max-width:280px; height:36px; }
  .th-r      { text-align:right; }
  .td-r      { text-align:right; }
  .td-symbol { font-weight:700; color:#6c8fff; }
  .td-muted  { color:#7a8fb0; }
  .td-sm     { font-size:0.72rem; }
  .positive  { color:#2dd4a0; }
  .negative  { color:#f96b7e; }
</style>
