<script lang="ts">
  import { CheckCircle2 } from 'lucide-svelte';
  import PortfolioModeBadge from './PortfolioModeBadge.svelte';
  import type { StrategyRecommendation } from '$lib/services/strategy-orchestrator.service';

  export let recommendation: StrategyRecommendation;
</script>

<article class="recommendation">
  <div class="head">
    <div>
      <span>{recommendation.priority} priority</span>
      <h2>{recommendation.title}</h2>
    </div>
    <PortfolioModeBadge mode={recommendation.strategyMode} />
  </div>
  <p>{recommendation.summary}</p>
  <div class="impact">{recommendation.recommendation.expectedImpact}</div>
  <div class="list">
    {#each recommendation.recommendation.actions as action}
      <div><CheckCircle2 size={14} /><span>{action}</span></div>
    {/each}
  </div>
  {#if recommendation.recommendation.tradeoffs.length}
    <div class="tradeoffs">
      {#each recommendation.recommendation.tradeoffs as tradeoff}<span>{tradeoff}</span>{/each}
    </div>
  {/if}
</article>

<style>
  .recommendation { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 10px; }
  .head { display: flex; justify-content: space-between; gap: 12px; align-items: start; }
  .head span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  h2 { margin: 3px 0 0; color: var(--text); font-size: 0.95rem; }
  p, .impact, .tradeoffs span { margin: 0; color: var(--muted); font-size: 0.74rem; line-height: 1.5; }
  .impact { border: 1px solid rgba(var(--primary-rgb), 0.18); border-radius: 8px; background: rgba(var(--primary-rgb), 0.06); padding: 9px; }
  .list { display: grid; gap: 7px; }
  .list div { display: flex; gap: 7px; align-items: start; color: var(--success); }
  .list span { color: var(--text); font-size: 0.74rem; line-height: 1.4; }
  .tradeoffs { display: grid; gap: 4px; border-top: 1px solid var(--border); padding-top: 8px; }
</style>
