<script lang="ts">
  import { ArrowLeft, CheckCircle, Clock, Play } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import PortfolioModeBadge from '$lib/components/optimization/PortfolioModeBadge.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  type HistoryRun = {
    portfolioMode: string;
    status: string;
  };

  const goalLabel: Record<string, string> = {
    minimum_volatility: 'Lower Risk',
    maximum_sharpe: 'Best Risk/Return',
    risk_parity: 'Balanced',
    efficient_frontier: 'Optimal Blend',
    target_volatility: 'Target Volatility',
    target_income: 'Income Focus',
    defensive_allocation: 'Defensive'
  };
  const riskLabel: Record<string, string> = {
    conservative: 'Safe',
    balanced: 'Moderate',
    aggressive: 'Aggressive'
  };

  function relativeTime(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 2) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days < 7) return `${days}d ago`;
    return new Date(iso).toLocaleDateString();
  }

  $: latest = data.history[0];
  $: modeCount = data.history.reduce((acc: Record<string, number>, r: HistoryRun) => {
    acc[r.portfolioMode] = (acc[r.portfolioMode] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  $: topMode = (Object.entries(modeCount) as Array<[string, number]>).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';
  $: completedCount = data.history.filter((r: HistoryRun) => r.status === 'completed').length;
</script>

<PageHeader
  title="Optimization History"
  subtitle="Recent optimization runs and selected goals."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'History' }]}
/>

<div class="actions-bar">
  <div class="actions-left">
    <a class="tab-btn" href="/optimization"><ArrowLeft size={13} /> Back to Engine</a>
  </div>
  <a class="button" href="/optimization"><Play size={13} /> Run Optimization</a>
</div>

{#if data.history.length > 0}
  <div class="summary">
    <div class="summary-card">
      <span class="label">Total Runs</span>
      <strong>{data.history.length}</strong>
    </div>
    <div class="summary-card">
      <span class="label">Completed</span>
      <strong class="ok">{completedCount}</strong>
    </div>
    <div class="summary-card">
      <span class="label">Top Mode</span>
      <strong>{topMode}</strong>
    </div>
    <div class="summary-card">
      <span class="label">Latest Run</span>
      <strong>{latest ? relativeTime(latest.createdAt) : '—'}</strong>
    </div>
  </div>

  <div class="runs">
    {#each data.history as run, i}
      <article class="run-card" class:completed={run.status === 'completed'} class:failed={run.status === 'failed'}>
        <div class="run-left">
          <div class="run-num">#{data.history.length - i}</div>
          <div class="run-id">{run.id.slice(0, 8)}</div>
        </div>

        <div class="run-body">
          <div class="run-top">
            <PortfolioModeBadge mode={run.portfolioMode} />
            <span class="goal">{goalLabel[run.optimizationGoal] ?? run.optimizationGoal}</span>
            <span class="risk">{riskLabel[run.riskProfile] ?? run.riskProfile}</span>
          </div>
          <div class="run-meta">
            <span>{new Date(run.createdAt).toLocaleString()}</span>
            <span class="dot">·</span>
            <span>{relativeTime(run.createdAt)}</span>
          </div>
        </div>

        <div class="run-right">
          {#if run.status === 'completed'}
            <div class="status-badge ok"><CheckCircle size={12} /> Completed</div>
          {:else if run.status === 'running'}
            <div class="status-badge running"><Clock size={12} /> Running</div>
          {:else}
            <div class="status-badge">{run.status}</div>
          {/if}
        </div>
      </article>
    {/each}
  </div>
{:else}
  <div class="empty">
    <div class="empty-icon">📋</div>
    <strong>No optimization runs yet</strong>
    <p>Run your first optimization to see history here.</p>
    <a class="button" href="/optimization">Go to Optimization Engine</a>
  </div>
{/if}

<style>
  .actions-bar { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .actions-left { display: flex; gap: 6px; }
  .tab-btn { display: inline-flex; align-items: center; gap: 5px; padding: 6px 12px; border-radius: 6px; font-size: 0.72rem; font-weight: 700; color: var(--muted); background: var(--surface-1); border: 1px solid var(--border); text-decoration: none; transition: all 0.12s; }
  .tab-btn:hover { color: var(--text); border-color: var(--primary); }

  .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-bottom: 16px; }
  .summary-card { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 12px 16px; display: grid; gap: 5px; }
  .label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; }
  .summary-card strong { font-size: 1.05rem; font-weight: 700; color: var(--text); }
  .summary-card strong.ok { color: var(--success); }

  .runs { display: grid; gap: 8px; }

  .run-card {
    display: grid;
    grid-template-columns: 3.5rem minmax(0, 1fr) auto;
    align-items: center;
    gap: 14px;
    border: 1px solid var(--border);
    border-left: 3px solid var(--border);
    border-radius: 8px;
    background: var(--card);
    padding: 12px 14px;
    transition: border-color 0.12s;
  }
  .run-card.completed { border-left-color: rgba(var(--success-rgb), 0.5); }
  .run-card.failed { border-left-color: rgba(var(--danger-rgb), 0.5); }
  .run-card:hover { border-color: var(--primary); border-left-color: var(--primary); }

  .run-left { display: grid; gap: 2px; }
  .run-num { font-size: 0.78rem; font-weight: 800; color: var(--text); }
  .run-id { font-size: 0.62rem; color: var(--muted); font-family: monospace; }

  .run-body { display: grid; gap: 5px; }
  .run-top { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
  .goal { font-size: 0.74rem; font-weight: 600; color: var(--text); }
  .risk { font-size: 0.68rem; color: var(--muted); }
  .run-meta { display: flex; align-items: center; gap: 6px; font-size: 0.68rem; color: var(--muted); }
  .dot { opacity: 0.4; }

  .run-right { display: flex; justify-content: flex-end; }
  .status-badge {
    display: inline-flex; align-items: center; gap: 4px;
    font-size: 0.62rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;
    padding: 4px 10px; border-radius: 999px;
    border: 1px solid var(--border);
    color: var(--muted);
    background: var(--surface-1);
    white-space: nowrap;
  }
  .status-badge.ok { color: var(--success); background: rgba(var(--success-rgb), 0.1); border-color: rgba(var(--success-rgb), 0.25); }
  .status-badge.running { color: var(--primary); background: rgba(var(--primary-rgb), 0.1); border-color: rgba(var(--primary-rgb), 0.25); }

  .empty {
    display: flex; flex-direction: column; align-items: center; justify-content: center;
    gap: 10px; padding: 64px 24px;
    border: 1px solid var(--border); border-radius: 10px; background: var(--card);
    text-align: center;
  }
  .empty-icon { font-size: 2rem; }
  .empty strong { font-size: 0.9rem; color: var(--text); }
  .empty p { margin: 0; font-size: 0.76rem; color: var(--muted); }

  @media (max-width: 600px) {
    .run-card { grid-template-columns: 3rem minmax(0, 1fr); }
    .run-right { grid-column: 1 / -1; justify-content: flex-start; }
  }
</style>
