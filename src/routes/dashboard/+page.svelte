<script lang="ts">
  import { onMount } from 'svelte';
  import { enhance } from '$app/forms';
  import { RefreshCw } from 'lucide-svelte';
  import type { ActionData, PageData } from './$types';
  import { portfolioSummary } from '$lib/stores/portfolio-summary';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import StatCard from '$lib/components/portfolioai/StatCard.svelte';
  import DailyBriefingCard from '$lib/components/portfolioai/DailyBriefingCard.svelte';
  import AIInsightCard from '$lib/components/portfolioai/AIInsightCard.svelte';
  import PortfolioGrowthChart from '$lib/components/portfolioai/charts/PortfolioGrowthChart.svelte';
  import AllocationChart from '$lib/components/portfolioai/charts/AllocationChart.svelte';
  import HoldingsTable from '$lib/components/portfolioai/tables/HoldingsTable.svelte';
  import WatchlistTable from '$lib/components/portfolioai/tables/WatchlistTable.svelte';
  import OnboardingChecklist from '$lib/components/portfolioai/OnboardingChecklist.svelte';

  export let data: PageData;
  export let form: ActionData;

  let refreshing = false;

  let beginnerMode = true;
  onMount(() => {
    beginnerMode = localStorage.getItem('portfolioai_mode') !== 'advanced';
  });

  function money(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }

  // Day P&L — from broker todayPl per holding (null = not available in transaction-only mode)
  $: dayPl = data.dayPl;
  $: hasDayPl = dayPl !== null;

  // Day change % relative to yesterday's close (totalValue - dayPl)
  $: yesterdayValue = hasDayPl ? data.totalValue - (dayPl ?? 0) : null;
  $: dayPlPct = yesterdayValue && yesterdayValue !== 0
    ? ((dayPl ?? 0) / yesterdayValue) * 100
    : null;

  // Concentration — top 5 holdings as % of total portfolio value
  $: top5Value = data.topHoldings.slice(0, 5).reduce((s, h) => s + h.marketValue, 0);
  $: top5Pct   = data.totalValue > 0 ? (top5Value / data.totalValue) * 100 : 0;

  // Dominant sector (first allocation by value)
  $: topSector = data.allocations[0];

  // Set portfolio summary store so Topbar reflects real data
  $: portfolioSummary.set({
    totalValue:  data.totalValue,
    dayChange:   dayPl ?? 0,
    dayChangePct: dayPlPct ?? 0,
    accountName: data.accounts?.[0]?.name ?? 'Portfolio',
    accountMode: 'LIVE',
    activeBrokerAccId: data.activeBrokerAccId ?? null,
  });
</script>

<div class="dash-header">
  <PageHeader
    title="Dashboard"
    subtitle={data.snapshotDate
      ? `Synced ${new Date(data.snapshotDate).toLocaleString()}`
      : new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
  />
  <div style="display:flex;gap:8px;align-items:center;">
    <form method="POST" action="?/refresh" use:enhance={() => {
      refreshing = true;
      return async ({ update }) => { await update(); refreshing = false; };
    }}>
      <button class="btn-refresh" type="submit" disabled={refreshing}>
        <RefreshCw size={13} class={refreshing ? 'spin' : ''} />
        {refreshing ? 'Syncing…' : 'Refresh'}
      </button>
    </form>
    <form method="POST" action="?/refreshPrices" use:enhance={() => {
      refreshing = true;
      return async ({ update }) => { await update(); refreshing = false; };
    }}>
      <button class="btn-refresh" type="submit" disabled={refreshing} title="Fetch latest prices from Yahoo Finance (free)">
        <RefreshCw size={13} class={refreshing ? 'spin' : ''} />
        {refreshing ? 'Updating…' : 'Update Prices'}
      </button>
    </form>
  </div>
</div>

{#if form?.refreshed}
  <div class="refresh-toast success">
    ✓ Synced {form.count} holding{form.count !== 1 ? 's' : ''} · {form.updatedAt ? new Date(form.updatedAt).toLocaleTimeString() : 'just now'}
  </div>
{:else if form?.pricesRefreshed}
  <div class="refresh-toast success">
    ✓ Updated {form.updated} price{form.updated !== 1 ? 's' : ''} from Yahoo Finance · {form.refreshedAt ? new Date(form.refreshedAt).toLocaleTimeString() : 'just now'}
  </div>
{:else if form?.error}
  <div class="refresh-toast error">⚠ {form.error}</div>
{/if}

<!-- Welcome banner (Beginner only) -->
{#if beginnerMode}
  <div class="welcome-banner">
    <span class="welcome-wave">👋</span>
    <div>
      <div class="welcome-title">Welcome to PortfolioAI</div>
      <div class="welcome-sub">Navigate sections with the <span class="welcome-q">?</span> icons to learn what each number means</div>
    </div>
  </div>
{/if}

<!-- Onboarding checklist (shown until dismissed or all steps complete) -->
{#if data.onboarding?.show}
  <OnboardingChecklist
    hasCash={data.onboarding.hasCash}
    hasBroker={data.onboarding.hasBroker}
    onboardingCompleted={data.onboarding.onboardingCompleted}
  />
{/if}

<!-- AI Banner -->
<DailyBriefingCard briefing={data.briefing} />

<!-- Stat row -->
<div class="stat-row">
  <StatCard
    label="Portfolio Value"
    tooltip={beginnerMode ? 'Total market value of all your investments at current prices' : ''}
    value={money(data.totalValue)}
    change={hasDayPl
      ? (dayPl! >= 0 ? '+' : '') + money(dayPl!) + ' today'
      : 'Sync broker for today\'s change'}
    tint="primary"
  />
  <StatCard
    label="Day P&L"
    tooltip={beginnerMode ? 'How much your portfolio gained or lost vs. yesterday\'s close' : ''}
    value={hasDayPl ? (dayPl! >= 0 ? '+' : '') + money(dayPl!) : '—'}
    change={dayPlPct !== null
      ? (dayPlPct >= 0 ? '+' : '') + dayPlPct.toFixed(2) + '%'
      : 'Not available'}
    tint={hasDayPl && dayPl! >= 0 ? 'success' : hasDayPl ? 'danger' : 'primary'}
  />
  <StatCard
    label="Total Return"
    tooltip={beginnerMode ? 'Overall gain or loss on your cost basis since you started investing' : ''}
    value={(data.totalReturnPct >= 0 ? '+' : '') + data.totalReturnPct.toFixed(2) + '%'}
    change={(data.totalReturn >= 0 ? '+' : '') + money(data.totalReturn) + ' on ' + money(data.costBasisTotal) + ' cost'}
    tint={data.totalReturnPct >= 0 ? 'success' : 'danger'}
  />
  <StatCard
    label="Holdings"
    tooltip={beginnerMode ? 'Number of different stocks or investments you currently hold' : ''}
    value={String(data.topHoldings.length)}
    change={data.allocations.length + ' sector' + (data.allocations.length !== 1 ? 's' : '')}
    tint="primary"
  />
</div>

<!-- Charts row -->
<div class="charts-row">
  <div class="chart-main">
    <PortfolioGrowthChart snapshots={data.growthData} />
  </div>
  <div class="chart-side">
    <AllocationChart allocations={data.allocations} holdingAllocations={data.holdingAllocations} />
  </div>
</div>

<!-- AI Insight cards -->
<div class="insight-row">
  <AIInsightCard
    title="⚠ Concentration Risk"
    summary={top5Pct > 0
      ? `Top ${Math.min(5, data.topHoldings.length)} holdings represent ${top5Pct.toFixed(0)}% of portfolio value. ${top5Pct >= 70 ? 'High concentration — consider diversifying.' : top5Pct >= 50 ? 'Moderate concentration.' : 'Well diversified.'}`
      : 'No holdings data available.'}
    signal={top5Pct >= 70 ? 'high' : top5Pct >= 50 ? 'medium' : 'low'}
    href="/analytics/risk"
  />
  <AIInsightCard
    title="◉ Sector Allocation"
    summary={topSector
      ? `${topSector.label} is the largest sector at ${topSector.percentage.toFixed(0)}% of portfolio. ${topSector.percentage >= 50 ? 'Consider rebalancing for diversification.' : 'Allocation looks balanced.'}`
      : 'No allocation data available.'}
    signal={topSector && topSector.percentage >= 50 ? 'high' : 'medium'}
    href="/analytics/exposure"
  />
  <AIInsightCard
    title="↗ Total Return"
    summary={data.totalValue > 0
      ? `Portfolio is ${data.totalReturnPct >= 0 ? 'up' : 'down'} ${Math.abs(data.totalReturnPct).toFixed(2)}% on cost basis. Unrealised ${money(data.totalPnl)}, realised ${money(data.realizedPnl)}${data.dividends ? ', dividends ' + money(data.dividends) : ''}.`
      : 'No return data yet. Add transactions or sync a broker to track performance.'}
    signal={data.totalReturnPct >= 0 ? 'low' : 'high'}
    href="/analytics/benchmark"
  />
</div>

<!-- Holdings full width -->
<div class="card bottom-card" style="margin-bottom:12px">
  <div class="bottom-header">
    <span class="bottom-title">Top Holdings</span>
    <a href="/holdings" class="bottom-link">View all →</a>
  </div>
  <HoldingsTable holdings={data.topHoldings} />
</div>

<!-- Watchlist full width -->
<div class="card bottom-card">
  <div class="bottom-header">
    <span class="bottom-title">Watchlist</span>
    <a href="/watchlist" class="bottom-link">Manage →</a>
  </div>
  <WatchlistTable items={data.watchlistItems} compact />
</div>

<style>
  .dash-header {
    display: flex; align-items: flex-end; justify-content: space-between;
    gap: 12px; margin-bottom: 16px;
  }
  .btn-refresh {
    display: flex; align-items: center; gap: 6px;
    padding: 7px 14px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--card);
    color: var(--text); font-size: 0.78rem; font-weight: 600;
    cursor: pointer; white-space: nowrap;
    transition: border-color 0.15s, background 0.15s;
  }
  .btn-refresh:hover:not(:disabled) {
    border-color: var(--primary);
    background: rgba(var(--primary-rgb), 0.06);
  }
  .btn-refresh:disabled { opacity: 0.55; cursor: not-allowed; }
  :global(.spin) { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .refresh-toast {
    margin-bottom: 12px; padding: 8px 12px; border-radius: 8px;
    font-size: 0.76rem;
  }
  .refresh-toast.success {
    background: rgba(var(--success-rgb), 0.07);
    border: 1px solid rgba(var(--success-rgb), 0.3);
    color: var(--success);
  }
  .refresh-toast.error {
    background: rgba(var(--danger-rgb), 0.07);
    border: 1px solid rgba(var(--danger-rgb), 0.3);
    color: var(--danger);
  }

  .welcome-banner {
    display: flex; align-items: center; gap: 12px;
    background: rgba(var(--success-rgb),0.06); border: 1px solid rgba(var(--success-rgb),0.2);
    border-radius: 10px; padding: 12px 16px; margin-bottom: 12px;
  }
  .welcome-wave { font-size: 1.4rem; flex-shrink: 0; }
  .welcome-title { font-size: 0.82rem; font-weight: 600; color: var(--text); margin-bottom: 2px; }
  .welcome-sub { font-size: 0.7rem; color: var(--muted); }
  .welcome-q { display: inline-flex; align-items: center; justify-content: center; width: 13px; height: 13px; border-radius: 50%; background: rgba(var(--primary-rgb),0.2); color: var(--primary); font-size: 0.55rem; font-weight: 700; border: 1px solid rgba(var(--primary-rgb),0.3); vertical-align: middle; }

  .stat-row    { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 16px; }
  .charts-row  { display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-bottom: 16px; }
  .chart-main  { min-width: 0; }
  .chart-side  { min-width: 0; }
  .insight-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 16px; }
  .bottom-card { padding: 16px; }
  .bottom-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
  .bottom-title  { font-size: 0.85rem; font-weight: 600; color: var(--text); }
  .bottom-link   { font-size: 0.72rem; color: var(--primary); text-decoration: none; }
  .bottom-link:hover { text-decoration: underline; }

  @media (min-width: 1024px) {
    .stat-row { grid-template-columns: repeat(4, 1fr); }
  }
  @media (max-width: 767px) {
    .charts-row  { grid-template-columns: 1fr; }
    .insight-row { grid-template-columns: 1fr; }
  }
</style>
