<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import RiskAdvisorPanel from '$lib/components/ai/RiskAdvisorPanel.svelte';
  import VolatilityInsightCard from '$lib/components/ai/VolatilityInsightCard.svelte';
  import RiskHeatmap from '$lib/components/ai/RiskHeatmap.svelte';
  import type { ActionData, PageData } from './$types';
  export let data: PageData;
  export let form: ActionData;
</script>

<PageHeader title="Volatility Advisor" subtitle="Explains unstable movement, benchmark-relative volatility, and non-linear holdings." breadcrumb={[{ label: 'AI', href: '/ai' }, { label: 'Risk Advisor', href: '/ai/risk-advisor' }, { label: 'Volatility' }]} />
{#if form?.answer}<div class="answer"><strong>{form.answer.title}</strong><span>{form.answer.summary}</span></div>{/if}
<div class="layout">
  <main><VolatilityInsightCard response={data.volatility} /><RiskAdvisorPanel response={data.volatility} type="volatility" /></main>
  <aside><RiskHeatmap heatmap={data.heatmap} /></aside>
</div>

<style>
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 22rem; gap: 12px; margin-top: 16px; }
  main, aside { display: grid; align-content: start; gap: 12px; }
  .answer { display: grid; gap: 6px; margin-top: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 12px; }
  .answer strong { color: var(--text); font-size: .84rem; } .answer span { color: var(--muted); font-size: .76rem; line-height: 1.5; }
  @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
</style>
