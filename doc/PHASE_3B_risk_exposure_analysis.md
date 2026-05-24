# Phase 3B — Risk & Exposure Analysis

> Portfolio AI SaaS  
> Analytics Engine Module  
> Institutional Risk & Exposure Layer

---

# Objective

Phase 3B membina sistem untuk:

```text
Portfolio Risk Analysis
+ Exposure Intelligence
+ Concentration Detection
+ Portfolio Health Scoring
```

Phase ini sambung selepas:

```text
Phase 3A — Portfolio Metrics
```

Jika Phase 3A fokus:

- portfolio value
- return
- PnL
- allocation
- growth metrics

Maka Phase 3B fokus:

- volatility
- drawdown
- exposure
- concentration risk
- diversification quality
- portfolio health

---

# Purpose

Phase 3B bertujuan untuk membantu sistem memahami:

- tahap risiko portfolio
- exposure portfolio
- weakness portfolio
- diversification quality
- concentration risk
- volatility profile

Fasa ini akan menjadi foundation kepada:

- AI portfolio insights
- optimization engine
- benchmark engine
- portfolio copilot

---

# Scope

## Main Features

- Volatility analysis
- Drawdown analysis
- Concentration risk analysis
- Sector exposure
- Country exposure
- Currency exposure
- Broker exposure
- Asset type exposure
- Correlation analysis
- Diversification analysis
- Portfolio health scoring
- Risk classification

---

# What This Phase Does

Phase 3B akan analyze:

```text
Portfolio Risk
Exposure
Volatility
Concentration
Diversification
Portfolio Health
```

---

# What This Phase Does Not Do Yet

Jangan masukkan lagi:

- Benchmark comparison
- Alpha/Beta vs market
- Sharpe ratio comparison
- AI optimization
- Rebalancing engine
- Strategy backtesting
- AI autonomous reasoning

Semua itu masuk Phase 3C dan Phase 4.

---

# Architecture Position

```text
[Portfolio Metrics Engine]
        ↓
[Risk & Exposure Engine]
        ↓
[Benchmark & Performance Engine]
        ↓
[AI Context Builder]
```

---

# Required Backend Module

```text
backend/laravel-api/app/Modules/Analytics/RiskExposure/
├── Controllers/
│   └── RiskExposureController.php
├── Services/
│   ├── PortfolioRiskService.php
│   ├── ExposureAnalysisService.php
│   ├── VolatilityService.php
│   ├── DrawdownService.php
│   ├── DiversificationService.php
│   ├── CorrelationService.php
│   └── PortfolioHealthService.php
├── DTOs/
│   ├── RiskMetricsDTO.php
│   ├── ExposureDTO.php
│   └── PortfolioHealthDTO.php
├── Jobs/
│   ├── GenerateRiskMetricsJob.php
│   ├── GenerateExposureAnalysisJob.php
│   ├── GeneratePortfolioHealthJob.php
│   └── RefreshRiskCacheJob.php
├── Routes/
│   └── api.php
└── Providers/
    └── RiskExposureServiceProvider.php
```

---

# Required Services

## PortfolioRiskService

Main risk engine.

Responsibilities:

- calculate volatility
- calculate risk score
- calculate concentration risk
- aggregate risk metrics

---

## ExposureAnalysisService

Analyze exposure.

Responsibilities:

- sector exposure
- country exposure
- currency exposure
- broker exposure
- account exposure
- asset type exposure

---

## VolatilityService

Analyze volatility.

Responsibilities:

- daily volatility
- annualized volatility
- rolling volatility
- volatility trend

---

## DrawdownService

Analyze drawdowns.

Responsibilities:

- max drawdown
- rolling drawdown
- drawdown periods
- recovery analysis

---

## DiversificationService

Analyze diversification quality.

Responsibilities:

- diversification score
- concentration analysis
- overlapping exposure detection
- correlated holdings analysis

---

## CorrelationService

Analyze correlation.

Responsibilities:

- asset correlation
- sector correlation
- portfolio clustering
- diversification matrix

---

## PortfolioHealthService

Generate portfolio health summary.

Responsibilities:

- risk classification
- health score
- strengths/weaknesses
- risk summary

---

# Core Calculations

## Annualized Volatility

genui{"math_block_widget_always_prefetch_v2":{"content":"\\sigma_{annual}=\\sigma_{daily}\\sqrt{252}"}}

---

## Max Drawdown

genui{"math_block_widget_always_prefetch_v2":{"content":"MaxDrawdown=\\frac{Trough-Peak}{Peak}"}}

---

## Correlation

genui{"math_block_widget_always_prefetch_v2":{"content":"Corr(X,Y)=\\frac{Cov(X,Y)}{\\sigma_X\\sigma_Y}"}}

---

## Concentration Percentage

```text
concentration_percent = position_value / total_portfolio_value × 100
```

---

## Sector Exposure

```text
sector_exposure = sector_market_value / total_portfolio_value × 100
```

---

# Required Database Tables

## portfolio_risk_metrics

```text
id
user_id
trading_account_id nullable
snapshot_date
volatility
max_drawdown
concentration_score
diversification_score
risk_score
risk_level
portfolio_health
metadata
created_at
updated_at
```

---

## portfolio_exposures

```text
id
user_id
snapshot_date
exposure_type
exposure_key
market_value
allocation_percent
risk_contribution
metadata
created_at
updated_at
```

Example exposure_type:

```text
sector
country
currency
broker
asset_type
account
```

---

## portfolio_correlations

```text
id
user_id
snapshot_date
asset_a
asset_b
correlation_value
metadata
created_at
updated_at
```

---

## portfolio_health_reports

```text
id
user_id
snapshot_date
health_score
risk_level
strengths_json
weaknesses_json
recommendations_json
metadata
created_at
updated_at
```

---

# Required API Endpoints

## Laravel API

```text
GET  /api/analytics/risk
GET  /api/analytics/risk/summary
GET  /api/analytics/risk/volatility
GET  /api/analytics/risk/drawdown
GET  /api/analytics/exposure
GET  /api/analytics/exposure/sectors
GET  /api/analytics/exposure/countries
GET  /api/analytics/exposure/currencies
GET  /api/analytics/correlation
GET  /api/analytics/portfolio-health
POST /api/analytics/risk/refresh
```

---

# Example Risk Response

```json
{
  "risk_score": 72,
  "risk_level": "moderate",
  "annualized_volatility": 0.24,
  "max_drawdown": -0.18,
  "diversification_score": 68,
  "concentration_score": 81,
  "portfolio_health": "moderate_risk"
}
```

---

# Example Exposure Response

```json
{
  "sector_exposure": {
    "technology": 42.5,
    "financials": 14.2,
    "healthcare": 10.8
  },
  "country_exposure": {
    "US": 76,
    "China": 12,
    "Malaysia": 5
  },
  "broker_exposure": {
    "Moomoo": 70,
    "Manual": 30
  }
}
```

---

# Portfolio Health Categories

Support:

```text
Low Risk
Moderate Risk
Aggressive Growth
High Volatility
Concentrated Portfolio
Well Diversified
```

---

# Diversification Rules

Examples:

```text
Single position > 25% = high concentration
Single sector > 40% = sector concentration risk
Single country > 80% = country concentration risk
Cash < 2% = liquidity warning
```

---

# Risk Classification

## Conservative

```text
Low volatility
Low drawdown
Diversified
```

---

## Balanced

```text
Moderate volatility
Moderate concentration
Healthy diversification
```

---

## Aggressive

```text
High volatility
High concentration
Growth-heavy
```

---

# Required Queue Jobs

```text
GenerateRiskMetricsJob
GenerateExposureAnalysisJob
GenerateCorrelationMatrixJob
GeneratePortfolioHealthJob
RefreshRiskAnalyticsCacheJob
```

---

# Queue Rules

- Use Redis queues
- Run after portfolio metrics refresh
- Cache expensive calculations
- Correlation calculations must be batched
- Recalculate after broker sync
- Recalculate after paper trade updates

---

# Frontend Pages

Create:

```text
/analytics/risk
/analytics/exposure
/analytics/diversification
/analytics/portfolio-health
```

---

# Frontend Components

Create reusable components:

```text
RiskScoreCard
VolatilityChart
DrawdownChart
SectorExposureChart
CountryExposureChart
CurrencyExposureChart
CorrelationHeatmap
DiversificationScoreCard
PortfolioHealthCard
RiskBreakdownTable
```

---

# Dashboard Widgets

Tambah widgets:

```text
Risk Score
Portfolio Health
Volatility Trend
Top Concentration Risk
Sector Exposure
Country Exposure
Drawdown Summary
Diversification Score
```

---

# UI Requirements

UI mesti rasa:

```text
Institutional
Professional
AI-native
Bloomberg-lite
Finance dashboard
```

Inspired by:

- OpenBB
- Portfolio Visualizer
- Ghostfolio
- FinceptTerminal

---

# Caching Strategy

Gunakan:

```text
Redis cache
Risk metrics cache
Exposure cache
Correlation cache
```

Example cache key:

```text
portfolio:{user_id}:risk:latest
portfolio:{user_id}:exposure:latest
portfolio:{user_id}:correlation:1m
```

---

# Engineering Rules

## Do

- Use snapshot-based calculations
- Keep risk calculations centralized
- Use batch processing for correlation
- Cache volatility calculations
- Support multi-account mode
- Support paper trading analytics

---

## Do Not

- Calculate risk in frontend
- Depend on live market request every page load
- Add benchmark comparison yet
- Add optimization logic yet
- Add AI autonomous reasoning yet

---

# Testing Requirements

Create tests for:

- volatility calculation
- max drawdown
- sector exposure
- country exposure
- concentration analysis
- diversification score
- portfolio health score
- correlation matrix
- cache refresh

---

# Acceptance Criteria

Phase 3B complete when:

- Volatility analysis works
- Drawdown analysis works
- Sector exposure works
- Country exposure works
- Currency exposure works
- Correlation analysis works
- Diversification analysis works
- Portfolio health score works
- Risk classification works
- Dashboard risk widgets visible
- Risk cache operational

---

# Next Phase Preview

```text
Phase 3C — Benchmark & Performance Engine
```

Phase 3C akan tambah:

- benchmark comparison
- SPY/QQQ/VOO comparison
- alpha/beta
- relative performance
- rolling return analysis
- benchmark outperformance

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

Phase 3B ialah foundation untuk institutional portfolio risk intelligence.

