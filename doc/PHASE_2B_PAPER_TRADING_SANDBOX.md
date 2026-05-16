# Phase 2B — Paper Trading Sandbox

> Portfolio AI SaaS  
> Paper Trading & Multi-Account Sandbox Layer

---

# Purpose

Phase 2B introduces:

```text
Paper Trading Sandbox
+ Multi-Account Switching
+ Simulated Portfolio Environment
```

This phase allows users to:

- Select active accounts
- Switch between accounts
- Use paper trading accounts
- Simulate trades safely
- Test strategies
- View portfolio changes in real time
- Analyze paper trading performance with AI

---

# Core Vision

The system should behave like:

```text
Professional Portfolio Operating System
+ Institutional Paper Trading Environment
+ AI Investment Sandbox
```

Inspired by:

- Interactive Brokers Paper Trading
- Bloomberg-style workspace
- Ghostfolio portfolio management
- Trading terminal UX

---

# IMPORTANT RULES

## Real Account Mode

Real broker accounts are:

```text
READ ONLY
```

Users can:

- Sync positions
- Sync holdings
- Sync transactions
- Analyze portfolio

Users CANNOT:

- Execute trades
- Place real orders
- Auto trade

---

## Paper Trading Mode

Paper accounts allow:

```text
Simulated trading only
```

Users CAN:

- Buy
- Sell
- Simulate positions
- Simulate strategies
- Test portfolio ideas

No real money involved.

---

# Architecture Position

```text
[SvelteKit Frontend]
        ↓
[Laravel API Gateway]
        ↓
[Account Switching Layer]
        ↓
[Paper Trading Engine]
        ↓
[Portfolio Core Engine]
        ↓
[Snapshots + Analytics]
        ↓
[AI Copilot]
```

---

# Main User Flow

```text
User Login
    ↓
Select Active Account
    ↓
Dashboard Changes
    ↓
Portfolio Loads
    ↓
Paper Trading Enabled
    ↓
Paper Orders Created
    ↓
Paper Positions Updated
    ↓
Portfolio Snapshots Generated
    ↓
AI Analysis Updated
```

---

# Main Features

## Multi-Account Support

Users can have:

```text
Real Broker Accounts
Paper Trading Accounts
Sandbox Accounts
```

---

## Account Switching

When user switches account:

```text
Dashboard updates automatically
```

Including:

- Holdings
- Transactions
- PnL
- Allocation
- AI insights
- Snapshot charts

---

## Paper Trading Engine

Supports:

- Simulated buy
- Simulated sell
- Simulated holdings
- Simulated cash balance
- Simulated PnL
- Simulated transaction history

---

## AI Sandbox Analysis

AI should analyze:

- Paper portfolio risk
- Trade performance
- Position concentration
- Strategy results
- Allocation changes

---

# Required Architecture

```text
portfolio-ai/
│
├── frontend/
│
├── backend/
│   └── modules/
│       └── paper-trading/
│
├── analytics/
│
├── ai/
│
└── quant/
```

---

# Required Backend Module

```text
backend/
└── modules/
    └── paper-trading/
        ├── Controllers/
        ├── Services/
        ├── Jobs/
        ├── DTOs/
        ├── Actions/
        ├── Enums/
        ├── Exceptions/
        ├── Routes/
        └── Providers/
```

---

# Required Services

Create:

```text
PaperTradingService
PaperOrderService
PaperPositionService
PaperSnapshotService
AccountSwitcherService
ActiveAccountService
PaperPortfolioService
```

---

# Required Database Tables

Create migrations for:

```text
trading_accounts
active_user_accounts
paper_orders
paper_deals
paper_positions
paper_snapshots
paper_snapshot_holdings
paper_cash_balances
```

---

# Database Design

## trading_accounts

```text
id
user_id
broker_connection_id
account_name
account_type
mode
currency
is_active
metadata
created_at
updated_at
```

---

## active_user_accounts

```text
id
user_id
trading_account_id
last_selected_at
created_at
updated_at
```

---

## paper_orders

```text
id
user_id
trading_account_id
symbol
side
order_type
quantity
price
status
submitted_at
filled_at
metadata
created_at
updated_at
```

---

## paper_deals

```text
id
user_id
paper_order_id
symbol
side
quantity
price
fee
executed_at
metadata
created_at
updated_at
```

---

## paper_positions

```text
id
user_id
trading_account_id
symbol
quantity
average_cost
market_value
unrealized_pnl
realized_pnl
currency
metadata
created_at
updated_at
```

---

## paper_snapshots

```text
id
user_id
trading_account_id
snapshot_date
total_value
cash_value
market_value
daily_pnl
unrealized_pnl
realized_pnl
currency
metadata
created_at
updated_at
```

---

# Required API Endpoints

```text
GET    /api/accounts
POST   /api/accounts/switch
GET    /api/accounts/active

GET    /api/paper-trading/dashboard
GET    /api/paper-trading/positions
GET    /api/paper-trading/orders
GET    /api/paper-trading/deals

POST   /api/paper-trading/buy
POST   /api/paper-trading/sell

GET    /api/paper-trading/snapshots
```

---

# Account Switching Logic

When user selects account:

```text
Set Active Account
    ↓
Store active account in DB/session
    ↓
Reload dashboard data
    ↓
Load:
- holdings
- transactions
- snapshots
- AI insights
```

---

# Dashboard Behavior

## Real Account

```text
READ ONLY MODE
```

Display:

- Holdings
- Transactions
- Portfolio metrics
- AI insights

Disable:

- Buy
- Sell
- Trade execution

---

## Paper Account

```text
SANDBOX MODE
```

Enable:

- Simulated buy/sell
- Paper positions
- Paper PnL
- Sandbox snapshots

---

# Required Frontend Pages

```text
/accounts
/accounts/switcher

/paper-trading
/paper-trading/dashboard
/paper-trading/positions
/paper-trading/orders
/paper-trading/history
```

---

# Required Frontend Components

Create reusable components:

```text
AccountSwitcherDropdown
ActiveAccountBadge
PaperTradingPanel
PaperOrderForm
PaperPositionsTable
PaperOrdersTable
PaperPnLChart
PaperSnapshotChart
SandboxModeBadge
```

---

# Required UI Rules

The application should feel:

```text
Professional
Institutional
Modern SaaS
AI-native
Clean finance dashboard
```

Inspired by:

- Ghostfolio
- FinceptTerminal
- Bloomberg terminal concepts

---

# Required Account Selector

The account selector should:

- Show all accounts
- Show account type
- Show account mode
- Show active account
- Switch instantly

Example:

```text
[ Real Account ]
[ Paper Trading ]
[ Sandbox Account ]
```

---

# Required Dashboard Header

Always display:

```text
Current Active Account
Account Mode
Broker Name
```

Example:

```text
Moomoo Paper Account
Mode: Sandbox
```

---

# Required Trading Rules

## Real Accounts

```text
No trade execution
No buy/sell
No AI execution
```

---

## Paper Accounts

```text
Simulated trading only
```

Orders should:

- Update positions
- Update cash balance
- Generate paper deals
- Generate snapshots

---

# Snapshot Flow

```text
Paper Order Filled
        ↓
Update Positions
        ↓
Update Cash Balance
        ↓
Generate Snapshot
        ↓
Queue Analytics
        ↓
Update AI Context
```

---

# AI Integration

Paper trading must integrate with:

- AI portfolio analysis
- Risk analysis
- Allocation analysis
- Strategy commentary

Example:

```text
Your paper portfolio is overweight technology.
Volatility increased after adding TSLA.
```

---

# Required Queue Jobs

Create:

```text
GeneratePaperSnapshotJob
UpdatePaperPortfolioJob
ProcessPaperOrderJob
RefreshPaperAnalyticsJob
```

Use:

- Redis queues
- retry support
- logging
- background processing

---

# Security Rules

## Never Allow

- Real money execution
- Real account order placement
- Auto trading
- AI auto execution

---

# Environment Variables

```env
PAPER_TRADING_ENABLED=true
REAL_TRADING_ENABLED=false
SANDBOX_MODE=true
```

---

# Future-Ready Architecture

Phase 2B must support future:

```text
Multi-broker support
AI strategy simulation
Riskfolio optimization
Future backtesting
Future quant layer
```

---

# Acceptance Criteria

Phase 2B is complete when:

- User can create paper accounts
- User can switch active account
- Dashboard changes based on active account
- User can simulate buy/sell
- Paper positions update correctly
- Paper PnL updates correctly
- Snapshots generate automatically
- AI insights update based on paper portfolio
- Real accounts remain read-only

---

# Final Architecture Reminder

```text
Real Account
    ↓
Read-only analytics

Paper Account
    ↓
Sandbox trading simulation
    ↓
AI analysis
```

Phase 2B focuses on:

```text
safe trading simulation
+ multi-account dashboard architecture
```
