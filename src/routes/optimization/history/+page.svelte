<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import PortfolioModeBadge from '$lib/components/optimization/PortfolioModeBadge.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  const goalLabel: Record<string, string> = {
    minimum_volatility: 'Lower Risk',
    maximum_sharpe: 'Best Risk/Return',
    risk_parity: 'Balanced',
    efficient_frontier: 'Optimal Blend',
    target_volatility: 'Set Volatility Target',
    target_income: 'Income Focus',
    defensive_allocation: 'Defensive'
  };
  const riskLabel: Record<string, string> = {
    conservative: 'Safe',
    balanced: 'Moderate',
    aggressive: 'Aggressive'
  };
</script>

<PageHeader
  title="Optimization History"
  subtitle="Recent optimization runs and selected goals."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'History' }]}
/>

<div class="table">
  <table>
    <thead><tr><th>Run</th><th>Mode</th><th>Goal</th><th>Risk</th><th>Status</th><th>Created</th></tr></thead>
    <tbody>
      {#each data.history as run}
        <tr>
          <td>{run.id.slice(0, 8)}</td>
          <td><PortfolioModeBadge mode={run.portfolioMode} /></td>
          <td>{goalLabel[run.optimizationGoal] ?? run.optimizationGoal}</td>
          <td>{riskLabel[run.riskProfile] ?? run.riskProfile}</td>
          <td>{run.status}</td>
          <td>{new Date(run.createdAt).toLocaleString()}</td>
        </tr>
      {/each}
    </tbody>
  </table>
</div>

<style>
  .table { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; background: var(--card); }
  table { width: 100%; border-collapse: collapse; min-width: 720px; }
  th, td { padding: 11px 12px; border-bottom: 1px solid var(--border); text-align: left; font-size: 0.74rem; color: var(--muted); }
  th { color: var(--text); text-transform: uppercase; font-size: 0.65rem; letter-spacing: 0.04em; }
  td:first-child { color: var(--text); font-weight: 700; }
</style>
