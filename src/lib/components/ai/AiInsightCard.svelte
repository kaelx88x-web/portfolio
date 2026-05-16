<script lang="ts">
  import { date } from '$lib/format';
  import AiRiskBadge from './AiRiskBadge.svelte';

  export let insight: any;
</script>

<article class="card insight-card">
  <div class="insight-header">
    <div>
      <div class="insight-type">{insight.insightType?.replaceAll('_', ' ') ?? 'insight'}</div>
      <h3 class="insight-title">{insight.title}</h3>
    </div>
    <AiRiskBadge level={insight.riskLevel} />
  </div>

  <p class="insight-summary">{insight.summary}</p>

  {#if insight.content?.observations?.length}
    <div class="insight-obs">
      {#each insight.content.observations.slice(0, 3) as item}
        <div class="obs-item">{item}</div>
      {/each}
    </div>
  {/if}

  <div class="insight-date">{date(insight.createdAt)}</div>
</article>

<style>
  .insight-card    { padding: 18px; display: flex; flex-direction: column; gap: 10px; }
  .insight-header  { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; }
  .insight-type    { font-size: 0.6rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: var(--primary); margin-bottom: 4px; }
  .insight-title   { font-size: 0.85rem; font-weight: 700; color: var(--text); margin: 0; }
  .insight-summary { font-size: 0.76rem; color: var(--muted); line-height: 1.6; margin: 0; }
  .insight-obs     { display: flex; flex-direction: column; gap: 5px; }
  .obs-item        { font-size: 0.71rem; color: var(--muted); background: var(--ai-bg); border: 1px solid var(--border);
                     border-radius: 6px; padding: 7px 10px; line-height: 1.5; }
  .insight-date    { font-size: 0.65rem; color: var(--muted); margin-top: 2px; }
</style>
