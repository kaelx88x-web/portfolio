<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AllocationInsightCard from '$lib/components/ai/AllocationInsightCard.svelte';
  import PortfolioAssistantPanel from '$lib/components/ai/PortfolioAssistantPanel.svelte';
  import PortfolioStoryTimeline from '$lib/components/ai/PortfolioStoryTimeline.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;
</script>

<PageHeader
  title="Allocation Assistant"
  subtitle="Plain-language explanation of cash, symbol, asset-class, and currency allocation."
  breadcrumb={[{ label: 'AI', href: '/ai' }, { label: 'Portfolio Assistant', href: '/ai/portfolio-assistant' }, { label: 'Allocation' }]}
/>

{#if form?.answer}
  <div class="answer"><strong>{form.answer.title}</strong><span>{form.answer.summary}</span></div>
{/if}

<div class="layout">
  <main>
    <AllocationInsightCard response={data.allocation} />
    <PortfolioAssistantPanel response={data.allocation} type="allocation" />
  </main>
  <aside>
    <PortfolioStoryTimeline timeline={data.storyTimeline} />
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
