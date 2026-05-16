<script lang="ts">
  import { Route } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AiProviderBadge from '$lib/components/ai/AiProviderBadge.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<PageHeader
  title="AI Providers"
  subtitle="Provider routing readiness for OpenAI, Claude, Gemini, Ollama, and local fallback."
  breadcrumb={[{ label: 'AI', href: '/ai' }, { label: 'Providers' }]}
/>

<div class="provider-grid">
  {#each data.providers as provider}
    <article class="provider-card" class:inactive={!provider.active}>
      <div class="provider-head">
        <Route size={16} />
        <AiProviderBadge provider={provider.provider} model={provider.model} />
      </div>
      <h2>{provider.model}</h2>
      <p>{provider.active ? 'Active route candidate' : 'Configured but inactive'}</p>
      <div class="feature-list">
        {#each provider.supportedFeatures as feature}
          <span>{feature.replaceAll('_', ' ')}</span>
        {/each}
      </div>
    </article>
  {/each}
</div>

<style>
  .provider-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
    margin-top: 16px;
  }

  .provider-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 14px;
  }

  .provider-card.inactive {
    opacity: 0.62;
  }

  .provider-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    color: var(--primary);
    margin-bottom: 12px;
  }

  h2 {
    margin: 0;
    color: var(--text);
    font-size: 0.92rem;
    overflow-wrap: anywhere;
  }

  p {
    margin: 6px 0 12px;
    color: var(--muted);
    font-size: 0.74rem;
  }

  .feature-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .feature-list span {
    border: 1px solid var(--border);
    border-radius: 999px;
    color: var(--muted);
    padding: 3px 8px;
    font-size: 0.66rem;
    text-transform: capitalize;
  }
</style>
