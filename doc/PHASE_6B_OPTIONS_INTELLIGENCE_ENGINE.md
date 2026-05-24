# Phase 6B — Options Intelligence Engine

> Portfolio AI SaaS  
> Optimization Engine Module  
> AI Options Intelligence Layer

---

# Purpose

Phase 6B introduces:

```text
Options Intelligence Engine
+ Wheel Strategy Intelligence
+ Covered Call Intelligence
+ Put Exposure Analysis
+ Premium Optimization
```

Phase 6B sambung selepas:

- Phase 6 — Optimization Engine
- Phase 6A — Smart Allocation Intelligence

Jika:

```text
Phase 6A = allocation intelligence
```

Maka:

```text
Phase 6B = options portfolio intelligence
```

---

# Core Vision

Phase 6B membolehkan sistem:

```text
faham options portfolio secara pintar
```

dan bukan sekadar:

```text
tracking options biasa
```

AI akan analyze:

- cash-secured puts
- covered calls
- collateral usage
- assignment risk
- premium efficiency
- options allocation
- theta exposure
- wheel strategy flow

---

# Main Objectives

## Goals

- Options exposure analysis
- Wheel strategy intelligence
- Covered call analysis
- Put selling analysis
- Collateral management
- Premium efficiency scoring
- Assignment probability analysis
- Risk-controlled options allocation
- AI options commentary

---

# Architecture Position

```text
Portfolio Metrics
        ↓
Risk & Exposure
        ↓
Optimization Engine
        ↓
Smart Allocation Intelligence
        ↓
Options Intelligence Engine
        ↓
AI Copilot
```

---

# Supported Options Strategies

## Cash-Secured Put

AI analyze:

- strike distance
- collateral requirement
- premium yield
- assignment probability
- expiration risk

---

## Covered Call

AI analyze:

- covered share availability
- premium potential
- upside cap impact
- assignment probability

---

## Wheel Strategy

AI analyze:

```text
Put Selling
    ↓
Assignment
    ↓
Covered Call
    ↓
Shares Sold
    ↓
Repeat Cycle
```

---

# Main Features

## Options Exposure Analysis

Analyze:

- total options allocation
- put exposure
- call exposure
- collateral locked
- premium generated
- options concentration

---

## Premium Efficiency Engine

Calculate:

```text
Premium Yield
Collateral Efficiency
Risk vs Reward
Annualized Premium
```

---

## Assignment Risk Engine

Analyze:

- ITM probability
- assignment exposure
- portfolio concentration after assignment
- collateral stress

---

## Wheel Strategy Intelligence

Generate:

- wheel candidates
- put suggestions
- covered call candidates
- premium flow analysis

---

# Required Backend Module

```text
backend/
└── modules/
    └── options-intelligence/
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

## OptionsExposureService

Responsibilities:

- analyze options allocation
- calculate options exposure
- calculate collateral usage

---

## CoveredCallService

Responsibilities:

- detect covered call opportunities
- calculate upside cap
- calculate premium efficiency

---

## PutSellingService

Responsibilities:

- analyze put exposure
- calculate assignment risk
- analyze collateral efficiency

---

## WheelStrategyService

Responsibilities:

- detect wheel opportunities
- generate wheel analysis
- calculate wheel cash flow

---

## PremiumAnalyticsService

Responsibilities:

- premium yield analysis
- annualized premium calculation
- premium efficiency scoring

---

# Options Rules

## Maximum Options Allocation

```text
Recommended max = 20%
Aggressive max = 35%
```

---

## Collateral Safety Rules

```text
90% collateral reserve
10% liquidity buffer
```

---

## Covered Call Rules

```text
100 shares required per contract
```

---

## Risk Warnings

Examples:

```text
High assignment concentration
Excessive naked exposure
Low collateral reserve
Overleveraged options exposure
```

---

# Core Calculations

## Premium Yield

```text
premium_yield = premium_received / collateral × 100
```

---

## Annualized Premium Yield

```text
annualized_yield = premium_yield × (365 / days_to_expiration)
```

---

## Options Allocation

```text
options_allocation = options_exposure / total_portfolio_value × 100
```

---

# Required Database Tables

## options_positions

```text
id
user_id
trading_account_id
symbol
option_type
strike
expiration_date
contracts
premium
collateral
status
metadata
created_at
updated_at
```

---

## options_exposure_reports

```text
id
user_id
snapshot_date
total_options_exposure
put_exposure
call_exposure
collateral_locked
premium_generated
assignment_risk_score
metadata
created_at
updated_at
```

---

## wheel_strategy_reports

```text
id
user_id
symbol
strategy_status
premium_collected
assignment_count
covered_call_cycles
realized_income
metadata
created_at
updated_at
```

---

# Required API Endpoints

```text
GET  /api/options/exposure
GET  /api/options/covered-calls
GET  /api/options/puts
GET  /api/options/wheel
GET  /api/options/premium
GET  /api/options/risk
POST /api/options/refresh
```

---

# Example Options Exposure Response

```json
{
  "options_allocation": 18.5,
  "put_exposure": 12.0,
  "call_exposure": 6.5,
  "collateral_locked": 24000,
  "premium_generated_monthly": 420,
  "assignment_risk_score": 61
}
```

---

# Example Wheel Analysis Response

```json
{
  "symbol": "NIO",
  "strategy_status": "cash_secured_put",
  "premium_collected": 280,
  "assignment_probability": 0.34,
  "collateral_efficiency": 72,
  "next_step": "covered_call_after_assignment"
}
```

---

# AI Copilot Integration

AI should explain:

```text
Why assignment risk exists
Why collateral reserve matters
Why premium may not justify risk
Why wheel strategy improves cash flow
```

Example:

```text
Your options allocation is approaching aggressive territory. Increasing collateral reserve may reduce assignment stress during volatility spikes.
```

---

# Frontend Pages

```text
/optimization/options
/optimization/options/exposure
/optimization/options/wheel
/optimization/options/premium
```

---

# Frontend Components

```text
OptionsExposureCard
WheelStrategyCard
PremiumYieldCard
AssignmentRiskCard
CoveredCallTable
PutExposureChart
CollateralUsageChart
OptionsAllocationBadge
```

---

# Dashboard Widgets

Tambah:

```text
Options Allocation
Monthly Premium Income
Collateral Usage
Wheel Strategy Status
Assignment Risk
Covered Call Opportunities
```

---

# UI Requirements

UI mesti rasa:

```text
Institutional
Modern SaaS
AI-native
Professional options dashboard
```

Inspired by:

- Tastytrade
- Interactive Brokers
- ThinkOrSwim
- Bloomberg terminal concepts

---

# Queue Jobs

```text
GenerateOptionsExposureJob
GenerateWheelAnalysisJob
RefreshPremiumAnalyticsJob
RefreshOptionsCacheJob
```

---

# Engineering Rules

## Do

- Keep options analysis explainable
- Use collateral-based risk analysis
- Support paper trading mode
- Cache expensive calculations
- Support hybrid portfolios

---

## Do Not

- Auto place options orders
- Auto roll positions
- Auto manage wheel strategy
- Recommend guaranteed income
- Ignore assignment risk

---

# Environment Variables

```env
OPTIONS_INTELLIGENCE_ENABLED=true
MAX_OPTIONS_ALLOCATION=20
OPTIONS_RISK_MODE=moderate
```

---

# Acceptance Criteria

Phase 6B complete when:

- Options exposure analysis works
- Premium calculations work
- Assignment risk analysis works
- Wheel strategy analysis works
- Covered call analysis works
- Dashboard widgets visible
- AI explanation works
- No auto trading exists

---

# Next Phase Preview

```text
Phase 6C — AI Rebalance & Scenario Simulation
```

Focus:

```text
Scenario simulation
Stress testing
Rebalance intelligence
AI portfolio projections
Risk-adjusted scenario modeling
```

---

# Final Architecture Reminder

```text
Optimization Engine
        ↓
Smart Allocation Intelligence
        ↓
Options Intelligence Engine
        ↓
Scenario Simulation
        ↓
AI Copilot
```

Phase 6B ialah foundation untuk:

```text
AI-assisted options portfolio intelligence
```

---

# Implementation Status

> Updated: 2026-05-17

## Guardrail Engine — COMPLETE ✅

The Guardrail Engine (financial rule enforcement) has been implemented as part of Phase 6B.

### What Was Built

**Guardrail Service** (`src/lib/services/guardrail.service.ts`):
- `validatePortfolioGuardrails(userId, mode, constraints?)` — full validation runner
- **Single stock concentration** — flags any holding exceeding `singleStockMaxPct`
- **Sector concentration** — groups holdings by sector, flags breaches of `sectorMaxPct`
- **Cash minimum** — warns if cash position is below `cashMinPct`
- **Options allocation** — checks options exposure vs `optionsMaxPct` (hybrid/options mode only)
- **Collateral reserve** — blocks if non-options portion drops below `collateralReservePct`
- **Constraint contradiction** — detects when `cashMinPct + optionsMaxPct > 95%`
- Returns `GuardrailReport` with `passed`, `violations[]`, and `summary`
- Each violation has `rule`, `severity` (ok / warning / breach), `current`, `limit`, `message`

**API Endpoints:**
- `GET /api/optimization/validate-guardrails` — validate using saved mode + saved constraints
- `POST /api/optimization/validate-guardrails` — validate with custom constraints payload

**Optimization Run Integration** (`src/lib/services/optimization-engine.service.ts`):
- Guardrail check runs automatically before scenario building
- `guardrailPassed`, `guardrailSummary`, `guardrailViolations` stored in run metadata

### What Was Already Built (Audit-Confirmed)

- `OptimizationConstraint` DB model with 6 constraint types
- `PortfolioConstraintEditor` UI component with min/max input ranges
- `getOptimizationConstraints()` / `saveOptimizationConstraints()` service functions
- Constraints applied in `buildTargetAllocation()` and `buildOptionsAllocation()`
- `AiGuardrailService` in Laravel backend (text-only AI response sanitization)

### Remaining Gaps

- No real-time guardrail feedback in constraint editor UI (only on run)
- No buying power check (requires live Moomoo account balance)
- AiGuardrailService (Laravel) still text-only — not wired to financial rules

---

# Phase 6C Next Steps

See `PHASE_6C_AI_REBALANCE_SCENARIO_SIMULATION.md` for next phase scope.
