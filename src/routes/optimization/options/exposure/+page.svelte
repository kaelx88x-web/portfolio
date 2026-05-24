<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AssignmentRiskCard from '$lib/components/options/AssignmentRiskCard.svelte';
  import CollateralUsageChart from '$lib/components/options/CollateralUsageChart.svelte';
  import OptionsExposureCard from '$lib/components/options/OptionsExposureCard.svelte';
  import PutExposureChart from '$lib/components/options/PutExposureChart.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<div class="page-top">
  <PageHeader title="Options Exposure" subtitle="Options allocation, put/call exposure, collateral usage, and assignment risk." breadcrumb={[{ label: 'Options', href: '/optimization/options' }, { label: 'Exposure' }]} />
  <a class="button-secondary" href="/optimization/options">Overview</a>
</div>

<div class="layout">
  <main><OptionsExposureCard exposure={data.exposure} /><PutExposureChart rows={data.puts} /></main>
  <aside><AssignmentRiskCard score={data.exposure.assignment_risk_score} level={data.exposure.risk_level} warnings={data.exposure.warnings} /><CollateralUsageChart usagePct={data.exposure.collateral_usage_pct} collateral={data.exposure.collateral_locked} /></aside>
</div>

<style>
  .page-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 23rem; gap: 12px; }
  main, aside { display: grid; align-content: start; gap: 12px; }
  @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
</style>
