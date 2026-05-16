<script lang="ts">
  import AiHistoricalInsightCard from '$lib/components/ai/AiHistoricalInsightCard.svelte';
  import AiMemoryTimeline from '$lib/components/ai/AiMemoryTimeline.svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<PageHeader
  title="Memory Timeline"
  subtitle="Portfolio growth, risk, allocation, benchmark, volatility, and compression timeline."
  breadcrumb={[
    { label: 'AI', href: '/ai' },
    { label: 'Memory', href: '/ai/memory' },
    { label: 'Timeline' }
  ]}
/>

<div class="timeline-layout">
  <AiMemoryTimeline timeline={data.timeline} />
  <section class="insights">
    {#each data.insights as insight}
      <AiHistoricalInsightCard {insight} />
    {/each}
  </section>
</div>

<style>
  .timeline-layout {
    display: grid;
    grid-template-columns: 1.1fr 0.9fr;
    gap: 12px;
  }

  .insights {
    display: grid;
    gap: 10px;
    align-content: start;
  }

  @media (max-width: 960px) {
    .timeline-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
