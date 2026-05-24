<script lang="ts">
  import { Activity, ArrowLeft, Table2 } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import SectorExposureChart from '$lib/components/allocation/SectorExposureChart.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  $: optionsPct = data.exposure?.options_exposure_pct ?? 0;
  $: cashPct = data.exposure?.cash_pct ?? 0;

  const metricColor = (warn: boolean) => warn ? 'var(--warning)' : 'var(--success)';
</script>

<PageHeader
  title="Allocation Exposure"
  subtitle="Single holding, category, asset type, currency, options, and cash exposure."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Allocation', href: '/optimization/allocation' }, { label: 'Exposure' }]}
/>

<div class="actions-bar">
  <div class="actions-left">
    <a class="tab-btn" href="/optimization/allocation"><ArrowLeft size={13} /> Overview</a>
    <a class="tab-btn" href="/optimization/allocation/health"><Activity size={13} /> Health</a>
    <span class="tab-btn active"><Table2 size={13} /> Exposure</span>
  </div>
</div>

<div class="summary">
  <div class="summary-card">
    <span class="label">Top Holding</span>
    <strong>{data.exposure.top_exposure}</strong>
  </div>
  <div class="summary-card" style="--c:{metricColor(optionsPct > 20)}">
    <span class="label">Options Overlay</span>
    <strong style="color:var(--c)">{optionsPct.toFixed(1)}%</strong>
    {#if optionsPct > 20}<p class="hint">Above 20% aggressive threshold</p>{/if}
  </div>
  <div class="summary-card" style="--c:{metricColor(cashPct < 5)}">
    <span class="label">Cash Reserve</span>
    <strong style="color:var(--c)">{cashPct.toFixed(1)}%</strong>
    {#if cashPct < 5}<p class="hint">Below 5% minimum target</p>{/if}
  </div>
</div>

<div class="grid">
  <SectorExposureChart rows={data.exposure.symbol_exposure} title="Single Holding Exposure" />
  <SectorExposureChart rows={data.exposure.category_exposure} title="Style / Category Exposure" />
  <SectorExposureChart rows={data.exposure.asset_type_exposure} title="Asset Type Exposure" />
  <SectorExposureChart rows={data.exposure.currency_exposure} title="Currency Exposure" />
</div>

<style>
  .actions-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
  .actions-left { display: flex; gap: 6px; flex-wrap: wrap; }
  .tab-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; color: var(--muted); background: var(--surface-1); border: 1px solid var(--border); text-decoration: none; transition: all 0.12s; }
  .tab-btn:hover { color: var(--text); border-color: var(--primary); }
  .tab-btn.active { color: var(--text); border-color: var(--primary); background: rgba(var(--primary-rgb), 0.08); }

  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 16px; }
  .summary-card { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 12px 16px; display: grid; gap: 5px; }
  .label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; }
  .summary-card strong { font-size: 1.05rem; font-weight: 700; color: var(--text); }
  .hint { margin: 0; font-size: 0.65rem; color: var(--warning); }

  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
</style>
