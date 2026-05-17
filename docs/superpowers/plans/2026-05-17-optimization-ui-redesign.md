# Optimization UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all 8 optimization pages into a hub-dashboard layout with plain-English labels, visual pill selectors, and no clutter in the sidebar or top nav.

**Architecture:** Pure frontend change — no server files, no services, no API routes touched. Three new shared components are created; existing components are rewritten in-place or cleaned up. All data flows from existing `PageData` types unchanged.

**Tech Stack:** SvelteKit, Svelte (components use `export let` props), CSS custom properties (`var(--primary)`, `var(--card)`, `var(--border)`, `var(--muted)`, `var(--text)`, `var(--success)`), Lucide Svelte icons.

---

## File Map

**Create:**
- `src/lib/components/optimization/OptimizationStatStrip.svelte` — reusable stat card row
- `src/lib/components/optimization/GuardrailBanner.svelte` — guardrail warning/breach strip
- `src/lib/components/optimization/OptimizationHubCard.svelte` — hub navigation card

**Rewrite:**
- `src/lib/components/optimization/OptimizationModeSelector.svelte` — radio pills (not dropdowns)
- `src/routes/optimization/+page.svelte` — full hub layout

**Update (remove nav buttons, add stat strip):**
- `src/routes/optimization/scenarios/+page.svelte`
- `src/routes/optimization/rebalance/+page.svelte`
- `src/routes/optimization/allocation/+page.svelte`
- `src/routes/optimization/options/+page.svelte`
- `src/routes/optimization/stress-test/+page.svelte`
- `src/routes/optimization/projection/+page.svelte`
- `src/routes/optimization/simulation/+page.svelte`
- `src/routes/optimization/history/+page.svelte`

---

## Task 1: Three New Shared Components

**Files:**
- Create: `src/lib/components/optimization/OptimizationStatStrip.svelte`
- Create: `src/lib/components/optimization/GuardrailBanner.svelte`
- Create: `src/lib/components/optimization/OptimizationHubCard.svelte`

- [ ] **Step 1: Create OptimizationStatStrip.svelte**

```svelte
<!-- src/lib/components/optimization/OptimizationStatStrip.svelte -->
<script lang="ts">
  export let stats: Array<{
    label: string;
    value: string;
    sub?: string;
    color?: 'green' | 'amber' | 'red';
  }> = [];
</script>

<div class="strip">
  {#each stats as stat}
    <div class="card" class:green={stat.color === 'green'} class:amber={stat.color === 'amber'} class:red={stat.color === 'red'}>
      <span class="label">{stat.label}</span>
      <strong class="value">{stat.value}</strong>
      {#if stat.sub}<span class="sub">{stat.sub}</span>{/if}
    </div>
  {/each}
</div>

<style>
  .strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; margin-bottom: 16px; }
  .card { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 12px 14px; display: grid; gap: 3px; }
  .label { color: var(--muted); font-size: 0.62rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
  .value { color: var(--text); font-size: 1.05rem; font-weight: 800; }
  .sub { color: var(--muted); font-size: 0.65rem; }
  .green .value { color: var(--success); }
  .amber .value { color: #f59e0b; }
  .red .value { color: #ef4444; }
</style>
```

- [ ] **Step 2: Create GuardrailBanner.svelte**

```svelte
<!-- src/lib/components/optimization/GuardrailBanner.svelte -->
<script lang="ts">
  import type { GuardrailReport } from '$lib/services/guardrail.service';

  export let guardrail: GuardrailReport | null = null;

  $: breaches = guardrail?.violations.filter((v) => v.severity === 'breach') ?? [];
  $: warnings = guardrail?.violations.filter((v) => v.severity === 'warning') ?? [];
  $: show = !!guardrail && guardrail.violations.length > 0;
  $: isBreached = breaches.length > 0;
  $: title = isBreached
    ? `${breaches.length} Risk Control Breach${breaches.length > 1 ? 'es' : ''}`
    : `${warnings.length} Risk Control Warning${warnings.length > 1 ? 's' : ''}`;
</script>

{#if show}
  <div class="banner" class:breach={isBreached}>
    <span class="icon">{isBreached ? '🚨' : '⚠️'}</span>
    <div class="text">
      <strong>{title}</strong>
      <span>{guardrail?.summary}</span>
    </div>
    <a href="/optimization/allocation" class="link">View Details →</a>
  </div>
{/if}

<style>
  .banner { display: flex; align-items: center; gap: 12px; border: 1px solid rgba(245, 158, 11, 0.3); border-left: 3px solid #f59e0b; border-radius: 10px; background: rgba(245, 158, 11, 0.06); padding: 12px 14px; margin-bottom: 16px; }
  .banner.breach { border-color: rgba(239, 68, 68, 0.3); border-left-color: #ef4444; background: rgba(239, 68, 68, 0.06); }
  .icon { font-size: 1.1rem; flex-shrink: 0; }
  .text { flex: 1; display: grid; gap: 2px; }
  .text strong { font-size: 0.78rem; color: var(--text); }
  .text span { font-size: 0.68rem; color: var(--muted); }
  .link { font-size: 0.72rem; color: var(--primary); text-decoration: none; flex-shrink: 0; font-weight: 700; white-space: nowrap; }
</style>
```

- [ ] **Step 3: Create OptimizationHubCard.svelte**

```svelte
<!-- src/lib/components/optimization/OptimizationHubCard.svelte -->
<script lang="ts">
  export let icon: string;
  export let name: string;
  export let description: string;
  export let badge = '';
  export let badgeColor: 'green' | 'amber' | 'blue' = 'blue';
  export let href: string;
</script>

<a {href} class="hub-card">
  <span class="icon">{icon}</span>
  <strong class="name">{name}</strong>
  <p class="desc">{description}</p>
  {#if badge}
    <span class="badge" class:green={badgeColor === 'green'} class:amber={badgeColor === 'amber'}>{badge}</span>
  {/if}
</a>

<style>
  .hub-card { display: flex; flex-direction: column; gap: 6px; border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 16px; text-decoration: none; transition: border-color 0.15s; }
  .hub-card:hover { border-color: var(--primary); }
  .icon { font-size: 1.4rem; }
  .name { font-size: 0.84rem; font-weight: 800; color: var(--text); }
  .desc { margin: 0; font-size: 0.69rem; color: var(--muted); line-height: 1.5; flex: 1; }
  .badge { align-self: flex-start; font-size: 0.6rem; font-weight: 700; text-transform: uppercase; padding: 3px 8px; border-radius: 999px; background: rgba(var(--primary-rgb), 0.1); color: var(--primary); }
  .badge.green { background: rgba(34, 197, 94, 0.1); color: var(--success); }
  .badge.amber { background: rgba(245, 158, 11, 0.1); color: #f59e0b; }
</style>
```

- [ ] **Step 4: Type-check**

```
npx svelte-check --output human 2>&1 | tail -5
```

Expected: `0 errors` (new files have no imports yet that could fail).

- [ ] **Step 5: Commit**

```
git add src/lib/components/optimization/OptimizationStatStrip.svelte
git add src/lib/components/optimization/GuardrailBanner.svelte
git add src/lib/components/optimization/OptimizationHubCard.svelte
git commit -m "feat: add OptimizationStatStrip, GuardrailBanner, OptimizationHubCard components"
```

---

## Task 2: Rewrite OptimizationModeSelector

Replace 3 dropdowns + submit button with radio-styled pill cards for mode, goal, and risk. Single form submits `?/run`.

**Files:**
- Modify: `src/lib/components/optimization/OptimizationModeSelector.svelte`

The jargon map for goal values (internal → display label):
```
minimum_volatility  → Lower Risk
maximum_sharpe      → Best Risk/Return
risk_parity         → Balanced
efficient_frontier  → Optimal Blend
target_volatility   → Set Volatility Target
target_income       → Income Focus
defensive_allocation → Defensive
```

Risk values:
```
conservative → Safe
balanced     → Moderate
aggressive   → Aggressive
```

Mode values:
```
stock   → Stocks Only
hybrid  → Hybrid
options → Active Options
```

Mode descriptions:
```
stock   → Buy and hold stocks. No options.
hybrid  → Stocks + options income strategies.
options → Options-focused. Covered calls and puts.
```

- [ ] **Step 1: Rewrite the component**

```svelte
<!-- src/lib/components/optimization/OptimizationModeSelector.svelte -->
<script lang="ts">
  export let portfolioModes: readonly string[] = [];
  export let optimizationGoals: readonly string[] = [];
  export let riskProfiles: readonly string[] = [];
  export let currentMode = 'hybrid';
  export let currentGoal = 'risk_parity';
  export let currentRisk = 'balanced';

  const modeLabel: Record<string, string> = {
    stock: 'Stocks Only',
    hybrid: 'Hybrid',
    options: 'Active Options'
  };
  const modeDesc: Record<string, string> = {
    stock: 'Buy and hold stocks. No options.',
    hybrid: 'Stocks + options income strategies.',
    options: 'Options-focused. Covered calls and puts.'
  };
  const modeIcon: Record<string, string> = {
    stock: '📦',
    hybrid: '⚡',
    options: '🎯'
  };
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

<form method="POST" action="?/run" class="selector">
  <div class="section-label">Portfolio Mode</div>
  <div class="mode-strip">
    {#each portfolioModes as mode}
      <label class="mode-card" class:active={mode === currentMode}>
        <input type="radio" name="portfolioMode" value={mode} checked={mode === currentMode} />
        <span class="m-icon">{modeIcon[mode] ?? '📂'}</span>
        <strong class="m-name">{modeLabel[mode] ?? mode}</strong>
        <span class="m-desc">{modeDesc[mode] ?? ''}</span>
      </label>
    {/each}
  </div>

  <div class="row-two">
    <div class="pill-group">
      <div class="section-label">Goal</div>
      <div class="pills">
        {#each optimizationGoals as goal}
          <label class="pill" class:active={goal === currentGoal}>
            <input type="radio" name="optimizationGoal" value={goal} checked={goal === currentGoal} />
            {goalLabel[goal] ?? goal}
          </label>
        {/each}
      </div>
    </div>
    <div class="pill-group">
      <div class="section-label">Risk Profile</div>
      <div class="pills">
        {#each riskProfiles as risk}
          <label class="pill" class:active={risk === currentRisk}>
            <input type="radio" name="riskProfile" value={risk} checked={risk === currentRisk} />
            {riskLabel[risk] ?? risk}
          </label>
        {/each}
      </div>
    </div>
  </div>

  <button class="button run-btn" type="submit">Run Optimization</button>
</form>

<style>
  .selector { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 16px; display: grid; gap: 14px; margin-bottom: 16px; }
  .section-label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; margin-bottom: 6px; }

  /* Mode cards */
  .mode-strip { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
  .mode-card { display: flex; flex-direction: column; gap: 4px; border: 1.5px solid var(--border); border-radius: 10px; padding: 12px 14px; cursor: pointer; background: var(--bg); transition: border-color 0.12s; }
  .mode-card input { display: none; }
  .mode-card.active { border-color: var(--primary); background: rgba(var(--primary-rgb), 0.05); }
  .mode-card:has(input:checked) { border-color: var(--primary); background: rgba(var(--primary-rgb), 0.05); }
  .m-icon { font-size: 1.2rem; }
  .m-name { font-size: 0.82rem; font-weight: 800; color: var(--text); }
  .mode-card.active .m-name { color: var(--primary); }
  .mode-card:has(input:checked) .m-name { color: var(--primary); }
  .m-desc { font-size: 0.67rem; color: var(--muted); line-height: 1.4; }

  /* Goal + Risk pills */
  .row-two { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  .pills { display: flex; flex-wrap: wrap; gap: 6px; }
  .pill { border: 1px solid var(--border); border-radius: 999px; padding: 6px 13px; font-size: 0.72rem; font-weight: 600; cursor: pointer; color: var(--muted); background: var(--bg); transition: all 0.12s; white-space: nowrap; }
  .pill input { display: none; }
  .pill.active { background: var(--primary); color: #fff; border-color: var(--primary); }
  .pill:has(input:checked) { background: var(--primary); color: #fff; border-color: var(--primary); }

  .run-btn { justify-self: end; }

  @media (max-width: 900px) {
    .mode-strip { grid-template-columns: 1fr; }
    .row-two { grid-template-columns: 1fr; }
    .run-btn { justify-self: stretch; }
  }
</style>
```

- [ ] **Step 2: Type-check**

```
npx svelte-check --output human 2>&1 | tail -5
```

Expected: `0 errors`.

- [ ] **Step 3: Open http://localhost:5173/optimization and verify**

- Mode cards show "Stocks Only", "Hybrid", "Active Options" (not "stock", "hybrid", "options")
- Goal pills show "Lower Risk", "Best Risk/Return", "Balanced" etc.
- Risk pills show "Safe", "Moderate", "Aggressive"
- Active selection is visually highlighted
- Clicking Run Optimization reloads the page with new settings

- [ ] **Step 4: Commit**

```
git add src/lib/components/optimization/OptimizationModeSelector.svelte
git commit -m "feat: rewrite OptimizationModeSelector with pill cards and plain English labels"
```

---

## Task 3: Rewrite Main Hub Page

Remove the 7 nav buttons and dense layout. Replace with results strip, guardrail banner, and 6 hub cards.

**Files:**
- Modify: `src/routes/optimization/+page.svelte`

The page receives this data from the existing server load (no server changes needed):
- `data.activeScenario` — `OptimizationScenario | null` — has `.expectedReturn`, `.expectedVolatility`, `.sharpeRatio`
- `data.scenarios` — `OptimizationScenario[]`
- `data.rebalance` — `RebalanceSuggestion[]`
- `data.guardrail` — `GuardrailReport | null`
- `data.run` — has `.portfolioMode`, `.optimizationGoal`, `.riskProfile`
- `data.portfolioModes`, `data.optimizationGoals`, `data.riskProfiles`
- `data.savedMode`

- [ ] **Step 1: Rewrite the page**

```svelte
<!-- src/routes/optimization/+page.svelte -->
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
```

- [ ] **Step 2: Type-check**

```
npx svelte-check --output human 2>&1 | tail -5
```

Expected: `0 errors`.

- [ ] **Step 3: Open http://localhost:5173/optimization and verify**

- No 7 nav buttons at top
- Mode selector shows pill cards
- 4 stat cards appear below selector
- Guardrail banner shows (or is hidden if no violations)
- 6 hub cards in 3-column grid with icons, names, descriptions, badges

- [ ] **Step 4: Commit**

```
git add src/routes/optimization/+page.svelte
git commit -m "feat: rewrite optimization hub page — remove nav buttons, add stat strip and hub cards"
```

---

## Task 4: Update Scenarios, Rebalance, and History Pages

Remove nav buttons from top-right. Add stat strip to scenarios page. Translate jargon in history table.

**Files:**
- Modify: `src/routes/optimization/scenarios/+page.svelte`
- Modify: `src/routes/optimization/rebalance/+page.svelte`
- Modify: `src/routes/optimization/history/+page.svelte`

- [ ] **Step 1: Update scenarios page**

```svelte
<!-- src/routes/optimization/scenarios/+page.svelte -->
<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AllocationComparisonChart from '$lib/components/optimization/AllocationComparisonChart.svelte';
  import EfficientFrontierChart from '$lib/components/optimization/EfficientFrontierChart.svelte';
  import OptimizationScenarioCard from '$lib/components/optimization/OptimizationScenarioCard.svelte';
  import OptimizationStatStrip from '$lib/components/optimization/OptimizationStatStrip.svelte';
  import ScenarioSelector from '$lib/components/optimization/ScenarioSelector.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  $: best = data.scenarios.reduce((a, b) => (a.expectedReturn > b.expectedReturn ? a : b), data.scenarios[0]);
  $: lowest = data.scenarios.reduce((a, b) => (a.expectedVolatility < b.expectedVolatility ? a : b), data.scenarios[0]);
  $: stats = data.scenarios.length
    ? [
        { label: 'Best Return', value: `${best?.expectedReturn > 0 ? '+' : ''}${best?.expectedReturn.toFixed(1) ?? '—'}%`, color: 'green' as const, sub: best?.scenarioName },
        { label: 'Lowest Volatility', value: `${lowest?.expectedVolatility.toFixed(1) ?? '—'}%`, sub: lowest?.scenarioName },
        { label: 'Best Sharpe', value: data.scenarios.reduce((a, b) => (a.sharpeRatio > b.sharpeRatio ? a : b), data.scenarios[0])?.sharpeRatio.toFixed(2) ?? '—', sub: '>0.5 is good' },
        { label: 'Active Scenario', value: data.activeScenarioName || 'Balanced', sub: 'Currently selected' }
      ]
    : [];
</script>

<PageHeader
  title="Portfolio Scenarios"
  subtitle="Compare three allocation strategies and pick what fits your goals."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Scenarios' }]}
/>

<OptimizationStatStrip {stats} />

<ScenarioSelector scenarios={data.scenarios} active={data.activeScenarioName} />

<div class="grid">
  {#each data.scenarios as scenario}<OptimizationScenarioCard {scenario} />{/each}
</div>

<EfficientFrontierChart points={data.efficientFrontier} />

{#if data.activeScenario}
  <AllocationComparisonChart allocation={data.activeScenario.allocation} />
{/if}

<style>
  .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 12px; margin: 12px 0; }
</style>
```

- [ ] **Step 2: Update rebalance page**

```svelte
<!-- src/routes/optimization/rebalance/+page.svelte -->
<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AllocationComparisonChart from '$lib/components/optimization/AllocationComparisonChart.svelte';
  import OptimizationStatStrip from '$lib/components/optimization/OptimizationStatStrip.svelte';
  import RebalanceSuggestionCard from '$lib/components/optimization/RebalanceSuggestionCard.svelte';
  import RebalanceProjectionCard from '$lib/components/simulation/RebalanceProjectionCard.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  $: stats = [
    { label: 'Suggestions', value: String(data.rebalance.length), sub: data.rebalance.length > 0 ? 'Actions available' : 'None needed' },
    { label: 'Status', value: data.rebalance.length > 0 ? 'Needs Action' : 'Up to Date', color: data.rebalance.length > 0 ? 'amber' as const : 'green' as const },
    { label: 'Est. Risk Reduction', value: data.rebalanceProjection ? `${data.rebalanceProjection.risk_reduction > 0 ? '-' : ''}${Math.abs(data.rebalanceProjection.risk_reduction).toFixed(1)}%` : '—', sub: 'After rebalance' }
  ];
</script>

<PageHeader
  title="Rebalance Suggestions"
  subtitle="Actions to bring your portfolio closer to the target allocation."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Rebalance' }]}
/>

<OptimizationStatStrip {stats} />

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<div class="layout">
  <main class="list">
    {#each data.rebalance as suggestion}<RebalanceSuggestionCard {suggestion} />{/each}
    {#if data.rebalance.length === 0}<div class="empty">No rebalance actions needed at this time.</div>{/if}
  </main>
  <aside>
    <form method="POST" action="?/simulate" class="simulate-card">
      <label>
        <span>Portfolio Mode</span>
        <select name="portfolioMode">
          {#each data.portfolioModes as mode}
            <option value={mode} selected={mode === data.portfolioMode}>{mode}</option>
          {/each}
        </select>
      </label>
      <button class="button" type="submit">Simulate Rebalance</button>
    </form>
    <RebalanceProjectionCard projection={data.rebalanceProjection} />
    {#if data.rebalance[0]}<AllocationComparisonChart allocation={data.rebalance[0].targetAllocation} />{/if}
  </aside>
</div>

<style>
  .notice { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 24rem; gap: 12px; }
  .list { display: grid; gap: 12px; align-content: start; }
  .empty { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 20px; color: var(--muted); font-size: 0.78rem; text-align: center; }
  aside { display: grid; align-content: start; gap: 12px; }
  .simulate-card { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; display: grid; gap: 10px; }
  label { display: grid; gap: 5px; }
  label span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  select { height: 34px; border: 1px solid var(--border); border-radius: 8px; background: var(--bg); color: var(--text); padding: 0 10px; font-size: 0.78rem; }
  @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
</style>
```

- [ ] **Step 3: Update history page — translate jargon in table**

```svelte
<!-- src/routes/optimization/history/+page.svelte -->
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
```

- [ ] **Step 4: Type-check**

```
npx svelte-check --output human 2>&1 | tail -5
```

Expected: `0 errors`.

- [ ] **Step 5: Verify in browser**

- http://localhost:5173/optimization/scenarios — stat strip visible, no nav buttons at top-right
- http://localhost:5173/optimization/rebalance — stat strip visible, no "Simulation / Overview" buttons
- http://localhost:5173/optimization/history — table shows "Lower Risk" not "risk_parity"

- [ ] **Step 6: Commit**

```
git add src/routes/optimization/scenarios/+page.svelte
git add src/routes/optimization/rebalance/+page.svelte
git add src/routes/optimization/history/+page.svelte
git commit -m "feat: update scenarios, rebalance, history pages — stat strip, remove nav buttons, translate jargon"
```

---

## Task 5: Update Allocation and Options Pages

Update page titles to plain English. Remove nav button cluster at top-right. Add stat strip.

**Files:**
- Modify: `src/routes/optimization/allocation/+page.svelte`
- Modify: `src/routes/optimization/options/+page.svelte`

- [ ] **Step 1: Update allocation page**

```svelte
<!-- src/routes/optimization/allocation/+page.svelte -->
<script lang="ts">
  import { Activity, RefreshCw, Table2 } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AllocationHealthCard from '$lib/components/allocation/AllocationHealthCard.svelte';
  import AllocationSuggestionCard from '$lib/components/allocation/AllocationSuggestionCard.svelte';
  import CashEfficiencyCard from '$lib/components/allocation/CashEfficiencyCard.svelte';
  import DiversificationScoreCard from '$lib/components/allocation/DiversificationScoreCard.svelte';
  import OptimizationStatStrip from '$lib/components/optimization/OptimizationStatStrip.svelte';
  import PortfolioStyleBadge from '$lib/components/allocation/PortfolioStyleBadge.svelte';
  import SectorExposureChart from '$lib/components/allocation/SectorExposureChart.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  $: largestPct = data.exposure?.symbol_exposure?.[0]?.percentage ?? 0;
  $: topSectorPct = data.exposure?.category_exposure?.[0]?.percentage ?? 0;
  $: stats = [
    { label: 'Largest Holding', value: `${largestPct.toFixed(1)}%`, color: largestPct > 20 ? 'amber' as const : 'green' as const, sub: data.exposure?.symbol_exposure?.[0]?.label ?? '' },
    { label: 'Top Sector', value: `${topSectorPct.toFixed(1)}%`, color: topSectorPct > 35 ? 'amber' as const : 'green' as const, sub: data.exposure?.category_exposure?.[0]?.label ?? '' },
    { label: 'Diversification', value: `${data.health?.diversification_score ?? 0}/100`, sub: 'Higher is better' },
    { label: 'Cash', value: `${((data.exposure?.cash_pct ?? 0) * 100).toFixed(1)}%`, sub: 'Available liquidity' }
  ];
</script>

<PageHeader
  title="Allocation Check"
  subtitle="Review how your portfolio is distributed across stocks, sectors, and asset types."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Allocation' }]}
/>

<div class="top-actions">
  <a class="button-secondary" href="/optimization/allocation/health"><Activity size={15} /> Health Report</a>
  <a class="button-secondary" href="/optimization/allocation/exposure"><Table2 size={15} /> Full Exposure</a>
  <form method="POST" action="?/refresh"><button class="button" type="submit"><RefreshCw size={15} /> Refresh</button></form>
</div>

<OptimizationStatStrip {stats} />

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<div class="layout">
  <main class="main-col">
    <AllocationHealthCard health={data.health} />
    <SectorExposureChart rows={data.exposure.category_exposure} title="Portfolio Style Exposure" />
    <SectorExposureChart rows={data.exposure.symbol_exposure} title="Single Holding Exposure" />
  </main>
  <aside class="side-col">
    <div class="style-card">
      <span>Detected Style</span>
      <PortfolioStyleBadge style={data.style.portfolio_style} />
      <p>{data.style.explanation}</p>
    </div>
    <DiversificationScoreCard score={data.health.diversification_score} />
    <CashEfficiencyCard score={data.health.cash_efficiency_score} cashPct={data.exposure.cash_pct} />
    <div class="suggestions">
      <h2>Allocation Suggestions</h2>
      {#each data.suggestions as suggestion}<AllocationSuggestionCard {suggestion} />{/each}
    </div>
  </aside>
</div>

<style>
  .top-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .notice { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 23rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  .style-card, .suggestions { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  .style-card { display: grid; gap: 10px; }
  .style-card span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  .style-card p { margin: 0; color: var(--muted); font-size: 0.74rem; line-height: 1.5; }
  .suggestions { display: grid; gap: 10px; }
  .suggestions h2 { margin: 0; color: var(--text); font-size: 0.9rem; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
</style>
```

- [ ] **Step 2: Update options page**

```svelte
<!-- src/routes/optimization/options/+page.svelte -->
<script lang="ts">
  import { Coins, RefreshCw, ShieldAlert, Table2 } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import AssignmentRiskCard from '$lib/components/options/AssignmentRiskCard.svelte';
  import CollateralUsageChart from '$lib/components/options/CollateralUsageChart.svelte';
  import CoveredCallTable from '$lib/components/options/CoveredCallTable.svelte';
  import OptimizationStatStrip from '$lib/components/optimization/OptimizationStatStrip.svelte';
  import OptionsExposureCard from '$lib/components/options/OptionsExposureCard.svelte';
  import PremiumYieldCard from '$lib/components/options/PremiumYieldCard.svelte';
  import PutExposureChart from '$lib/components/options/PutExposureChart.svelte';
  import WheelStrategyCard from '$lib/components/options/WheelStrategyCard.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;

  $: stats = data.widgets.slice(0, 4).map((w) => ({ label: w.label, value: w.value }));
</script>

<PageHeader
  title="Options Strategy"
  subtitle="Covered call and cash-secured put candidates, ranked by premium yield."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Options' }]}
/>

<div class="top-actions">
  <a class="button-secondary" href="/optimization/options/exposure"><ShieldAlert size={15} /> Exposure</a>
  <a class="button-secondary" href="/optimization/options/wheel"><Table2 size={15} /> Wheel</a>
  <a class="button-secondary" href="/optimization/options/premium"><Coins size={15} /> Premium</a>
  <form method="POST" action="?/refresh"><button class="button" type="submit"><RefreshCw size={15} /> Refresh</button></form>
</div>

<OptimizationStatStrip {stats} />

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<div class="layout">
  <main class="main-col">
    <OptionsExposureCard exposure={data.exposure} />
    <CoveredCallTable rows={data.coveredCalls} />
    <PutExposureChart rows={data.puts} />
  </main>
  <aside class="side-col">
    <AssignmentRiskCard score={data.exposure.assignment_risk_score} level={data.exposure.risk_level} warnings={data.exposure.warnings} />
    <PremiumYieldCard premium={data.premium} />
    <CollateralUsageChart usagePct={data.exposure.collateral_usage_pct} collateral={data.exposure.collateral_locked} />
    {#each data.wheel.slice(0, 3) as report}<WheelStrategyCard {report} />{/each}
  </aside>
</div>

<style>
  .top-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
  .notice { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), .3); border-radius: 8px; background: rgba(var(--success-rgb), .08); color: var(--success); padding: 10px 12px; font-size: .78rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 23rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
</style>
```

- [ ] **Step 3: Type-check**

```
npx svelte-check --output human 2>&1 | tail -5
```

Expected: `0 errors`.

- [ ] **Step 4: Verify in browser**

- http://localhost:5173/optimization/allocation — title is "Allocation Check" (not "Smart Allocation Intelligence"), stat strip visible, no nav button row in page-top
- http://localhost:5173/optimization/options — title is "Options Strategy" (not "Options Intelligence Engine"), stat strip visible

- [ ] **Step 5: Commit**

```
git add src/routes/optimization/allocation/+page.svelte
git add src/routes/optimization/options/+page.svelte
git commit -m "feat: update allocation and options pages — plain title, stat strip, clean header"
```

---

## Task 6: Update Stress-Test, Projection, and Simulation Pages

Remove nav buttons from the top-right of these pages. They already have widget-rows which are fine — no stat strip needed (would duplicate).

**Files:**
- Modify: `src/routes/optimization/stress-test/+page.svelte`
- Modify: `src/routes/optimization/projection/+page.svelte`
- Modify: `src/routes/optimization/simulation/+page.svelte`

- [ ] **Step 1: Update stress-test page — remove nav button**

Replace the current `+page.svelte` with this (only change: remove the `<a>` nav button from page-top, update breadcrumb, keep all content):

```svelte
<!-- src/routes/optimization/stress-test/+page.svelte -->
<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import RiskProjectionCard from '$lib/components/simulation/RiskProjectionCard.svelte';
  import ScenarioSimulationCard from '$lib/components/simulation/ScenarioSimulationCard.svelte';
  import StressTestChart from '$lib/components/simulation/StressTestChart.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<PageHeader
  title="Stress Test"
  subtitle="See how your portfolio holds up under market crashes, rate shocks, and sector selloffs."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Stress Test' }]}
/>

<div class="widget-row">
  {#each data.stressTest.widgets as widget}
    <article class:high={widget.status === 'high'} class:medium={widget.status === 'medium'}>
      <span>{widget.label}</span><strong>{widget.value}</strong>
    </article>
  {/each}
</div>

<div class="layout">
  <main class="main-col">
    <StressTestChart stressTest={data.stressTest} />
    {#each data.stressTest.scenarios as result}<ScenarioSimulationCard {result} />{/each}
  </main>
  <aside class="side-col">
    {#if data.stressTest.worst_case}<RiskProjectionCard title="Worst Case Risk" summary={data.stressTest.worst_case.riskSummary} />{/if}
    <div class="guardrail">{data.stressTest.guardrail}</div>
  </aside>
</div>

<style>
  .widget-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 12px; }
  .widget-row article, .guardrail { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  .widget-row article.medium { border-color: rgba(var(--warning-rgb), 0.28); }
  .widget-row article.high { border-color: rgba(var(--danger-rgb), 0.28); }
  .widget-row span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  .widget-row strong { display: block; margin-top: 6px; color: var(--text); font-size: 1rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 22rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  .guardrail { color: var(--muted); font-size: 0.74rem; line-height: 1.5; }
  @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
</style>
```

- [ ] **Step 2: Update projection page — remove nav button**

```svelte
<!-- src/routes/optimization/projection/+page.svelte -->
<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import PortfolioProjectionChart from '$lib/components/simulation/PortfolioProjectionChart.svelte';
  import RebalanceProjectionCard from '$lib/components/simulation/RebalanceProjectionCard.svelte';
  import RiskProjectionCard from '$lib/components/simulation/RiskProjectionCard.svelte';
  import VolatilityProjectionChart from '$lib/components/simulation/VolatilityProjectionChart.svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  function money(value: number) {
    return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  }
</script>

<PageHeader
  title="Portfolio Projection"
  subtitle="Expected portfolio value in 1, 3, and 5 years based on current return rates."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Projection' }]}
/>

<div class="widget-row">
  <article><span>Portfolio Projection</span><strong>{money(data.projection.points.at(-1)?.expectedValue ?? data.projection.base_value)}</strong></article>
  <article><span>Volatility Forecast</span><strong>{data.projection.expected_volatility.toFixed(2)}%</strong></article>
  <article><span>Projected Income</span><strong>{money(data.projection.projected_income)}</strong></article>
  <article><span>Options Premium</span><strong>{money(data.projection.projected_options_premium)}</strong></article>
</div>

<div class="layout">
  <main class="main-col">
    <PortfolioProjectionChart projection={data.projection} />
    <VolatilityProjectionChart points={data.projection.points} />
  </main>
  <aside class="side-col">
    <RiskProjectionCard summary={data.projection.risk_summary} />
    <RebalanceProjectionCard projection={data.rebalanceProjection} />
    <div class="guardrail">{data.projection.guardrail}</div>
  </aside>
</div>

<style>
  .widget-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 10px; margin-bottom: 12px; }
  .widget-row article, .guardrail { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  .widget-row span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  .widget-row strong { display: block; margin-top: 6px; color: var(--text); font-size: 1rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 23rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  .guardrail { color: var(--muted); font-size: 0.74rem; line-height: 1.5; }
  @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
</style>
```

- [ ] **Step 3: Update simulation page — remove nav buttons**

```svelte
<!-- src/routes/optimization/simulation/+page.svelte -->
<script lang="ts">
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import PortfolioProjectionChart from '$lib/components/simulation/PortfolioProjectionChart.svelte';
  import RebalanceProjectionCard from '$lib/components/simulation/RebalanceProjectionCard.svelte';
  import RiskProjectionCard from '$lib/components/simulation/RiskProjectionCard.svelte';
  import ScenarioSelector from '$lib/components/simulation/ScenarioSelector.svelte';
  import ScenarioSimulationCard from '$lib/components/simulation/ScenarioSimulationCard.svelte';
  import StressTestChart from '$lib/components/simulation/StressTestChart.svelte';
  import type { ActionData, PageData } from './$types';

  export let data: PageData;
  export let form: ActionData;
</script>

<PageHeader
  title="Scenario Simulation"
  subtitle="Run what-if scenarios to see how allocation changes affect risk and return."
  breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Simulation' }]}
/>

{#if form?.message}<div class="notice">{form.message}</div>{/if}

<ScenarioSelector
  scenarioTypes={data.scenarioTypes}
  portfolioModes={data.portfolioModes}
  activeScenario={data.latestRun?.scenarioType ?? 'bear_market'}
  activeMode={data.portfolioMode}
/>

<div class="widget-row">
  {#each data.widgets as widget}
    <article class:high={widget.status === 'high'} class:medium={widget.status === 'medium'}>
      <span>{widget.label}</span>
      <strong>{widget.value}</strong>
    </article>
  {/each}
</div>

<div class="layout">
  <main class="main-col">
    <div class="ai-note">{data.aiExplanation}</div>
    {#each data.results as result}<ScenarioSimulationCard {result} />{/each}
    <StressTestChart stressTest={data.stressTest} />
  </main>
  <aside class="side-col">
    {#if data.stressTest.worst_case}<RiskProjectionCard summary={data.stressTest.worst_case.riskSummary} />{/if}
    <PortfolioProjectionChart projection={data.projection} />
    <RebalanceProjectionCard projection={data.rebalanceProjection} />
  </aside>
</div>

<style>
  .notice, .ai-note { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }
  .ai-note { border-color: rgba(var(--primary-rgb), 0.22); background: rgba(var(--primary-rgb), 0.06); color: var(--muted); }
  .widget-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin-bottom: 12px; }
  .widget-row article { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; }
  .widget-row article.medium { border-color: rgba(var(--warning-rgb), 0.28); }
  .widget-row article.high { border-color: rgba(var(--danger-rgb), 0.28); }
  .widget-row span { color: var(--muted); font-size: 0.65rem; font-weight: 800; text-transform: uppercase; }
  .widget-row strong { display: block; margin-top: 6px; color: var(--text); font-size: 1rem; }
  .layout { display: grid; grid-template-columns: minmax(0, 1fr) 24rem; gap: 12px; }
  .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
  @media (max-width: 1100px) { .layout { grid-template-columns: 1fr; } }
</style>
```

- [ ] **Step 4: Type-check**

```
npx svelte-check --output human 2>&1 | tail -5
```

Expected: `0 errors`.

- [ ] **Step 5: Verify in browser**

- http://localhost:5173/optimization/stress-test — no "Simulation" button in header, subtitle updated
- http://localhost:5173/optimization/projection — no "Simulation" button in header, subtitle updated
- http://localhost:5173/optimization/simulation — no "Stress Test / Projection / Rebalance" buttons in header
- All pages still show their content correctly

- [ ] **Step 6: Final type-check across all optimization files**

```
npx svelte-check --output human 2>&1 | grep -E "error|Error|0 error"
```

Expected: `0 errors, 0 warnings`.

- [ ] **Step 7: Commit**

```
git add src/routes/optimization/stress-test/+page.svelte
git add src/routes/optimization/projection/+page.svelte
git add src/routes/optimization/simulation/+page.svelte
git commit -m "feat: update stress-test, projection, simulation pages — clean headers, remove nav buttons"
```
