<script lang="ts">
  import { PieChart } from 'lucide-svelte';
  import AiConfidenceBadge from './AiConfidenceBadge.svelte';

  export let response: any;
</script>

<article class="insight-card">
  <div class="head">
    <PieChart size={16} />
    <h2>{response?.title ?? 'Allocation Insight'}</h2>
    <AiConfidenceBadge confidence={response?.confidence ?? 'medium'} />
  </div>
  <p>{response?.summary}</p>
  <ul>
    {#each response?.key_observations ?? [] as item}
      <li>{item}</li>
    {/each}
  </ul>
</article>

<style>
  .insight-card {
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
    flex: 1;
    margin: 0;
    color: var(--text);
    font-size: 0.9rem;
  }

  p,
  li {
    color: var(--muted);
    font-size: 0.76rem;
    line-height: 1.5;
  }

  ul {
    display: grid;
    gap: 6px;
    margin: 10px 0 0;
    padding-left: 16px;
  }
</style>
