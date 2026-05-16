<script lang="ts">
  import { FileText, RefreshCw } from 'lucide-svelte';
  import PromptGenerationPanel from '$lib/components/ai/PromptGenerationPanel.svelte';
  import PromptTemplateCard from '$lib/components/ai/PromptTemplateCard.svelte';
  import PromptViewer from '$lib/components/ai/PromptViewer.svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<div class="page-top">
  <PageHeader
    title="Prompt Builder"
    subtitle="Template, compression, safety, and provider formatting layer for PortfolioAI."
  />
  <div class="page-actions">
    <a class="button-secondary" href="/ai/prompts/templates"><FileText size={15} /> Templates</a>
    <a class="button-secondary" href="/api/prompts"><RefreshCw size={15} /> API</a>
  </div>
</div>

<PromptGenerationPanel
  promptTypes={data.promptTypes}
  providers={data.providers}
  selectedType={data.promptType}
  selectedProvider={data.provider}
  question={data.question}
/>

{#if 'formatted' in data.prompt}
  <PromptViewer prompt={data.prompt} />
{/if}

<div class="template-grid">
  {#each data.templates.slice(0, 3) as template}
    <PromptTemplateCard {template} />
  {/each}
</div>

<style>
  .page-top {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 12px;
    margin-bottom: 10px;
  }

  .page-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .template-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 12px;
    margin-top: 16px;
  }

  @media (max-width: 1100px) {
    .template-grid {
      grid-template-columns: 1fr;
    }
  }
</style>
