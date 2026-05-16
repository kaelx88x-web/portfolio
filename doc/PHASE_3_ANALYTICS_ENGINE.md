# Phase 3 — Analytics Engine

> Portfolio AI SaaS · Engineering Plan · docs/PHASE_3_ANALYTICS_ENGINE.md

---

## Objective

Build the **Analytics Engine** for Portfolio AI.

Phase 3 menggunakan data daripada:

- Phase 1: Portfolio Insight, accounts, holdings, transactions
- Phase 2: Broker Sync, broker connections, portfolio snapshots, CSV import

Tujuan utama Phase 3 ialah menjadikan portfolio bukan sekadar tracker, tetapi sistem yang boleh membaca prestasi, risiko, allocation, benchmark, dan trend portfolio pengguna.

Phase 3 masih **bukan auto-trading** dan **bukan AI investment advice penuh**. Ia ialah engine analitik yang akan menjadi asas kepada AI Copilot, risk engine, strategy tracker, dan Portfolio Operating System.

---

## Scope

| Feature | Priority | Status |
|---|---:|---|
| Portfolio Performance Analytics | High | Implemented |
| Historical Snapshot Analysis | High | Implemented |
| Risk Metrics | High | Implemented |
| Benchmark Comparison | High | Implemented |
| Allocation Drift | Medium | Implemented |
| Dividend / Income Analytics | Medium | Implemented |
| Sector / Asset Class Breakdown | Medium | Partial: asset class/currency |
| Analytics API | High | Implemented in SvelteKit |
| Analytics Dashboard UI | High | Implemented |
| Export Report | Medium | Implemented as CSV |

---

## Architecture

```text
[Transactions + Holdings]
          │
          ▼
[Portfolio Snapshots]            ← From Phase 2
          │
          ▼
[Analytics Calculation Layer]
          │
          ├── Performance Engine
          ├── Risk Engine
          ├── Benchmark Engine
          ├── Allocation Engine
          ├── Income Engine
          └── Report Engine
          │
          ▼
[Analytics API]
          │
          ▼
[SvelteKit Analytics Dashboard]
```

---

## Phase 3 Position In Full Roadmap

```text
Phase 1  → Portfolio Insight
Phase 2  → Broker Synchronization
Phase 3  → Analytics Engine
Phase 4  → Risk Intelligence
Phase 5  → AI Insight Layer
Phase 6+ → Portfolio AI Copilot / Operating System
```

---

## Key Principle

Phase 3 mesti kira analytics daripada data sebenar pengguna, bukan hanya mock UI.

Namun untuk local development, seed data dan mock price boleh digunakan.

```txt
Transactions → Holdings → Snapshots → Analytics
```

Analytics tidak patut ubah transaksi asal. Ia hanya membaca, mengira, menyimpan summary, dan memaparkan insight.

---

## Module Breakdown

---

## 1. Performance Engine

**Location:**

```text
backend/laravel-api/app/Services/Analytics/PerformanceService.php
```

### Metrics

| Metric | Description |
|---|---|
| Total Return | Pulangan keseluruhan portfolio |
| Daily Return | Pulangan harian berdasarkan snapshot |
| MTD Return | Month-to-date return |
| YTD Return | Year-to-date return |
| 1Y Return | Pulangan 1 tahun |
| CAGR | Compound Annual Growth Rate |
| Realized P/L | Profit/loss daripada transaksi sell |
| Unrealized P/L | Profit/loss daripada holdings semasa |
| Cash Drag | Peratus cash yang tidak dilaburkan |

### Basic Formula

```txt
Total Return = (Current Value - Net Contributions) / Net Contributions * 100
```

```txt
Daily Return = (Today Value - Previous Value) / Previous Value * 100
```

```txt
CAGR = (Ending Value / Beginning Value) ^ (1 / Years) - 1
```

---

## 2. Risk Engine

**Location:**

```text
backend/laravel-api/app/Services/Analytics/RiskService.php
```

### Metrics

| Metric | Description |
|---|---|
| Volatility | Turun naik portfolio |
| Max Drawdown | Kejatuhan terbesar dari peak ke trough |
| Sharpe Ratio | Return berbanding risiko |
| Sortino Ratio | Return berbanding downside risk |
| Beta | Sensitiviti portfolio berbanding benchmark |
| Value at Risk later | Masuk fasa advanced |
| Concentration Risk | Risiko terlalu berat pada satu asset |

### Max Drawdown Concept

```txt
Peak Value = nilai portfolio tertinggi sebelum jatuh
Drawdown = (Current Value - Peak Value) / Peak Value
Max Drawdown = drawdown paling rendah
```

### Sharpe Ratio Basic

```txt
Sharpe Ratio = (Portfolio Return - Risk Free Rate) / Portfolio Volatility
```

---

## 3. Benchmark Engine

**Location:**

```text
backend/laravel-api/app/Services/Analytics/BenchmarkService.php
```

### Supported Benchmark Phase 3

| Benchmark | Use Case |
|---|---|
| SPY | US market comparison |
| QQQ | Growth / Nasdaq comparison |
| SCHD | Dividend portfolio comparison |
| VT | Global equity comparison |
| User Custom | Manual benchmark later |

### Comparison Output

```json
{
  "portfolio_return": 12.4,
  "benchmark_return": 9.8,
  "alpha": 2.6,
  "outperformed": true
}
```

### Important

Benchmark price boleh dimasukkan melalui:

1. mock seed data untuk local
2. CSV import benchmark
3. external market data provider later

Jangan lock sistem kepada satu data provider sahaja.

---

## 4. Allocation Engine

**Location:**

```text
backend/laravel-api/app/Services/Analytics/AllocationService.php
```

### Breakdown

| Breakdown | Example |
|---|---|
| By Asset | AAPL, MSFT, SCHG |
| By Asset Class | stock, ETF, cash, bond, crypto |
| By Sector | Technology, Financial, Healthcare |
| By Currency | USD, MYR, SGD |
| By Broker | Moomoo, Webull, Manual |
| By Country | US, Malaysia, Singapore |

### Allocation Drift

Allocation drift menunjukkan portfolio sudah lari daripada target.

```txt
Target SCHG = 50%
Current SCHG = 62%
Drift = +12%
```

### Use Case

Nanti Phase 4 / Phase 5 boleh guna drift ini untuk cadang rebalance, tetapi Phase 3 hanya paparkan data.

---

## 5. Income Analytics Engine

**Location:**

```text
backend/laravel-api/app/Services/Analytics/IncomeService.php
```

### Income Sources

| Source | Description |
|---|---|
| Dividend | Dividend daripada stock / ETF |
| Interest | Cash interest later |
| Option Premium later | Masuk fasa options tracker |
| Distribution | ETF distribution |

### Metrics

```txt
Monthly income
Annualized income
Yield on cost
Forward yield
Income by asset
Income by month
```

### Example Output

```json
{
  "monthly_income": 42.50,
  "annualized_income": 510.00,
  "yield_on_cost": 6.2,
  "top_income_assets": ["JEPQ", "JEPI", "SCHD"]
}
```

---

## 6. Analytics Database Tables

### portfolio_analytics_daily

```sql
id
user_id
snapshot_date
total_value
net_contribution
daily_return
total_return
realized_pnl
unrealized_pnl
cash_balance
created_at
updated_at
```

### portfolio_risk_metrics

```sql
id
user_id
period
volatility
max_drawdown
sharpe_ratio
sortino_ratio
beta
concentration_score
created_at
updated_at
```

### portfolio_benchmark_metrics

```sql
id
user_id
benchmark_symbol
period
portfolio_return
benchmark_return
alpha
beta
outperformed
created_at
updated_at
```

### portfolio_allocation_snapshots

```sql
id
user_id
snapshot_date
allocation_type
allocation_json
created_at
updated_at
```

### portfolio_income_metrics

```sql
id
user_id
period
income_total
annualized_income
yield_on_cost
income_json
created_at
updated_at
```

---

## 7. Queue Jobs

**Location:**

```text
backend/laravel-api/app/Jobs/Analytics/
```

| Job | Queue | Description |
|---|---|---|
| CalculateDailyAnalyticsJob | analytics | Calculate daily performance |
| CalculateRiskMetricsJob | analytics | Calculate risk metrics |
| CalculateBenchmarkMetricsJob | analytics | Compare with benchmark |
| CalculateAllocationSnapshotJob | analytics | Store allocation breakdown |
| CalculateIncomeMetricsJob | analytics | Calculate dividend / income summary |
| GeneratePortfolioReportJob | reports | Generate PDF/CSV report later |

---

## 8. API Endpoints

**Prefix:** `/api/v1/analytics`

| Method | Endpoint | Description |
|---|---|---|
| GET | `/overview` | Main analytics summary |
| GET | `/performance` | Performance by period |
| GET | `/risk` | Risk metrics |
| GET | `/benchmark` | Benchmark comparison |
| GET | `/allocation` | Allocation breakdown |
| GET | `/income` | Income analytics |
| GET | `/drawdown` | Drawdown chart data |
| GET | `/returns` | Daily / monthly returns |
| POST | `/recalculate` | Trigger analytics recalculation |
| GET | `/report` | Export analytics report |

All endpoints require:

```txt
auth:sanctum
ownership check
rate limit
```

---

## 9. Frontend Routes

**Location:**

```text
frontend/sveltekit-app/src/routes/(app)/analytics/
```

```text
analytics/
├── +page.svelte
├── performance/+page.svelte
├── risk/+page.svelte
├── benchmark/+page.svelte
├── allocation/+page.svelte
├── income/+page.svelte
└── report/+page.svelte
```

---

## 10. Frontend Components

**Location:**

```text
frontend/sveltekit-app/src/lib/components/analytics/
```

```text
analytics/
├── AnalyticsSummaryCards.svelte
├── PerformanceChart.svelte
├── DrawdownChart.svelte
├── RiskMetricCards.svelte
├── BenchmarkComparisonChart.svelte
├── AllocationPieChart.svelte
├── AllocationDriftTable.svelte
├── IncomeTrendChart.svelte
├── MonthlyReturnHeatmap.svelte
├── TopContributorsTable.svelte
└── AnalyticsPeriodFilter.svelte
```

---

## 11. Analytics Dashboard UI

### Main Analytics Page

Paparan utama:

- Total return
- Daily / MTD / YTD / 1Y return
- CAGR
- Max drawdown
- Sharpe ratio
- Volatility
- Portfolio vs benchmark
- Allocation chart
- Top gainers / losers
- Income summary

### Layout Cadangan

```text
[Summary Cards]
[Portfolio Value Chart]
[Performance vs Benchmark]
[Drawdown Chart]
[Allocation + Drift]
[Risk Metrics]
[Income Analytics]
[Top Contributors]
```

---

## 12. Calculation Periods

Phase 3 perlu support period berikut:

```txt
1D
1W
1M
3M
6M
YTD
1Y
3Y
5Y
MAX
CUSTOM
```

Kalau data belum cukup, API perlu return message:

```json
{
  "status": "insufficient_data",
  "message": "Need at least 30 daily snapshots to calculate volatility."
}
```

---

## 13. Analytics Service Structure

```text
app/
└── Services/
    └── Analytics/
        ├── PerformanceService.php
        ├── RiskService.php
        ├── BenchmarkService.php
        ├── AllocationService.php
        ├── IncomeService.php
        ├── DrawdownService.php
        ├── AnalyticsRecalculationService.php
        └── AnalyticsFormatter.php
```

---

## 14. Data Flow

```text
User sync broker / import CSV
          │
          ▼
Transactions updated
          │
          ▼
Holdings recalculated
          │
          ▼
Portfolio snapshot taken
          │
          ▼
Analytics jobs dispatched
          │
          ▼
Analytics tables updated
          │
          ▼
Dashboard reads summary API
```

---

## 15. Error Handling

| Error | Behaviour |
|---|---|
| Not enough snapshots | Show insufficient data message |
| Missing benchmark data | Disable benchmark chart gracefully |
| Missing asset sector | Show as Unknown sector |
| Invalid return calculation | Log and skip bad snapshot |
| Zero portfolio value | Avoid divide-by-zero |
| Queue failure | Retry and log analytics error |

---

## 16. Security & Safety

- Analytics must be read-only against transaction records
- Do not expose other user data
- Every analytics query filters by `user_id`
- Recalculation endpoint must be rate-limited
- Do not make financial advice claim
- UI label should say `Insight`, not `Buy/Sell Recommendation`

---

## 17. Testing Plan

### Unit Tests

```text
PerformanceServiceTest
RiskServiceTest
BenchmarkServiceTest
AllocationServiceTest
IncomeServiceTest
DrawdownServiceTest
```

### Test Cases

- Calculate total return correctly
- Calculate daily return correctly
- Handle deposit and withdrawal
- Handle missing previous snapshot
- Calculate max drawdown
- Calculate allocation percentage
- Compare benchmark correctly
- Return insufficient data for volatility
- Prevent divide-by-zero
- Ensure user cannot access other user's analytics

---

## 18. Deliverables Checklist

- [x] Analytics database migrations
- [x] PerformanceService
- [x] RiskService
- [x] BenchmarkService
- [x] AllocationService
- [x] IncomeService
- [x] DrawdownService
- [x] AnalyticsRecalculationService
- [x] Analytics API controller
- [x] Analytics routes
- [ ] Queue jobs for analytics
- [x] SvelteKit analytics pages
- [x] Analytics summary cards
- [x] Portfolio value chart
- [x] Drawdown chart
- [x] Benchmark comparison chart
- [x] Allocation drift table
- [x] Income trend chart
- [ ] Unit tests
- [x] README update

---

## 19. Code Agent Instruction

Gunakan instruction ini untuk **Code agent**.

```md
# TASK: Phase 3 — Analytics Engine

You are the Code agent for Portfolio AI.

Build Phase 3: Analytics Engine.

## Context
Phase 1 already created portfolio foundation:
- accounts
- assets
- transactions
- holdings
- dashboard
- watchlist

Phase 2 added broker sync foundation:
- broker connections
- sync logs
- portfolio snapshots
- queue jobs
- CSV import
- Moomoo adapter structure

## Goal
Create analytics services, API endpoints, database tables, queue jobs, and SvelteKit analytics UI.

## Main Features
1. Portfolio performance analytics
2. Risk metrics
3. Benchmark comparison
4. Allocation breakdown
5. Allocation drift
6. Income analytics
7. Drawdown chart
8. Analytics dashboard

## Backend Requirements
- Create services under app/Services/Analytics
- Create analytics migrations
- Create API routes under /api/v1/analytics
- Use user_id ownership filtering
- Use portfolio_snapshots as primary data source
- Do not modify original transactions inside analytics services
- Add queue jobs for recalculation
- Add tests for calculation logic

## Frontend Requirements
- Create analytics route group in SvelteKit
- Create summary cards
- Create performance chart
- Create benchmark chart
- Create drawdown chart
- Create allocation pie chart
- Create allocation drift table
- Create income chart
- Add period filter

## Calculation Requirements
Implement:
- total return
- daily return
- MTD return
- YTD return
- CAGR
- volatility
- max drawdown
- Sharpe ratio basic
- allocation percentage
- benchmark alpha
- income by month

## Safety
- Do not generate buy/sell recommendation
- Do not add auto-trading
- Do not add AI copilot yet
- Treat analytics as insight only

## Deliverables
- Working analytics backend
- Working analytics API
- Working analytics dashboard
- Seed data for testing
- Unit tests
- README update
```

---

## 20. Codex Reviewer Instruction

Gunakan instruction ini untuk **Codex** selepas Code siap bina Phase 3.

```md
# TASK: Review Phase 3 — Analytics Engine

You are the Codex reviewer for Portfolio AI.

Review the Phase 3 implementation.

Check:
1. Performance calculation correctness
2. Risk metric calculation correctness
3. Drawdown logic
4. Benchmark comparison logic
5. Deposit/withdrawal handling
6. Snapshot usage
7. API ownership filtering
8. Rate limiting for recalculation
9. Frontend chart data format
10. TypeScript safety
11. Unit test coverage
12. Whether analytics accidentally modifies source transaction data

Return:
- Issues found
- Priority level
- Suggested fixes
- Files to modify
- Test cases to add
```

---

## 21. Definition of Done

Phase 3 dianggap siap bila:

- Analytics dashboard boleh dibuka
- Portfolio value history dipaparkan
- Total return dikira
- Daily / MTD / YTD return dikira
- Max drawdown dikira
- Volatility dikira
- Sharpe ratio basic dikira
- Benchmark comparison dipaparkan
- Allocation breakdown dipaparkan
- Allocation drift dipaparkan
- Income analytics dipaparkan
- API endpoints protected dengan auth
- Queue recalculation boleh dijalankan
- Unit tests untuk calculation utama lulus

---

## 22. Apa Tidak Dibuat Dalam Phase 3

Jangan masukkan lagi:

- AI buy/sell recommendation
- Auto trading
- Broker order execution
- Options wheel tracker
- Tax optimization
- Robo-advisor rebalance execution
- Multi-agent copilot
- Subscription billing
- Social portfolio sharing

---

## 23. Next Phase Preview

> **Phase 4 — Risk Intelligence**
>
> Concentration risk · sector risk · currency risk · volatility regime · downside warning · stress test · scenario analysis · portfolio health score

---

## 24. Ringkasan Keputusan

```txt
Phase 3 nama: Analytics Engine
Agent utama: Code
Agent sokongan: Codex
Data utama: portfolio_snapshots + transactions
Backend: Laravel API analytics services + queue jobs
Frontend: SvelteKit analytics dashboard
Fokus: performance, risk, benchmark, allocation, income
Output: portfolio analytics foundation untuk AI Copilot later
```

---

*Portfolio AI SaaS · docs/ · Phase 3: Analytics Engine*
