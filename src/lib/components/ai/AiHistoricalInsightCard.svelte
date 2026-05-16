<script lang="ts">
  import { date } from '$lib/format';

  export let insight: any;
</script>

<article class="insight-card">
  <div>
    <h3>{insight.title}</h3>
    <p>{insight.summary}</p>
  </div>
  <div class="insight-meta">
    <span>{insight.insightType?.replaceAll('_', ' ')}</span>
    <time>{date(insight.createdAt)}</time>
  </div>
</article>

<style>
  .insight-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 14px;
  }

  h3 {
    margin: 0;
    color: var(--text);
    font-size: 0.85rem;
  }

  p {
    margin: 6px 0 0;
    color: var(--muted);
    font-size: 0.75rem;
    line-height: 1.55;
  }

  .insight-meta {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    margin-top: 12px;
    color: var(--muted);
    font-size: 0.68rem;
    text-transform: capitalize;
  }
</style>
