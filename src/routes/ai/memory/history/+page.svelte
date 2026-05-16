<script lang="ts">
  import AiMemoryCard from '$lib/components/ai/AiMemoryCard.svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<PageHeader
  title="Memory History"
  subtitle="Stored compressed memory snapshots for historical retrieval."
  breadcrumb={[
    { label: 'AI', href: '/ai' },
    { label: 'Memory', href: '/ai/memory' },
    { label: 'History' }
  ]}
/>

<div class="history-grid">
  {#each data.history as memory}
    <AiMemoryCard {memory} />
  {/each}
</div>

{#if data.history.length === 0}
  <div class="empty">No stored memory snapshots yet.</div>
{/if}

<style>
  .history-grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .empty {
    border: 1px solid #1a2038;
    border-radius: 8px;
    background: #0e1830;
    color: #7a8fb0;
    padding: 32px;
    text-align: center;
  }

  @media (max-width: 960px) {
    .history-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
