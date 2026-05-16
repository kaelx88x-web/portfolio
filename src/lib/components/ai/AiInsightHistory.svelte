<script lang="ts">
  import AiInsightCard from './AiInsightCard.svelte';

  export let insights: Array<Record<string, any>> = [];
</script>

<div class="insight-grid">
  {#each insights as insight}
    <AiInsightCard {insight} />
  {/each}
  {#if insights.length === 0}
    <div class="empty-state">No AI insights generated yet. Use the buttons above to generate one.</div>
  {/if}
</div>

<style>
  .insight-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 12px; }
  .empty-state  { grid-column: 1 / -1; background: var(--card); border: 1px solid var(--border); border-radius: 10px;
                  padding: 32px 16px; text-align: center; font-size: 0.78rem; color: var(--muted); }
</style>
