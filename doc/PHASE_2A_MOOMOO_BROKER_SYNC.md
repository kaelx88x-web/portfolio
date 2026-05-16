# Phase 2A — Moomoo Broker Sync

> Portfolio AI SaaS  
> Broker Synchronization Layer for Moomoo OpenAPI / OpenD  
> Mode: Read-Only First

---

# Purpose

Phase 2A adds a dedicated broker synchronization layer for Moomoo.

This phase connects Portfolio AI SaaS to Moomoo OpenAPI / OpenD so the system can read:

- Accounts
- Cash / funds
- Positions
- Orders
- Deals / executed trades
- Historical trade activity

The goal is to sync broker data into the Portfolio Core Engine.

---

# Important Rule

This phase is **READ-ONLY**.

Do not build:

- Auto trading
- Buy / sell execution
- AI auto order placement
- Trade bot
- Autonomous execution
- One-click trading

Trade execution must stay disabled by default.

---

# Architecture Position

```text
[SvelteKit Frontend]
        ↓
[Laravel API Gateway]
        ↓
[Moomoo Broker Sync Module]
        ↓
[Portfolio Core Engine]
        ↓
[Portfolio Snapshots]
        ↓
[Analytics Engine]
        ↓
[AI Context Builder]
```

---

# Main Data Flow

```text
Moomoo OpenD
    ↓
Moomoo Broker Sync Service
    ↓
Broker Accounts
    ↓
Positions / Deals / Orders / Cash
    ↓
Transactions
    ↓
Holdings
    ↓
Portfolio Snapshots
    ↓
AI Portfolio Context
```

---

# Phase 2A Goals

## Main Goals

- Add Moomoo broker connection module
- Sync Moomoo account list
- Sync Moomoo positions
- Sync cash / funds
- Sync current orders
- Sync historical orders
- Sync executed deals
- Convert Moomoo deals into portfolio transactions
- Update holdings
- Generate portfolio snapshots

---

# Moomoo API Scope

## Use These Read APIs

```text
get_acc_list
accinfo_query
position_list_query
order_list_query
history_order_list_query
deal_list_query
history_deal_list_query
order_fee_query
```

---

## Do Not Use In This Phase

```text
place_order
modify_order
cancel_order
unlock_trade
```

---

# Required Backend Module

Create this structure:

```text
backend/
└── modules/
    └── brokers/
        └── moomoo/
            ├── Controllers/
            │   └── MoomooBrokerController.php
            ├── Services/
            │   ├── MoomooConnectionService.php
            │   ├── MoomooAccountService.php
            │   ├── MoomooPositionService.php
            │   ├── MoomooOrderService.php
            │   ├── MoomooDealService.php
            │   ├── MoomooSyncService.php
            │   └── MoomooSnapshotService.php
            ├── Jobs/
            │   ├── SyncMoomooAccountsJob.php
            │   ├── SyncMoomooPositionsJob.php
            │   ├── SyncMoomooOrdersJob.php
            │   ├── SyncMoomooDealsJob.php
            │   └── GenerateMoomooSnapshotJob.php
            ├── DTOs/
            │   ├── MoomooAccountDTO.php
            │   ├── MoomooPositionDTO.php
            │   ├── MoomooOrderDTO.php
            │   └── MoomooDealDTO.php
            ├── Enums/
            │   ├── BrokerProvider.php
            │   ├── BrokerSyncStatus.php
            │   └── BrokerAccountType.php
            ├── Exceptions/
            │   └── MoomooSyncException.php
            ├── Routes/
            │   └── api.php
            └── Providers/
                └── MoomooBrokerServiceProvider.php
```

---

# Required Database Tables

Create migrations for:

```text
broker_connections
broker_accounts
broker_positions
broker_orders
broker_deals
portfolio_snapshots
portfolio_snapshot_holdings
broker_sync_logs
```

---

# Database Design

## broker_connections

```text
id
user_id
broker
status
environment
host
port
sync_enabled
last_synced_at
metadata
created_at
updated_at
```

---

## broker_accounts

```text
id
user_id
broker_connection_id
broker_account_id
account_name
account_type
currency
cash_balance
net_liquidation_value
buying_power
status
metadata
last_synced_at
created_at
updated_at
```

---

## broker_positions

```text
id
user_id
broker_account_id
symbol
name
market
currency
quantity
average_cost
last_price
market_value
unrealized_pnl
realized_pnl
metadata
last_synced_at
created_at
updated_at
```

---

## broker_orders

```text
id
user_id
broker_account_id
broker_order_id
symbol
side
order_type
status
quantity
filled_quantity
price
average_filled_price
currency
submitted_at
updated_broker_at
metadata
created_at
updated_at
```

---

## broker_deals

```text
id
user_id
broker_account_id
broker_order_id
broker_deal_id
symbol
side
quantity
price
fee
currency
executed_at
metadata
created_at
updated_at
```

---

## portfolio_snapshots

```text
id
user_id
broker_account_id
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

## portfolio_snapshot_holdings

```text
id
portfolio_snapshot_id
symbol
quantity
average_cost
last_price
market_value
allocation_percentage
unrealized_pnl
currency
metadata
created_at
updated_at
```

---

## broker_sync_logs

```text
id
user_id
broker_connection_id
sync_type
status
started_at
finished_at
message
error_message
metadata
created_at
updated_at
```

---

# Required Laravel Models

Create models:

```text
BrokerConnection
BrokerAccount
BrokerPosition
BrokerOrder
BrokerDeal
PortfolioSnapshot
PortfolioSnapshotHolding
BrokerSyncLog
```

---

# Required API Endpoints

```text
GET    /api/brokers
POST   /api/brokers/moomoo/connect
POST   /api/brokers/moomoo/disconnect
GET    /api/brokers/moomoo/accounts
GET    /api/brokers/moomoo/positions
GET    /api/brokers/moomoo/orders
GET    /api/brokers/moomoo/deals
POST   /api/brokers/moomoo/sync
GET    /api/brokers/moomoo/sync-logs
GET    /api/portfolio/snapshots
```

---

# Sync Flow

## Full Sync

```text
User clicks Sync Moomoo
        ↓
SyncMoomooAccountsJob
        ↓
SyncMoomooPositionsJob
        ↓
SyncMoomooOrdersJob
        ↓
SyncMoomooDealsJob
        ↓
Convert deals to transactions
        ↓
Update holdings
        ↓
Generate portfolio snapshot
        ↓
Trigger analytics queue
```

---

# Job Queue Rules

Use Redis queue.

Each sync job must support:

- Retry
- Timeout
- Failure logging
- Sync status update
- Safe re-run
- Idempotent update

---

# Idempotency Rules

Broker sync must not duplicate records.

Use unique broker keys:

```text
broker_account_id
broker_order_id
broker_deal_id
```

When syncing:

```text
if exists → update
if missing → create
```

---

# Security Rules

## Never Store

- Trading password
- Plain API secret
- Trading unlock password
- Sensitive credentials in logs

---

## Do Not Implement Yet

- Trade execution
- Order placement
- Auto trading
- AI execution
- Trade unlock

---

# Frontend Pages

Create SvelteKit pages:

```text
/brokers
/brokers/moomoo
/portfolio
/portfolio/holdings
/portfolio/transactions
/portfolio/snapshots
```

---

# Frontend Components

Create reusable components:

```text
BrokerConnectionCard
BrokerStatusBadge
SyncStatusIndicator
MoomooAccountCard
PortfolioSummaryCard
HoldingsTable
OrdersTable
DealsTable
SnapshotChart
SyncLogTable
```

---

# UI Requirements

The UI must feel:

```text
Modern SaaS
Clean finance dashboard
Institutional
AI-native
Professional
```

Inspired by:

- Ghostfolio
- Maybe Finance
- FinceptTerminal

---

# Moomoo Broker Page

The page `/brokers/moomoo` should show:

- Connection status
- OpenD host and port
- Account list
- Last sync time
- Sync button
- Sync logs
- Read-only mode badge

---

# Portfolio Holdings Page

The page `/portfolio/holdings` should show:

- Symbol
- Quantity
- Average cost
- Last price
- Market value
- Unrealized PnL
- Allocation percentage

---

# Portfolio Snapshot Page

The page `/portfolio/snapshots` should show:

- Total portfolio value
- Cash value
- Market value
- Daily PnL
- Historical value chart
- Allocation chart

---

# Read-Only Mode Badge

Always show:

```text
Moomoo Sync Mode: Read-Only
```

This prevents confusion with trade execution.

---

# Environment Variables

Add:

```env
MOOMOO_OPEND_HOST=127.0.0.1
MOOMOO_OPEND_PORT=11111
MOOMOO_ENV=paper
MOOMOO_READ_ONLY=true
```

---

# Config File

Create:

```text
config/brokers.php
```

Example:

```php
return [
    'moomoo' => [
        'host' => env('MOOMOO_OPEND_HOST', '127.0.0.1'),
        'port' => env('MOOMOO_OPEND_PORT', 11111),
        'environment' => env('MOOMOO_ENV', 'paper'),
        'read_only' => env('MOOMOO_READ_ONLY', true),
    ],
];
```

---

# Important Engineering Rules

## Do

- Keep broker logic inside broker module
- Keep portfolio logic inside portfolio core
- Use queue jobs for sync
- Use DTOs for external API data
- Use services, not controller-heavy logic
- Log all sync attempts
- Make sync safe to retry
- Keep architecture multi-broker ready

---

## Do Not

- Hardcode Moomoo directly into portfolio core
- Put API calls inside controllers
- Put broker logic in frontend
- Add trade execution
- Add AI auto trading
- Store sensitive credentials
- Duplicate transactions during sync

---

# Future-Ready Design

This phase must support future brokers:

```text
Moomoo
Webull
Alpaca
Interactive Brokers
CSV
Manual Import
```

Use generic broker tables where possible.

Avoid naming every table `moomoo_*`.

Use:

```text
broker_connections
broker_accounts
broker_positions
broker_orders
broker_deals
```

not:

```text
moomoo_accounts
moomoo_positions
```

---

# Acceptance Criteria

Phase 2A is complete when:

- User can create Moomoo broker connection
- System can sync Moomoo accounts
- System can sync Moomoo positions
- System can sync orders
- System can sync deals
- Deals can become transactions
- Holdings are updated
- Portfolio snapshot is generated
- Sync logs are visible
- Read-only mode is enforced
- No trade execution exists

---

# Final Architecture Reminder

```text
Moomoo OpenD
    ↓
Broker Sync Module
    ↓
Portfolio Core
    ↓
Snapshots
    ↓
Analytics
    ↓
AI Context
    ↓
AI Copilot
```

Phase 2A must strengthen broker synchronization only.

Do not expand into trading automation yet.
