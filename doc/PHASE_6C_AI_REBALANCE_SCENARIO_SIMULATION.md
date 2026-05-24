# Phase 6C — AI Rebalance & Scenario Simulation

> Portfolio AI SaaS  
> Optimization Engine Module  
> AI Rebalance & Scenario Intelligence Layer

---

# Purpose

Phase 6C introduces:

```text
AI Rebalance Intelligence
+ Portfolio Scenario Simulation
+ Stress Testing
+ Portfolio Projection Engine
```

Phase 6C sambung selepas:

- Phase 6 — Optimization Engine
- Phase 6A — Smart Allocation Intelligence
- Phase 6B — Options Intelligence Engine

Jika:

```text
Phase 6B = options intelligence
```

Maka:

```text
Phase 6C = portfolio simulation & rebalance intelligence
```

---

# Core Vision

Phase 6C membolehkan sistem:

```text
simulate future portfolio behavior
```

dan bukan sekadar:

```text
static portfolio analysis
```

AI akan simulate:

- market downturn
- volatility spikes
- sector crash
- allocation changes
- options assignment impact
- cash flow changes
- rebalance scenarios

---

# Main Objectives

## Goals

- AI rebalance suggestions
- Portfolio scenario simulation
- Stress testing engine
- Allocation projection
- Portfolio resilience analysis
- Downside risk simulation
- Rebalance impact analysis
- Portfolio future projection
- Risk-adjusted scenario modeling

---

# Architecture Position

```text
Portfolio Metrics
        ↓
Risk & Exposure
        ↓
Optimization Engine
        ↓
Allocation Intelligence
        ↓
Options Intelligence
        ↓
Scenario Simulation Engine
        ↓
AI Copilot
```

---

# Main Features

## AI Rebalance Engine

AI analyze:

- current allocation
- target allocation
- concentration reduction
- volatility reduction
- diversification improvement

---

## Scenario Simulation Engine

Simulate:

```text
Bull Market
Bear Market
High Volatility
Interest Rate Shock
Sector Selloff
Tech Crash
Options Assignment Stress
```

---

## Portfolio Projection Engine

Project:

- expected portfolio range
- volatility-adjusted projection
- income projection
- cash flow projection
- options premium projection

---

## Stress Testing Engine

Analyze:

- max drawdown impact
- concentration collapse
- liquidity stress
- assignment chain effect
- market crash exposure

---

# Required Backend Module

```text
backend/
└── modules/
    └── scenario-simulation/
        ├── Controllers/
        ├── Services/
        ├── DTOs/
        ├── Jobs/
        ├── Enums/
        ├── Routes/
        └── Providers/
```

---

# Required Services

## RebalanceSimulationService

Responsibilities:

- simulate allocation rebalance
- compare before/after portfolio
- estimate volatility reduction

---

## StressTestingService

Responsibilities:

- simulate market crash
- simulate volatility expansion
- simulate concentration collapse

---

## PortfolioProjectionService

Responsibilities:

- project future portfolio value
- estimate expected return range
- estimate downside scenarios

---

## ScenarioEngineService

Responsibilities:

- generate scenario sets
- run portfolio simulation
- aggregate simulation output

---

## RiskProjectionService

Responsibilities:

- estimate future risk profile
- estimate future concentration
- estimate drawdown probabilities

---

# Supported Scenarios

## Bull Market Scenario

```text
Strong growth
Low volatility
High momentum
```

---

## Bear Market Scenario

```text
Negative return
Higher drawdown
Volatility expansion
```

---

## Tech Sector Crash

```text
Technology selloff
Growth compression
Correlation spike
```

---

## Options Assignment Stress

```text
Multiple puts assigned
Collateral usage spike
Liquidity reduction
```

---

# Core Calculations

## Portfolio Projection

```text
future_value = current_value × (1 + expected_return)
```

---

## Rebalance Improvement

```text
risk_reduction = old_volatility - new_volatility
```

---

## Drawdown Projection

```text
projected_drawdown = stress_loss / portfolio_value × 100
```

---

# Required Database Tables

## simulation_runs

```text
id
user_id
scenario_type
portfolio_mode
status
metadata
created_at
updated_at
```

---

## simulation_results

```text
id
simulation_run_id
scenario_name
projected_return
projected_volatility
projected_drawdown
allocation_json
risk_summary_json
metadata
created_at
updated_at
```

---

## rebalance_projections

```text
id
user_id
current_allocation_json
projected_allocation_json
risk_reduction
expected_return_change
volatility_change
metadata
created_at
updated_at
```

---

# Required API Endpoints

```text
POST /api/simulation/run
GET  /api/simulation/results
GET  /api/simulation/stress-test
GET  /api/simulation/projection
GET  /api/rebalance/projection
POST /api/rebalance/simulate
```

---

# Example Scenario Response

```json
{
  "scenario": "Bear Market",
  "projected_return": -0.18,
  "projected_drawdown": -0.24,
  "risk_level": "high",
  "largest_risk": "technology concentration",
  "suggested_action": "reduce single-sector exposure"
}
```

---

# Example Rebalance Projection

```json
{
  "current_volatility": 0.28,
  "projected_volatility": 0.18,
  "risk_reduction": 0.10,
  "allocation_change": {
    "QQQ": -15,
    "SCHD": +10,
    "Cash": +5
  }
}
```

---

# AI Copilot Integration

AI should explain:

```text
Why rebalance helps
Why stress scenarios matter
How volatility changes
How downside risk changes
What tradeoff exists
```

Example:

```text
Reducing technology concentration lowers projected drawdown during a simulated market correction scenario.
```

---

# Frontend Pages

```text
/optimization/simulation
/optimization/stress-test
/optimization/rebalance
/optimization/projection
```

---

# Frontend Components

```text
ScenarioSimulationCard
StressTestChart
PortfolioProjectionChart
RebalanceProjectionCard
ScenarioSelector
RiskProjectionCard
VolatilityProjectionChart
```

---

# Dashboard Widgets

Tambah:

```text
Stress Test Result
Projected Drawdown
Rebalance Improvement
Portfolio Projection
Volatility Forecast
Scenario Risk Score
```

---

# UI Requirements

UI mesti rasa:

```text
Institutional
Bloomberg-lite
AI-native
Modern finance dashboard
Professional
```

Inspired by:

- Bloomberg Terminal
- OpenBB
- Portfolio Visualizer
- Institutional risk dashboards

---

# Queue Jobs

```text
GenerateScenarioSimulationJob
GenerateStressTestJob
GeneratePortfolioProjectionJob
RefreshSimulationCacheJob
```

---

# Engineering Rules

## Do

- Keep simulations explainable
- Use scenario-based modeling
- Cache expensive simulations
- Support hybrid portfolio mode
- Support paper trading mode

---

## Do Not

- Promise future returns
- Generate guaranteed projections
- Auto rebalance portfolio
- Execute trades automatically
- Ignore downside risk

---

# Environment Variables

```env
SCENARIO_SIMULATION_ENABLED=true
STRESS_TESTING_ENABLED=true
MAX_SIMULATION_RUNS_PER_DAY=20
```

---

# Acceptance Criteria

Phase 6C complete when:

- Scenario simulation works
- Stress testing works
- Portfolio projection works
- Rebalance projection works
- Dashboard simulation widgets visible
- AI explanation works
- No auto trading exists

---

# Next Phase Preview

```text
Phase 7 — Multi-Agent Finance AI
```

Agents:

```text
Risk Agent
Macro Agent
News Agent
Options Agent
Allocation Agent
Copilot Agent
```

akan collaborate untuk:

```text
AI portfolio orchestration
```

---

# Final Architecture Reminder

```text
Optimization Engine
        ↓
Allocation Intelligence
        ↓
Options Intelligence
        ↓
Scenario Simulation
        ↓
AI Copilot
        ↓
Multi-Agent Finance AI
```

Phase 6C ialah foundation untuk:

```text
AI-driven portfolio scenario intelligence
```

---

# Implementation Status

> Updated: 2026-05-17

## Options Discovery Engine — COMPLETE ✅

The Options Discovery Engine (6C in the new Phase 6 structure) has been implemented.

### What Was Built

**Moomoo Service** (`moomoo-service/main.py`) — 3 new endpoints:

| Endpoint | Purpose |
|----------|---------|
| `GET /options/expiry?symbol=AAPL` | List available expiry dates for an underlying |
| `GET /options/chain?symbol=AAPL&expiry=2024-12-20&option_type=all` | Full option chain with greeks (delta, gamma, theta, vega, IV) |
| `GET /options/candidates?symbols=AAPL,MSFT&mode=both` | Ranked CC + CSP candidates filtered by delta 0.20–0.45 |

**Candidate Scoring Logic** (`/options/candidates`):
- Fetches 2 nearest expiry dates per symbol
- Pulls full chain per expiry
- Filters: delta 0.20–0.45 (target range for premium sellers)
- Returns: strike, bid/ask/mid, premium yield %, collateral per contract, IV, theta, open interest
- Sorted: highest premium yield first

**Broker Service** (`src/lib/services/broker.service.ts`) — 3 new typed functions:
- `getOptionExpiry(symbol)` → `OptionExpiryResult`
- `getOptionChain(symbol, expiry, optionType?)` → `OptionChainResult`
- `getOptionCandidates(symbols[], mode?)` → `OptionCandidatesResult`

**SvelteKit API Routes:**
- `GET /api/options/expiry?symbol=` — proxy to moomoo-service
- `GET /api/options/chain?symbol=&expiry=` — proxy to moomoo-service
- `GET /api/options/candidates?symbols=&mode=` — proxy to moomoo-service

### What Was Already Built (Audit-Confirmed)

- `options-intelligence.service.ts` — full analysis of existing positions
- Covered call candidate identification from stock holdings (no chain needed)
- Wheel strategy tracking, assignment risk scoring, premium yield analytics
- DB models: `OptionsPosition`, `OptionsExposureReport`, `WheelStrategyReport`
- Frontend pages: `/optimization/options/`, `/optimization/options/wheel/`, etc.

### Remaining Gaps

- No earnings date filtering (avoid selling options before earnings)
- No IV rank/percentile calculation (sell high IV, buy low IV)
- No roll recommendation for existing positions near expiry
- No `/optimization/options/discover` page using the new chain data

---

# Phase 6D Next Steps

See `PHASE_6D_AI_PORTFOLIO_STRATEGY_ORCHESTRATOR.md` for next phase scope.
