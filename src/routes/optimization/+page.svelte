<script lang="ts">
  import { enhance } from '$app/forms';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import GuardrailBanner from '$lib/components/optimization/GuardrailBanner.svelte';
  import OptimizationHubCard from '$lib/components/optimization/OptimizationHubCard.svelte';
  import AiStrategySelector from '$lib/components/optimization/AiStrategySelector.svelte';
  import OptimizationStatStrip from '$lib/components/optimization/OptimizationStatStrip.svelte';
  import PortfolioConstraintEditor from '$lib/components/optimization/PortfolioConstraintEditor.svelte';
  import type { ActionData, PageData } from './$types';
  import type { RiskLevel } from '$lib/services/behavioral-profile.service';

  export let data: PageData;
  export let form: ActionData;

  let running = false;
  let progress = 0;
  let progressInterval: ReturnType<typeof setInterval> | null = null;

  const steps = [
    { pct: 15, label: 'Loading portfolio context…' },
    { pct: 30, label: 'Building optimization scenarios…' },
    { pct: 50, label: 'Computing rebalance suggestions…' },
    { pct: 65, label: 'Running stress test…' },
    { pct: 78, label: 'Calculating portfolio projection…' },
    { pct: 88, label: 'Caching results…' },
    { pct: 94, label: 'Finalising…' }
  ];
  let stepLabel = steps[0].label;

  function handleRunSubmit() {
    running = true;
    progress = 0;
    stepLabel = steps[0].label;
    let stepIndex = 0;
    progressInterval = setInterval(() => {
      const next = steps[stepIndex];
      if (!next) return;
      progress = next.pct;
      stepLabel = next.label;
      stepIndex++;
      if (stepIndex >= steps.length && progressInterval) {
        clearInterval(progressInterval);
        progressInterval = null;
      }
    }, 900);
  }

  $: if (form) {
    progress = 100;
    stepLabel = 'Done!';
    if (progressInterval) {
      clearInterval(progressInterval);
      progressInterval = null;
    }
    setTimeout(() => {
      running = false;
      progress = 0;
    }, 600);
  }

  // AI strategy state
  $: recommended = (data.recommendedStrategy?.riskLevel ?? 'moderate') as RiskLevel;
  $: confidence = data.recommendedStrategy?.confidence ?? 0;
  let selectedRisk: RiskLevel = 'moderate';
  $: selectedRisk = recommended; // sync when data loads

  $: showConflict =
    data.recommendedStrategy?.conflictDetected === true || selectedRisk !== recommended;

  $: aiRecommendedLevel = (data.recommendedStrategy?.aiRecommendedLevel ?? recommended) as RiskLevel;

  // Stats strip
  $: s = data.activeScenario;

  function guardrailStatusFor(g: typeof data.guardrail) {
    if (!g || g.violations.length === 0)
      return { value: 'All Clear', color: 'green' as const, sub: 'No issues detected' };
    const breaches = g.violations.filter((v) => v.severity === 'breach');
    if (breaches.length > 0)
      return {
        value: `${breaches.length} Breach${breaches.length > 1 ? 'es' : ''}`,
        color: 'red' as const,
        sub: 'Review required'
      };
    return {
      value: `${g.violations.length} Warning${g.violations.length > 1 ? 's' : ''}`,
      color: 'amber' as const,
      sub: 'Minor issues'
    };
  }

  $: guardrailStatus = guardrailStatusFor(data.guardrail);
  $: stats = s
    ? [
        {
          label: 'Expected Return',
          value: `${s.expectedReturn > 0 ? '+' : ''}${s.expectedReturn.toFixed(1)}%`,
          color: s.expectedReturn > 0 ? ('green' as const) : ('red' as const),
          sub: 'Balanced scenario'
        },
        {
          label: 'Price Swings',
          value: `${s.expectedVolatility.toFixed(1)}%`,
          sub: 'Volatility'
        },
        {
          label: 'Risk-Adjusted Return',
          value: s.sharpeRatio.toFixed(2),
          sub: s.sharpeRatio >= 0.5 ? '≥0.5 — good' : '<0.5 — watch this'
        },
        {
          label: 'Risk Controls',
          value: guardrailStatus.value,
          color: guardrailStatus.color,
          sub: guardrailStatus.sub
        }
      ]
    : [];

  $: scenarioBadge = `${data.scenarios.length} scenario${data.scenarios.length !== 1 ? 's' : ''}`;
  $: rebalanceBadge = data.rebalance.length > 0 ? `${data.rebalance.length} suggestion${data.rebalance.length !== 1 ? 's' : ''}` : 'Up to date';
  $: rebalanceBadgeColor = data.rebalance.length > 0 ? ('amber' as const) : ('green' as const);
  $: historyBadge = `${data.history.length} run${data.history.length !== 1 ? 's' : ''}`;

  const riskLabels: Record<RiskLevel, string> = {
    conservative: 'Conservative',
    moderate: 'Moderate',
    aggressive: 'Aggressive'
  };
</script>

<PageHeader
  title="Optimization Engine"
  subtitle="AI-assisted portfolio scenarios, rebalance suggestions, and risk controls."
  breadcrumb={[{ label: 'Portfolio', href: '/dashboard' }, { label: 'Optimization' }]}
/>

{#if running}
  <div class="run-overlay">
    <div class="run-overlay-box">
      <div class="run-spinner"></div>
      <div class="run-title">Running Optimization</div>
      <div class="run-step">{stepLabel}</div>
      <div class="run-bar-wrap">
        <div class="run-bar-fill" style="width: {progress}%"></div>
      </div>
      <div class="run-pct">{progress}%</div>
    </div>
  </div>
{/if}

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<!-- Strategy selector — parent owns the form -->
<!-- svelte-ignore a11y-no-static-element-interactions -->
<div on:submit={handleRunSubmit}>
  <form method="POST" action="?/run" use:enhance class="run-form">
    <input type="hidden" name="riskLevel" value={selectedRisk} />

    {#if data.recommendedStrategy}
      <AiStrategySelector
        {recommended}
        {confidence}
        bind:selected={selectedRisk}
        on:change={(e) => (selectedRisk = e.detail)}
      />
    {:else}
      <!-- Skeleton while behavioral profile loads -->
      <div class="skeleton-wrap">
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
        <div class="skeleton-card"></div>
      </div>
    {/if}

    {#if showConflict && data.recommendedStrategy}
      <div class="conflict-notice">
        <span>⚠</span>
        AI detects your actual behavior is <strong>{riskLabels[aiRecommendedLevel]}</strong>.
        Parameters adjusted to fit your selection safely.
      </div>
    {/if}

    <div class="run-row">
      <button class="run-btn" type="submit" disabled={running}>
        {running ? 'Running…' : `▶ Run with ${riskLabels[selectedRisk]}`}
      </button>
    </div>
  </form>
</div>

{#if stats.length > 0}
  <OptimizationStatStrip {stats} />
{/if}

<GuardrailBanner guardrail={data.guardrail} />

<div class="hub-label">Explore Further</div>
<div class="hub-grid">
  <div class="behavioral-card">
    <OptimizationHubCard
      icon="🧠"
      name="Behavioral Profile"
      description="Discover your actual investor profile — derived from your optimization history and transaction patterns, not just what you say."
      badge="New"
      badgeColor="amber"
      href="/optimization/behavioral"
    />
  </div>
  <OptimizationHubCard
    icon="📊"
    name="Portfolio Scenarios"
    description="Compare three allocation plans — safe, moderate, and aggressive — and see the expected return and risk for each."
    badge={scenarioBadge}
    badgeColor="blue"
    href="/optimization/scenarios"
  />
  <OptimizationHubCard
    icon="⚖️"
    name="Rebalance Suggestions"
    description="What to buy or sell to bring your portfolio closer to the target allocation."
    badge={rebalanceBadge}
    badgeColor={rebalanceBadgeColor}
    href="/optimization/rebalance"
  />
  <OptimizationHubCard
    icon="📈"
    name="Allocation Check"
    description="Review overweight and underweight positions by stock, sector, and asset type."
    badge="View details"
    badgeColor="blue"
    href="/optimization/allocation"
  />
  <OptimizationHubCard
    icon="🌪️"
    name="Stress Test"
    description="See how your portfolio holds up in a market crash, rate shock, or sector selloff."
    badge="Run simulation"
    badgeColor="blue"
    href="/optimization/stress-test"
  />
  <OptimizationHubCard
    icon="🔮"
    name="Portfolio Projection"
    description="Expected portfolio value in 1, 3, and 5 years based on current return rates."
    badge="View projection"
    badgeColor="blue"
    href="/optimization/projection"
  />
  <OptimizationHubCard
    icon="🧪"
    name="Scenario Simulation"
    description="Run what-if scenarios — bear markets, rate shocks, sector rotations — and see how your allocation holds up."
    badge="Run simulation"
    badgeColor="blue"
    href="/optimization/simulation"
  />
  <OptimizationHubCard
    icon="🎯"
    name="Options Strategy"
    description="Covered call and cash-secured put candidates ranked by premium yield."
    badge="View candidates"
    badgeColor="blue"
    href="/optimization/options"
  />
  <OptimizationHubCard
    icon="📋"
    name="Run History"
    description="Previous optimization runs and how your allocation targets have evolved over time."
    badge={historyBadge}
    badgeColor="blue"
    href="/optimization/history"
  />
</div>

<details class="constraints-section">
  <summary>Advanced Constraints</summary>
  <PortfolioConstraintEditor constraints={data.constraints} />
</details>

<style>
  /* ── Run overlay ──────────────────────────────────────────────────── */
  .run-overlay {
    position: fixed;
    inset: 0;
    z-index: 200;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .run-overlay-box {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 14px;
    background: var(--card);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 36px 48px;
    box-shadow: 0 24px 64px rgba(0, 0, 0, 0.5);
  }
  .run-spinner {
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 3px solid rgba(var(--primary-rgb), 0.2);
    border-top-color: var(--primary);
    animation: spin 0.8s linear infinite;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  .run-title {
    font-size: 1rem;
    font-weight: 700;
    color: var(--text);
  }
  .run-step {
    font-size: 0.72rem;
    color: var(--muted);
    min-height: 1.2em;
  }
  .run-bar-wrap {
    width: 240px;
    height: 6px;
    background: rgba(var(--primary-rgb), 0.15);
    border-radius: 999px;
    overflow: hidden;
  }
  .run-bar-fill {
    height: 100%;
    background: var(--primary);
    border-radius: 999px;
    transition: width 0.7s ease;
  }
  .run-pct {
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--primary);
  }

  /* ── Notice ───────────────────────────────────────────────────────── */
  .notice {
    margin-bottom: 12px;
    border: 1px solid rgba(var(--success-rgb), 0.3);
    border-radius: 8px;
    background: rgba(var(--success-rgb), 0.08);
    color: var(--success);
    padding: 10px 12px;
    font-size: 0.78rem;
  }

  /* ── Run form wrapper ─────────────────────────────────────────────── */
  .run-form {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--card);
    padding: 16px;
    display: grid;
    gap: 12px;
    margin-bottom: 16px;
  }

  /* ── Skeleton ─────────────────────────────────────────────────────── */
  .skeleton-wrap {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .skeleton-card {
    height: 120px;
    border-radius: 10px;
    background: var(--border);
    animation: pulse 1.4s ease-in-out infinite;
  }
  @keyframes pulse {
    0%,
    100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }

  /* ── Conflict notice ──────────────────────────────────────────────── */
  .conflict-notice {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 9px 13px;
    border-radius: 7px;
    border: 1px solid rgba(245, 158, 11, 0.35);
    background: rgba(245, 158, 11, 0.07);
    color: #f59e0b;
    font-size: 0.73rem;
  }
  .conflict-notice strong {
    font-weight: 800;
  }

  /* ── Run button row ───────────────────────────────────────────────── */
  .run-row {
    display: flex;
    justify-content: flex-end;
  }
  .run-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 24px;
    border-radius: 8px;
    background: var(--primary);
    color: #fff;
    font-size: 0.8rem;
    font-weight: 700;
    border: none;
    cursor: pointer;
    transition: opacity 0.12s;
  }
  .run-btn:hover:not(:disabled) {
    opacity: 0.88;
  }
  .run-btn:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  /* ── Hub grid ─────────────────────────────────────────────────────── */
  .hub-label {
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--muted);
    letter-spacing: 0.05em;
    margin-bottom: 10px;
  }
  .hub-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .behavioral-card {
    grid-column: span 3;
  }

  /* ── Constraints ──────────────────────────────────────────────────── */
  .constraints-section {
    margin-top: 16px;
  }
  .constraints-section summary {
    font-size: 0.68rem;
    font-weight: 800;
    text-transform: uppercase;
    color: var(--muted);
    letter-spacing: 0.05em;
    cursor: pointer;
    user-select: none;
    padding: 4px 0;
  }
  .constraints-section summary:hover {
    color: var(--text);
  }
  .constraints-section > :global(.editor) {
    margin-top: 10px;
  }

  /* ── Responsive ───────────────────────────────────────────────────── */
  @media (max-width: 900px) {
    .hub-grid {
      grid-template-columns: 1fr 1fr;
    }
    .behavioral-card {
      grid-column: span 2;
    }
    .skeleton-wrap {
      grid-template-columns: 1fr;
    }
    .run-row {
      justify-content: stretch;
    }
    .run-btn {
      width: 100%;
      justify-content: center;
    }
  }
  @media (max-width: 600px) {
    .hub-grid {
      grid-template-columns: 1fr;
    }
    .behavioral-card {
      grid-column: span 1;
    }
  }
</style>
