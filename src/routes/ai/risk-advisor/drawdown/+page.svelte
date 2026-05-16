<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import DrawdownInsightCard from '$lib/components/ai/DrawdownInsightCard.svelte';
  import PortfolioStressPanel from '$lib/components/ai/PortfolioStressPanel.svelte';
  import RiskAdvisorPanel from '$lib/components/ai/RiskAdvisorPanel.svelte';
  import type { ActionData, PageData } from './$types';
  export let data: PageData; export let form: ActionData;
</script>

<PageHeader title="Drawdown Advisor" subtitle="Downside behavior, recovery context, and calm drawdown explanation." breadcrumb={[{ label: 'AI', href: '/ai' }, { label: 'Risk Advisor', href: '/ai/risk-advisor' }, { label: 'Drawdown' }]} />
{#if form?.answer}<div class="answer"><strong>{form.answer.title}</strong><span>{form.answer.summary}</span></div>{/if}
<div class="layout">
  <main><DrawdownInsightCard response={data.drawdown} /><RiskAdvisorPanel response={data.drawdown} type="drawdown" /></main>
  <aside><PortfolioStressPanel scenarios={data.stressScenarios} /></aside>
</div>

<style>
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 24rem; gap: 12px; margin-top: 16px; }
  main, aside { display: grid; align-content: start; gap: 12px; }
  .answer { display: grid; gap: 6px; margin-top: 12px; border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 12px; }
  .answer strong { color: var(--text); font-size: .84rem; } .answer span { color: var(--muted); font-size: .76rem; line-height: 1.5; }
  @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
</style>
