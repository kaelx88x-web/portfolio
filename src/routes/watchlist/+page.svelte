<script lang="ts">
  import type { PageData } from './$types';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import WatchlistTable from '$lib/components/portfolioai/tables/WatchlistTable.svelte';
  import EmptyState from '$lib/components/portfolioai/EmptyState.svelte';

  export let data: PageData;

  $: items = (data.items ?? []).map((w: any) => ({
    id: w.id,
    symbol: w.symbol,
    name: w.name ?? undefined,
    notes: w.notes ?? undefined,
  }));
</script>

<PageHeader
  title="Watchlist"
  subtitle="Track ideas and signals before they become positions."
  breadcrumb={[{ label: 'Portfolio', href: '/dashboard' }, { label: 'Watchlist' }]}
/>

<div class="toolbar">
  <a href="/watchlist/add" class="button">+ Add Symbol</a>
</div>

{#if items.length === 0}
  <EmptyState
    icon="◎"
    title="Watchlist is empty"
    description="Add symbols to track ideas before they become holdings."
  />
{:else}
  <WatchlistTable {items} />
{/if}

<style>
  .toolbar { margin-bottom: 16px; }
</style>
