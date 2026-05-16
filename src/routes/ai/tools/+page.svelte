<script lang="ts">
  import { Wrench } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AiToolExecutionCard from '$lib/components/ai/AiToolExecutionCard.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<PageHeader
  title="AI Tools"
  subtitle="Read-only internal tools used by the AI orchestration pipeline."
  breadcrumb={[{ label: 'AI', href: '/ai' }, { label: 'Tools' }]}
/>

<div class="tools-layout">
  <section class="tool-catalog">
    {#each data.tools as tool}
      <article class="tool-card">
        <div class="tool-head">
          <Wrench size={16} />
          <h2>{tool.name}</h2>
        </div>
        <p>{tool.description}</p>
        <span>{tool.type.replaceAll('_', ' ')}</span>
      </article>
    {/each}
  </section>

  <aside class="panel">
    <h2>Recent Executions</h2>
    <div class="execution-list">
      {#each data.toolLogs as call}
        <AiToolExecutionCard {call} />
      {:else}
        <p>No tool execution logs yet.</p>
      {/each}
    </div>
  </aside>
</div>

<style>
  .tools-layout {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 24rem;
    gap: 12px;
    margin-top: 16px;
  }

  .tool-catalog {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }

  .tool-card,
  .panel {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 14px;
  }

  .tool-head {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--primary);
  }

  h2 {
    margin: 0;
    color: var(--text);
    font-size: 0.9rem;
  }

  p {
    color: var(--muted);
    font-size: 0.76rem;
    line-height: 1.5;
  }

  .tool-card span {
    color: var(--primary);
    font-size: 0.68rem;
    font-weight: 800;
    text-transform: capitalize;
  }

  .execution-list {
    display: grid;
    gap: 10px;
    margin-top: 12px;
  }

  @media (max-width: 1080px) {
    .tools-layout {
      grid-template-columns: 1fr;
    }
  }
</style>
