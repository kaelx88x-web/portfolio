<script lang="ts">
  import PromptGenerationPanel from '$lib/components/ai/PromptGenerationPanel.svelte';
  import PromptViewer from '$lib/components/ai/PromptViewer.svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<PageHeader
  title="Prompt Viewer"
  subtitle="Provider-ready prompt payload generated from live AI context."
  breadcrumb={[
    { label: 'AI', href: '/ai' },
    { label: 'Prompts', href: '/ai/prompts' },
    { label: 'Viewer' }
  ]}
/>

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
