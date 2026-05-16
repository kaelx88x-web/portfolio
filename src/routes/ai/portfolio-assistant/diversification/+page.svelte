<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AiEducationalTip from '$lib/components/ai/AiEducationalTip.svelte';
  import DiversificationInsightCard from '$lib/components/ai/DiversificationInsightCard.svelte';
  import PortfolioAssistantPanel from '$lib/components/ai/PortfolioAssistantPanel.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;
</script>

<PageHeader
  title="Diversification Assistant"
  subtitle="Explanation of concentration clusters, overlap risk, and hidden dependency."
  breadcrumb={[{ label: 'AI', href: '/ai' }, { label: 'Portfolio Assistant', href: '/ai/portfolio-assistant' }, { label: 'Diversification' }]}
/>

{#if form?.answer}
  <div class="answer"><strong>{form.answer.title}</strong><span>{form.answer.summary}</span></div>
{/if}

<div class="layout">
  <main>
    <DiversificationInsightCard response={data.diversification} />
    <PortfolioAssistantPanel response={data.diversification} type="diversification" />
  </main>
  <aside>
    <AiEducationalTip note={data.diversification.educational_note} />
  </aside>
</div>

<style>
  .layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 22rem;
    gap: 12px;
    margin-top: 16px;
  }

  main,
  aside {
    display: grid;
    align-content: start;
    gap: 12px;
  }

  .answer {
    display: grid;
    gap: 6px;
    margin-top: 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 12px;
  }

  .answer strong {
    color: var(--text);
    font-size: 0.84rem;
  }

  .answer span {
    color: var(--muted);
    font-size: 0.76rem;
    line-height: 1.5;
  }

  @media (max-width: 1000px) {
    .layout {
      grid-template-columns: 1fr;
    }
  }
</style>
