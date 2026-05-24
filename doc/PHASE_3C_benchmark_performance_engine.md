# Phase 3C — Benchmark & Performance Engine

> Portfolio AI SaaS  
> Analytics Engine Module  
> Institutional Benchmark & Relative Performance Layer

---

# Objective

Phase 3C membina sistem untuk:

```text
Benchmark Comparison
+ Relative Performance Analysis
+ Alpha/Beta Engine
+ Portfolio Performance Intelligence
```

Phase ini sambung selepas:

```text
Phase 3A — Portfolio Metrics
Phase 3B — Risk & Exposure Analysis
```

Jika:

- Phase 3A = portfolio metrics
- Phase 3B = risk & exposure

Maka:

```text
Phase 3C = benchmark & relative performance intelligence
```

---

# Purpose

Phase 3C bertujuan untuk membantu sistem memahami:

- adakah portfolio outperform market
- adakah portfolio terlalu volatile
- bagaimana prestasi berbanding benchmark
- adakah return datang daripada market beta atau alpha
- relative strength portfolio

Fasa ini akan menjadi foundation kepada:

- AI portfolio advisor
- portfolio optimization
- AI copilot commentary
- institutional analytics
- performance attribution

---

# Scope

## Main Features

- Benchmark comparison
- Relative return analysis
- Alpha calculation
- Beta calculation
- Sharpe ratio
- Sortino ratio
- Tracking error
- Information ratio
- Rolling return analysis
- Relative drawdown analysis
- Performance attribution
- Outperformance tracking

---

# Supported Benchmarks

```text
SPY
QQQ
VOO
DIA
SCHG
IWM
Custom ETF
Custom Index
```

---

# What This Phase Does

Phase 3C akan analyze:

```text
Portfolio vs Benchmark
Relative Return
Risk-adjusted Performance
Alpha/Beta
Rolling Performance
```

---

# What This Phase Does Not Do Yet

Jangan masukkan lagi:

- AI optimization
- Rebalancing engine
- Quant backtesting
- AI autonomous portfolio actions
- Reinforcement learning

Semua itu masuk Phase 4 dan future quant layers.

---

# Architecture Position

```text
[Portfolio Metrics Engine]
        ↓
[Risk & Exposure Analysis]
        ↓
[Benchmark & Performance Engine]
        ↓
[AI Context Builder]
```

---

# Recommended Stack

## Analytics Layer

```text
Python FastAPI microservice
```

---

## Main Libraries

```text
pandas
numpy
empyrical
FinanceToolkit
PyPortfolioOpt
yfinance
```

Optional later:

```text
OpenBB SDK
Riskfolio-Lib
quantstats
```

---

# Required Backend Module

```text
analytics/benchmark-engine/
├── app/
│   ├── api/
│   ├── services/
│   ├── calculators/
│   ├── providers/
│   ├── schemas/
│   ├── models/
│   └── workers/
├── tests/
├── requirements.txt
└── Dockerfile
```

---

# Required Services

## BenchmarkComparisonService

Responsibilities:

- compare portfolio vs benchmark
- calculate outperformance
- relative return analysis
- benchmark drawdown comparison

---

## PerformanceAttributionService

Responsibilities:

- identify return drivers
- benchmark-relative analysis
- alpha attribution
- sector contribution

---

## RelativePerformanceService

Responsibilities:

- rolling return comparison
- rolling volatility comparison
- relative strength analysis
- trend analysis

---

## AlphaBetaService

Responsibilities:

- beta calculation
- alpha calculation
- covariance analysis
- benchmark sensitivity

---

## RiskAdjustedReturnService

Responsibilities:

- sharpe ratio
- sortino ratio
- information ratio
- tracking error

---

# Core Calculations

## Beta

genui{"math_block_widget_always_prefetch_v2":{"content":"\\beta=\\frac{Cov(R_p,R_m)}{Var(R_m)}"}}

---

## Alpha

genui{"math_block_widget_always_prefetch_v2":{"content":"\\alpha=R_p-[R_f+\\beta(R_m-R_f)]"}}

---

## Sharpe Ratio

genui{"math_block_widget_always_prefetch_v2":{"content":"Sharpe=\\frac{R_p-R_f}{\\sigma_p}"}}

---

## Sortino Ratio

genui{"math_block_widget_always_prefetch_v2":{"content":"Sortino=\\frac{R_p-R_f}{\\sigma_d}"}}

---

## Tracking Error

genui{"math_block_widget_always_prefetch_v2":{"content":"TrackingError=Std(R_p-R_b)"}}

---

## Information Ratio

genui{"math_block_widget_always_prefetch_v2":{"content":"IR=\\frac{R_p-R_b}{TrackingError}"}}

---

# Required Database Tables

## benchmark_prices

```text
id
symbol
date
open
high
low
close
adj_close
volume
created_at
updated_at
```

---

## benchmark_performance_metrics

```text
id
user_id
benchmark_symbol
snapshot_date
portfolio_return
benchmark_return
relative_return
alpha
beta
sharpe_ratio
sortino_ratio
tracking_error
information_ratio
metadata
created_at
updated_at
```

---

## rolling_performance_metrics

```text
id
user_id
benchmark_symbol
period
snapshot_date
portfolio_return
benchmark_return
relative_strength
volatility_difference
metadata
created_at
updated_at
```

---

## performance_attribution_reports

```text
id
user_id
benchmark_symbol
snapshot_date
sector_contribution_json
asset_contribution_json
risk_contribution_json
metadata
created_at
updated_at
```

---

# Required API Endpoints

## Laravel Gateway

```text
GET  /api/analytics/benchmark
GET  /api/analytics/benchmark/compare
GET  /api/analytics/benchmark/rolling
GET  /api/analytics/performance
GET  /api/analytics/performance/alpha-beta
GET  /api/analytics/performance/risk-adjusted
GET  /api/analytics/performance/attribution
POST /api/analytics/benchmark/refresh
```

---

## Python Analytics Service

```text
POST /benchmark/compare
POST /benchmark/alpha-beta
POST /benchmark/risk-adjusted
POST /benchmark/rolling-analysis
POST /benchmark/performance-attribution
```

---

# Example Benchmark Response

```json
{
  "benchmark": "SPY",
  "portfolio_return": 0.182,
  "benchmark_return": 0.121,
  "relative_return": 0.061,
  "alpha": 0.034,
  "beta": 1.12,
  "sharpe_ratio": 1.42,
  "sortino_ratio": 1.88,
  "tracking_error": 0.09,
  "information_ratio": 0.67
}
```

---

# Example Rolling Performance Response

```json
{
  "rolling_1m": {
    "portfolio": 0.032,
    "benchmark": 0.021
  },
  "rolling_3m": {
    "portfolio": 0.084,
    "benchmark": 0.051
  },
  "rolling_1y": {
    "portfolio": 0.182,
    "benchmark": 0.121
  }
}
```

---

# Relative Performance Features

Analyze:

```text
Portfolio outperformance
Benchmark-relative volatility
Rolling excess return
Relative drawdown
Relative strength
```

---

# Performance Attribution

Analyze:

```text
Sector contribution
Asset contribution
Cash drag
Broker performance contribution
Currency impact
```

---

# Relative Performance Categories

Support:

```text
Outperforming
Neutral
Underperforming
High Beta
Low Volatility
Market Leader
Defensive Performer
```

---

# Required Queue Jobs

```text
RefreshBenchmarkPricesJob
GenerateBenchmarkComparisonJob
GenerateAlphaBetaMetricsJob
GenerateRollingPerformanceJob
GeneratePerformanceAttributionJob
RefreshBenchmarkCacheJob
```

---

# Queue Rules

- Use Redis queues
- Refresh benchmark data daily
- Cache rolling analysis
- Recalculate after portfolio metric updates
- Recalculate after benchmark refresh

---

# Benchmark Data Providers

Support:

```text
yfinance
AlphaVantage (optional)
Polygon (future)
OpenBB (future)
```

---

# Frontend Pages

Create:

```text
/analytics/benchmark
/analytics/performance
/analytics/performance/rolling
/analytics/performance/attribution
```

---

# Frontend Components

Create reusable components:

```text
BenchmarkComparisonCard
RollingReturnChart
AlphaBetaCard
SharpeRatioCard
SortinoRatioCard
PerformanceAttributionChart
RelativeStrengthChart
BenchmarkDrawdownChart
InformationRatioCard
```

---

# Dashboard Widgets

Tambah widgets:

```text
Portfolio vs SPY
Alpha/Beta Summary
Sharpe Ratio
Relative Return
Rolling Outperformance
Benchmark Drawdown Comparison
```

---

# UI Requirements

UI mesti rasa:

```text
Institutional
Bloomberg-lite
Professional
AI-native
Modern finance dashboard
```

Inspired by:

- Portfolio Visualizer
- OpenBB
- Ghostfolio
- FinceptTerminal
- Bloomberg terminal concepts

---

# Caching Strategy

Gunakan:

```text
Redis cache
benchmark cache
rolling analysis cache
performance attribution cache
```

Example cache key:

```text
portfolio:{user_id}:benchmark:spy
portfolio:{user_id}:rolling:1y
portfolio:{user_id}:alpha-beta
```

---

# Engineering Rules

## Do

- Separate benchmark engine into Python service
- Cache rolling analysis
- Use snapshot-based calculations
- Use benchmark normalization
- Support multiple benchmarks
- Keep calculations reproducible

---

## Do Not

- Depend on live broker requests
- Calculate rolling metrics in frontend
- Recompute benchmark history every request
- Add optimization logic yet
- Add AI autonomous reasoning yet

---

# Testing Requirements

Create tests for:

- alpha calculation
- beta calculation
- sharpe ratio
- sortino ratio
- tracking error
- information ratio
- rolling return analysis
- benchmark comparison
- cache refresh

---

# Acceptance Criteria

Phase 3C complete when:

- Benchmark comparison works
- Alpha calculation works
- Beta calculation works
- Sharpe ratio works
- Sortino ratio works
- Rolling return analysis works
- Relative performance works
- Performance attribution works
- Benchmark cache operational
- Dashboard benchmark widgets visible

---

# Next Phase Preview

```text
Phase 4 — AI Context Builder
```

Phase 4 akan tambah:

- AI-ready analytics payload
- structured portfolio context
- benchmark-aware AI reasoning
- multi-agent financial context
- portfolio intelligence memory layer

---

# Final Architecture Reminder

```text
Portfolio Metrics
        ↓
Risk & Exposure Analysis
        ↓
Benchmark & Performance Engine
        ↓
AI Context Builder
        ↓
AI Copilot
```

Phase 3C ialah foundation untuk institutional-grade portfolio performance intelligence.

