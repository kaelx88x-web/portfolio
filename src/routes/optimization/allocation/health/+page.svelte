<script lang="ts">
  import { Activity, ArrowLeft, Table2 } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AllocationHealthCard from '$lib/components/allocation/AllocationHealthCard.svelte';
  import AllocationSuggestionCard from '$lib/components/allocation/AllocationSuggestionCard.svelte';
  import CashEfficiencyCard from '$lib/components/allocation/CashEfficiencyCard.svelte';
  import DiversificationScoreCard from '$lib/components/allocation/DiversificationScoreCard.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<PageHeader
  title="Allocation Health"
  subtitle="Allocation, diversification, cash efficiency, and volatility balance scoring."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Allocation', href: '/optimization/allocation' }, { label: 'Health' }]}
/>

<div class="actions-bar">
  <div class="actions-left">
    <a class="tab-btn" href="/optimization/allocation"><ArrowLeft size={13} /> Overview</a>
    <span class="tab-btn active"><Activity size={13} /> Health</span>
    <a class="tab-btn" href="/optimization/allocation/exposure"><Table2 size={13} /> Exposure</a>
  </div>
</div>

<div class="scores">
  <DiversificationScoreCard score={data.health.allocation_score} label="Allocation Score" />
  <DiversificationScoreCard score={data.health.diversification_score} label="Diversification" />
  <DiversificationScoreCard score={data.health.cash_efficiency_score} label="Cash Efficiency" />
  <DiversificationScoreCard score={data.health.volatility_balance_score} label="Volatility Balance" />
</div>

<div class="layout">
  <main class="main-col">
    <AllocationHealthCard health={data.health} />
  </main>
  <aside class="side-col">
    <CashEfficiencyCard score={data.health.cash_efficiency_score} cashPct={data.exposure.cash_pct} />
    {#if data.suggestions.length}
      <div class="suggestions">
        <span class="label">All Suggestions</span>
        {#each data.suggestions as suggestion}
          <AllocationSuggestionCard {suggestion} />
        {/each}
      </div>
    {/if}
  </aside>
</div>

<style>
  .actions-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; }
  .actions-left { display: flex; gap: 6px; flex-wrap: wrap; }
  .tab-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; color: var(--muted); background: var(--surface-1); border: 1px solid var(--border); text-decoration: none; transition: all 0.12s; }
  .tab-btn:hover { color: var(--text); border-color: var(--primary); }
  .tab-btn.active { color: var(--text); border-color: var(--primary); background: rgba(var(--primary-rgb), 0.08); }

  .scores { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 10px; margin-bottom: 16px; }

  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 22rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }

  .suggestions { display: grid; gap: 8px; }
  .label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; }

  @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
</style>
