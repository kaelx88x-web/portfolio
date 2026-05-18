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

  type Color = 'red' | 'amber' | 'green';
  function statusColor(status: string): Color {
    return status === 'high' ? 'red' : status === 'medium' ? 'amber' : 'green';
  }
  $: stats = data.widgets.slice(0, 4).map((w) => ({ label: w.label, value: w.value, color: statusColor(w.status) }));
</script>

<PageHeader
  title="Options Strategy"
  subtitle="Covered call and cash-secured put candidates, ranked by premium yield."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Options' }]}
/>

<div class="actions-bar">
  <div class="actions-left">
    <a class="tab-btn" href="/optimization/options/exposure"><ShieldAlert size={13} /> Exposure</a>
    <a class="tab-btn" href="/optimization/options/wheel"><Table2 size={13} /> Wheel</a>
    <a class="tab-btn" href="/optimization/options/premium"><Coins size={13} /> Premium</a>
  </div>
  <form method="POST" action="?/refresh">
    <button class="button" type="submit"><RefreshCw size={13} /> Refresh Data</button>
  </form>
</div>

<OptimizationStatStrip {stats} />

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<div class="layout">
  <main class="main-col">
    <OptionsExposureCard exposure={data.exposure} />
    <CoveredCallTable rows={data.coveredCalls} />
    <PutExposureChart rows={data.puts} />

    <div class="next-step">
      <div class="next-text">
        <strong>Review optimization history</strong>
        <span>Compare how your portfolio metrics and allocation targets have changed over past runs.</span>
      </div>
      <a class="button" href="/optimization/history">View History →</a>
    </div>
  </main>
  <aside class="side-col">
    <PremiumYieldCard premium={data.premium} />
    <AssignmentRiskCard score={data.exposure.assignment_risk_score} level={data.exposure.risk_level} warnings={data.exposure.warnings} />
    <CollateralUsageChart usagePct={data.exposure.collateral_usage_pct} collateral={data.exposure.collateral_locked} />
    {#if data.wheel.length > 0}
      <div class="wheel-label">Wheel Strategy</div>
      {#each data.wheel.slice(0, 3) as report}<WheelStrategyCard {report} />{/each}
    {/if}
  </aside>
</div>

<style>
  .actions-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
  .actions-left { display: flex; gap: 6px; flex-wrap: wrap; }
  .tab-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; color: var(--muted); background: var(--surface-1); border: 1px solid var(--border); text-decoration: none; transition: all 0.12s; }
  .tab-btn:hover { color: var(--text); border-color: var(--primary); }
  .notice { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .next-step { display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid rgba(var(--primary-rgb), 0.22); border-radius: 8px; background: rgba(var(--primary-rgb), 0.05); padding: 14px 16px; }
  .next-text { display: grid; gap: 3px; }
  .next-text strong { font-size: 0.82rem; color: var(--text); }
  .next-text span { font-size: 0.72rem; color: var(--muted); }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 22rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  .wheel-label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
  @media (max-width: 600px) { .actions-bar { flex-direction: column; align-items: flex-start; } }
</style>
