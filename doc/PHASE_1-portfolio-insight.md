# Phase 1 — Portfolio Insight (Permulaan)

## 1. Tujuan Phase 1

Phase 1 ialah asas kepada aplikasi **Portfolio AI**. Fokus utama ialah membina modul **Portfolio Insight** yang boleh membaca, menyimpan, dan memaparkan gambaran awal portfolio pelaburan pengguna.

Fasa ini bukan untuk auto-trading, bukan untuk broker sync penuh, dan bukan untuk AI recommendation yang kompleks. Ia ialah foundation untuk memahami portfolio sebelum masuk ke fasa broker, analitik, AI copilot, dan portfolio operating system.

Inspirasi konteks diambil daripada konsep Ghostfolio: portfolio tracker yang fokus kepada net worth, holdings, transaksi, multi-account, performance, allocation, import/export, privacy, dan data ownership.

---

## 2. Pilihan Agent: Code atau Codex?

### Cadangan utama: **Code** untuk Phase 1

Untuk Phase 1, lebih sesuai guna **Code agent** kerana kerja utama ialah:

- scaffold project
- buat database schema
- buat CRUD asas
- buat UI dashboard awal
- buat import manual CSV
- buat calculation basic
- susun folder dan architecture

Phase 1 belum perlukan reasoning agent yang terlalu kompleks. Kita mahu hasil cepat, bersih, dan boleh jalan.

### Bila guna Codex?

Codex boleh digunakan sebagai reviewer atau planner tambahan untuk:

- semak architecture
- semak calculation logic
- semak security flow
- cadang refactor
- tulis test case
- pastikan code ikut phase requirement

### Rule ringkas

```txt
Phase 1 = Code sebagai builder utama
Codex = reviewer / architect / checker
```

---

## 3. Skop Phase 1

### Modul utama

1. Portfolio Dashboard
2. Accounts
3. Holdings
4. Transactions
5. Basic Performance
6. Basic Allocation
7. Manual Import CSV
8. Watchlist awal
9. Settings asas

---

## 4. Konsep daripada Ghostfolio yang diambil

Ambil konsep, bukan copy sistem penuh.

### Konsep yang sesuai diambil

- Portfolio sebagai pusat utama sistem
- Multi-account tracking
- Holdings berdasarkan transaksi
- Net worth / total portfolio value
- Asset allocation mengikut symbol, asset class, currency, broker
- Performance period seperti Today, MTD, YTD, 1Y, Max
- Import/export transaksi
- Privacy-first dan user owns data
- Minimal dashboard
- PWA/mobile-first sebagai hala tuju kemudian

### Konsep yang belum perlu diambil dalam Phase 1

- Advanced benchmark
- Tax report
- Multi-user SaaS billing
- Broker API sync
- Full AI portfolio copilot
- Risk engine advanced
- Options strategy tracker
- Automatic market data provider production-grade

---

## 5. Tech Stack Cadangan

### Frontend

```txt
SvelteKit
Tailwind CSS
shadcn-svelte / custom component
Chart library: lightweight chart / echarts / chart.js
```

### Backend

Pilihan A — simple monolith:

```txt
SvelteKit + server actions + Prisma
```

Pilihan B — lebih scalable:

```txt
SvelteKit frontend
Node/NestJS atau FastAPI backend
PostgreSQL database
Redis optional later
```

### Database

```txt
PostgreSQL recommended
SQLite boleh untuk prototype local
MongoDB tidak digalakkan untuk calculation portfolio awal
```

---

## 6. Database Schema Awal

### users

```txt
id
name
email
password_hash
base_currency
created_at
updated_at
```

### accounts

```txt
id
user_id
name
broker_name
account_type
currency
created_at
updated_at
```

Contoh:

```txt
Moomoo US Account
Webull Account
Manual Cash Account
Crypto Wallet
```

### assets

```txt
id
symbol
name
asset_type
exchange
currency
sector
country
created_at
updated_at
```

Contoh asset_type:

```txt
stock
etf
crypto
cash
bond
option_later
```

### transactions

```txt
id
user_id
account_id
asset_id
type
trade_date
quantity
price
fee
currency
notes
created_at
updated_at
```

Contoh type:

```txt
buy
sell
dividend
fee
deposit
withdrawal
split
```

### holdings_snapshot

```txt
id
user_id
account_id
asset_id
date
quantity
average_cost
market_price
market_value
unrealized_pnl
created_at
updated_at
```

### watchlists

```txt
id
user_id
name
created_at
updated_at
```

### watchlist_items

```txt
id
watchlist_id
asset_id
notes
created_at
updated_at
```

---

## 7. Calculation Logic Phase 1

### Holding quantity

```txt
total_buy_quantity - total_sell_quantity = current_quantity
```

### Average cost basic

```txt
total_buy_cost + fees / total_buy_quantity = average_cost
```

### Market value

```txt
current_quantity * latest_price = market_value
```

### Unrealized P/L

```txt
market_value - cost_basis = unrealized_pnl
```

### Allocation percentage

```txt
asset_market_value / total_portfolio_value * 100 = allocation_percentage
```

---

## 8. UI Pages Phase 1

### 1. Dashboard

Paparan:

- Total portfolio value
- Today change
- Total gain/loss
- Cash balance
- Top holdings
- Asset allocation chart
- Recent transactions
- Watchlist

### 2. Accounts Page

Fungsi:

- Add account
- Edit account
- Delete account
- View account holdings

### 3. Holdings Page

Table column:

```txt
Symbol
Name
Quantity
Avg Cost
Current Price
Market Value
Unrealized P/L
Allocation %
Account
```

### 4. Transactions Page

Fungsi:

- Add transaction
- Edit transaction
- Delete transaction
- Filter by account, symbol, date, type

### 5. Import Page

Fungsi:

- Upload CSV
- Preview mapping
- Confirm import
- Error row display

### 6. Watchlist Page

Fungsi:

- Add symbol
- Remove symbol
- Notes
- Simple price display later

---

## 9. Folder Structure Cadangan

```txt
portfolio-ai/
├─ src/
│  ├─ lib/
│  │  ├─ components/
│  │  ├─ server/
│  │  ├─ services/
│  │  │  ├─ portfolio.service.ts
│  │  │  ├─ transaction.service.ts
│  │  │  ├─ holding.service.ts
│  │  │  └─ import.service.ts
│  │  ├─ calculators/
│  │  │  ├─ average-cost.ts
│  │  │  ├─ allocation.ts
│  │  │  └─ performance.ts
│  │  └─ types/
│  ├─ routes/
│  │  ├─ dashboard/
│  │  ├─ accounts/
│  │  ├─ holdings/
│  │  ├─ transactions/
│  │  ├─ import/
│  │  └─ watchlist/
├─ prisma/
│  └─ schema.prisma
├─ docs/
│  └─ phase-01-portfolio-insight.md
└─ README.md
```

---

## 10. Code Agent Instruction

Gunakan instruction ini untuk **Code agent**.

```md
# TASK: Phase 1 — Portfolio Insight

You are the Code agent for Portfolio AI.

Build Phase 1: Portfolio Insight foundation.

## Goal
Create a working SvelteKit portfolio tracking foundation inspired by Ghostfolio concepts, but do not copy Ghostfolio code.

## Stack
- SvelteKit
- TypeScript
- Tailwind CSS
- Prisma
- PostgreSQL or SQLite for local development

## Main Modules
1. Dashboard
2. Accounts CRUD
3. Assets CRUD/search manual
4. Transactions CRUD
5. Holdings calculation
6. Allocation chart
7. CSV import preview
8. Watchlist

## Requirements
- Use clean folder structure
- Use typed services
- Keep calculation logic inside /lib/calculators
- Keep database access inside /lib/server or services
- Do not add broker API yet
- Do not add AI recommendation yet
- Do not add payment/subscription yet
- Make the app runnable locally

## Pages to create
- /dashboard
- /accounts
- /holdings
- /transactions
- /import
- /watchlist
- /settings

## Database
Create Prisma schema for:
- User
- Account
- Asset
- Transaction
- HoldingSnapshot
- Watchlist
- WatchlistItem

## Calculation
Implement:
- current quantity
- average cost
- market value
- unrealized gain/loss
- allocation percentage

## UI Style
- Clean SaaS dashboard
- Dark mode ready
- Cards, tables, filters
- Mobile responsive
- Minimal but professional

## Deliverables
- Working app
- Prisma schema
- Seed data
- Dashboard with mock prices
- README with setup guide
```

---

## 11. Codex Reviewer Instruction

Gunakan instruction ini untuk **Codex** selepas Code siap bina foundation.

```md
# TASK: Review Phase 1 — Portfolio Insight

You are the Codex reviewer for Portfolio AI.

Review the Phase 1 implementation.

Check:
1. Database schema correctness
2. Transaction calculation logic
3. Average cost calculation
4. Holdings aggregation
5. Folder structure
6. TypeScript safety
7. UI route completeness
8. CSV import safety
9. Error handling
10. Security basics

Do not rewrite the whole project unless necessary.

Return:
- Issues found
- Priority level
- Suggested fixes
- Files to modify
- Test cases to add
```

---

## 12. Definition of Done

Phase 1 dianggap siap bila:

- User boleh create account
- User boleh add asset
- User boleh add buy/sell/dividend transaction
- Holdings dikira automatik daripada transactions
- Dashboard tunjuk total portfolio value
- Allocation chart boleh dipaparkan
- CSV import basic boleh preview data
- Watchlist boleh simpan symbol
- README setup lengkap
- Code boleh jalan local tanpa broker API

---

## 13. Apa Tidak Dibuat Dalam Phase 1

Jangan masukkan lagi:

- Moomoo OpenD integration
- Webull sync
- Alpaca integration
- AI investment advice
- Options wheel tracker
- Portfolio Copilot chat
- Multi-tenant SaaS billing
- Advanced tax calculation
- Live order execution

Semua itu masuk phase seterusnya.

---

## 14. Ringkasan Keputusan

```txt
Phase 1 nama: Portfolio Insight
Agent utama: Code
Agent sokongan: Codex
Stack: SvelteKit + Prisma + PostgreSQL/SQLite
Inspirasi: Ghostfolio concept, bukan copy code
Fokus: manual portfolio tracking + basic insight
Output: foundation yang boleh dikembangkan ke broker sync dan AI copilot
```
