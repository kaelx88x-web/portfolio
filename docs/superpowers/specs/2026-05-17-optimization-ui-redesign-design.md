# Optimization UI Redesign — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Redesign all 8 optimization pages to be easier to understand — replacing jargon, dense dropdowns, and cluttered nav with a hub dashboard, plain-English labels, and visual selectors.

**Architecture:** Pure frontend change. No backend or API changes. All data already available from existing `PageData` and `ActionData` types. Components are rewritten in-place or replaced with new focused components.

**Tech Stack:** SvelteKit, Svelte 5, CSS custom properties (var(--primary), var(--card), var(--border), var(--muted), var(--text), var(--success)), Lucide Svelte icons.

---

## Jargon Translation Table

All technical terms replaced with plain English throughout:

| Technical | Plain English |
|-----------|--------------|
| `minimum_volatility` | Lower Risk |
| `maximum_sharpe` | Best Risk/Return |
| `risk_parity` | Balanced |
| `efficient_frontier` | Optimal Blend |
| `target_volatility` | Set Volatility Target |
| `target_income` | Income Focus |
| `defensive_allocation` | Defensive |
| `conservative` | Safe |
| `balanced` | Moderate |
| `aggressive` | Aggressive |
| `stock` mode | Stocks Only |
| `hybrid` mode | Hybrid |
| `options` mode | Active Options |
| Sharpe Ratio | Risk-Adjusted Return (keep value, add tooltip) |
| Volatility | Price Swings |
| Efficient Frontier | Risk vs Return Chart |
| Risk Parity | Equal Risk Split |

---

## Page 1 — Main Hub (`/optimization`)

### Layout (top to bottom)

1. **Page header** — title "Optimization Engine", subtitle "AI-assisted portfolio scenarios, rebalance suggestions, and risk controls."
2. **Mode selector** — 3 clickable card pills (not dropdowns). Clicking a pill submits the `?/saveMode` action.
3. **Goal + Risk row** — two side-by-side pill groups (plain English labels). Submits `?/run` on any change.
4. **Results strip** — 4 stat cards: Expected Return, Price Swings (Volatility), Risk-Adjusted Return (Sharpe), Guardrail Status.
5. **Guardrail banner** — visible only when `data.guardrail` has warnings or breaches. Shows plain-English message + link to allocation page.
6. **Hub section label** — "Explore Further"
7. **Hub cards grid** — 6 cards (2×3 or 3×2). Each card: icon, name, description, status badge.

### Removed from current UI
- The 7 nav buttons at the top (`Allocation`, `Options`, `Simulation`, etc.) — removed entirely.
- The `run-strip` metadata row — replaced by Results strip stat cards.
- `ScenarioSelector` component — moved to `/optimization/scenarios` sub-page only.
- `OptimizationScenarioCard`, `AllocationComparisonChart`, `EfficientFrontierChart`, `RiskParityChart`, `RebalanceSuggestionCard`, `PortfolioConstraintEditor` — removed from main page. Each lives only on its relevant sub-page.

### Mode Selector Component (`OptimizationModeSelector`)

Rewrite. Replace 3 `<select>` dropdowns + submit button with 3 card pills:

```
[ 📦 Stocks Only         ] [ ⚡ Hybrid (selected)    ] [ 🎯 Active Options      ]
  Buy and hold stocks.     Stocks + options income.   Options-focused strategy.
```

Clicking a pill fires `fetch('?/saveMode', { method: 'POST', body: formData })` (progressive enhancement via form action). Active pill has `border-color: var(--primary)` and `background: rgba(var(--primary-rgb), 0.06)`.

### Goal + Risk Selectors

Replace `<select>` with pill button groups inside a 2-column row card.

**Goal pills** (plain English, maps to `optimizationGoal` form value):
- Lower Risk → `minimum_volatility`
- Best Risk/Return → `maximum_sharpe`
- Balanced → `risk_parity`
- Optimal Blend → `efficient_frontier`
- Income Focus → `target_income`
- Defensive → `defensive_allocation`

**Risk pills**:
- Safe → `conservative`
- Moderate → `balanced`
- Aggressive → `aggressive`

Selecting either group submits `?/run` form action via JS fetch. Falls back to standard form submit without JS.

### Results Strip (4 stat cards)

Pull from `data.activeScenario` (Balanced scenario by default):
- **Expected Return** — `activeScenario.expectedReturn.toFixed(1) + '%'`, green if positive
- **Price Swings** — `activeScenario.expectedVolatility.toFixed(1) + '%'`, label "Volatility"
- **Risk-Adjusted Return** — `activeScenario.sharpeRatio.toFixed(2)`, label "Sharpe Ratio", subtitle ">0.5 is good"
- **Guardrail Status** — from `data.guardrail`: "All Clear" (green) / "N Warning(s)" (amber) / "N Breach(es)" (red)

If `data.activeScenario` is null (no runs yet), show placeholder cards with "Run optimization to see results".

### Guardrail Banner

Shown only when `data.guardrail && !data.guardrail.passed` or `data.guardrail?.violations.length > 0`.

```
🛡️  [title: "1 Risk Control Warning"]  [message from guardrail.summary]  [→ View Details link to /optimization/allocation]
```

Left border: amber for warnings, red for breaches.

### Hub Cards (6 cards, 3-column grid)

| Icon | Name | Description | Badge source |
|------|------|-------------|--------------|
| 📊 | Portfolio Scenarios | Compare 3 portfolio plans — safe, moderate, aggressive | `data.scenarios.length + ' scenarios'` |
| ⚖️ | Rebalance Suggestions | What to buy or sell to hit your target allocation | `data.rebalance.length + ' suggestions'` |
| 📈 | Allocation Check | See overweight and underweight positions by stock, sector, and asset type | static "View details" |
| 🎯 | Options Strategy | Covered call and cash-secured put candidates ranked by premium yield | static "View candidates" |
| 🌪️ | Stress Test | Simulate how your portfolio holds up in a market crash or sector selloff | static "Run simulation" |
| 🔮 | Portfolio Projection | Expected portfolio value in 1, 3, and 5 years | static "View projection" |

Each card links to its sub-page. Badge color: green for "All Clear", amber for warnings, primary blue for info counts.

---

## Page 2 — Scenarios (`/optimization/scenarios`)

**Header:** "Portfolio Scenarios" — "Compare three allocation strategies and pick what fits your goals."

**Stat strip (4 cards):** Best Return (from scenarios), Lowest Volatility, Best Sharpe, Active Scenario name.

**Content:** `ScenarioSelector` + `OptimizationScenarioCard` + `AllocationComparisonChart` + `EfficientFrontierChart` (renamed "Risk vs Return Chart" in UI label).

**Back link:** `← Optimization` in breadcrumb.

---

## Page 3 — Rebalance (`/optimization/rebalance`)

**Header:** "Rebalance Suggestions" — "Actions to bring your portfolio closer to the target allocation."

**Stat strip (3 cards):** Suggestions count, Estimated risk reduction, Status (up to date / needs action).

**Content:** List of `RebalanceSuggestionCard` components (all suggestions, not just first).

**Back link:** breadcrumb.

---

## Page 4 — Allocation (`/optimization/allocation`)

**Header:** "Allocation Check" — "Review how your portfolio is distributed across stocks, sectors, and asset types."

**Stat strip (3 cards):** Largest holding %, Top sector %, Drift from target.

**Content:** Existing allocation charts + exposure sub-links. Guardrail violations shown inline if any.

**Back link:** breadcrumb.

---

## Page 5 — Options (`/optimization/options`)

**Header:** "Options Strategy" — "Covered call and cash-secured put candidates, ranked by premium yield."

**Stat strip (3 cards):** CC candidates, CSP candidates, Avg premium yield.

**Content:** Existing options components.

**Back link:** breadcrumb.

---

## Page 6 — Stress Test (`/optimization/stress-test`)

**Header:** "Stress Test" — "See how your portfolio performs under market crashes, rate shocks, and sector selloffs."

**Stat strip (3 cards):** Worst scenario loss, Max drawdown, Recovery estimate.

**Content:** Existing stress test components.

**Back link:** breadcrumb.

---

## Page 7 — Projection (`/optimization/projection`)

**Header:** "Portfolio Projection" — "Expected portfolio value over 1, 3, and 5 years based on current returns."

**Stat strip (3 cards):** 1-year estimate, 3-year estimate, 5-year estimate.

**Content:** Existing projection components.

**Back link:** breadcrumb.

---

## Page 8 — Simulation (`/optimization/simulation`)

**Header:** "Scenario Simulation" — "Run what-if scenarios to see how allocation changes affect risk and return."

**Stat strip (3 cards):** Scenarios run, Best projected return, Worst projected drawdown.

**Content:** Existing simulation components.

**Back link:** breadcrumb.

---

## New Shared Components

### `OptimizationStatStrip.svelte`
Reusable 2-4 stat card row. Props: `stats: Array<{ label, value, sub?, color? }>`.

### `OptimizationHubCard.svelte`
Single hub card. Props: `icon, name, description, badge, badgeColor, href`.

### `GuardrailBanner.svelte`
Guardrail warning/breach strip. Props: `guardrail: GuardrailReport | null`.

---

## Sidebar Navigation

No changes to sidebar. `/optimization` stays as a single entry. Sub-pages are not added to the sidebar menu — they are accessed only from hub cards.

---

## Existing Components — Disposition

| Component | Action |
|-----------|--------|
| `OptimizationModeSelector.svelte` | Rewrite (pills, not dropdowns) |
| `ScenarioSelector.svelte` | Keep, move to scenarios sub-page only |
| `OptimizationScenarioCard.svelte` | Keep, move to scenarios sub-page only |
| `AllocationComparisonChart.svelte` | Keep, move to scenarios sub-page only |
| `EfficientFrontierChart.svelte` | Keep, relabel "Risk vs Return Chart" |
| `RiskParityChart.svelte` | Keep, move to scenarios sub-page only |
| `RebalanceSuggestionCard.svelte` | Keep, move to rebalance sub-page only |
| `PortfolioConstraintEditor.svelte` | Keep, move to allocation sub-page only |

---

## What Does NOT Change

- Backend services, API routes, server load functions — no changes
- Component internal logic — only visual/layout changes
- Data types — no changes
- Other pages outside `/optimization` — no changes
