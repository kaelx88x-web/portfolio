<script lang="ts">
  import { ArrowDown, BrainCircuit, Database, MessageSquareText, Route, ShieldCheck, Wrench } from 'lucide-svelte';
  import AiConfidenceBadge from './AiConfidenceBadge.svelte';
  import AiIntentBadge from './AiIntentBadge.svelte';
  import AiProviderBadge from './AiProviderBadge.svelte';

  export let result: any = null;

  $: steps = result
    ? [
        { label: 'Question', value: result.question, icon: MessageSquareText },
        { label: 'Intent', value: result.intent?.type, icon: BrainCircuit },
        { label: 'Context', value: result.context?.scope, icon: Database },
        { label: 'Tools', value: `${result.response?.tool_calls?.length ?? 0} executed`, icon: Wrench },
        { label: 'Provider', value: result.provider?.provider, icon: Route },
        { label: 'Response', value: result.response?.confidence, icon: ShieldCheck }
      ]
    : [];
</script>

{#if result}
  <div class="pipeline">
    {#each steps as step, index}
      <div class="pipe-step">
        <svelte:component this={step.icon} size={16} />
        <div>
          <span>{step.label}</span>
          {#if step.label === 'Intent'}
            <AiIntentBadge intent={step.value} />
          {:else if step.label === 'Provider'}
            <AiProviderBadge provider={result.provider?.provider} model={result.provider?.model} />
          {:else if step.label === 'Response'}
            <AiConfidenceBadge confidence={step.value} />
          {:else}
            <strong>{step.value}</strong>
          {/if}
        </div>
      </div>
      {#if index < steps.length - 1}
        <div class="pipe-arrow"><ArrowDown size={14} /></div>
      {/if}
    {/each}
  </div>
{:else}
  <div class="pipeline empty">Ask a question to visualize the orchestration pipeline.</div>
{/if}

<style>
  .pipeline {
    display: grid;
    gap: 8px;
  }

  .pipeline.empty {
    min-height: 180px;
    place-items: center;
    color: var(--muted);
    font-size: 0.78rem;
  }

  .pipe-step {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr);
    gap: 10px;
    align-items: center;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: rgba(var(--primary-rgb), 0.05);
    padding: 10px;
    color: var(--primary);
  }

  .pipe-step span {
    display: block;
    margin-bottom: 4px;
    color: var(--muted);
    font-size: 0.66rem;
    font-weight: 700;
    text-transform: uppercase;
  }

  .pipe-step strong {
    display: block;
    color: var(--text);
    font-size: 0.76rem;
    font-weight: 700;
    overflow-wrap: anywhere;
  }

  .pipe-arrow {
    display: grid;
    place-items: center;
    color: var(--muted);
  }
</style>
