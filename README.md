# Portfolio AI

Analytics Engine foundation.

## Stack

- SvelteKit + TypeScript
- Tailwind CSS
- Prisma
- MySQL for local development through Prisma

## What Is Included

- Dashboard with total portfolio value, cash balance, P/L, allocation, recent transactions, and watchlist
- Accounts CRUD
- Assets CRUD and manual mock latest prices
- Transactions CRUD with filtering
- Holdings calculated from transactions
- CSV import preview and confirm
- Watchlist
- Basic settings page
- Portfolio snapshots from broker sync or manual recalculation
- Analytics dashboard with performance, risk, drawdown, benchmark, allocation drift, income, and top contributors
- Portfolio metrics dashboard with value, cash, market value, cost basis, P/L, returns, allocation, and growth
- Risk and exposure analytics with risk score, health classification, volatility, drawdown, concentration, diversification, and exposure breakdowns
- Benchmark and performance analytics with SPY/QQQ/VOO comparison, alpha, beta, rolling returns, relative performance, and outperformance tracking
- Local analytics API under `/api/v1/analytics`
- CSV analytics report export

No AI advice, payment, tax engine, or live trading is included.

## Setup

```bash
npm install
copy .env.example .env
npm run db:push
npm run db:seed
npm run dev
```

Open the local URL printed by Vite, usually:

```txt
http://127.0.0.1:5173
```

## CSV Import Format

```csv
account,symbol,type,trade_date,quantity,price,fee,currency,notes
Moomoo US Account,MSFT,buy,2026-05-01,10,420,1,USD,Initial Microsoft buy
Moomoo US Account,AAPL,dividend,2026-05-08,20,0.24,0,USD,Quarterly dividend
```

## Calculation Notes

- Current quantity = total buy quantity - total sell quantity
- Average cost = buy cost plus buy fees divided by buy quantity
- Market value = current quantity x latest mock price
- Unrealized P/L = market value - remaining cost basis
- Allocation = holding market value / total market value
- Analytics uses portfolio snapshots as its primary source
- Period returns are adjusted for external deposit and withdrawal cash flows
- Benchmark comparison stays unavailable until live or imported benchmark market data is added
- Benchmark performance does not use dummy benchmark values; it reads Moomoo historical candles first, then stored `benchmark_prices`
- `npm run db:seed` only creates the local user; it does not create mock holdings, transactions, or snapshots

## Analytics API

```txt
GET  /api/v1/analytics
GET  /api/v1/analytics/overview
GET  /api/v1/analytics/performance
GET  /api/v1/analytics/risk
GET  /api/v1/analytics/benchmark
GET  /api/v1/analytics/allocation
GET  /api/v1/analytics/income
GET  /api/v1/analytics/drawdown
GET  /api/v1/analytics/returns
GET  /api/v1/analytics/report
POST /api/v1/analytics/recalculate

GET  /api/v1/analytics/portfolio-metrics
GET  /api/v1/analytics/portfolio-metrics/summary
GET  /api/v1/analytics/portfolio-metrics/returns
GET  /api/v1/analytics/portfolio-metrics/allocation
GET  /api/v1/analytics/portfolio-metrics/history
POST /api/v1/analytics/portfolio-metrics/refresh

GET  /api/v1/analytics/risk/summary
GET  /api/v1/analytics/risk/volatility
GET  /api/v1/analytics/risk/drawdown
POST /api/v1/analytics/risk/refresh
GET  /api/v1/analytics/exposure/sectors
GET  /api/v1/analytics/exposure/countries
GET  /api/v1/analytics/exposure/currencies
GET  /api/v1/analytics/portfolio-health
```

The benchmark endpoint includes the benchmark performance payload under `benchmarkPerformance`. The same portfolio metric endpoints are also available without the version prefix under `/api/analytics/portfolio-metrics`.

## Project Structure

```txt
src/lib/calculators    Portfolio calculations
src/lib/server         Prisma client and server helpers
src/lib/services       Typed application services
src/routes             SvelteKit pages and server actions
prisma                 Schema and seed data
doc                    Product phase notes
```
