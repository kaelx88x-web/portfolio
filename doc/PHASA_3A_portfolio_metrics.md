# Phase 3A — Portfolio Metrics

> Portfolio AI SaaS  
> Analytics Engine Module  
> Core Portfolio Metrics Foundation

---

# Objective

Phase 3A membina foundation untuk **Portfolio Metrics**.

Fasa ini fokus kepada calculation asas portfolio supaya sistem boleh faham prestasi, nilai, return, PnL, allocation, dan growth portfolio sebelum masuk ke risk analysis dan benchmark engine.

```text
Portfolio Core
    ↓
Portfolio Snapshots
    ↓
Portfolio Metrics Engine
    ↓
Risk & Exposure Analysis
    ↓
Benchmark & Performance Engine
```

---

# Purpose

Phase 3A bertujuan untuk menghasilkan metrik asas portfolio yang bersih, konsisten, dan boleh digunakan oleh:

- dashboard
- analytics page
- risk engine
- benchmark engine
- AI context builder
- portfolio copilot

---

# Scope

## Main Features

- Total portfolio value
- Cash balance
- Market value
- Cost basis
- Unrealized PnL
- Realized PnL
- Total return
- Daily return
- Monthly return
- Year-to-date return
- Allocation percentage
- Portfolio growth chart
- Portfolio snapshot timeline

---

# What This Phase Does

Phase 3A akan kira:

```text
Portfolio Value
PnL
Return
Allocation
Growth
Snapshot Metrics
```

---

# What This Phase Does Not Do Yet

Jangan masukkan lagi:

- Sharpe ratio
- Sortino ratio
- Beta
- Alpha
- VaR
- Benchmark comparison
- Sector risk scoring
- Optimization
- AI recommendation
- Backtesting

Semua itu masuk Phase 3B dan 3C.

---

# Architecture Position

```text
[Broker Sync / Manual Transactions]
        ↓
[Portfolio Core Engine]
        ↓
[Portfolio Snapshot Engine]
        ↓
[Portfolio Metrics Engine]
        ↓
[SvelteKit Dashboard]
```

---

# Required Backend Module

```text
backend/laravel-api/app/Modules/Analytics/PortfolioMetrics/
├── Controllers/
│   └── PortfolioMetricsController.php
├── Services/
│   ├── PortfolioMetricsService.php
│   ├── PortfolioReturnService.php
│   ├── PortfolioPnLService.php
│   ├── PortfolioAllocationService.php
│   └── PortfolioSnapshotMetricsService.php
├── DTOs/
│   ├── PortfolioMetricsDTO.php
│   ├── PortfolioReturnDTO.php
│   └── AllocationDTO.php
├── Jobs/
│   ├── GeneratePortfolioMetricsJob.php
│   ├── GenerateDailyReturnJob.php
│   └── RefreshPortfolioMetricsCacheJob.php
├── Routes/
│   └── api.php
└── Providers/
    └── PortfolioMetricsServiceProvider.php
```

---

# Required Services

## PortfolioMetricsService

Main service untuk gabungkan semua metric portfolio.

Responsibilities:

- get total portfolio value
- get cash balance
- get market value
- get total cost basis
- get total unrealized PnL
- get total realized PnL
- return summary response

---

## PortfolioReturnService

Kira return portfolio.

Responsibilities:

- daily return
- weekly return
- monthly return
- YTD return
- all-time return
- cumulative return

---

## PortfolioPnLService

Kira profit and loss.

Responsibilities:

- unrealized PnL
- realized PnL
- dividend income
- fee impact
- total gain/loss

---

## PortfolioAllocationService

Kira allocation portfolio.

Responsibilities:

- allocation by symbol
- allocation by asset type
- allocation by broker/account
- allocation by currency
- allocation percentage

---

## PortfolioSnapshotMetricsService

Bina timeline portfolio.

Responsibilities:

- snapshot value history
- portfolio growth chart
- change from previous snapshot
- missing snapshot handling

---

# Core Calculations

## Total Portfolio Value

```text
total_portfolio_value = cash_balance + total_market_value
```

---

## Market Value

```text
market_value = quantity × current_price
```

---

## Cost Basis

```text
cost_basis = quantity × average_cost
```

---

## Unrealized PnL

```text
unrealized_pnl = market_value - cost_basis
```

---

## Unrealized PnL Percentage

```text
unrealized_pnl_percent = unrealized_pnl / cost_basis × 100
```

---

## Total Return

```text
total_return = current_value - net_deposit
```

---

## Total Return Percentage

```text
total_return_percent = total_return / net_deposit × 100
```

---

## Daily Return

```text
daily_return = (today_value - yesterday_value) / yesterday_value × 100
```

---

## Allocation Percentage

```text
allocation_percent = asset_market_value / total_portfolio_value × 100
```

---

# Required Database Tables

## portfolio_metrics

```text
id
user_id
trading_account_id nullable
snapshot_date
total_value
cash_value
market_value
cost_basis
unrealized_pnl
realized_pnl
dividend_income
fees_paid
total_return
total_return_percent
daily_return
monthly_return
ytd_return
currency
metadata
created_at
updated_at
```

---

## portfolio_metric_allocations

```text
id
portfolio_metric_id
allocation_type
allocation_key
market_value
allocation_percent
metadata
created_at
updated_at
```

Example allocation_type:

```text
symbol
asset_type
broker
currency
account
```

---

## portfolio_return_history

```text
id
user_id
trading_account_id nullable
date
portfolio_value
cash_value
market_value
net_deposit
daily_return
cumulative_return
created_at
updated_at
```

---

# Required API Endpoints

## Laravel API

```text
GET  /api/analytics/portfolio-metrics
GET  /api/analytics/portfolio-metrics/summary
GET  /api/analytics/portfolio-metrics/returns
GET  /api/analytics/portfolio-metrics/allocation
GET  /api/analytics/portfolio-metrics/history
POST /api/analytics/portfolio-metrics/refresh
```

---

# Example API Response

```json
{
  "portfolio_value": 152400.50,
  "cash_value": 12400.00,
  "market_value": 140000.50,
  "cost_basis": 120000.00,
  "unrealized_pnl": 20000.50,
  "realized_pnl": 3200.00,
  "dividend_income": 880.00,
  "fees_paid": 45.20,
  "total_return": 24035.30,
  "total_return_percent": 18.76,
  "daily_return": 0.42,
  "monthly_return": 3.12,
  "ytd_return": 12.40,
  "currency": "USD"
}
```

---

# Allocation Response Example

```json
{
  "by_symbol": {
    "AAPL": 22.5,
    "MSFT": 18.3,
    "VOO": 31.4,
    "Cash": 8.1
  },
  "by_asset_type": {
    "stock": 45.2,
    "etf": 46.7,
    "cash": 8.1
  },
  "by_broker": {
    "Moomoo": 70.5,
    "Manual": 29.5
  }
}
```

---

# Required Queue Jobs

```text
GeneratePortfolioMetricsJob
GenerateDailyReturnJob
GenerateAllocationMetricsJob
RefreshPortfolioMetricsCacheJob
RebuildPortfolioReturnHistoryJob
```

---

# Queue Rules

- Use Redis queue
- Metrics generation must be idempotent
- Recalculate after broker sync
- Recalculate after manual transaction update
- Recalculate after paper trade execution
- Cache latest dashboard metrics

---

# Trigger Points

Run metrics refresh after:

```text
New transaction created
Transaction updated
Broker sync completed
Paper order filled
Portfolio snapshot generated
Manual refresh clicked
```

---

# Frontend Pages

Create:

```text
/analytics
/analytics/portfolio
/analytics/portfolio/metrics
```

---

# Frontend Components

Create reusable components:

```text
PortfolioValueCard
CashBalanceCard
MarketValueCard
PnLCard
ReturnCard
AllocationChart
PortfolioGrowthChart
MetricSummaryGrid
PortfolioHistoryTable
```

---

# Dashboard Widgets

Tambah widgets:

```text
Total Portfolio Value
Cash Balance
Market Value
Unrealized PnL
Realized PnL
Daily Return
YTD Return
Allocation Summary
Portfolio Growth
```

---

# UI Requirements

UI mesti rasa:

```text
Clean SaaS
Professional
Finance dashboard
AI-ready
Mobile responsive
```

---

# Caching Strategy

Gunakan:

```text
Redis cache
portfolio_metrics table
latest_metrics cache key
```

Example cache key:

```text
portfolio:{user_id}:metrics:latest
portfolio:{user_id}:allocation:latest
portfolio:{user_id}:returns:1y
```

---

# Engineering Rules

## Do

- Use snapshot-based calculation
- Keep formulas centralized
- Keep API response consistent
- Use decimal-safe calculation
- Cache latest metrics
- Support account switching
- Support paper account and real account

---

## Do Not

- Calculate metrics in frontend
- Depend on live broker API per request
- Mix risk analytics into this phase
- Add benchmark comparison yet
- Add AI recommendations yet

---

# Testing Requirements

Create tests for:

- total portfolio value
- market value calculation
- cost basis calculation
- unrealized PnL
- daily return
- allocation percentage
- account-specific metrics
- cache refresh

---

# Acceptance Criteria

Phase 3A complete when:

- Total portfolio value is calculated
- Cash value is calculated
- Market value is calculated
- Cost basis is calculated
- Unrealized PnL is calculated
- Realized PnL is calculated
- Daily return works
- Monthly return works
- YTD return works
- Allocation percentage works
- Portfolio growth chart works
- Metrics cache works
- Dashboard shows portfolio metric cards

---

# Next Phase Preview

```text
Phase 3B — Risk & Exposure Analysis
```

Phase 3B akan tambah:

- volatility
- drawdown
- concentration risk
- sector exposure
- country exposure
- currency exposure
- risk score

---

# Final Architecture Reminder

```text
Transactions / Broker Sync / Paper Trading
        ↓
Portfolio Snapshots
        ↓
Portfolio Metrics
        ↓
Risk & Exposure
        ↓
Benchmark & Performance
        ↓
AI Context Builder
```

Phase 3A ialah foundation untuk semua analytics selepas ini.

