<script lang="ts">
  import { RefreshCw } from 'lucide-svelte';
  import PromptTemplateCard from '$lib/components/ai/PromptTemplateCard.svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<div class="page-top">
  <PageHeader
    title="Prompt Templates"
    subtitle="Active prompt templates used by the Phase 4B Prompt Builder."
  />
  <form method="POST" action="?/reload">
    <button class="button-secondary" type="submit"><RefreshCw size={15} /> Reload</button>
  </form>
</div>

<div class="template-list">
  {#each data.templates as template}
    <PromptTemplateCard {template} />
  {/each}
</div>

<style>
  .page-top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 12px;
  }

  .template-list {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  @media (max-width: 960px) {
    .template-list {
      grid-template-columns: 1fr;
    }
  }
</style>
