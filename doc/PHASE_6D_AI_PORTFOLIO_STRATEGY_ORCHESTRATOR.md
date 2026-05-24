# Phase 6D — AI Portfolio Strategy Orchestrator

> Portfolio AI SaaS  
> Optimization Engine Module  
> AI Strategy Coordination & Portfolio Decision Layer

---

# Purpose

Phase 6D introduces:

```text
AI Portfolio Strategy Orchestrator
+ Strategy Coordination Engine
+ Multi-Strategy Intelligence
+ Portfolio Decision Framework
```

---

# Core Vision

Phase 6D membolehkan sistem:

```text
coordinate multiple portfolio strategies intelligently
```

AI akan coordinate:

- growth strategy
- dividend strategy
- options income strategy
- defensive allocation strategy
- cash reserve strategy
- volatility control strategy

---

# Main Objectives

## Goals

- Portfolio strategy orchestration
- Multi-strategy coordination
- Dynamic portfolio mode switching
- AI strategy prioritization
- Risk-aware strategy balancing
- Portfolio objective management
- Strategy conflict detection
- Strategy recommendation engine

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
Scenario Simulation
        ↓
Strategy Orchestrator
        ↓
AI Copilot
```

---

# Supported Portfolio Strategies

## Growth Strategy

Focus:

```text
Capital appreciation
Higher beta exposure
Growth ETF allocation
Technology momentum
```

---

## Dividend Strategy

Focus:

```text
Stable income
Dividend ETF
Yield consistency
Cash flow generation
```

---

## Options Income Strategy

Focus:

```text
Cash-secured puts
Covered calls
Premium generation
Collateral efficiency
```

---

## Defensive Strategy

Focus:

```text
Cash reserve
Lower volatility
Risk reduction
Defensive allocation
```

---

# Main Features

## Strategy Coordination Engine

AI coordinate:

- allocation priorities
- risk priorities
- income priorities
- growth priorities
- volatility targets

---

## Strategy Conflict Detection

Detect:

```text
Growth vs Defensive conflict
Income vs Volatility conflict
Options exposure conflict
Cash reserve weakness
```

---

## Dynamic Portfolio Mode Engine

Support:

```text
Aggressive Growth
Balanced Growth
Income Focused
Defensive Income
Hybrid Strategy
```

---

## Portfolio Objective Engine

AI understand user objectives:

- income generation
- growth
- capital preservation
- options premium generation
- volatility reduction

---

# Required Backend Module

```text
backend/
└── modules/
    └── strategy-orchestrator/
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

## StrategyOrchestratorService

Responsibilities:

- coordinate portfolio strategies
- generate final strategy output
- prioritize optimization goals

---

## PortfolioObjectiveService

Responsibilities:

- classify portfolio objectives
- map strategy priorities
- detect objective mismatch

---

## StrategyConflictService

Responsibilities:

- detect allocation conflicts
- detect risk conflicts
- detect exposure conflicts

---

## DynamicPortfolioModeService

Responsibilities:

- switch portfolio profile dynamically
- classify portfolio mode
- generate mode recommendations

---

## StrategyRecommendationService

Responsibilities:

- generate AI strategy recommendations
- summarize portfolio strategy
- explain tradeoffs

---

# Strategy Rules

## Growth Profile

```text
Higher volatility allowed
Higher growth exposure
Lower cash reserve
```

---

## Income Profile

```text
Stable premium flow
Higher dividend allocation
Moderate volatility
```

---

## Defensive Profile

```text
Higher cash reserve
Lower concentration
Lower options exposure
```

---

# Portfolio Strategy Modes

Support:

```text
Growth
Balanced
Income
Defensive
Hybrid
Aggressive Options
```

---

# Required Database Tables

## portfolio_strategy_profiles

```text
id
user_id
profile_type
risk_tolerance
income_target
growth_target
cash_target
options_target
metadata
created_at
updated_at
```

---

## strategy_recommendations

```text
id
user_id
strategy_mode
title
summary
priority
risk_level
recommendation_json
metadata
created_at
updated_at
```

---

## strategy_conflicts

```text
id
user_id
conflict_type
severity
description
resolution_suggestion
metadata
created_at
updated_at
```

---

# Required API Endpoints

```text
GET  /api/strategy/profile
GET  /api/strategy/recommendations
GET  /api/strategy/conflicts
GET  /api/strategy/modes
POST /api/strategy/profile/update
POST /api/strategy/refresh
```

---

# Example Strategy Response

```json
{
  "strategy_mode": "balanced_income",
  "risk_level": "moderate",
  "income_target": 8,
  "growth_target": 12,
  "cash_target": 10,
  "options_target": 15
}
```

---

# AI Copilot Integration

AI should explain:

```text
Why strategy conflicts exist
Why portfolio profile matters
Why income and growth may conflict
Why volatility impacts strategy
```

---

# Frontend Pages

```text
/strategy
/strategy/profile
/strategy/recommendations
/strategy/conflicts
```

---

# Frontend Components

```text
StrategyProfileCard
PortfolioModeBadge
StrategyConflictCard
StrategyRecommendationCard
RiskToleranceSlider
PortfolioObjectivePanel
StrategyAllocationChart
```

---

# Dashboard Widgets

Tambah:

```text
Current Portfolio Strategy
Risk Profile
Income vs Growth Balance
Strategy Conflicts
Portfolio Objective Status
```

---

# Queue Jobs

```text
GenerateStrategyProfileJob
GenerateStrategyRecommendationsJob
DetectStrategyConflictsJob
RefreshStrategyCacheJob
```

---

# Engineering Rules

## Do

- Keep strategy output explainable
- Support hybrid portfolios
- Support paper trading mode
- Use snapshot-based analysis
- Cache strategy recommendations

---

## Do Not

- Auto change portfolio allocation
- Auto execute strategy changes
- Promise strategy performance
- Ignore user-defined objectives

---

# Environment Variables

```env
STRATEGY_ORCHESTRATOR_ENABLED=true
MAX_STRATEGY_REFRESH_PER_DAY=20
PORTFOLIO_MODE_DYNAMIC=true
```

---

# Acceptance Criteria

Phase 6D complete when:

- Strategy profile works
- Strategy recommendation engine works
- Conflict detection works
- Dynamic portfolio modes work
- Dashboard strategy widgets visible
- AI explanation works
- No auto trading exists

---

# Next Phase Preview

```text
Phase 6E — Trade Layer
```

Phase 6E converts approved AI suggestions into internal trade tickets only. It must not submit broker orders directly.

```text
Phase 7 — Multi-Agent Finance AI
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
Strategy Orchestrator
        ↓
AI Copilot
        ↓
Multi-Agent Finance AI
```

Phase 6D ialah foundation untuk:

```text
AI portfolio strategy coordination
```
