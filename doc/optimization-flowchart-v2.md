# Optimization Engine â€” Flowchart v2

> **Status:** Implemented 2026-05-24  
> Versi ini guna Mermaid diagrams â€” render dalam VS Code Markdown Preview dan GitHub.

---

## 1. User Journey â€” Hub ke Run

```mermaid
flowchart TD
    A([User buka /optimization]) --> B[Server load]
    B --> C{getRecommendedStrategy\ngagal?}
    C -- Ya .catch null --> D[data.recommendedStrategy = null]
    C -- Tidak --> E[data.recommendedStrategy populated]
    D --> F[Render skeleton 3 kad\ntiada AI badge]
    E --> G[Render AiStrategySelector\n3 kad + AI Pick badge]
    F --> H[User tunggu / refresh]
    G --> I{User pilih\nrisk level}
    I -- Sama dgn AI pick --> J[Tiada conflict notice]
    I -- Berbeza dgn AI pick --> K[Tunjuk conflict notice amber\nParameters adjusted safely]
    J --> L[â–¶ Run with X]
    K --> L
    L --> M[POST ?/run\nriskLevel dalam hidden input]
    M --> N["getRecommendedStrategy\n(userId, riskLevel)"]
    N --> O[runOptimization\nall params dari strategy]
    O --> P[Pre-compute sub-pages\nstress + projection + rebalance]
    P --> Q([Hub refresh â€” selesai])
```

---

## 2. `getRecommendedStrategy()` â€” Decision Tree

```mermaid
flowchart TD
    A(["getRecommendedStrategy\n(userId, userRiskLevel?)"]) --> B{"Cache hit\n& belum expired?"}
    B -- Ya --> C([Return cached data])
    B -- Tidak --> D[getBehavioralProfile userId]
    D --> E{dataPoints === 0?}
    E -- Ya --> F([Return DEFAULT_STRATEGY clone\nmoderate + hybrid + 0% confidence])
    E -- Tidak --> G["mapActualToRiskLevel\n(profile.actualProfile) â†’ aiRiskLevel"]
    G --> H{userRiskLevel\nada?}
    H -- Tidak --> I[effectiveRisk = aiRiskLevel]
    H -- Ya --> J[effectiveRisk = userRiskLevel]
    I --> K[Clamp cashFloorPct\ndalam RISK_CLAMPS\[effectiveRisk\]]
    J --> K
    K --> L["blendScenarioWeights\n60% behavioral + 40% base"]
    L --> M[Set optimizationGoal\nberdasarkan effectiveRisk]
    M --> N{userRiskLevel\n!== aiRiskLevel?}
    N -- Ya --> O[conflictDetected = true]
    N -- Tidak --> P[conflictDetected = false]
    O --> Q[Simpan cache â†’ return]
    P --> Q
```

---

## 3. Scenario Weights Blending

```mermaid
flowchart LR
    A["Behavioral weights\n(dari DB)"] -- 60% --> C[Blended weights]
    B["Base weights\n(per risk level)"] -- 40% --> C
    C --> D["conservative = round(beh.cÃ—0.6 + base.cÃ—0.4)"]
    C --> E["balanced = round(beh.bÃ—0.6 + base.bÃ—0.4)"]
    C --> F["aggressive = 100 - c - b\nâ† absorb rounding error"]

    subgraph BASE["Base Weights per Risk Level"]
        H["conservative: c=70 b=25 a=5"]
        I["moderate:     c=25 b=50 a=25"]
        J["aggressive:   c=5  b=30 a=65"]
    end
```

---

## 4. riskLevel â†’ Parameter Mapping

```mermaid
flowchart LR
    U([User pilih]) --> C[conservative]
    U --> M[moderate]
    U --> AG[aggressive]

    C --- C1[portfolioMode: stock]
    C --- C2[riskProfile: conservative]
    C --- C3["goal: minimum_volatility"]
    C --- C4["cashFloor: 8â€“20%"]

    M --- M1[portfolioMode: hybrid]
    M --- M2[riskProfile: balanced]
    M --- M3["goal: weights.goalDefault\n|| maximum_sharpe"]
    M --- M4["cashFloor: 4â€“12%"]

    AG --- A1[portfolioMode: options]
    AG --- A2[riskProfile: aggressive]
    AG --- A3["goal: maximum_return"]
    AG --- A4["cashFloor: 1â€“6%"]
```

---

## 5. Sub-Pages â€” portfolioMode Flow

```mermaid
flowchart TD
    A([User navigate ke sub-page]) --> B{Route}
    B --> ST[/stress-test]
    B --> SIM[/simulation]
    B --> OTH["/scenarios /allocation\n/projection /options\n/behavioral /history"]

    ST --> ST1["getRecommendedStrategy(userId)\n.catch â†’ null"]
    ST1 --> ST2["portfolioMode = strategy?.portfolioMode ?? 'hybrid'"]
    ST2 --> ST3["âœ— tiada mode pills\nâœ“ scenario count text\nâœ“ stat strip + charts"]

    SIM --> SIM1["getRecommendedStrategy(userId)\n.catch â†’ null"]
    SIM1 --> SIM2["portfolioMode = strategy?.portfolioMode ?? 'hybrid'"]
    SIM2 --> SIM3["ScenarioSelector portfolioModes={[]}"]
    SIM3 --> SIM4["Mode dropdown disembunyi\nHidden input masih hantar mode"]
    SIM4 --> SIM5["CTA statik: View History â†’"]

    OTH --> OTH1[Tiada perubahan\ndalam fasa ini]
```

---

## 6. Cache Strategy

```mermaid
flowchart TD
    A(["getRecommendedStrategy\n(userId, userRiskLevel?)"]) --> B["cacheKey =\nuserId + ':' + (userRiskLevel ?? 'ai')"]
    B --> C{_strategyCache\n.get cacheKey}

    C -- Miss --> D["_strategyCache.size > 500?"]
    D -- Ya --> E[cache.clear â€” unbounded guard]
    D -- Tidak --> F[skip]
    E --> G[Compute strategy dari DB]
    F --> G
    G --> H["cache.set(key, { data, ts: Date.now() })"]
    H --> I([Return])

    C -- Hit --> J{"Date.now() - ts\n< 5 minit?"}
    J -- Ya --> K([Return cached â€” tiada DB call])
    J -- Tidak: expired --> D
```

---

## 7. Sequence â€” Full Request Cycle

```mermaid
sequenceDiagram
    actor User
    participant Page as +page.svelte
    participant Server as +page.server.ts
    participant BPS as behavioral-profile.service
    participant OES as optimization-engine.service

    User->>Page: GET /optimization
    Page->>Server: load()
    Server->>BPS: getRecommendedStrategy(userId)
    BPS-->>Server: RecommendedStrategy | null
    Server->>OES: getOptimizationDashboard(userId)
    OES-->>Server: dashboard data
    Server-->>Page: { recommendedStrategy, ...dashboard }
    Page-->>User: 3 kad + AI Pick badge

    User->>Page: Klik kad + klik Run
    Page->>Server: POST ?/run { riskLevel }
    Server->>Server: parseRiskLevel() validate
    Server->>BPS: getRecommendedStrategy(userId, riskLevel)
    BPS-->>Server: RecommendedStrategy (blended + clamped)
    Server->>OES: runOptimization(strategy params)
    OES-->>Server: done
    Server->>OES: getStressTest + getProjection + getRebalance
    OES-->>Server: cached
    Server-->>Page: { status: 'completed', message }
    Page-->>User: Hub refresh + notice
```

---

## 8. Error & Fallback Chain

```mermaid
flowchart TD
    A[getRecommendedStrategy throws] --> B{Siapa panggil?}

    B --> L["load() .catch(() => null)"]
    B --> R["run action â€” try/catch"]
    B --> ST["stress-test load .catch(() => null)"]
    B --> SIM["simulation load .catch(() => null)"]

    L --> L1["data.recommendedStrategy = null\nSkeleton render\nDefault: moderate / hybrid\nTiada AI badge"]
    R --> R1["fail(400, { message })\nBukan 500 â€” handled gracefully"]
    ST --> ST1["portfolioMode = 'hybrid'\nFallback selamat untuk semua jenis"]
    SIM --> SIM1["portfolioMode = 'hybrid'\nFallback selamat"]
```

---

## 9. Hub Grid Layout

```
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚  ðŸ§  Behavioral Profile                              [New]         â”‚
â”‚  grid-column: span 3  (full-width)                               â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ ðŸ“Š Scenarios â”‚  â”‚ âš–ï¸ Rebalance â”‚  â”‚ ðŸ“ˆ Allocationâ”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ ðŸŒªï¸ Stress   â”‚  â”‚ ðŸ”® Projectionâ”‚  â”‚ ðŸ§ª Simulationâ”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜
â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”  â”Œâ”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”
â”‚ ðŸŽ¯ Options  â”‚  â”‚ ðŸ“‹ History   â”‚
â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜  â””â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”˜

Responsive:
  â‰¤ 900px â†’ 2-col, behavioral: span 2
  â‰¤ 600px â†’ 1-col, behavioral: span 1
```

---

## 10. Quick Reference Tables

### RISK_CLAMPS

| riskLevel | cashFloorMin | cashFloorMax |
|---|---|---|
| conservative | 8% | 20% |
| moderate | 4% | 12% |
| aggressive | 1% | 6% |

### riskLevel â†’ Parameters

| riskLevel | portfolioMode | riskProfile | optimizationGoal |
|---|---|---|---|
| conservative | stock | conservative | minimum_volatility |
| moderate | hybrid | balanced | weights.goalDefault \|\| maximum_sharpe |
| aggressive | options | aggressive | maximum_return |

### RecommendedStrategy Fields

| Field | Source |
|---|---|
| `riskLevel` | userRiskLevel ?? mapActualToRiskLevel(actualProfile) |
| `portfolioMode` | riskLevel mapping |
| `riskProfile` | riskLevel mapping |
| `optimizationGoal` | riskLevel + weights.goalDefault |
| `cashFloorPct` | profile.weights.cashFloorPct clamped dalam RISK_CLAMPS |
| `rebalanceTrigger` | profile.weights.rebalanceTrigger |
| `scenarioWeights` | blended 60/40 â€” sum = 100 |
| `confidence` | profile.confidencePct (0â€“100) |
| `conflictDetected` | userRiskLevel !== aiRiskLevel |
| `aiRecommendedLevel` | hasil mapActualToRiskLevel â€” untuk conflict notice |

### Cache Keys

| Scenario | Key format |
|---|---|
| AI recommendation (load) | `${userId}:ai` |
| User pilih conservative | `${userId}:conservative` |
| User pilih moderate | `${userId}:moderate` |
| User pilih aggressive | `${userId}:aggressive` |

---

## 11. Files Diubah

| File | Perubahan |
|---|---|
| `src/lib/services/behavioral-profile.service.ts` | Tambah `RiskLevel`, `RecommendedStrategy`, `getRecommendedStrategy()`, `RISK_CLAMPS`, `BASE_WEIGHTS`, in-memory cache |
| `src/lib/components/optimization/AiStrategySelector.svelte` | **BARU** â€” 3-card risk picker, AI badge, `role="radiogroup"` |
| `src/routes/optimization/+page.server.ts` | Buang `getUserPortfolioMode` + `saveMode`; load + run dari `getRecommendedStrategy` |
| `src/routes/optimization/+page.svelte` | Buang `OptimizationModeSelector`; tambah `AiStrategySelector`, skeleton, conflict notice, behavioral card full-width |
| `src/routes/optimization/stress-test/+page.server.ts` | `portfolioMode` dari behavioral; buang `PORTFOLIO_MODES` |
| `src/routes/optimization/stress-test/+page.svelte` | Buang mode pills; tambah scenario count text |
| `src/routes/optimization/simulation/+page.server.ts` | `portfolioMode` dari behavioral |
| `src/routes/optimization/simulation/+page.svelte` | `portfolioModes={[]}`, buang conditional CTA, statik History link |
| `src/lib/components/simulation/ScenarioSelector.svelte` | Mode field dalam `{#if portfolioModes.length > 0}` |

**Tidak diubah:**
- `OptimizationModeSelector.svelte` — disimpan, tidak dipadam
- `optimization-engine.service.ts` — dalaman tidak berubah
- `/scenarios`, `/projection`, `/rebalance`, `/history`, `/options`, `/allocation`, `/behavioral`
