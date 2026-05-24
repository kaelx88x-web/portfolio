# AI-Driven Optimization Hub — Design Spec

**Date:** 2026-05-24  
**Status:** Approved

---

## Goal

Redesign the Optimization Engine hub so that **all optimization parameters are AI-driven** — derived entirely from the user's behavioral profile. The user only selects their broad risk appetite: **Conservative**, **Moderate**, or **Aggressive**. Every internal parameter (portfolioMode, riskProfile, optimizationGoal, scenario weights, rebalance trigger, cash floor) is determined by AI from behavioral data. Manual dropdowns and mode selectors are removed entirely.

---

## Architecture

The behavioral profile engine derives `actualProfile` (aggressive / balanced / conservative) plus a full `ScenarioWeights` object (including `goalDefault`, `rebalanceTrigger`, `cashFloorPct`) from the user's optimization history and transaction patterns. We extend this into `getRecommendedStrategy()` which produces **all** parameters needed to run optimization — the hub page just needs the user's risk appetite choice as a final confirmation.

**Risk level → full parameter mapping (all from AI behavioral data):**

| User selects | portfolioMode | riskProfile | optimizationGoal | cashFloorPct | rebalanceTrigger |
|---|---|---|---|---|---|
| Conservative | `stock` | `conservative` | `minimum_volatility` | from `weights.cashFloorPct` | from `weights.rebalanceTrigger` |
| Moderate | `hybrid` | `balanced` | from `weights.goalDefault` | from `weights.cashFloorPct` | from `weights.rebalanceTrigger` |
| Aggressive | `options` | `aggressive` | `maximum_return` | from `weights.cashFloorPct` | from `weights.rebalanceTrigger` |

All `weights.*` values come from the behavioral profile — they are never hardcoded. The user's risk level selection is the only manual input; everything else the AI decides.

---

## Components & Files

### New

**`src/lib/components/optimization/AiStrategySelector.svelte`**  
Three large selectable cards (Conservative / Moderate / Aggressive). Shows an "AI PICK" badge on the card that matches the AI recommendation. Emits `on:change` with the selected risk level. Accepts `recommended: string` and `selected: string` props. Renders strategy description and internal mode label per card (e.g., "Stock only", "Hybrid", "Options enabled"). Single "Run with [Selected]" submit button at the bottom.

### Modified

**`src/lib/services/behavioral-profile.service.ts`**  
Add exported function `getRecommendedStrategy(userId)` that calls `getBehavioralProfile()` and returns:
```typescript
export type RecommendedStrategy = {
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
  portfolioMode: 'stock' | 'hybrid' | 'options';
  riskProfile: 'conservative' | 'balanced' | 'aggressive';
  optimizationGoal: string;       // from weights.goalDefault
  cashFloorPct: number;           // from weights.cashFloorPct
  rebalanceTrigger: string;       // from weights.rebalanceTrigger
  scenarioWeights: {
    aggressive: number;
    balanced: number;
    conservative: number;
  };
  confidence: number;             // from profile.confidencePct
  actualProfile: string;          // for display ("balanced", etc.)
};
```
All fields are populated from `BehavioralProfile.weights` — never hardcoded. `riskLevel` maps from `actualProfile`: `'aggressive'→'aggressive'`, `'balanced'→'moderate'`, `'conservative'→'conservative'`. Falls back to `{ riskLevel: 'moderate', portfolioMode: 'hybrid', optimizationGoal: 'maximum_sharpe', cashFloorPct: 5, ... }` if no behavioral data exists (zero data points).

**`src/routes/optimization/+page.server.ts`**  
- Remove `getUserPortfolioMode()` call  
- Add `getRecommendedStrategy(user.id).catch(() => null)` in parallel with dashboard load  
- Pass `recommendedStrategy` to page data  
- `run` action: accept `riskLevel` form field instead of `portfolioMode` + `optimizationGoal` + `riskProfile` separately. Derive all three from `riskLevel` using the mapping table above.  
- Remove `saveMode` action (no longer needed)

**`src/routes/optimization/+page.svelte`**  
- Remove `OptimizationModeSelector` import and usage  
- Add `AiStrategySelector` with `recommended={data.recommendedStrategy?.riskLevel ?? 'moderate'}`  
- Hub cards: Behavioral Profile card rendered full-width first (using `grid-column: span 3`), then remaining 8 cards in 3-col grid  
- Remove `savedMode` references

**`src/routes/optimization/stress-test/+page.svelte`**  
- Remove `modeLabel` record, mode pills section, and `portfolioModes` usage  
- Server already has `data.portfolioMode` derived from behavioral recommendation — use it silently  
- Keep stat strip and layout unchanged

**`src/routes/optimization/stress-test/+page.server.ts`**  
- Derive `portfolioMode` from behavioral profile (`getRecommendedStrategy`) instead of URL query param  
- Keep `period` and `benchmark` query params (still useful)

**`src/routes/optimization/simulation/+page.svelte`**  
- Remove conditional `{#if data.portfolioMode === 'hybrid' || data.portfolioMode === 'options'}` block  
- Replace with a single static "next step" CTA: "Review past optimization runs → View History"

**`src/routes/optimization/simulation/+page.server.ts`**  
- Derive `portfolioMode` from behavioral recommendation instead of URL query param

---

## Hub Page Layout (Final)

```
PageHeader: "Optimization Engine"
│
├── AiStrategySelector (3 cards: Conservative / Moderate / Aggressive)
│   └── [▶ Run with Moderate]  ← submit button inside component
│
├── OptimizationStatStrip (if scenarios loaded)
│
├── GuardrailBanner (if violations)
│
└── Hub Cards Grid
    ├── [🧠 Behavioral Profile — full-width, NEW badge]
    ├── [📊 Scenarios]  [⚖️ Rebalance]  [📈 Allocation]
    ├── [🌪️ Stress Test]  [🔮 Projection]  [🧪 Simulation]
    └── [🎯 Options]  [📋 History]  [empty or future]
```

---

## Error Handling

- `getRecommendedStrategy()` wrapped in `.catch(() => null)` — if behavioral data unavailable, hub defaults to Moderate pre-selected with no AI PICK badge shown (graceful degradation).
- If `runOptimization` fails, existing `fail(400, { message })` pattern unchanged.
- Stress-test and simulation pages: if behavioral mode derivation fails, fall back to `'stock'` as the safe default.

---

## Out of Scope

- `OptimizationModeSelector.svelte` component file — kept (not deleted) in case referenced elsewhere, but removed from hub page usage.
- `/optimization/scenarios`, `/optimization/projection`, `/optimization/rebalance`, `/optimization/behavioral`, `/optimization/allocation`, `/optimization/history`, `/optimization/options` — no changes required.
- `optimization-engine.service.ts` internal logic — parameters flow through unchanged; only the source of those parameters changes.
- No database schema changes required.
