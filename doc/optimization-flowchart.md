# Optimization Engine — Flowchart & Reference

> **Status:** Implemented — AI-Driven Hub (2026-05-24)  
> Semua parameter optimization diterbitkan dari behavioral profile. User pilih risk level sahaja.

---

## 1. Arkitektur Keseluruhan

```
User buka /optimization
        │
        ▼
+page.server.ts  ──────────────────────────────────────────────────┐
  Promise.all([                                                      │
    getOptimizationDashboard(userId),          ← data carta          │
    getRecommendedStrategy(userId).catch(→null) ← AI recommendation  │
  ])                                                                 │
        │                                                            │
        ▼                                                            │
  data.recommendedStrategy  ──── null? ──── YA ──── fallback:      │
        │                                        riskLevel: moderate │
        │                                        portfolioMode: hybrid│
        │                                        confidence: 0       │
        │                                        (no AI badge shown) │
        │                                                            │
        ▼                                                            │
+page.svelte                                                         │
  AiStrategySelector (3 kad)                                         │
  + hidden <input name="riskLevel">                                  │
  + "▶ Run with [X]" button                                          │
                                                                     │
  User submit form → POST ?/run                                      │
        │                                                            │
        ▼                                                            │
+page.server.ts (action: run)                                        │
  riskLevel = form.get('riskLevel')                                  │
  strategy  = await getRecommendedStrategy(userId, riskLevel)  ◄────┘
  runOptimization(strategy params...)
```

---

## 2. `getRecommendedStrategy()` — Cara Kerja

**Fail:** `src/lib/services/behavioral-profile.service.ts`

```
getRecommendedStrategy(userId, userRiskLevel?)
        │
        ▼
Cache check (_strategyCache Map)
  key = "${userId}:${userRiskLevel ?? 'ai'}"
  TTL = 5 minit
        │
        ├─ cache hit & belum expired → return cached data
        │
        └─ cache miss / expired
                │
                ▼
        getBehavioralProfile(userId)
                │
                ▼
        profile.dataPoints === 0?
          ├─ YA  → return DEFAULT_STRATEGY (spread-clone, bukan reference)
          │        riskLevel: 'moderate', portfolioMode: 'hybrid'
          │        confidence: 0, conflictDetected: false
          │
          └─ TIDAK → buildRecommendedStrategy(profile, userRiskLevel?)
                        │
                        ▼
                mapActualToRiskLevel(profile.actualProfile)
                  aggressive  → 'aggressive'
                  balanced    → 'moderate'
                  conservative → 'conservative'
                  (lain-lain) → 'moderate'
                        │
                        ▼
                effectiveRisk = userRiskLevel ?? aiRiskLevel
                        │
                        ▼
                clamp cashFloorPct dalam RISK_CLAMPS[effectiveRisk]
                  conservative: min=8  max=20
                  moderate:     min=4  max=12
                  aggressive:   min=1  max=6
                        │
                        ▼
                blendScenarioWeights (60% behavioral + 40% base)
                  conservative_blended = round(beh.c * 0.6 + base.c * 0.4)
                  balanced_blended     = round(beh.b * 0.6 + base.b * 0.4)
                  aggressive_blended   = 100 - c - b  ← absorb rounding
                        │
                        ▼
                optimizationGoal:
                  aggressive   → 'maximum_return'
                  conservative → 'minimum_volatility'
                  moderate     → profile.weights.goalDefault || 'maximum_sharpe'
                        │
                        ▼
                conflictDetected = !!userRiskLevel && userRiskLevel !== aiRiskLevel
                        │
                        ▼
                simpan dalam cache, return RecommendedStrategy
```

---

## 3. AiStrategySelector — Cara Kerja

**Fail:** `src/lib/components/optimization/AiStrategySelector.svelte`

```
Props:
  recommended: RiskLevel  ← dari data.recommendedStrategy.riskLevel
  selected: RiskLevel     ← bind:selected (parent owns selectedRisk)
  confidence: number      ← dari data.recommendedStrategy.confidence

Render 3 kad:
  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
  │  ✨ AI Pick·72% │  │                 │  │                 │
  │  🛡️ Conservative│  │  ⚖️ Moderate    │  │  🚀 Aggressive  │
  │  Stock only     │  │  Hybrid strategy│  │  Options enabled│
  └─────────────────┘  └─────────────────┘  └─────────────────┘
         ↑
   card bertanda recommended

User klik kad lain:
  select(level) → selectedRisk dikemas kini → dispatch('change', level)

Parent (+page.svelte):
  selectedRisk !== recommended?
    YA → tunjuk conflict notice (amber):
         "AI detects your actual behavior is [X].
          Parameters adjusted to fit your selection safely."
```

---

## 4. Run Action — Parameter Mapping

**Fail:** `src/routes/optimization/+page.server.ts`

```
Form submit: riskLevel = 'conservative' | 'moderate' | 'aggressive'
        │
        ▼
getRecommendedStrategy(userId, riskLevel)  ← dengan user override
        │
        ▼
┌─────────────┬────────────────┬─────────────┬──────────────────────┐
│ riskLevel   │ portfolioMode  │ riskProfile │ optimizationGoal     │
├─────────────┼────────────────┼─────────────┼──────────────────────┤
│ conservative│ stock          │ conservative│ minimum_volatility   │
│ moderate    │ hybrid         │ balanced    │ weights.goalDefault   │
│ aggressive  │ options        │ aggressive  │ maximum_return        │
└─────────────┴────────────────┴─────────────┴──────────────────────┘
  + cashFloorPct: dari RISK_CLAMPS (clamped)
  + scenarioWeights: 60% behavioral + 40% base
  + rebalanceTrigger: dari profile.weights.rebalanceTrigger
        │
        ▼
runOptimization(userId, { portfolioMode, optimizationGoal, riskProfile, ... })
        │
        ▼
Pre-compute sub-pages (parallel):
  getStressTest(...)       → saveStressTestCache(...)
  getPortfolioProjection() → savePortfolioProjectionCache(...)
  getRebalanceProjection() ← persist: true
```

---

## 5. Sub-Pages — portfolioMode Derivation

Sub-pages **tidak terima portfolioMode dari URL param** — semuanya dari behavioral profile.

### 5a. `/optimization/stress-test`

```
+page.server.ts
  strategy = await getRecommendedStrategy(userId).catch(() => null)
  portfolioMode = strategy?.portfolioMode ?? 'hybrid'

+page.svelte
  ✗ tiada mode pills (Stock / Hybrid / Options)
  ✓ "<p>{data.stressTest.scenarios.length} scenarios analysed</p>"
  ✓ stat strip + chart + RiskProjectionCard
```

### 5b. `/optimization/simulation`

```
+page.server.ts
  strategy = await getRecommendedStrategy(userId).catch(() => null)
  portfolioMode = strategy?.portfolioMode ?? 'hybrid'

+page.svelte
  ScenarioSelector:
    portfolioModes={[]}  ← Mode dropdown disembunyi
    activeMode={data.portfolioMode}  ← AI-derived, submit via hidden input

  CTA bawah (statik):
    "Review past optimization runs → View History"
    href="/optimization/history"
```

---

## 6. Fallback & Error Handling

```
getRecommendedStrategy() gagal?
  ├─ +page.server.ts (load):    .catch(() => null)
  │    └─ data.recommendedStrategy = null
  │    └─ skeleton cards render di +page.svelte
  │    └─ tiada AI badge
  │
  ├─ +page.server.ts (action: run): .catch() tidak ada
  │    └─ kalau gagal, error masuk try/catch → fail(400, { message })
  │
  ├─ stress-test/+page.server.ts: .catch(() => null)
  │    └─ portfolioMode fallback = 'hybrid'
  │
  └─ simulation/+page.server.ts: .catch(() => null)
       └─ portfolioMode fallback = 'hybrid'

validateStrategyConsistency():
  └─ cashFloorPct < RISK_CLAMPS.min → console.warn (bukan throw)
  └─ scenarioWeights > 85% → console.warn
  └─ tiada exception dilempar — fungsi boleh teruskan
```

---

## 7. Cache

```
_strategyCache = Map<string, { data: RecommendedStrategy; ts: number }>

Cache key:
  AI recommendation:    "${userId}:ai"
  User override:        "${userId}:conservative" | ":moderate" | ":aggressive"

TTL: 5 minit (300,000ms)
  Date.now() - cached.ts < STRATEGY_CACHE_TTL

Unbounded guard:
  if (_strategyCache.size > 500) _strategyCache.clear()
```

---

## 8. Hub Cards Grid Layout

```
┌──────────────────────────────────────────────────────────────────┐
│  🧠 Behavioral Profile                              [New]         │
│  (grid-column: span 3 — full-width)                              │
└──────────────────────────────────────────────────────────────────┘
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ 📊 Scenarios │  │ ⚖️ Rebalance │  │ 📈 Allocation│
└──────────────┘  └──────────────┘  └──────────────┘
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ 🌪️ Stress   │  │ 🔮 Projection│  │ 🧪 Simulation│
└──────────────┘  └──────────────┘  └──────────────┘
┌──────────────┐  ┌──────────────┐
│ 🎯 Options  │  │ 📋 History   │
└──────────────┘  └──────────────┘
```

---

## 9. Files Diubah

| File | Perubahan |
|---|---|
| `src/lib/services/behavioral-profile.service.ts` | Tambah `RiskLevel`, `RecommendedStrategy`, `getRecommendedStrategy()`, `RISK_CLAMPS`, `BASE_WEIGHTS`, cache |
| `src/lib/components/optimization/AiStrategySelector.svelte` | BARU — 3-card picker, AI badge, pure selection |
| `src/routes/optimization/+page.server.ts` | Buang `getUserPortfolioMode`, `saveMode`; tambah `getRecommendedStrategy` load + run |
| `src/routes/optimization/+page.svelte` | Buang `OptimizationModeSelector`; tambah `AiStrategySelector`, skeleton, conflict notice, behavioral card full-width |
| `src/routes/optimization/stress-test/+page.server.ts` | `portfolioMode` dari behavioral, buang `PORTFOLIO_MODES` |
| `src/routes/optimization/stress-test/+page.svelte` | Buang mode pills, tambah scenario count text |
| `src/routes/optimization/simulation/+page.server.ts` | `portfolioMode` dari behavioral |
| `src/routes/optimization/simulation/+page.svelte` | `portfolioModes={[]}`, buang conditional CTA |
| `src/lib/components/simulation/ScenarioSelector.svelte` | Mode field dalam `{#if portfolioModes.length > 0}` |

**Tidak diubah (out of scope):**
- `src/lib/components/optimization/OptimizationModeSelector.svelte` — disimpan, tidak dipadam
- `src/lib/services/optimization-engine.service.ts` — dalaman tidak berubah
- `/optimization/scenarios`, `/projection`, `/rebalance`, `/history`, `/options`, `/allocation`, `/behavioral`

---

## 10. RecommendedStrategy Type

```typescript
type RecommendedStrategy = {
  riskLevel:          'conservative' | 'moderate' | 'aggressive';
  portfolioMode:      'stock' | 'hybrid' | 'options';
  riskProfile:        'conservative' | 'balanced' | 'aggressive';
  optimizationGoal:   string;   // 'minimum_volatility' | 'maximum_sharpe' | 'maximum_return'
  cashFloorPct:       number;   // clamped dalam RISK_CLAMPS
  rebalanceTrigger:   string;   // dari profile.weights.rebalanceTrigger
  scenarioWeights:    { aggressive: number; balanced: number; conservative: number };
  confidence:         number;   // profile.confidencePct (0–100)
  actualProfile:      string;   // 'aggressive' | 'balanced' | 'conservative'
  conflictDetected:   boolean;  // userRiskLevel !== aiRiskLevel
  aiRecommendedLevel: 'conservative' | 'moderate' | 'aggressive';
};
```
