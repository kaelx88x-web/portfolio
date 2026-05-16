<script lang="ts">
  import { CheckCircle2, CircleDashed, XCircle } from 'lucide-svelte';

  export let call: any;

  $: status = call?.status ?? call?.executionStatus ?? 'completed';
  $: tool = call?.tool ?? call?.toolName ?? 'tool';
  $: output = call?.output ?? {};
  $: elapsed = call?.executionTimeMs ?? 0;
  $: keys = Object.keys(output ?? {}).slice(0, 4);
</script>

<article class="tool-card">
  <div class="tool-head">
    <div class="tool-title">
      {#if status === 'completed'}
        <CheckCircle2 size={15} />
      {:else if status === 'failed'}
        <XCircle size={15} />
      {:else}
        <CircleDashed size={15} />
      {/if}
      <span>{tool.replaceAll('_', ' ')}</span>
    </div>
    <span class="elapsed">{elapsed}ms</span>
  </div>
  <div class="tool-output">
    {#each keys as key}
      <div>
        <span>{key}</span>
        <strong>{JSON.stringify(output[key]).slice(0, 90)}</strong>
      </div>
    {/each}
  </div>
</article>

<style>
  .tool-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 12px;
  }

  .tool-head,
  .tool-title {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .tool-head {
    justify-content: space-between;
    margin-bottom: 10px;
  }

  .tool-title {
    min-width: 0;
    color: var(--text);
    font-size: 0.78rem;
    font-weight: 800;
    text-transform: capitalize;
  }

  .elapsed {
    color: var(--muted);
    font-size: 0.68rem;
  }

  .tool-output {
    display: grid;
    gap: 6px;
  }

  .tool-output div {
    min-width: 0;
  }

  .tool-output span {
    display: block;
    color: var(--muted);
    font-size: 0.66rem;
  }

  .tool-output strong {
    display: block;
    margin-top: 2px;
    color: var(--text);
    font-size: 0.72rem;
    font-weight: 600;
    overflow-wrap: anywhere;
  }
</style>
