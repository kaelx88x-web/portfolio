# Phase 6A — Smart Allocation Intelligence

> Portfolio AI SaaS  
> Optimization Engine Module  
> AI Allocation Intelligence Layer

---

# Purpose

Phase 6A introduces:

```text
Smart Allocation Intelligence
+ Dynamic Portfolio Allocation
+ AI Allocation Scoring
+ Adaptive Exposure Management
```

Phase 6A sambung selepas:

- Phase 6 — Optimization Engine

Jika:

```text
Phase 6 = optimization engine
```

Maka:

```text
Phase 6A = intelligent allocation system
```

---

# Core Vision

Phase 6A membolehkan sistem:

```text
faham allocation portfolio secara pintar
```

dan bukan sekadar:

```text
static allocation calculation
```

AI akan analyze:

- portfolio composition
- market regime
- concentration risk
- growth vs income balance
- options exposure
- cash efficiency
- volatility profile

---

# Main Objectives

## Goals

- Intelligent allocation analysis
- Dynamic allocation scoring
- Smart exposure balancing
- Portfolio mode adaptation
- Allocation health analysis
- AI allocation suggestions
- Sector balancing
- ETF vs stock balancing
- Cash reserve intelligence

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
AI Copilot
```

---

# Supported Portfolio Types

## Growth Portfolio

Focus:

```text
Growth ETF
Tech exposure
Higher volatility
Capital appreciation
```

---

## Income Portfolio

Focus:

```text
Dividend ETF
Covered call ETF
Monthly income
Yield stability
```

---

## Hybrid Portfolio

Focus:

```text
Growth
+
Income
+
Options overlay
```

---

# Main Features

## Allocation Health Score

Generate:

```text
Allocation Score
Diversification Score
Cash Efficiency Score
Volatility Balance Score
```

---

## Exposure Intelligence

Analyze:

- single stock exposure
- sector concentration
- country exposure
- currency exposure
- options exposure
- cash drag

---

## Dynamic Allocation Suggestions

Examples:

```text
Reduce QQQ exposure
Increase SCHD allocation
Lower options concentration
Increase cash reserve
Reduce technology overweight
```

---

# Required Backend Module

```text
backend/
└── modules/
    └── smart-allocation/
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

## AllocationHealthService

Responsibilities:

- calculate allocation score
- detect unhealthy allocation
- detect concentration

---

## ExposureBalancingService

Responsibilities:

- sector balancing
- country balancing
- volatility balancing
- options balancing

---

## PortfolioStyleService

Responsibilities:

- classify portfolio style
- detect aggressive portfolio
- detect defensive portfolio
- detect income portfolio

---

## AllocationSuggestionService

Responsibilities:

- generate allocation suggestions
- generate rebalance explanation
- calculate improvement estimate

---

# Allocation Rules

## Single Stock Exposure

```text
>15% = moderate concentration
>25% = high concentration
```

---

## Sector Exposure

```text
>35% sector = concentration warning
```

---

## Cash Reserve

```text
<5% cash = liquidity warning
```

---

## Options Exposure

```text
>20% options = aggressive profile
```

---

# Portfolio Health Categories

Support:

```text
Defensive
Balanced
Growth
Aggressive
Income Focused
High Volatility
```

---

# Required Database Tables

## allocation_health_reports

```text
id
user_id
snapshot_date
allocation_score
diversification_score
cash_efficiency_score
volatility_balance_score
portfolio_style
health_level
metadata
created_at
updated_at
```

---

## allocation_suggestions

```text
id
user_id
title
summary
current_state_json
suggested_state_json
impact_estimate
priority
metadata
created_at
updated_at
```

---

# Required API Endpoints

```text
GET  /api/allocation/health
GET  /api/allocation/exposure
GET  /api/allocation/style
GET  /api/allocation/suggestions
POST /api/allocation/refresh
```

---

# Example Allocation Health Response

```json
{
  "allocation_score": 74,
  "diversification_score": 68,
  "cash_efficiency_score": 82,
  "portfolio_style": "growth",
  "health_level": "moderate",
  "warnings": [
    "Technology exposure exceeds 42%",
    "Single-stock concentration detected"
  ]
}
```

---

# AI Copilot Integration

AI should explain:

```text
Why allocation is risky
Why concentration matters
Why cash reserve matters
What diversification improves
```

Example:

```text
Your portfolio is highly concentrated in technology holdings. Reducing QQQ exposure may improve diversification and reduce volatility risk.
```

---

# Frontend Pages

```text
/optimization/allocation
/optimization/allocation/health
/optimization/allocation/exposure
```

---

# Frontend Components

```text
AllocationHealthCard
PortfolioStyleBadge
SectorExposureChart
AllocationSuggestionCard
DiversificationScoreCard
CashEfficiencyCard
```

---

# Dashboard Widgets

Tambah:

```text
Allocation Health
Portfolio Style
Top Exposure
Diversification Score
Cash Reserve Status
```

---

# UI Requirements

UI mesti rasa:

```text
Institutional
Modern SaaS
AI-native
Professional finance dashboard
```

Inspired by:

- OpenBB
- Portfolio Visualizer
- Ghostfolio
- Bloomberg terminal concepts

---

# Queue Jobs

```text
GenerateAllocationHealthJob
GenerateExposureBalancingJob
RefreshAllocationCacheJob
```

---

# Engineering Rules

## Do

- Keep allocation analysis explainable
- Use snapshot-based analysis
- Cache allocation reports
- Support hybrid portfolios
- Support paper trading mode

---

## Do Not

- Auto rebalance portfolio
- Auto execute trades
- Force allocation changes
- Promise portfolio safety

---

# Acceptance Criteria

Phase 6A complete when:

- Allocation score works
- Diversification score works
- Portfolio style detection works
- Exposure analysis works
- Allocation suggestions work
- Dashboard widgets visible
- AI explanation works
- No auto trading exists

---

# Next Phase Preview

```text
Phase 6B — Options Intelligence Engine
```

Focus:

```text
Put exposure
Covered calls
Collateral analysis
Premium efficiency
Wheel strategy intelligence
```

---

# Final Architecture Reminder

```text
Optimization Engine
        ↓
Smart Allocation Intelligence
        ↓
Options Intelligence
        ↓
AI Copilot
```

Phase 6A ialah foundation untuk:

```text
AI portfolio allocation intelligence
```

---

# Implementation Status

> Updated: 2026-05-17

## Portfolio Mode Engine — COMPLETE ✅

The Portfolio Mode Engine (persistent mode selection) has been implemented as part of Phase 6A.

### What Was Built

**Database:**
- Added `portfolioMode` field to `User` model (`prisma/schema.prisma`)
- Default value: `"stock"`
- Applied via `prisma db push`

**Backend Service** (`src/lib/services/optimization-engine.service.ts`):
- `getUserPortfolioMode(userId)` — reads persisted mode from User record
- `saveUserPortfolioMode(userId, mode)` — updates User.portfolioMode in DB

**API Endpoints:**
- `GET /api/portfolio/mode` — returns current user's saved portfolio mode
- `PUT /api/portfolio/mode` — saves new mode, returns updated value

**Optimization Page** (`src/routes/optimization/+page.server.ts`):
- `load()` now fetches `savedMode` alongside dashboard data
- New `saveMode` form action persists user's mode choice
- Mode persists across sessions — no longer resets per run

### What Was Already Built (Audit-Confirmed)

- Portfolio mode types: `stock | hybrid | options`
- Mode-driven allocation logic in `optimization-engine.service.ts`
- 3 scenarios (Conservative / Balanced / Aggressive) per mode
- OptimizationRun, OptimizationScenario, RebalanceSuggestion DB models
- 12+ frontend pages under `/optimization/`
- PortfolioConstraintEditor, OptimizationModeSelector UI components
- API: `/api/optimization/run`, `/constraints`, `/scenarios`, `/history`

### Remaining Gaps

- No main dashboard quick-mode switcher (minor UX improvement)
- No guardrail validation for conflicting mode/constraint combos
  (e.g., options mode with 0% collateral reserve)

---

# Phase 6B Next Steps

See `PHASE_6B_OPTIONS_INTELLIGENCE_ENGINE.md` for next phase scope.
