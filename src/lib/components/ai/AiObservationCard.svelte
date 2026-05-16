<script lang="ts">
  import { Eye } from 'lucide-svelte';

  export let title = 'Observation';
  export let items: string[] = [];
</script>

<article class="observation-card">
  <div class="head">
    <Eye size={16} />
    <h2>{title}</h2>
  </div>
  <ul>
    {#each items as item}
      <li>{item}</li>
    {:else}
      <li>No observation available yet.</li>
    {/each}
  </ul>
</article>

<style>
  .observation-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 14px;
  }

  .head {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    color: var(--primary);
  }

  h2 {
    margin: 0;
    color: var(--text);
    font-size: 0.86rem;
  }

  ul {
    display: grid;
    gap: 7px;
    margin: 0;
    padding-left: 16px;
    color: var(--muted);
    font-size: 0.75rem;
    line-height: 1.5;
  }
</style>
