<script lang="ts">
  import { Coins, RefreshCw, ShieldAlert, Table2 } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AssignmentRiskCard from '$lib/components/options/AssignmentRiskCard.svelte';
  import CollateralUsageChart from '$lib/components/options/CollateralUsageChart.svelte';
  import CoveredCallTable from '$lib/components/options/CoveredCallTable.svelte';
  import OptimizationStatStrip from '$lib/components/optimization/OptimizationStatStrip.svelte';
  import OptionsExposureCard from '$lib/components/options/OptionsExposureCard.svelte';
  import PremiumYieldCard from '$lib/components/options/PremiumYieldCard.svelte';
  import PutExposureChart from '$lib/components/options/PutExposureChart.svelte';
  import WheelStrategyCard from '$lib/components/options/WheelStrategyCard.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  $: stats = data.widgets.slice(0, 4).map((w) => ({ label: w.label, value: w.value }));
</script>

<PageHeader
  title="Options Strategy"
  subtitle="Covered call and cash-secured put candidates, ranked by premium yield."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Options' }]}
/>

<div class="top-actions">
  <a class="button-secondary" href="/optimization/options/exposure"><ShieldAlert size={15} /> Exposure</a>
  <a class="button-secondary" href="/optimization/options/wheel"><Table2 size={15} /> Wheel</a>
  <a class="button-secondary" href="/optimization/options/premium"><Coins size={15} /> Premium</a>
  <form method="POST" action="?/refresh"><button class="button" type="submit"><RefreshCw size={15} /> Refresh</button></form>
</div>

<OptimizationStatStrip {stats} />

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<div class="layout">
  <main class="main-col">
    <OptionsExposureCard exposure={data.exposure} />
    <CoveredCallTable rows={data.coveredCalls} />
    <PutExposureChart rows={data.puts} />
  </main>
  <aside class="side-col">
    <AssignmentRiskCard score={data.exposure.assignment_risk_score} level={data.exposure.risk_level} warnings={data.exposure.warnings} />
    <PremiumYieldCard premium={data.premium} />
    <CollateralUsageChart usagePct={data.exposure.collateral_usage_pct} collateral={data.exposure.collateral_locked} />
    {#each data.wheel.slice(0, 3) as report}<WheelStrategyCard {report} />{/each}
  </aside>
</div>

<style>
  .top-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .notice { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 23rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
</style>
