<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import PremiumYieldCard from '$lib/components/options/PremiumYieldCard.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<div class="page-top">
  <PageHeader title="Premium Analytics" subtitle="Premium yield, annualized premium, collateral base, and efficiency scoring." breadcrumb={[{ label: 'Options', href: '/optimization/options' }, { label: 'Premium' }]} />
  <a class="button-secondary" href="/optimization/options">Overview</a>
</div>

<div class="layout">
  <PremiumYieldCard premium={data.premium} />
  <div class="table">
    <table>
      <thead><tr><th>Symbol</th><th>Yield</th><th>Annualized</th><th>Risk</th></tr></thead>
      <tbody>
        {#each data.premium.positions as row}<tr><td>{row.symbol}</td><td>{row.premium_yield.toFixed(2)}%</td><td>{row.annualized_yield.toFixed(2)}%</td><td>{row.risk_level}</td></tr>{/each}
      </tbody>
    </table>
  </div>
</div>

<style>
  .page-top { display: flex; align-items: flex-end; justify-content: space-between; gap: 12px; margin-bottom: 16px; }
  .layout { display: grid; grid-template-columns: 22rem minmax(0, 1fr); gap: 12px; }
  .table { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--card); }
  table { width: 100%; border-collapse: collapse; min-width: 520px; }
  th, td { padding: 10px 12px; border-bottom: 1px solid var(--border); color: var(--muted); font-size: .73rem; text-align: left; }
  th { color: var(--text); text-transform: uppercase; font-size: .64rem; }
  td:first-child { color: var(--text); font-weight: 800; }
  @media (max-width: 900px) { .layout { grid-template-columns: 1fr; } }
</style>
