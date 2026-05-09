# Portfolio AI

Phase 1: Portfolio Insight foundation.

## Stack

- SvelteKit + TypeScript
- Tailwind CSS
- Prisma
- SQLite for local development

## What Is Included

- Dashboard with total portfolio value, cash balance, P/L, allocation, recent transactions, and watchlist
- Accounts CRUD
- Assets CRUD and manual mock latest prices
- Transactions CRUD with filtering
- Holdings calculated from transactions
- CSV import preview and confirm
- Watchlist
- Basic settings page

No broker API, AI advice, payment, tax engine, or live trading is included in Phase 1.

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

## Project Structure

```txt
src/lib/calculators    Portfolio calculations
src/lib/server         Prisma client and server helpers
src/lib/services       Typed application services
src/routes             SvelteKit pages and server actions
prisma                 Schema and seed data
doc                    Product phase notes
```
