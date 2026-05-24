<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import CoveredCallTable from '$lib/components/options/CoveredCallTable.svelte';
  import WheelStrategyCard from '$lib/components/options/WheelStrategyCard.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<div class="page-top">
  <PageHeader title="Wheel Strategy Intelligence" subtitle="Cash-secured put, assignment, covered call, and repeat-cycle analysis." breadcrumb={[{ label: 'Options', href: '/optimization/options' }, { label: 'Wheel' }]} />
  <a class="button-secondary" href="/optimization/options">Overview</a>
</div>

<div class="grid">{#each data.wheel as report}<WheelStrategyCard {report} />{/each}</div>
<div class="table-block"><h2>Covered Call Candidates</h2><CoveredCallTable rows={data.coveredCalls} /></div>

<style>
  .page-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin-bottom: 12px; }
  .table-block h2 { color: var(--text); font-size: .9rem; margin: 0 0 10px; }
</style>
