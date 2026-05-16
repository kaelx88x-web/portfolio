<script lang="ts">
  import { BarChart3 } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AiObservationCard from '$lib/components/ai/AiObservationCard.svelte';
  import AiRiskNotice from '$lib/components/ai/AiRiskNotice.svelte';
  import PortfolioAssistantPanel from '$lib/components/ai/PortfolioAssistantPanel.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;
</script>

<PageHeader
  title="Performance Assistant"
  subtitle="Explains return drivers, benchmark comparison, drawdown, volatility, and uncertainty."
  breadcrumb={[{ label: 'AI', href: '/ai' }, { label: 'Portfolio Assistant', href: '/ai/portfolio-assistant' }, { label: 'Performance' }]}
/>

{#if form?.answer}
  <div class="answer"><strong>{form.answer.title}</strong><span>{form.answer.summary}</span></div>
{/if}

<div class="layout">
  <main>
    <div class="hero-card">
      <BarChart3 size={18} />
      <div>
        <h2>{data.performance.title}</h2>
        <p>{data.performance.summary}</p>
      </div>
    </div>
    <PortfolioAssistantPanel response={data.performance} type="performance" />
  </main>
  <aside>
    <AiObservationCard title="Performance Signals" items={data.performance.key_observations} />
    <AiRiskNotice risks={data.performance.risk_considerations} mode={data.performance.account_mode} />
  </aside>
</div>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 24rem;
    gap: 12px;
    margin-top: 16px;
  }

  main,
  aside {
    display: grid;
    align-content: start;
    gap: 12px;
  }

  .hero-card,
  .answer {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 14px;
  }

  .hero-card {
    display: grid;
    grid-template-columns: 22px minmax(0, 1fr);
    gap: 10px;
    color: var(--primary);
  }

  h2 {
    margin: 0;
    color: var(--text);
    font-size: 0.95rem;
  }

  p,
  .answer span {
    color: var(--muted);
    font-size: 0.78rem;
    line-height: 1.5;
  }

  .answer {
    display: grid;
    gap: 6px;
    margin-top: 12px;
  }

  .answer strong {
    color: var(--text);
    font-size: 0.84rem;
  }

  @media (max-width: 1000px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
</style>
