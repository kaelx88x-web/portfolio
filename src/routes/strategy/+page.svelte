<script lang="ts">
  import { AlertTriangle, RefreshCw, Target, Trophy } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import PortfolioObjectivePanel from '$lib/components/strategy/PortfolioObjectivePanel.svelte';
  import StrategyAllocationChart from '$lib/components/strategy/StrategyAllocationChart.svelte';
  import StrategyConflictCard from '$lib/components/strategy/StrategyConflictCard.svelte';
  import StrategyProfileCard from '$lib/components/strategy/StrategyProfileCard.svelte';
  import StrategyRecommendationCard from '$lib/components/strategy/StrategyRecommendationCard.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;
</script>

<div class="page-top">
  <PageHeader
    title="Strategy Orchestrator"
    subtitle="AI portfolio strategy coordination across growth, income, options, defensive allocation, cash reserve, and volatility control."
    breadcrumb={[{ label: 'Portfolio', href: '/dashboard' }, { label: 'Strategy' }]}
  />
  <div class="actions">
    <a class="button-secondary" href="/strategy/profile"><Target size={15} /> Profile</a>
    <a class="button-secondary" href="/strategy/recommendations"><Trophy size={15} /> Recommendations</a>
    <a class="button-secondary" href="/strategy/conflicts"><AlertTriangle size={15} /> Conflicts</a>
    <form method="POST" action="?/refresh"><button class="button" type="submit"><RefreshCw size={15} /> Refresh</button></form>
  </div>
</div>

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<div class="widget-row">
  {#each data.widgets as widget}
    <article class:high={widget.status === 'high'} class:medium={widget.status === 'medium'}>
      <span>{widget.label}</span>
      <strong>{widget.value}</strong>
    </article>
  {/each}
</div>

<div class="ai-note">{data.aiExplanation}</div>

<div class="layout">
  <main class="main-col">
    <StrategyProfileCard profile={data.profile} />
    {#if data.activeMode}<StrategyAllocationChart mode={data.activeMode} />{/if}
    {#each data.recommendations.slice(0, 3) as recommendation}<StrategyRecommendationCard {recommendation} />{/each}
  </main>
  <aside class="side-col">
    <PortfolioObjectivePanel profile={data.profile} />
    {#each data.conflicts.slice(0, 4) as conflict}<StrategyConflictCard {conflict} />{/each}
  </aside>
</div>

<style>
  .page-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .actions { display: flex; flex-wrap: wrap; gap: 8px; }
  .notice, .ai-note { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .ai-note { border-color: rgba(var(--primary-rgb), 0.22); background: rgba(var(--primary-rgb), 0.06); color: var(--muted); }
  .widget-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 12px; }
  .widget-row article { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  .widget-row article.medium { border-color: rgba(var(--warning-rgb), 0.28); }
  .widget-row article.high { border-color: rgba(var(--danger-rgb), 0.28); }
  .widget-row span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  .widget-row strong { display: block; margin-top: 6px; color: var(--text); font-size: 1rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 24rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } .page-top { align-items: start; flex-direction: column; } }
</style>
