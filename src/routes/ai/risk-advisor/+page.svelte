<script lang="ts">
  import { Activity, BarChart3, Network, RefreshCw, ShieldAlert, Table2, TrendingDown } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AiEducationalTip from '$lib/components/ai/AiEducationalTip.svelte';
  import AiRiskWarningBanner from '$lib/components/ai/AiRiskWarningBanner.svelte';
  import ConcentrationRiskTable from '$lib/components/ai/ConcentrationRiskTable.svelte';
  import DrawdownInsightCard from '$lib/components/ai/DrawdownInsightCard.svelte';
  import ExposureBreakdownChart from '$lib/components/ai/ExposureBreakdownChart.svelte';
  import PortfolioStressPanel from '$lib/components/ai/PortfolioStressPanel.svelte';
  import RiskAdvisorPanel from '$lib/components/ai/RiskAdvisorPanel.svelte';
  import RiskAlertCard from '$lib/components/ai/RiskAlertCard.svelte';
  import RiskHeatmap from '$lib/components/ai/RiskHeatmap.svelte';
  import RiskNarrativeCard from '$lib/components/ai/RiskNarrativeCard.svelte';
  import VolatilityInsightCard from '$lib/components/ai/VolatilityInsightCard.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;
</script>

<div class="page-top">
  <PageHeader
    title="Risk Advisor AI"
    subtitle="Calm AI risk intelligence for concentration, volatility, drawdown, exposure, and stress scenarios."
    breadcrumb={[{ label: 'AI', href: '/ai' }, { label: 'Risk Advisor' }]}
  />
  <div class="actions">
    <a class="button-secondary" href="/ai/risk-advisor/volatility"><Activity size={15} /> Volatility</a>
    <a class="button-secondary" href="/ai/risk-advisor/concentration"><Table2 size={15} /> Concentration</a>
    <a class="button-secondary" href="/ai/risk-advisor/drawdown"><TrendingDown size={15} /> Drawdown</a>
    <a class="button-secondary" href="/ai/risk-advisor/exposure"><Network size={15} /> Exposure</a>
    <a class="button-secondary" href="/ai/risk-advisor/stress-analysis"><BarChart3 size={15} /> Stress</a>
    <form method="POST" action="?/refresh"><button class="button" type="submit"><RefreshCw size={15} /> Refresh</button></form>
  </div>
</div>

{#if form?.message}<div class="error-banner">{form.message}</div>{/if}
{#if form?.answer}
  <div class="answer"><strong>{form.answer.title}</strong><span>{form.answer.summary}</span><AiEducationalTip note={form.answer.educational_note} /></div>
{/if}

<div class="layout">
  <main class="main-col">
    <AiRiskWarningBanner warnings={data.summary.warnings} mode={data.summary.account_mode} />
    <RiskNarrativeCard narrative={data.narrative} response={data.summary} />
    <RiskHeatmap heatmap={data.heatmap} />
    <RiskAdvisorPanel response={data.summary} type="risk" />
    <div class="section-head"><Table2 size={16} /><h2>Concentration Table</h2></div>
    <ConcentrationRiskTable rows={data.concentrationTable} />
    <PortfolioStressPanel scenarios={data.stressScenarios} />
  </main>
  <aside class="side-col">
    <div class="panel">
      <h2>Active Alerts</h2>
      <div class="alert-list">{#each data.alerts as alert}<RiskAlertCard {alert} />{/each}</div>
    </div>
    <VolatilityInsightCard response={data.volatility} />
    <DrawdownInsightCard response={data.drawdown} />
    <ExposureBreakdownChart slices={data.exposureSlices} />
  </aside>
</div>

<style>
  .page-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 24rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  .panel, .answer { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  .answer { display: grid; gap: 8px; margin-bottom: 12px; }
  .answer strong, .panel h2, .section-head h2 { margin: 0; color: var(--text); font-size: .9rem; }
  .answer span { color: var(--muted); font-size: .76rem; line-height: 1.5; }
  .alert-list { display: grid; gap: 8px; margin-top: 10px; }
  .section-head { display: flex; align-items: center; gap: 8px; color: var(--primary); }
  .error-banner { margin-bottom: 12px; border: 1px solid rgba(var(--danger-rgb),.3); border-radius: 8px; background: rgba(var(--danger-rgb),.08); color: var(--danger); padding: 10px 12px; font-size: .78rem; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
</style>
