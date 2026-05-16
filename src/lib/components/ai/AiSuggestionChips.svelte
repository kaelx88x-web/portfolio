<script lang="ts">
  export let suggestions: string[] = [];
  export let conversationId: string | null = null;
</script>

<div class="chips">
  {#each suggestions as suggestion}
    <form method="POST" action="?/ask">
      <input type="hidden" name="question" value={suggestion} />
      {#if conversationId}
        <input type="hidden" name="conversationId" value={conversationId} />
      {/if}
      <button class="chip" type="submit">{suggestion}</button>
    </form>
  {/each}
  {#if suggestions.length === 0}
    <span class="chips-empty">No suggestions available.</span>
  {/if}
</div>

<style>
  .chips       { display: flex; flex-wrap: wrap; gap: 8px; }
  .chip        { padding: 6px 12px; border-radius: 20px; border: 1px solid var(--border);
                 background: var(--card); color: var(--muted); font-size: 0.73rem; font-weight: 500;
                 cursor: pointer; transition: border-color 0.15s, color 0.15s; white-space: nowrap; }
  .chip:hover  { border-color: var(--primary); color: var(--text); }
  .chips-empty { font-size: 0.75rem; color: var(--muted); }
</style>
