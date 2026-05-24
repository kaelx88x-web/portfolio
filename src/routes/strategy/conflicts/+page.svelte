<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import StrategyConflictCard from '$lib/components/strategy/StrategyConflictCard.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<div class="page-top">
  <PageHeader title="Strategy Conflicts" subtitle="Growth, income, options, cash reserve, volatility, and guardrail conflict detection." breadcrumb={[{ label: 'Strategy', href: '/strategy' }, { label: 'Conflicts' }]} />
  <a class="button-secondary" href="/strategy">Overview</a>
</div>

<div class="list">
  {#each data.conflicts as conflict}<StrategyConflictCard {conflict} />{/each}
</div>

<style>
  .page-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .list { display: grid; gap: 12px; }
</style>
