<script lang="ts">
  export let heatmap: any[] = [];
</script>

<div class="heatmap">
  {#each heatmap as item}
    <article class={item.severity}>
      <span>{item.label}</span>
      <strong>{Math.round(item.score)}</strong>
    </article>
  {/each}
</div>

<style>
  .heatmap { display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr)); gap: 8px; }
  article { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 12px; }
  span { display: block; color: var(--muted); font-size: .68rem; }
  strong { display: block; margin-top: 6px; color: var(--text); font-size: 1.2rem; }
  .medium { border-color: rgba(var(--warning-rgb), .32); }
  .high, .critical { border-color: rgba(var(--danger-rgb), .34); background: rgba(var(--danger-rgb), .06); }
</style>
