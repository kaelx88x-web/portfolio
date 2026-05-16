<script lang="ts">
  import { Network } from 'lucide-svelte';
  import AiRiskNotice from './AiRiskNotice.svelte';

  export let response: any;
</script>

<article class="diversification-card">
  <div class="head">
    <Network size={16} />
    <h2>{response?.title ?? 'Diversification Insight'}</h2>
  </div>
  <p>{response?.summary}</p>
  <div class="observations">
    {#each response?.key_observations ?? [] as item}
      <span>{item}</span>
    {/each}
  </div>
  <AiRiskNotice risks={response?.risk_considerations ?? []} mode={response?.account_mode} />
</article>

<style>
  .diversification-card {
    display: grid;
    gap: 12px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 14px;
  }

  .head {
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
    margin: 0;
    color: var(--muted);
    font-size: 0.78rem;
    line-height: 1.5;
  }

  .observations {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 8px;
  }

  .observations span {
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 9px;
    color: var(--text);
    font-size: 0.72rem;
    line-height: 1.45;
  }
</style>
