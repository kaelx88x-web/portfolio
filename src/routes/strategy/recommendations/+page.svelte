<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import StrategyRecommendationCard from '$lib/components/strategy/StrategyRecommendationCard.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<div class="page-top">
  <PageHeader title="Strategy Recommendations" subtitle="AI strategy recommendation engine with objective actions, tradeoffs, and no-auto-trading guardrails." breadcrumb={[{ label: 'Strategy', href: '/strategy' }, { label: 'Recommendations' }]} />
  <a class="button-secondary" href="/strategy">Overview</a>
</div>

<div class="list">
  {#each data.recommendations as recommendation}<StrategyRecommendationCard {recommendation} />{/each}
</div>

<style>
  .page-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .list { display: grid; gap: 12px; }
</style>
