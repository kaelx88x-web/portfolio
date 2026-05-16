<script lang="ts">
  import { BookOpenText } from 'lucide-svelte';
  import AiConfidenceBadge from './AiConfidenceBadge.svelte';

  export let narrative: any = null;
  export let confidence = 'medium';
</script>

<article class="narrative-card">
  <div class="head">
    <div>
      <div class="label"><BookOpenText size={16} /> Portfolio Story</div>
      <h2>{narrative?.title ?? 'Portfolio Story'}</h2>
    </div>
    <AiConfidenceBadge {confidence} />
  </div>
  <p class="summary">{narrative?.summary}</p>
  <p class="story">{narrative?.narrative}</p>
</article>

<style>
  .narrative-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 16px;
  }

  .head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    margin-bottom: 12px;
  }

  .label {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--primary);
    font-size: 0.7rem;
    font-weight: 800;
    text-transform: uppercase;
  }

  h2 {
    margin: 6px 0 0;
    color: var(--text);
    font-size: 1rem;
  }

  p {
    margin: 0;
    line-height: 1.55;
  }

  .summary {
    color: var(--text);
    font-size: 0.86rem;
    font-weight: 700;
  }

  .story {
    margin-top: 10px;
    color: var(--muted);
    font-size: 0.78rem;
  }
</style>
