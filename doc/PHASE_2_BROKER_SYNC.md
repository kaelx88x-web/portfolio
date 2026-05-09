# Phase 2 — Broker Synchronization

> Portfolio AI SaaS · Engineering Plan · docs/PHASE_2_BROKER_SYNC.md

---

## Objective

Build a robust, modular **Broker Synchronization Layer** that connects the Portfolio Core Engine (Phase 1) to external data sources — Moomoo integration, CSV import, and automated portfolio snapshots.

---

## Scope

| Feature | Priority | Status |
|---|---|---|
| Moomoo Integration | High | Planned |
| CSV Import | High | Planned |
| Manual Entry Improvement | Medium | Planned |
| Portfolio Snapshots | High | Planned |
| Sync Job Queue | High | Planned |
| Broker Auth Management | High | Planned |

---

## Architecture

```text
[Broker Data Sources]
        │
        ▼
[Broker Adapter Layer]         ← Modular per-broker adapter
        │
        ▼
[Sync Service]                 ← Normalization + deduplication
        │
        ▼
[Queue Worker]                 ← Laravel Queue + Redis
        │
        ▼
[Portfolio Core Engine]        ← Holdings, Transactions, Cost Basis
        │
        ▼
[Snapshot Engine]              ← Historical portfolio state
        │
        ▼
[SvelteKit Frontend]           ← Sync status, import UI
```

---

## Module Breakdown

### 1. Broker Adapter Layer

**Location:** `backend/laravel-api/app/Modules/Brokers/`

```text
Modules/
└── Brokers/
    ├── Contracts/
    │   └── BrokerAdapterInterface.php
    ├── Adapters/
    │   ├── MoomooAdapter.php
    │   └── CsvAdapter.php
    ├── DTOs/
    │   ├── BrokerHoldingDTO.php
    │   └── BrokerTransactionDTO.php
    └── BrokerAdapterFactory.php
```

```php
interface BrokerAdapterInterface
{
    public function authenticate(array $credentials): bool;
    public function fetchHoldings(): Collection;
    public function fetchTransactions(Carbon $from, Carbon $to): Collection;
    public function fetchAccountInfo(): array;
}
```

---

### 2. Moomoo Integration

**Location:** `backend/laravel-api/app/Modules/Brokers/Adapters/MoomooAdapter.php`

- Uses Moomoo OpenAPI (futu-api / OpenD gateway)
- OAuth token stored encrypted in DB
- Maps Moomoo positions → `BrokerHoldingDTO`
- Maps Moomoo orders → `BrokerTransactionDTO`

**Key Queue Jobs:**

| Job | Description |
|---|---|
| `SyncMoomooHoldingsJob` | Pull latest positions |
| `SyncMoomooTransactionsJob` | Pull transaction history |
| `RefreshMoomooTokenJob` | Silent token refresh |

**Database Tables:**

```sql
-- broker_connections
id
user_id
broker          ENUM('moomoo', 'webull', 'csv', 'manual')
credentials     TEXT        -- encrypted JSON (AES-256)
last_synced_at  TIMESTAMP
status          ENUM('active', 'error', 'pending')
created_at
updated_at

-- broker_sync_logs
id
broker_connection_id  FK
sync_type             ENUM('holdings', 'transactions', 'snapshot')
status                ENUM('success', 'failed', 'partial')
records_imported      INT
error_message         TEXT NULL
created_at
```

---

### 3. CSV Import

**Location:** `backend/laravel-api/app/Modules/Brokers/Adapters/CsvAdapter.php`

**Supported Schemas:**

| Schema | Source |
|---|---|
| Moomoo Export | Moomoo desktop CSV export |
| Generic OHLCV | Standard brokerage format |
| Custom Mapped | User-defined column mapping |

**Import Flow:**

```text
Upload CSV → Detect schema → Preview + validate
      → User confirms → ProcessCsvImportJob (queue)
      → Normalize → Deduplicate → Insert
      → TakePortfolioSnapshotJob
```

---

### 4. Sync Service

**Location:** `backend/laravel-api/app/Services/BrokerSyncService.php`

```php
class BrokerSyncService
{
    public function syncHoldings(BrokerConnection $connection): void;
    public function syncTransactions(BrokerConnection $connection, Carbon $from, Carbon $to): void;
    public function triggerFullSync(BrokerConnection $connection): void;
}
```

---

### 5. Portfolio Snapshot Engine

**Location:** `backend/laravel-api/app/Services/SnapshotService.php`

Point-in-time portfolio state. Required by Phase 3 Analytics for historical performance.

```json
{
  "snapshot_date": "2025-05-01",
  "total_value": 125400.00,
  "cash_balance": 3200.00,
  "holdings_count": 12,
  "holdings": [
    {
      "ticker": "AAPL",
      "quantity": 50,
      "avg_cost": 172.30,
      "current_price": 189.50,
      "market_value": 9475.00,
      "unrealized_pnl": 860.00
    }
  ],
  "allocation": { "equities": 0.74, "cash": 0.026, "etf": 0.21 }
}
```

```sql
-- portfolio_snapshots
id
user_id          FK
snapshot_date    DATE
total_value      DECIMAL(15,2)
cash_balance     DECIMAL(15,2)
holdings_json    JSONB
allocation_json  JSONB
created_at
updated_at
```

---

### 6. Queue Workers

| Job | Queue | Description |
|---|---|---|
| `SyncMoomooHoldingsJob` | `broker-sync` | Pull positions from Moomoo |
| `SyncMoomooTransactionsJob` | `broker-sync` | Pull transaction history |
| `ProcessCsvImportJob` | `csv-import` | Process uploaded CSV |
| `TakePortfolioSnapshotJob` | `snapshots` | Record portfolio state |
| `RefreshBrokerTokenJob` | `tokens` | Silent token refresh |

```php
// config/queue.php
'broker-sync' => ['driver' => 'redis', 'retry_after' => 120],
'csv-import'  => ['driver' => 'redis', 'retry_after' => 300],
'snapshots'   => ['driver' => 'redis', 'retry_after' => 60],
```

---

### 7. API Endpoints

**Prefix:** `/api/v1`

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/broker/connections` | List broker connections |
| `POST` | `/broker/connections` | Add new connection |
| `DELETE` | `/broker/connections/{id}` | Remove connection |
| `POST` | `/broker/connections/{id}/sync` | Trigger manual sync |
| `GET` | `/broker/connections/{id}/logs` | Sync history logs |
| `POST` | `/broker/csv/preview` | Preview CSV before import |
| `POST` | `/broker/csv/import` | Process CSV import |
| `GET` | `/portfolio/snapshots` | List snapshots |
| `GET` | `/portfolio/snapshots/{date}` | Get snapshot by date |

All endpoints: `auth:sanctum` + ownership check.

---

### 8. Frontend Components

**Location:** `frontend/sveltekit-app/src/lib/components/broker/`

```text
broker/
├── BrokerConnectionCard.svelte
├── BrokerConnectionList.svelte
├── AddBrokerModal.svelte
├── SyncStatusBadge.svelte
├── CsvImportWizard.svelte
├── CsvPreviewTable.svelte
└── SyncHistoryTable.svelte
```

**Routes:**

```text
routes/(app)/
├── broker/+page.svelte
└── broker/import/+page.svelte
```

---

## Security Requirements

- Credentials encrypted at rest via Laravel `encrypt()` (AES-256-CBC)
- Token refresh runs silently in background queue
- CSV temp files deleted immediately after job completes
- Rate limit: max 1 manual sync per 5 min per connection

---

## Error Handling

| Error | Behaviour |
|---|---|
| Broker API timeout | Retry 3× with exponential backoff |
| Invalid credentials | Mark `error`, notify user |
| CSV parse failure | Return row-level error list |
| Partial sync | Log as `partial`, alert user |
| Broker rate limit | Queue retry after cooldown |

---

## Deliverables Checklist

- [ ] `BrokerAdapterInterface` contract
- [ ] `MoomooAdapter` implementation
- [ ] `CsvAdapter` with multi-schema + auto-detection
- [ ] `BrokerAdapterFactory`
- [ ] `BrokerHoldingDTO` + `BrokerTransactionDTO`
- [ ] `BrokerSyncService`
- [ ] `SnapshotService`
- [ ] 5 Laravel Queue jobs
- [ ] 3 database migrations
- [ ] 9 REST API endpoints
- [ ] 7 SvelteKit components
- [ ] Multi-step CSV Import Wizard
- [ ] Sync status polling / WebSocket
- [ ] Sync history log viewer
- [ ] Error handling + retry logic
- [ ] Unit tests for adapters + sync service

---

## Phase 1 Dependencies

| Component | Required For |
|---|---|
| `Holdings` model | Sync write target |
| `Transactions` model | Sync write target |
| `Accounts` model | Broker connection parent |
| `Portfolio` model | Snapshot parent |
| Auth (Sanctum) | Security layer |

---

## Next Phase Preview

> **Phase 3 — Analytics Engine**
> FinanceToolkit · Sharpe · Sortino · Beta · Alpha · Drawdown · CAGR · Volatility · Benchmark comparison · Sector analysis

---

*Portfolio AI SaaS · docs/ · Phase 2: Broker Synchronization*