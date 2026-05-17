<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import GuardrailBanner from '$lib/components/optimization/GuardrailBanner.svelte';
  import OptimizationHubCard from '$lib/components/optimization/OptimizationHubCard.svelte';
  import OptimizationModeSelector from '$lib/components/optimization/OptimizationModeSelector.svelte';
  import OptimizationStatStrip from '$lib/components/optimization/OptimizationStatStrip.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  $: s = data.activeScenario;
  $: guardrailStatus = (() => {
    const g = data.guardrail;
    if (!g || g.violations.length === 0) return { value: 'All Clear', color: 'green' as const, sub: 'No issues detected' };
    const breaches = g.violations.filter((v) => v.severity === 'breach');
    if (breaches.length > 0) return { value: `${breaches.length} Breach${breaches.length > 1 ? 'es' : ''}`, color: 'red' as const, sub: 'Review required' };
    return { value: `${g.violations.length} Warning${g.violations.length > 1 ? 's' : ''}`, color: 'amber' as const, sub: 'Minor issues' };
  })();

  $: stats = s
    ? [
        { label: 'Expected Return', value: `${s.expectedReturn > 0 ? '+' : ''}${s.expectedReturn.toFixed(1)}%`, color: s.expectedReturn > 0 ? 'green' as const : 'red' as const, sub: 'Balanced scenario' },
        { label: 'Price Swings', value: `${s.expectedVolatility.toFixed(1)}%`, sub: 'Volatility' },
        { label: 'Risk-Adjusted Return', value: s.sharpeRatio.toFixed(2), sub: s.sharpeRatio >= 0.5 ? '≥0.5 — good' : '<0.5 — watch this' },
        { label: 'Risk Controls', value: guardrailStatus.value, color: guardrailStatus.color, sub: guardrailStatus.sub }
      ]
    : [];

  $: scenarioBadge = `${data.scenarios.length} scenario${data.scenarios.length !== 1 ? 's' : ''}`;
  $: rebalanceBadge = data.rebalance.length > 0 ? `${data.rebalance.length} suggestion${data.rebalance.length !== 1 ? 's' : ''}` : 'Up to date';
  $: rebalanceBadgeColor = data.rebalance.length > 0 ? ('amber' as const) : ('green' as const);
</script>

<PageHeader
  title="Optimization Engine"
  subtitle="AI-assisted portfolio scenarios, rebalance suggestions, and risk controls."
  breadcrumb={[{ label: 'Portfolio', href: '/dashboard' }, { label: 'Optimization' }]}
/>

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<OptimizationModeSelector
  portfolioModes={data.portfolioModes}
  optimizationGoals={data.optimizationGoals}
  riskProfiles={data.riskProfiles}
  currentMode={data.run.portfolioMode}
  currentGoal={data.run.optimizationGoal}
  currentRisk={data.run.riskProfile}
/>

{#if stats.length > 0}
  <OptimizationStatStrip {stats} />
{/if}

<GuardrailBanner guardrail={data.guardrail} />

<div class="hub-label">Explore Further</div>
<div class="hub-grid">
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
    icon="🎯"
    name="Options Strategy"
    description="Covered call and cash-secured put candidates ranked by premium yield."
    badge="View candidates"
    badgeColor="blue"
    href="/optimization/options"
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
</div>

<style>
  .notice { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .hub-label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; margin-bottom: 10px; }
  .hub-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  @media (max-width: 900px) { .hub-grid { grid-template-columns: 1fr 1fr; } }
  @media (max-width: 600px) { .hub-grid { grid-template-columns: 1fr; } }
</style>
