<script lang="ts">
  import { BrainCircuit } from 'lucide-svelte';

  export let promptTypes: readonly string[] = [];
  export let providers: readonly string[] = [];
  export let selectedType = 'portfolio_health';
  export let selectedProvider = 'gemini';
  export let question = '';
</script>

<form method="GET" action="/ai/prompts/viewer" class="generation-panel">
  <div class="panel-title">
    <BrainCircuit size={16} />
    <span>Generate Prompt</span>
  </div>

  <label>
    <span>Type</span>
    <select name="promptType" bind:value={selectedType}>
      {#each promptTypes as type}
        <option value={type}>{type}</option>
      {/each}
    </select>
  </label>

  <label>
    <span>Provider</span>
    <select name="provider" bind:value={selectedProvider}>
      {#each providers as provider}
        <option value={provider}>{provider}</option>
      {/each}
    </select>
  </label>

  <label class="wide">
    <span>Question</span>
    <input name="question" bind:value={question} placeholder="Review this portfolio." />
  </label>

  <label class="check">
    <input type="checkbox" name="compression" value="true" checked />
    <span>Compress context</span>
  </label>

  <button class="button" type="submit">Build</button>
</form>

<style>
  .generation-panel {
    display: grid;
    grid-template-columns: minmax(170px, 0.7fr) minmax(140px, 0.5fr) minmax(220px, 1fr) auto auto;
    align-items: end;
    gap: 10px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 14px;
    margin-bottom: 16px;
  }

  .panel-title {
    grid-column: 1 / -1;
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--text);
    font-size: 0.85rem;
    font-weight: 700;
  }

  label {
    display: grid;
    gap: 5px;
  }

  label span {
    color: var(--muted);
    font-size: 0.68rem;
    font-weight: 700;
  }

  select,
  input {
    height: 34px;
    border: 1px solid var(--border);
    border-radius: 6px;
    background: var(--ai-bg);
    color: var(--text);
    padding: 0 10px;
    font-size: 0.76rem;
  }

  .check {
    display: flex;
    align-items: center;
    gap: 7px;
    height: 34px;
  }

  .check input {
    height: 14px;
    width: 14px;
  }

  button {
    height: 34px;
  }

  @media (max-width: 980px) {
    .generation-panel {
      grid-template-columns: 1fr;
    }
  }
</style>
