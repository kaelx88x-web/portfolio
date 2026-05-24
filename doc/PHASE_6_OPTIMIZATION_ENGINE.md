# Phase 6 — Optimization Engine

> Portfolio AI SaaS  
> AI Portfolio Optimization Layer  
> Mode: Suggestion & Scenario Simulation Only

---

# Purpose

Phase 6 introduces:

```text
Portfolio Optimization Engine
+ AI Rebalance Suggestions
+ Allocation Intelligence
+ Risk-Controlled Portfolio Design
```

Phase ini sambung selepas:

- Phase 3 — Analytics Engine
- Phase 4 — AI Context Layer
- Phase 5 — AI Copilot

Tujuan utama:

```text
Bukan auto trading.
Bukan robo advisor penuh.
```

Tetapi:

```text
AI-assisted portfolio optimization
```

yang boleh:

- cadang allocation lebih baik
- kurangkan concentration risk
- optimize volatility
- optimize income vs growth
- optimize stock + options hybrid portfolio
- generate multiple portfolio scenarios

---

# Important Rule

Phase 6 ialah:

```text
Suggestion Engine Only
```

Sistem boleh:

- suggest rebalance
- suggest allocation
- suggest options structure
- suggest hedge
- suggest portfolio optimization

Tetapi:

```text
TIDAK execute trade automatik
```

User mesti:

```text
review → approve → click confirm
```

baru Phase future boleh integrate order placement.

---

# Architecture Position

```text
[SvelteKit Frontend]
        ↓
[Laravel API Gateway]
        ↓
[Portfolio Core Engine]
        ↓
[Analytics Engine]
        ↓
[AI Context Layer]
        ↓
[Optimization Engine]
        ↓
[AI Copilot]
```

---

# Main Data Flow

```text
Portfolio Snapshot
    ↓
Risk Metrics
    ↓
Benchmark Metrics
    ↓
Optimization Engine
    ↓
Generate Optimization Scenarios
    ↓
AI Copilot Explanation
    ↓
User Review
```

---

# Core Vision

Phase 6 bukan hanya:

```text
"portfolio rebalance"
```

Tetapi:

```text
Portfolio Intelligence System
```

yang boleh support:

- stock-only portfolio
- options-only portfolio
- hybrid stock + options portfolio
- conservative income portfolio
- growth portfolio
- defensive portfolio

---

# Supported Portfolio Modes

## 1. Stock Portfolio

AI optimize:

- allocation
- diversification
- volatility
- concentration risk
- benchmark exposure

Example:

```text
QQQ exposure terlalu tinggi
AI suggest reduce from 50% → 30%
```

---

## 2. Options Portfolio

AI optimize:

- collateral usage
- premium efficiency
- theta exposure
- risk allocation
- assignment risk

Rules example:

```text
90% collateral reserve
10% buffer cash
```

---

## 3. Hybrid Portfolio

AI optimize:

```text
Stock Allocation
+
Options Allocation
```

Example:

```text
80% stock
20% options
```

atau:

```text
60% ETF
20% dividend
20% options income
```

---

# Main Features

## Portfolio Optimization

Supports:

```text
Efficient Frontier
Risk Parity
Minimum Volatility
Maximum Sharpe
Target Volatility
Target Income
Defensive Allocation
```

---

## AI Rebalance Suggestions

Examples:

```text
Reduce concentration risk
Increase defensive ETF exposure
Reduce volatility
Increase cash reserve
Improve diversification
Lower single-stock exposure
```

---

## Options Allocation Intelligence

AI analyze:

- put exposure
- covered call exposure
- collateral efficiency
- assignment risk
- premium yield

---

## Scenario Generation

AI generate:

```text
Conservative Scenario
Balanced Scenario
Aggressive Scenario
```

---

# Required Backend Module

```text
backend/
└── modules/
    └── optimization-engine/
        ├── Controllers/
        ├── Services/
        ├── DTOs/
        ├── Jobs/
        ├── Enums/
        ├── Routes/
        └── Providers/
```

---

# Recommended Quant Stack

## Python Optimization Service

Recommended:

```text
FastAPI
Riskfolio-Lib
PyPortfolioOpt
pandas
numpy
cvxpy
```

Optional later:

```text
FinRL
Qlib
LEAN
mlfinlab
```

---

# Optimization Modes

## Minimum Volatility

Objective:

```text
Reduce portfolio volatility
```

---

## Maximum Sharpe

Formula:

```text
Sharpe = (Rp - Rf) / σp
```

---

## Risk Parity

Objective:

```text
Equalize risk contribution
```

---

## Efficient Frontier

Generate:

```text
Optimal allocation curve
```

---

# Hybrid Portfolio Rules

## Example Constraints

```text
Options max allocation = 20%
Single stock max = 15%
Cash minimum = 5%
Single sector max = 35%
```

---

# Options Portfolio Rules

## Collateral Safety

Example:

```text
90% collateral reserved
10% buffer cash
```

---

## Covered Call Rules

If:

```text
100 shares owned
```

AI may suggest:

```text
covered call candidates
```

---

## Put Selling Rules

AI may analyze:

```text
premium
IV
strike distance
expiration risk
assignment probability
```

---

# Required Database Tables

## optimization_runs

```text
id
user_id
portfolio_mode
optimization_goal
risk_profile
status
metadata
created_at
updated_at
```

---

## optimization_scenarios

```text
id
optimization_run_id
scenario_name
expected_return
expected_volatility
sharpe_ratio
allocation_json
options_allocation_json nullable
metadata
created_at
updated_at
```

---

## rebalance_suggestions

```text
id
user_id
snapshot_id
title
summary
current_allocation_json
target_allocation_json
risk_impact
volatility_impact
status
metadata
created_at
updated_at
```

---

# Required API Endpoints

```text
POST /api/optimization/run
GET  /api/optimization/scenarios
GET  /api/optimization/rebalance
GET  /api/optimization/constraints
POST /api/optimization/constraints
GET  /api/optimization/history
```

---

# AI Copilot Integration

AI explain:

```text
Why rebalance is suggested
What risk improves
What concentration reduces
What tradeoff exists
```

---

# Frontend Pages

```text
/optimization
/optimization/scenarios
/optimization/rebalance
/optimization/history
```

---

# Frontend Components

```text
OptimizationScenarioCard
EfficientFrontierChart
RiskParityChart
RebalanceSuggestionCard
PortfolioConstraintEditor
AllocationComparisonChart
ScenarioSelector
OptimizationModeSelector
PortfolioModeBadge
```

---

# UI Requirements

UI mesti rasa:

```text
Institutional
Modern SaaS
Bloomberg-lite
AI-native
Professional finance dashboard
```

Inspired by:

- Ghostfolio
- OpenBB
- Portfolio Visualizer
- Bloomberg terminal concepts

---

# Queue Jobs

```text
GenerateOptimizationJob
GenerateEfficientFrontierJob
GenerateRebalanceSuggestionsJob
RefreshOptimizationCacheJob
```

---

# Environment Variables

```env
OPTIMIZATION_ENGINE_ENABLED=true
OPTIMIZATION_PROVIDER=python
RISKFOLIO_ENABLED=true
MAX_OPTIMIZATION_RUNS_PER_DAY=20
```

---

# Future-Ready Design

Phase 6 mesti bersedia untuk staged execution:

```text
Phase 7 — Multi-Agent Finance AI
Phase 8 — Future Quant Layer
```

Canonical Phase 6 sequence:

```text
6A Portfolio Mode Engine
6B Guardrail Engine
6C Options Discovery Engine
6D AI Suggestion Engine
6E Trade Layer
6F Moomoo Execution Layer
6G Order Tracking System
```

Later integration:

```text
FinRL
Qlib
LEAN
mlfinlab
TradeMaster
```

---

# Acceptance Criteria

Phase 6 complete when:

- User can run optimization
- System can generate multiple scenarios
- System can generate rebalance suggestions
- System supports stock mode
- System supports options mode
- System supports hybrid mode
- AI can explain optimization output
- Constraint system works
- Efficient frontier works
- Risk parity works
- No auto-trading exists

---

# Final Architecture Reminder

```text
Analytics Engine
        ↓
AI Context Layer
        ↓
AI Copilot
        ↓
Optimization Engine
        ↓
Multi-Agent Finance AI
```

Phase 6 ialah permulaan kepada:

```text
AI-assisted portfolio intelligence
```

bukan auto trading. Execution only begins in Phase 6E and remains gated by explicit user approval, broker checks, and audit logs.
