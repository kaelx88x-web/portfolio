# AI-Driven Optimization Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace manual portfolio mode / goal / risk dropdowns in the Optimization Engine with an AI-driven system — all parameters derived from behavioral profile. User picks Conservative / Moderate / Aggressive as a confirmation; AI blends that with behavioral data. Mode pills removed from sub-pages.

**Architecture:** `getRecommendedStrategy(userId, userRiskLevel?)` reads behavioral profile and derives the full strategy. If `userRiskLevel` differs from AI's recommendation, it clamps `cashFloorPct` to a safe range and blends scenario weights 60% behavioral + 40% base. A 5-minute in-memory cache prevents redundant DB reads. `AiStrategySelector` is a pure selection component — the parent owns the `<form>` and submit button. Stress-test and simulation pages derive `portfolioMode` from behavioral profile server-side; no mode picker shown to user.

**Tech Stack:** SvelteKit, TypeScript, Prisma (MySQL), Lucide Svelte, CSS variables (`var(--primary)`, `var(--border)`, `var(--card)`, `var(--text)`, `var(--muted)`, `var(--bg)`, `var(--primary-rgb)`)

---

## File Map

| Action | File |
|---|---|
| **Modify** | `src/lib/services/behavioral-profile.service.ts` |
| **Create** | `src/lib/components/optimization/AiStrategySelector.svelte` |
| **Modify** | `src/routes/optimization/+page.server.ts` |
| **Modify** | `src/routes/optimization/+page.svelte` |
| **Modify** | `src/routes/optimization/stress-test/+page.server.ts` |
| **Modify** | `src/routes/optimization/stress-test/+page.svelte` |
| **Modify** | `src/routes/optimization/simulation/+page.server.ts` |
| **Modify** | `src/routes/optimization/simulation/+page.svelte` |
| **Modify** | `src/lib/components/simulation/ScenarioSelector.svelte` |

---

## Task 1: Extend `behavioral-profile.service.ts` — `RecommendedStrategy` + caching + conflict handling

**Files:**
- Modify: `src/lib/services/behavioral-profile.service.ts`

**Context:** The file (~264 lines) already exports `BehavioralProfile`, `getBehavioralProfile()`, and `ScenarioWeights`. `ScenarioWeights` has: `aggressive`, `balanced`, `conservative` (percentages summing to 100), `cashFloorPct`, `goalDefault`, `rebalanceTrigger`. We append new types, constants, and functions at the end of the file. We do NOT change any existing code.

- [ ] **Step 1: Verify existing `ScenarioWeights` shape**

  Open `src/lib/services/behavioral-profile.service.ts` and confirm line 19–26 has:
  ```typescript
  export type ScenarioWeights = {
    aggressive: number;
    balanced: number;
    conservative: number;
    cashFloorPct: number;
    goalDefault: string;
    rebalanceTrigger: string;
  };
  ```
  If the field names differ, note them — the new code references these exact names.

- [ ] **Step 2: Append the full new block at the bottom of the file**

  After the closing `}` of `topEntry` (the last line of the file), append:

  ```typescript
  // ─── Recommended Strategy ────────────────────────────────────────────────────

  export type RiskLevel = 'conservative' | 'moderate' | 'aggressive';

  export type RecommendedStrategy = {
    riskLevel: RiskLevel;
    portfolioMode: 'stock' | 'hybrid' | 'options';
    riskProfile: 'conservative' | 'balanced' | 'aggressive';
    optimizationGoal: string;
    cashFloorPct: number;
    rebalanceTrigger: string;
    scenarioWeights: { aggressive: number; balanced: number; conservative: number };
    confidence: number;
    actualProfile: string;
    conflictDetected: boolean;
    aiRecommendedLevel: RiskLevel;
  };

  // ─── Risk clamps: cashFloorPct must stay within these bounds per risk level ──

  const RISK_CLAMPS = {
    conservative: { cashFloorMin: 8,  cashFloorMax: 20 },
    moderate:     { cashFloorMin: 4,  cashFloorMax: 12 },
    aggressive:   { cashFloorMin: 1,  cashFloorMax: 6  },
  } as const;

  // Base scenario weights (percentages) per risk level — used for blending
  const BASE_WEIGHTS: Record<RiskLevel, { conservative: number; balanced: number; aggressive: number }> = {
    conservative: { conservative: 70, balanced: 25, aggressive:  5 },
    moderate:     { conservative: 25, balanced: 50, aggressive: 25 },
    aggressive:   { conservative:  5, balanced: 30, aggressive: 65 },
  };

  // ─── Helpers ─────────────────────────────────────────────────────────────────

  function mapActualToRiskLevel(actualProfile: string): RiskLevel {
    if (actualProfile === 'aggressive')  return 'aggressive';
    if (actualProfile === 'conservative') return 'conservative';
    return 'moderate';
  }

  function blendScenarioWeights(
    behavioral: { aggressive: number; balanced: number; conservative: number },
    effectiveRisk: RiskLevel
  ): { aggressive: number; balanced: number; conservative: number } {
    const base = BASE_WEIGHTS[effectiveRisk];
    return {
      conservative: Math.round(behavioral.conservative * 0.6 + base.conservative * 0.4),
      balanced:     Math.round(behavioral.balanced     * 0.6 + base.balanced     * 0.4),
      aggressive:   Math.round(behavioral.aggressive   * 0.6 + base.aggressive   * 0.4),
    };
  }

  function validateStrategyConsistency(strategy: RecommendedStrategy): void {
    const clamp = RISK_CLAMPS[strategy.riskLevel];
    if (strategy.cashFloorPct < clamp.cashFloorMin) {
      throw new Error(
        `cashFloorPct ${strategy.cashFloorPct} is too low for ${strategy.riskLevel} (min ${clamp.cashFloorMin})`
      );
    }
    const dominantWeight = Math.max(
      strategy.scenarioWeights.conservative,
      strategy.scenarioWeights.balanced,
      strategy.scenarioWeights.aggressive
    );
    if (dominantWeight > 85) {
      console.warn('[behavioral] Scenario weights are heavily skewed — check behavioral data quality');
    }
  }

  function buildRecommendedStrategy(
    profile: BehavioralProfile,
    userRiskLevel?: RiskLevel
  ): RecommendedStrategy {
    const aiRiskLevel   = mapActualToRiskLevel(profile.actualProfile);
    const effectiveRisk = userRiskLevel ?? aiRiskLevel;
    const clamp         = RISK_CLAMPS[effectiveRisk];

    const rawCashFloor    = profile.weights.cashFloorPct;
    const clampedCashFloor = Math.min(Math.max(rawCashFloor, clamp.cashFloorMin), clamp.cashFloorMax);

    const optimizationGoal =
      effectiveRisk === 'aggressive'  ? 'maximum_return' :
      effectiveRisk === 'conservative' ? 'minimum_volatility' :
      (profile.weights.goalDefault ?? 'maximum_sharpe');

    const behavioralWeights = {
      aggressive:   profile.weights.aggressive,
      balanced:     profile.weights.balanced,
      conservative: profile.weights.conservative,
    };

    const strategy: RecommendedStrategy = {
      riskLevel:       effectiveRisk,
      portfolioMode:   effectiveRisk === 'aggressive' ? 'options' : effectiveRisk === 'conservative' ? 'stock' : 'hybrid',
      riskProfile:     effectiveRisk === 'aggressive' ? 'aggressive' : effectiveRisk === 'conservative' ? 'conservative' : 'balanced',
      optimizationGoal,
      cashFloorPct:    clampedCashFloor,
      rebalanceTrigger: profile.weights.rebalanceTrigger,
      scenarioWeights: blendScenarioWeights(behavioralWeights, effectiveRisk),
      confidence:      profile.confidencePct,
      actualProfile:   profile.actualProfile,
      conflictDetected: !!userRiskLevel && userRiskLevel !== aiRiskLevel,
      aiRecommendedLevel: aiRiskLevel,
    };

    validateStrategyConsistency(strategy);
    return strategy;
  }

  // ─── Default (no behavioral data yet) ────────────────────────────────────────

  const DEFAULT_STRATEGY: RecommendedStrategy = {
    riskLevel:        'moderate',
    portfolioMode:    'hybrid',
    riskProfile:      'balanced',
    optimizationGoal: 'maximum_sharpe',
    cashFloorPct:     5,
    rebalanceTrigger: 'Threshold rebalance',
    scenarioWeights:  { aggressive: 25, balanced: 50, conservative: 25 },
    confidence:       0,
    actualProfile:    'balanced',
    conflictDetected: false,
    aiRecommendedLevel: 'moderate',
  };

  // ─── In-memory cache (5-min TTL) ──────────────────────────────────────────────

  const _strategyCache = new Map<string, { data: RecommendedStrategy; ts: number }>();
  const STRATEGY_CACHE_TTL = 5 * 60 * 1000;

  export async function getRecommendedStrategy(
    userId: string,
    userRiskLevel?: RiskLevel
  ): Promise<RecommendedStrategy> {
    const cacheKey = `${userId}:${userRiskLevel ?? 'ai'}`;
    const cached   = _strategyCache.get(cacheKey);
    if (cached && Date.now() - cached.ts < STRATEGY_CACHE_TTL) return cached.data;

    const profile = await getBehavioralProfile(userId);
    const result  = profile.dataPoints === 0
      ? DEFAULT_STRATEGY
      : buildRecommendedStrategy(profile, userRiskLevel);

    _strategyCache.set(cacheKey, { data: result, ts: Date.now() });
    return result;
  }
  ```

- [ ] **Step 3: Type-check**

  Run: `npx tsc --noEmit 2>&1 | head -40`

  Expected: no errors. Common issues:
  - If `profile.weights.goalDefault` is typed as `string` (not `string | undefined`), remove the `?? 'maximum_sharpe'` fallback.
  - If `BehavioralProfile` is in the same file, no imports needed.

- [ ] **Step 4: Commit**

  ```bash
  git add src/lib/services/behavioral-profile.service.ts
  git commit -m "feat: add RecommendedStrategy, getRecommendedStrategy() with clamping, blending, and 5-min cache"
  ```

---

## Task 2: Create `AiStrategySelector.svelte` — pure selection component, no form

**Files:**
- Create: `src/lib/components/optimization/AiStrategySelector.svelte`

**Context:** This component renders 3 clickable cards. It does NOT contain a `<form>` or submit button — the parent owns those. It exports `recommended` (AI pick) and `selected` (current pick, two-way bindable). Emits `on:change` with the new `RiskLevel` when user clicks. Accessible via `role="radiogroup"`.

- [ ] **Step 1: Create the file**

  ```svelte
  <script lang="ts">
    import { createEventDispatcher } from 'svelte';
    import { Sparkles } from 'lucide-svelte';
    import type { RiskLevel } from '$lib/services/behavioral-profile.service';

    export let recommended: RiskLevel = 'moderate';
    export let selected: RiskLevel    = recommended;
    export let confidence: number     = 0;

    const dispatch = createEventDispatcher<{ change: RiskLevel }>();

    type Card = { level: RiskLevel; icon: string; label: string; mode: string; desc: string };

    const cards: Card[] = [
      { level: 'conservative', icon: '🛡️', label: 'Conservative', mode: 'Stock only',      desc: 'Minimize volatility. Capital preservation priority.' },
      { level: 'moderate',     icon: '⚖️', label: 'Moderate',     mode: 'Hybrid strategy', desc: 'Balance growth and stability. AI-tuned allocation.'  },
      { level: 'aggressive',   icon: '🚀', label: 'Aggressive',   mode: 'Options enabled', desc: 'Maximum return focus. Higher risk accepted.'         },
    ];

    function select(level: RiskLevel) {
      selected = level;
      dispatch('change', level);
    }
  </script>

  <div class="strategy-cards" role="radiogroup" aria-label="Risk level selection">
    {#each cards as card}
      <button
        type="button"
        role="radio"
        aria-checked={selected === card.level}
        class="card"
        class:active={selected === card.level}
        class:is-ai={card.level === recommended}
        on:click={() => select(card.level)}
      >
        {#if card.level === recommended}
          <div class="ai-badge">
            <Sparkles size={9} />
            AI Pick{confidence > 0 ? ` · ${confidence}%` : ''}
          </div>
        {/if}
        <div class="icon">{card.icon}</div>
        <strong class="name">{card.label}</strong>
        <span class="mode-tag">{card.mode}</span>
        <span class="desc">{card.desc}</span>
      </button>
    {/each}
  </div>

  <style>
    .strategy-cards {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }

    .card {
      position: relative;
      display: flex;
      flex-direction: column;
      gap: 5px;
      border: 1.5px solid var(--border);
      border-radius: 10px;
      padding: 18px 14px 12px;
      cursor: pointer;
      background: var(--bg);
      text-align: left;
      transition: border-color 0.12s, background 0.12s;
    }
    .card:hover        { border-color: rgba(var(--primary-rgb), 0.5); }
    .card.is-ai:not(.active) { border-color: rgba(var(--primary-rgb), 0.3); }
    .card.active {
      border-color: var(--primary);
      background: rgba(var(--primary-rgb), 0.06);
    }

    .ai-badge {
      position: absolute;
      top: -10px;
      left: 50%;
      transform: translateX(-50%);
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: var(--primary);
      color: #fff;
      font-size: 0.6rem;
      font-weight: 800;
      padding: 2px 9px;
      border-radius: 999px;
      white-space: nowrap;
    }

    .icon     { font-size: 1.5rem; margin-bottom: 2px; }
    .name     { font-size: 0.88rem; font-weight: 800; color: var(--text); }
    .card.active .name { color: var(--primary); }

    .mode-tag {
      align-self: flex-start;
      font-size: 0.62rem;
      font-weight: 700;
      color: var(--muted);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 2px 7px;
      margin-bottom: 2px;
    }
    .card.active .mode-tag {
      border-color: rgba(var(--primary-rgb), 0.3);
      color: var(--primary);
    }

    .desc { font-size: 0.67rem; color: var(--muted); line-height: 1.45; }

    @media (max-width: 900px) { .strategy-cards { grid-template-columns: 1fr; } }
  </style>
  ```

- [ ] **Step 2: Type-check**

  Run: `npx tsc --noEmit 2>&1 | head -20`

  Expected: no errors.

- [ ] **Step 3: Commit**

  ```bash
  git add src/lib/components/optimization/AiStrategySelector.svelte
  git commit -m "feat: add AiStrategySelector — pure selection component, parent owns form"
  ```

---

## Task 3: Update hub `+page.server.ts`

**Files:**
- Modify: `src/routes/optimization/+page.server.ts`

**Context:** Remove `getUserPortfolioMode`, `saveUserPortfolioMode`, `saveMode` action, and all three manual selector imports (`parsePortfolioMode`, `parseOptimizationGoal`, `parseRiskProfile`). Load now calls `getRecommendedStrategy(userId)` without a user risk level — this gives the AI-only recommendation for pre-selecting the card. The `run` action calls `getRecommendedStrategy(userId, riskLevel)` WITH the user's chosen risk level to get blended/clamped params.

- [ ] **Step 1: Replace the entire file**

  ```typescript
  import { fail, type Actions } from '@sveltejs/kit';
  import { getDemoUser } from '$lib/server/demo-user';
  import {
    getOptimizationDashboard,
    parseOptimizationBenchmark,
    parseOptimizationPeriod,
    runOptimization,
    saveOptimizationConstraints,
    type OptimizationConstraintSet,
    type OptimizationGoal,
    type RiskProfile,
  } from '$lib/services/optimization-engine.service';
  import {
    getStressTest,
    getPortfolioProjection,
    getRebalanceProjection,
    saveStressTestCache,
    savePortfolioProjectionCache,
  } from '$lib/services/scenario-simulation.service';
  import { validatePortfolioGuardrails } from '$lib/services/guardrail.service';
  import {
    getRecommendedStrategy,
    type RiskLevel,
  } from '$lib/services/behavioral-profile.service';
  import type { PageServerLoad } from './$types';

  // ─── Helpers ──────────────────────────────────────────────────────────────────

  function parseRiskLevel(value: FormDataEntryValue | string | null): RiskLevel {
    const valid: RiskLevel[] = ['conservative', 'moderate', 'aggressive'];
    return valid.includes(value as RiskLevel) ? (value as RiskLevel) : 'moderate';
  }

  // ─── Load ─────────────────────────────────────────────────────────────────────

  export const load: PageServerLoad = async ({ url }) => {
    const user      = await getDemoUser();
    const period    = parseOptimizationPeriod(url.searchParams.get('period'));
    const benchmark = parseOptimizationBenchmark(url.searchParams.get('benchmark'));

    const [dashboard, recommendedStrategy] = await Promise.all([
      getOptimizationDashboard(user.id, { period, benchmark }),
      getRecommendedStrategy(user.id).catch(() => null),
    ]);

    const portfolioMode = recommendedStrategy?.portfolioMode ?? 'hybrid';
    const guardrail = await validatePortfolioGuardrails(user.id, portfolioMode).catch(() => null);

    const activeScenarioName = url.searchParams.get('scenario') ?? dashboard.scenarios[0]?.scenarioName ?? '';
    return {
      ...dashboard,
      recommendedStrategy,
      guardrail,
      activeScenarioName,
      activeScenario: dashboard.scenarios.find((s) => s.scenarioName === activeScenarioName) ?? dashboard.scenarios[0] ?? null,
    };
  };

  // ─── Actions ──────────────────────────────────────────────────────────────────

  export const actions: Actions = {
    run: async ({ request, url }) => {
      const user      = await getDemoUser();
      const form      = await request.formData();
      const riskLevel = parseRiskLevel(form.get('riskLevel'));
      try {
        // Get AI-blended strategy for this user's chosen risk level
        const strategy  = await getRecommendedStrategy(user.id, riskLevel);
        const guardrail = await validatePortfolioGuardrails(user.id, strategy.portfolioMode);
        const period    = parseOptimizationPeriod(url.searchParams.get('period'));
        const benchmark = parseOptimizationBenchmark(url.searchParams.get('benchmark'));

        await runOptimization(user.id, {
          portfolioMode:    strategy.portfolioMode,
          optimizationGoal: strategy.optimizationGoal as OptimizationGoal,
          riskProfile:      strategy.riskProfile      as RiskProfile,
          period,
          benchmark,
        });

        // Pre-compute heavy sub-page data
        const [stressTest, projection] = await Promise.all([
          getStressTest(user.id, { period, benchmark, portfolioMode: strategy.portfolioMode, skipCache: true }),
          getPortfolioProjection(user.id, { period, benchmark, portfolioMode: strategy.portfolioMode, skipCache: true }),
          getRebalanceProjection(user.id, { period, benchmark, portfolioMode: strategy.portfolioMode, persist: true }),
        ]);
        await Promise.all([
          saveStressTestCache(user.id, strategy.portfolioMode, stressTest),
          savePortfolioProjectionCache(user.id, strategy.portfolioMode, projection),
        ]);

        return { status: 'completed', message: 'Optimization run completed.', guardrail };
      } catch (error) {
        return fail(400, { message: error instanceof Error ? error.message : 'Optimization run failed.' });
      }
    },

    saveConstraints: async ({ request }) => {
      const user = await getDemoUser();
      const form = await request.formData();
      const constraints: Partial<OptimizationConstraintSet> = {
        singleStockMaxPct:    numberField(form, 'singleStockMaxPct'),
        optionsMaxPct:        numberField(form, 'optionsMaxPct'),
        hybridStockPct:       numberField(form, 'hybridStockPct'),
        cashMinPct:           numberField(form, 'cashMinPct'),
        sectorMaxPct:         numberField(form, 'sectorMaxPct'),
        collateralReservePct: numberField(form, 'collateralReservePct'),
        targetVolatilityPct:  numberField(form, 'targetVolatilityPct'),
      };
      await saveOptimizationConstraints(user.id, constraints);
      return { status: 'saved', message: 'Optimization constraints saved.' };
    },
  };

  function numberField(form: FormData, key: keyof OptimizationConstraintSet) {
    return Number(form.get(key) ?? 0);
  }
  ```

- [ ] **Step 2: Type-check**

  Run: `npx tsc --noEmit 2>&1 | head -40`

  Expected: no errors. If `'maximum_return'` is not a valid `OptimizationGoal`, open `src/lib/services/optimization-engine.service.ts` and check `OPTIMIZATION_GOALS`. If it's missing, replace `'maximum_return'` with `'maximum_sharpe'` in `buildRecommendedStrategy` in Task 1.

- [ ] **Step 3: Commit**

  ```bash
  git add src/routes/optimization/+page.server.ts
  git commit -m "feat: hub server — AI-blended strategy load, riskLevel-based run action"
  ```

---

## Task 4: Update hub `+page.svelte` — parent owns form, skeleton loading, conflict warning

**Files:**
- Modify: `src/routes/optimization/+page.svelte`

**Context:** Replace the `OptimizationModeSelector` component with `AiStrategySelector`. The parent (`+page.svelte`) now owns the `<form method="POST" action="?/run">` and submit button. Add skeleton loading state when `data.recommendedStrategy` is null. Show a conflict warning when user picks a different level from AI recommendation. Hub cards: Behavioral Profile full-width first.

- [ ] **Step 1: Replace the `<script lang="ts">` block**

  Replace lines 1–77 (the entire `<script>` block) with:

  ```svelte
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

    let running  = false;
    let progress = 0;
    let progressInterval: ReturnType<typeof setInterval> | null = null;

    const steps = [
      { pct: 15, label: 'Loading portfolio context…'       },
      { pct: 30, label: 'Building optimization scenarios…' },
      { pct: 50, label: 'Computing rebalance suggestions…' },
      { pct: 65, label: 'Running stress test…'             },
      { pct: 78, label: 'Calculating portfolio projection…'},
      { pct: 88, label: 'Caching results…'                 },
      { pct: 94, label: 'Finalising…'                      },
    ];
    let stepLabel = steps[0].label;

    function handleRunSubmit() {
      running = true; progress = 0; stepLabel = steps[0].label;
      let stepIndex = 0;
      progressInterval = setInterval(() => {
        const next = steps[stepIndex];
        if (!next) return;
        progress = next.pct; stepLabel = next.label; stepIndex++;
        if (stepIndex >= steps.length && progressInterval) { clearInterval(progressInterval); progressInterval = null; }
      }, 900);
    }

    $: if (form) {
      progress = 100; stepLabel = 'Done!';
      if (progressInterval) { clearInterval(progressInterval); progressInterval = null; }
      setTimeout(() => { running = false; progress = 0; }, 600);
    }

    // AI strategy state
    $: recommended = (data.recommendedStrategy?.riskLevel ?? 'moderate') as RiskLevel;
    $: confidence  = data.recommendedStrategy?.confidence ?? 0;
    let selectedRisk: RiskLevel = 'moderate';
    $: selectedRisk = recommended;   // sync when data loads

    $: showConflict = data.recommendedStrategy?.conflictDetected === true
      || (selectedRisk !== recommended);

    $: aiRecommendedLevel = data.recommendedStrategy?.aiRecommendedLevel ?? recommended;

    // Stats strip
    $: s = data.activeScenario;
    function guardrailStatusFor(g: typeof data.guardrail) {
      if (!g || g.violations.length === 0) return { value: 'All Clear', color: 'green' as const, sub: 'No issues detected' };
      const breaches = g.violations.filter((v) => v.severity === 'breach');
      if (breaches.length > 0) return { value: `${breaches.length} Breach${breaches.length > 1 ? 'es' : ''}`, color: 'red' as const, sub: 'Review required' };
      return { value: `${g.violations.length} Warning${g.violations.length > 1 ? 's' : ''}`, color: 'amber' as const, sub: 'Minor issues' };
    }
    $: guardrailStatus = guardrailStatusFor(data.guardrail);
    $: stats = s ? [
      { label: 'Expected Return',      value: `${s.expectedReturn > 0 ? '+' : ''}${s.expectedReturn.toFixed(1)}%`, color: s.expectedReturn > 0 ? 'green' as const : 'red' as const, sub: 'Balanced scenario' },
      { label: 'Price Swings',         value: `${s.expectedVolatility.toFixed(1)}%`, sub: 'Volatility' },
      { label: 'Risk-Adjusted Return', value: s.sharpeRatio.toFixed(2), sub: s.sharpeRatio >= 0.5 ? '≥0.5 — good' : '<0.5 — watch this' },
      { label: 'Risk Controls',        value: guardrailStatus.value, color: guardrailStatus.color, sub: guardrailStatus.sub },
    ] : [];

    $: scenarioBadge      = `${data.scenarios.length} scenario${data.scenarios.length !== 1 ? 's' : ''}`;
    $: rebalanceBadge     = data.rebalance.length > 0 ? `${data.rebalance.length} suggestion${data.rebalance.length !== 1 ? 's' : ''}` : 'Up to date';
    $: rebalanceBadgeColor = data.rebalance.length > 0 ? ('amber' as const) : ('green' as const);
    $: historyBadge       = `${data.history.length} run${data.history.length !== 1 ? 's' : ''}`;

    const riskLabels: Record<RiskLevel, string> = { conservative: 'Conservative', moderate: 'Moderate', aggressive: 'Aggressive' };
  </script>
  ```

- [ ] **Step 2: Replace the template body**

  Replace everything from `<PageHeader` to (but not including) `<style>`) with:

  ```svelte
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
        <div class="run-bar-wrap"><div class="run-bar-fill" style="width: {progress}%"></div></div>
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
    <OptimizationHubCard icon="📊" name="Portfolio Scenarios"  description="Compare three allocation plans — safe, moderate, and aggressive — and see the expected return and risk for each." badge={scenarioBadge}      badgeColor="blue"              href="/optimization/scenarios"   />
    <OptimizationHubCard icon="⚖️" name="Rebalance Suggestions" description="What to buy or sell to bring your portfolio closer to the target allocation."                                  badge={rebalanceBadge}     badgeColor={rebalanceBadgeColor} href="/optimization/rebalance"   />
    <OptimizationHubCard icon="📈" name="Allocation Check"      description="Review overweight and underweight positions by stock, sector, and asset type."                                   badge="View details"       badgeColor="blue"              href="/optimization/allocation"  />
    <OptimizationHubCard icon="🌪️" name="Stress Test"           description="See how your portfolio holds up in a market crash, rate shock, or sector selloff."                              badge="Run simulation"     badgeColor="blue"              href="/optimization/stress-test" />
    <OptimizationHubCard icon="🔮" name="Portfolio Projection"  description="Expected portfolio value in 1, 3, and 5 years based on current return rates."                                   badge="View projection"    badgeColor="blue"              href="/optimization/projection"  />
    <OptimizationHubCard icon="🧪" name="Scenario Simulation"   description="Run what-if scenarios — bear markets, rate shocks, sector rotations — and see how your allocation holds up."   badge="Run simulation"     badgeColor="blue"              href="/optimization/simulation"  />
    <OptimizationHubCard icon="🎯" name="Options Strategy"      description="Covered call and cash-secured put candidates ranked by premium yield."                                          badge="View candidates"    badgeColor="blue"              href="/optimization/options"     />
    <OptimizationHubCard icon="📋" name="Run History"           description="Previous optimization runs and how your allocation targets have evolved over time."                              badge={historyBadge}       badgeColor="blue"              href="/optimization/history"     />
  </div>

  <details class="constraints-section">
    <summary>Advanced Constraints</summary>
    <PortfolioConstraintEditor constraints={data.constraints} />
  </details>
  ```

- [ ] **Step 3: Replace the `<style>` block**

  Replace the entire `<style>` block with:

  ```svelte
  <style>
    /* ── Run overlay ──────────────────────────────────────────────────── */
    .run-overlay { position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.6); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; }
    .run-overlay-box { display: flex; flex-direction: column; align-items: center; gap: 14px; background: var(--card); border: 1px solid var(--border); border-radius: 16px; padding: 36px 48px; box-shadow: 0 24px 64px rgba(0,0,0,0.5); }
    .run-spinner { width: 36px; height: 36px; border-radius: 50%; border: 3px solid rgba(var(--primary-rgb), 0.2); border-top-color: var(--primary); animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .run-title { font-size: 1rem; font-weight: 700; color: var(--text); }
    .run-step  { font-size: 0.72rem; color: var(--muted); min-height: 1.2em; }
    .run-bar-wrap { width: 240px; height: 6px; background: rgba(var(--primary-rgb), 0.15); border-radius: 999px; overflow: hidden; }
    .run-bar-fill { height: 100%; background: var(--primary); border-radius: 999px; transition: width 0.7s ease; }
    .run-pct { font-size: 0.72rem; font-weight: 700; color: var(--primary); }

    /* ── Notice ───────────────────────────────────────────────────────── */
    .notice { margin-bottom: 12px; border: 1px solid rgba(var(--success-rgb), 0.3); border-radius: 8px; background: rgba(var(--success-rgb), 0.08); color: var(--success); padding: 10px 12px; font-size: 0.78rem; }

    /* ── Run form wrapper ─────────────────────────────────────────────── */
    .run-form { border: 1px solid var(--border); border-radius: 10px; background: var(--card); padding: 16px; display: grid; gap: 12px; margin-bottom: 16px; }

    /* ── Skeleton ─────────────────────────────────────────────────────── */
    .skeleton-wrap { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .skeleton-card { height: 120px; border-radius: 10px; background: var(--border); animation: pulse 1.4s ease-in-out infinite; }
    @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }

    /* ── Conflict notice ──────────────────────────────────────────────── */
    .conflict-notice { display: flex; align-items: center; gap: 8px; padding: 9px 13px; border-radius: 7px; border: 1px solid rgba(var(--warning-rgb), 0.35); background: rgba(var(--warning-rgb), 0.07); color: var(--warning); font-size: 0.73rem; }
    .conflict-notice strong { font-weight: 800; }

    /* ── Run button row ───────────────────────────────────────────────── */
    .run-row { display: flex; justify-content: flex-end; }
    .run-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 24px; border-radius: 8px; background: var(--primary); color: #fff; font-size: 0.8rem; font-weight: 700; border: none; cursor: pointer; transition: opacity 0.12s; }
    .run-btn:hover:not(:disabled) { opacity: 0.88; }
    .run-btn:disabled { opacity: 0.55; cursor: not-allowed; }

    /* ── Hub grid ─────────────────────────────────────────────────────── */
    .hub-label { font-size: 0.62rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; margin-bottom: 10px; }
    .hub-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .behavioral-card { grid-column: span 3; }

    /* ── Constraints ──────────────────────────────────────────────────── */
    .constraints-section { margin-top: 16px; }
    .constraints-section summary { font-size: 0.68rem; font-weight: 800; text-transform: uppercase; color: var(--muted); letter-spacing: 0.05em; cursor: pointer; user-select: none; padding: 4px 0; }
    .constraints-section summary:hover { color: var(--text); }
    .constraints-section > :global(.editor) { margin-top: 10px; }

    /* ── Responsive ───────────────────────────────────────────────────── */
    @media (max-width: 900px) {
      .hub-grid { grid-template-columns: 1fr 1fr; }
      .behavioral-card { grid-column: span 2; }
      .skeleton-wrap { grid-template-columns: 1fr; }
      .run-row { justify-content: stretch; }
      .run-btn { width: 100%; justify-content: center; }
    }
    @media (max-width: 600px) {
      .hub-grid { grid-template-columns: 1fr; }
      .behavioral-card { grid-column: span 1; }
    }
  </style>
  ```

- [ ] **Step 4: Type-check**

  Run: `npx tsc --noEmit 2>&1 | head -40`

  Expected: no errors. If you see `Property 'savedMode' does not exist`, search the file for `savedMode` and remove any remaining references.

- [ ] **Step 5: Commit**

  ```bash
  git add src/routes/optimization/+page.svelte
  git commit -m "feat: hub page — AiStrategySelector with parent-owned form, skeleton loading, conflict warning, behavioral card first"
  ```

---

## Task 5: Update stress-test server and page — remove mode pills

**Files:**
- Modify: `src/routes/optimization/stress-test/+page.server.ts`
- Modify: `src/routes/optimization/stress-test/+page.svelte`

**Context:** Server currently reads `portfolioMode` from URL query param and returns `portfolioModes: PORTFOLIO_MODES`. Replace with behavioral-derived mode. Svelte page has a `.controls` section with mode pills — remove entirely. Show scenario count as a simple text line instead.

- [ ] **Step 1: Replace `stress-test/+page.server.ts`**

  ```typescript
  import { getDemoUser } from '$lib/server/demo-user';
  import {
    getStressTest,
    parseSimulationBenchmark,
    parseSimulationPeriod,
  } from '$lib/services/scenario-simulation.service';
  import { getRecommendedStrategy } from '$lib/services/behavioral-profile.service';
  import type { PageServerLoad } from './$types';

  export const load: PageServerLoad = async ({ url }) => {
    const user      = await getDemoUser();
    const period    = parseSimulationPeriod(url.searchParams.get('period'));
    const benchmark = parseSimulationBenchmark(url.searchParams.get('benchmark'));

    const strategy      = await getRecommendedStrategy(user.id).catch(() => null);
    const portfolioMode = strategy?.portfolioMode ?? 'hybrid';

    return {
      period,
      benchmark,
      portfolioMode,
      stressTest: await getStressTest(user.id, { period, benchmark, portfolioMode }),
    };
  };
  ```

- [ ] **Step 2: Replace `<script>` block in `stress-test/+page.svelte`**

  Replace lines 1–19 (current script block) with:

  ```svelte
  <script lang="ts">
    import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
    import OptimizationStatStrip from '$lib/components/optimization/OptimizationStatStrip.svelte';
    import RiskProjectionCard from '$lib/components/simulation/RiskProjectionCard.svelte';
    import ScenarioSimulationCard from '$lib/components/simulation/ScenarioSimulationCard.svelte';
    import StressTestChart from '$lib/components/simulation/StressTestChart.svelte';
    import type { PageData } from './$types';

    export let data: PageData;

    $: worst = data.stressTest.worst_case;
    $: stats = [
      { label: 'Stress Result',   value: worst?.riskSummary.risk_level.toUpperCase() ?? 'N/A',   color: worst?.riskSummary.risk_level === 'high' ? 'red' as const : worst?.riskSummary.risk_level === 'medium' ? 'amber' as const : 'green' as const, sub: 'Worst scenario' },
      { label: 'Worst Drawdown',  value: worst ? `${worst.projectedDrawdown.toFixed(1)}%` : '—', color: 'red' as const, sub: worst?.scenarioName ?? '' },
      { label: 'Peak Volatility', value: `${Math.max(...data.stressTest.scenarios.map((s) => s.projectedVolatility), 0).toFixed(1)}%`, sub: 'Across all scenarios' },
      { label: 'Risk Score',      value: worst ? `${worst.riskSummary.scenario_risk_score}/100` : '—', color: worst?.riskSummary.risk_level === 'high' ? 'red' as const : 'amber' as const, sub: 'Worst case score' },
    ];
  </script>
  ```

- [ ] **Step 3: Replace template body in `stress-test/+page.svelte`**

  Replace everything from `<PageHeader` to (but not including) `<style>`) with:

  ```svelte
  <PageHeader
    title="Stress Test"
    subtitle="See how your portfolio holds up under market crashes, rate shocks, and sector selloffs."
    breadcrumb={[{ label: 'Optimization', href: '/optimization' }, { label: 'Stress Test' }]}
  />

  <OptimizationStatStrip {stats} />

  <p class="scenario-count">{data.stressTest.scenarios.length} scenarios analysed</p>

  <div class="layout">
    <main class="main-col">
      <StressTestChart stressTest={data.stressTest} />
      {#each data.stressTest.scenarios as result}<ScenarioSimulationCard {result} />{/each}

      <div class="next-step">
        <div class="next-text">
          <strong>Run a full Monte Carlo simulation</strong>
          <span>See thousands of possible outcomes based on your current portfolio composition and risk profile.</span>
        </div>
        <a class="button" href="/optimization/simulation">View Simulation →</a>
      </div>
    </main>
    <aside class="side-col">
      {#if worst}<RiskProjectionCard title="Worst Case Risk" summary={worst.riskSummary} />{/if}
      <div class="guardrail">{data.stressTest.guardrail}</div>
    </aside>
  </div>
  ```

- [ ] **Step 4: Replace `<style>` block in `stress-test/+page.svelte`**

  ```svelte
  <style>
    .scenario-count { font-size: 0.68rem; font-weight: 700; color: var(--muted); margin-bottom: 12px; }
    .layout { display: grid; grid-template-columns: minmax(0, 1fr) 22rem; gap: 12px; }
    .main-col, .side-col { display: grid; align-content: start; gap: 12px; }
    .guardrail { border: 1px solid var(--border); border-radius: 8px; background: var(--card); padding: 14px; color: var(--muted); font-size: 0.72rem; line-height: 1.5; }
    .next-step { display: flex; align-items: center; justify-content: space-between; gap: 16px; border: 1px solid rgba(var(--primary-rgb), 0.22); border-radius: 8px; background: rgba(var(--primary-rgb), 0.05); padding: 14px 16px; }
    .next-text { display: grid; gap: 3px; }
    .next-text strong { font-size: 0.82rem; color: var(--text); }
    .next-text span   { font-size: 0.72rem; color: var(--muted); }
    @media (max-width: 1000px) { .layout { grid-template-columns: 1fr; } }
    @media (max-width: 600px)  { .next-step { flex-direction: column; align-items: flex-start; } }
  </style>
  ```

- [ ] **Step 5: Type-check**

  Run: `npx tsc --noEmit 2>&1 | head -20`

  Expected: no errors. `portfolioModes` should no longer appear in the stress-test files.

- [ ] **Step 6: Commit**

  ```bash
  git add src/routes/optimization/stress-test/+page.server.ts src/routes/optimization/stress-test/+page.svelte
  git commit -m "feat: stress test — remove mode pills, use AI-derived portfolioMode from behavioral profile"
  ```

---

## Task 6: Update simulation — remove Mode dropdown from ScenarioSelector, clean up page

**Files:**
- Modify: `src/lib/components/simulation/ScenarioSelector.svelte`
- Modify: `src/routes/optimization/simulation/+page.server.ts`
- Modify: `src/routes/optimization/simulation/+page.svelte`

**Context:** `ScenarioSelector` has a Scenario Type dropdown AND a Portfolio Mode dropdown. We keep the Scenario Type picker but conditionally hide the Mode dropdown when `portfolioModes` is empty (passing `portfolioModes={[]}` from the page). The hidden `name="portfolioMode"` input stays so the form still submits the AI-derived mode. The simulation server derives `portfolioMode` from behavioral profile. The conditional next-step CTA becomes a static link to History.

- [ ] **Step 1: Update `ScenarioSelector.svelte` — wrap Mode field in conditional**

  Find the Mode `<div class="field">` block (the second field div, starting with `<div class="field">` and containing `<span>Mode</span>`). Wrap it in `{#if portfolioModes.length > 0}...{/if}`. The hidden inputs remain outside this conditional. The result should look like:

  ```svelte
  <form method="POST" action="?/run" class="selector" use:clickOutside>
    <input type="hidden" name="scenarioType" value={selectedScenario} />
    <input type="hidden" name="portfolioMode" value={selectedMode} />

    <div class="field">
      <span>Scenario</span>
      <div class="drop" class:open={scenarioOpen}>
        <button type="button" class="drop-trigger" on:click={() => { scenarioOpen = !scenarioOpen; modeOpen = false; }}>
          <span>{label(selectedScenario)}</span>
          <ChevronDown size={14} />
        </button>
        {#if scenarioOpen}
          <div class="drop-menu">
            {#each scenarioTypes as scenario}
              <button type="button" class="drop-item" class:active={scenario === selectedScenario} on:click={() => selectScenario(scenario)}>
                {label(scenario)}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    {#if portfolioModes.length > 0}
      <div class="field">
        <span>Mode</span>
        <div class="drop" class:open={modeOpen}>
          <button type="button" class="drop-trigger" on:click={() => { modeOpen = !modeOpen; scenarioOpen = false; }}>
            <span>{label(selectedMode)}</span>
            <ChevronDown size={14} />
          </button>
          {#if modeOpen}
            <div class="drop-menu">
              {#each portfolioModes as mode}
                <button type="button" class="drop-item" class:active={mode === selectedMode} on:click={() => selectMode(mode)}>
                  {label(mode)}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}

    <button class="button run-btn" type="submit"><Play size={14} /> Run Simulation</button>
  </form>
  ```

- [ ] **Step 2: Replace `simulation/+page.server.ts`**

  ```typescript
  import { fail, type Actions } from '@sveltejs/kit';
  import { getDemoUser } from '$lib/server/demo-user';
  import {
    getScenarioSimulationDashboard,
    parseScenarioType,
    parseSimulationBenchmark,
    parseSimulationPeriod,
    parseSimulationPortfolioMode,
    runScenarioSimulation,
  } from '$lib/services/scenario-simulation.service';
  import { getRecommendedStrategy } from '$lib/services/behavioral-profile.service';
  import type { PageServerLoad } from './$types';

  export const load: PageServerLoad = async ({ url }) => {
    const user      = await getDemoUser();
    const period    = parseSimulationPeriod(url.searchParams.get('period'));
    const benchmark = parseSimulationBenchmark(url.searchParams.get('benchmark'));

    const strategy      = await getRecommendedStrategy(user.id).catch(() => null);
    const portfolioMode = strategy?.portfolioMode ?? 'hybrid';

    return getScenarioSimulationDashboard(user.id, { period, benchmark, portfolioMode });
  };

  export const actions: Actions = {
    run: async ({ request, url }) => {
      const user = await getDemoUser();
      const form = await request.formData();
      try {
        // portfolioMode from form is AI-derived (set via hidden input + activeMode prop)
        const portfolioMode = parseSimulationPortfolioMode(form.get('portfolioMode'));
        await runScenarioSimulation(user.id, {
          scenarioType: parseScenarioType(form.get('scenarioType')),
          portfolioMode,
          period:    parseSimulationPeriod(url.searchParams.get('period')),
          benchmark: parseSimulationBenchmark(url.searchParams.get('benchmark')),
        });
        return { status: 'completed', message: 'Scenario simulation completed.' };
      } catch (error) {
        return fail(400, { message: error instanceof Error ? error.message : 'Scenario simulation failed.' });
      }
    },
  };
  ```

- [ ] **Step 3: Update `simulation/+page.svelte` — two targeted changes**

  **Change A:** Find the `<ScenarioSelector>` usage and update `portfolioModes` to an empty array:

  ```svelte
  <ScenarioSelector
    scenarioTypes={data.scenarioTypes}
    portfolioModes={[]}
    activeScenario={data.latestRun?.scenarioType ?? 'bear_market'}
    activeMode={data.portfolioMode}
  />
  ```

  **Change B:** Find the `{#if data.portfolioMode === 'hybrid' || data.portfolioMode === 'options'}` block (both the `if` and `else` branches) and replace the entire conditional with:

  ```svelte
  <div class="next-step">
    <div class="next-text">
      <strong>Review past optimization runs</strong>
      <span>Compare how your portfolio metrics have changed over time.</span>
    </div>
    <a class="button" href="/optimization/history">View History →</a>
  </div>
  ```

- [ ] **Step 4: Type-check**

  Run: `npx tsc --noEmit 2>&1 | head -30`

  Expected: no errors.

- [ ] **Step 5: Commit**

  ```bash
  git add src/lib/components/simulation/ScenarioSelector.svelte
  git add src/routes/optimization/simulation/+page.server.ts
  git add src/routes/optimization/simulation/+page.svelte
  git commit -m "feat: simulation — hide Mode dropdown, AI-derived portfolioMode, static history CTA"
  ```

---

## Final Verification

- [ ] **Sync types**

  ```
  npx svelte-kit sync
  ```

  Expected: exits cleanly.

- [ ] **Full type check**

  ```
  npx tsc --noEmit
  ```

  Expected: zero errors.

- [ ] **Browser: `/optimization`**

  Navigate to `http://localhost:5173/optimization`.
  - Three large cards: Conservative / Moderate / Aggressive
  - One card has "AI Pick · X%" badge
  - Clicking a different card updates the "Run with X" button label
  - If selected ≠ AI pick, amber conflict notice appears
  - No dropdown skeletons show after data loads
  - Behavioral Profile card is full-width at top of hub grid
  - Remaining 8 cards in 3-column grid below
  - Old mode dropdowns (Stocks Only / Hybrid / Active Options) are gone

- [ ] **Browser: `/optimization/stress-test`**

  - No "Portfolio Mode" pills (Stock / Hybrid / Active Options gone)
  - Scenario count text appears: "X scenarios analysed"
  - Stats strip and charts intact

- [ ] **Browser: `/optimization/simulation`**

  - `ScenarioSelector` shows only the Scenario Type dropdown; Mode dropdown is hidden
  - Next-step CTA says "Review past optimization runs → View History"
  - No conditional options content based on mode

- [ ] **Final commit**

  ```bash
  git add .
  git commit -m "feat: AI-driven optimization hub — behavioral profile drives all strategy params, mode selection removed"
  ```
