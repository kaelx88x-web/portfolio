<script lang="ts">
  import { DatabaseZap, History, RefreshCw, Route } from 'lucide-svelte';
  import AiHistoricalInsightCard from '$lib/components/ai/AiHistoricalInsightCard.svelte';
  import AiMemoryCard from '$lib/components/ai/AiMemoryCard.svelte';
  import AiMemoryTimeline from '$lib/components/ai/AiMemoryTimeline.svelte';
  import AiSnapshotViewer from '$lib/components/ai/AiSnapshotViewer.svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  $: latest = data.latest?.snapshotType ? data.latest : data.latest?.memory ?? data.latest;

  function typeUrl(type: string) {
    return `/ai/memory?period=${data.period}&benchmark=${data.benchmark}&type=${type}`;
  }
</script>

<div class="page-top">
  <PageHeader
    title="AI Memory"
    subtitle="Compressed portfolio memory, historical insights, and context timeline."
  />
  <div class="page-actions">
    <a class="button-secondary" href="/ai/memory/history"><History size={15} /> History</a>
    <a class="button-secondary" href="/ai/memory/timeline"><Route size={15} /> Timeline</a>
    <form method="POST" action="?/refresh">
      <button class="button" type="submit"><RefreshCw size={15} /> Refresh</button>
    </form>
  </div>
</div>

<div class="type-tabs">
  {#each data.memoryTypes as type}
    <a class:active={data.snapshotType === type} href={typeUrl(type)}>{type.replaceAll('_', ' ')}</a>
  {/each}
</div>

<div class="memory-layout">
  <div class="left-col">
    <AiMemoryCard memory={latest} />
    <div class="panel">
      <div class="panel-head">
        <DatabaseZap size={16} />
        <h2>Historical Insights</h2>
      </div>
      <div class="insight-list">
        {#each data.insights.slice(0, 6) as insight}
          <AiHistoricalInsightCard {insight} />
        {/each}
      </div>
    </div>
  </div>

  <div class="right-col">
    <AiSnapshotViewer snapshot={latest} />
    <div class="panel">
      <div class="panel-head">
        <Route size={16} />
        <h2>Timeline</h2>
      </div>
      <AiMemoryTimeline timeline={data.timeline.slice(0, 8)} />
    </div>
  </div>
</div>

<style>
  .page-top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .page-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    align-items: center;
  }

  .page-actions :global(form) {
    display: contents;
  }

  .type-tabs {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 14px;
  }

  .type-tabs a {
    border: 1px solid #1a2038;
    border-radius: 999px;
    background: #0e1830;
    color: #7a8fb0;
    padding: 6px 10px;
    font-size: 0.72rem;
    font-weight: 700;
    text-decoration: none;
    text-transform: capitalize;
  }

  .type-tabs a.active {
    background: rgba(108, 143, 255, 0.14);
    border-color: rgba(108, 143, 255, 0.32);
    color: #9fb5ff;
  }

  .memory-layout {
    display: grid;
    grid-template-columns: 0.9fr 1.1fr;
    gap: 12px;
  }

  .left-col,
  .right-col {
    display: grid;
    gap: 12px;
    align-content: start;
  }

  .panel {
    border: 1px solid #1a2038;
    border-radius: 8px;
    background: rgba(14, 24, 48, 0.72);
    padding: 14px;
  }

  .panel-head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    color: #9fb5ff;
  }

  .panel-head h2 {
    margin: 0;
    color: #dce8ff;
    font-size: 0.9rem;
  }

  .insight-list {
    display: grid;
    gap: 10px;
  }

  @media (max-width: 1080px) {
    .memory-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
