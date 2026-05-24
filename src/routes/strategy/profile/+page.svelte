<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import PortfolioObjectivePanel from '$lib/components/strategy/PortfolioObjectivePanel.svelte';
  import StrategyAllocationChart from '$lib/components/strategy/StrategyAllocationChart.svelte';
  import StrategyProfileCard from '$lib/components/strategy/StrategyProfileCard.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;
</script>

<div class="page-top">
  <PageHeader title="Strategy Profile" subtitle="Portfolio objective settings for risk tolerance, income, growth, cash reserve, and options premium targets." breadcrumb={[{ label: 'Strategy', href: '/strategy' }, { label: 'Profile' }]} />
  <a class="button-secondary" href="/strategy">Overview</a>
</div>

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<div class="layout">
  <main class="main-col">
    <StrategyProfileCard profile={data.profile} />
    {#if data.activeMode}<StrategyAllocationChart mode={data.activeMode} />{/if}
  </main>
  <aside class="side-col">
    <PortfolioObjectivePanel profile={data.profile} />
  </aside>
</div>

<style>
  .page-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .notice { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 23rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
</style>
