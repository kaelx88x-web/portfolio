# Option Alert System — Redis + BullMQ Design Spec

**Date:** 2026-05-23  
**Feature:** Option Alert System with Redis cache + BullMQ async processing  
**Status:** Approved for implementation

---

## Overview

Build an option alert system that:
1. Fetches live option positions from moomoo broker
2. Scans positions for actionable alerts (expiry, profit targets, assignment risk)
3. Processes alerts asynchronously via BullMQ
4. Caches current alert state in Redis
5. Persists alert history to SQLite via Prisma

This is the foundation layer that the Daily Briefing AI will consume later.

---

## Why Redis + BullMQ

- **Redis** — fast in-memory cache for current option state and active alerts. Avoids hitting moomoo API on every page load.
- **BullMQ** — async job processing for scanning and alert generation. Built on Redis (one stack). Handles retries, scheduling, and job concurrency cleanly.
- **SQLite (Prisma)** — persistent history of alerts for trend tracking and audit.

---

## Architecture

```
[Trigger: moomoo sync OR scheduled 15min OR manual UI button]
          ↓
  BullMQ: options-scan queue
          ↓
  OptionScannerWorker
    → fetches holdings from moomoo bridge
    → filters option positions (covered calls, short puts, etc.)
    → detects alerts per position
    → for each alert → enqueue: alerts queue
    → cache current positions in Redis (TTL 15 min)
          ↓
  BullMQ: alerts queue
          ↓
  AlertProcessorWorker
    → stores alert in Redis (active alerts hash)
    → persists to SQLite via Prisma
    → marks alert severity: urgent | profitable | info
          ↓
  SvelteKit API endpoints
    → read active alerts from Redis (fast)
    → read alert history from SQLite
```

---

## Alert Detection Rules

| Condition | Severity | Message |
|---|---|---|
| DTE ≤ 3 days | `urgent` | Expiry imminent — roll or let expire |
| DTE ≤ 7 days | `info` | Expiry approaching — review position |
| Current price within 2% of strike (short) | `urgent` | Assignment risk — near strike |
| Current price > strike (covered call) | `urgent` | Assignment likely — stock may be called away |
| Profit ≥ 80% of max premium | `profitable` | 80% profit hit — consider early close |
| Profit ≥ 70% of max premium | `profitable` | 70% profit — early close opportunity |
| Profit ≥ 50% of max premium | `info` | 50% profit — monitor for early close |
| Strike < cost basis (covered call) | `urgent` | Strike below cost basis — roll up to protect |

---

## Queue Design

### Queue 1: `options-scan`

**Job:** `ScanOptionsJob`
```ts
type ScanOptionsJob = {
  userId: string;
  triggeredBy: 'schedule' | 'moomoo-sync' | 'manual';
};
```
- **Repeatable:** every 15 minutes (BullMQ repeat)
- **Also triggered:** on moomoo sync completion, on manual UI button
- **Concurrency:** 1 (no parallel scans for same user)

### Queue 2: `option-alerts`

**Job:** `ProcessAlertJob`
```ts
type ProcessAlertJob = {
  userId: string;
  alert: OptionAlert;
};
```
- **Concurrency:** 5
- **Retry:** 3 attempts with exponential backoff

---

## Data Types

```ts
type OptionType = 'covered_call' | 'cash_secured_put' | 'long_call' | 'long_put';
type AlertSeverity = 'urgent' | 'profitable' | 'info';

type OptionPosition = {
  symbol: string;
  name: string;
  optionType: OptionType;
  strike: number;
  expiry: string;          // ISO date
  dte: number;             // days to expiry
  quantity: number;
  premiumCollected: number;
  currentValue: number;
  unrealizedPnl: number;
  profitPct: number;       // % of max profit captured
  currentPrice: number;    // underlying price
  costBasis?: number;      // for covered calls
};

type OptionAlert = {
  id: string;              // generated uuid
  userId: string;
  symbol: string;
  optionType: OptionType;
  severity: AlertSeverity;
  message: string;
  recommendation: string;
  position: OptionPosition;
  detectedAt: string;      // ISO timestamp
  acknowledged: boolean;
};
```

---

## Redis Key Design

```
option:positions:{userId}          → JSON array of OptionPosition[]  TTL: 15min
option:alerts:active:{userId}      → JSON array of OptionAlert[]     TTL: 1hr
option:scan:last:{userId}          → ISO timestamp of last scan       TTL: 24hr
```

---

## Prisma Schema Addition

```prisma
model OptionAlert {
  id             String   @id @default(cuid())
  userId         String
  symbol         String
  optionType     String
  severity       String
  message        String
  recommendation String
  positionJson   String   // JSON snapshot of OptionPosition
  detectedAt     DateTime @default(now())
  acknowledged   Boolean  @default(false)
  acknowledgedAt DateTime?
  createdAt      DateTime @default(now())

  @@index([userId, detectedAt])
  @@index([userId, acknowledged])
}
```

---

## New Files

| File | Purpose |
|---|---|
| `src/lib/server/redis.ts` | ioredis singleton client |
| `src/lib/server/queues.ts` | BullMQ Queue + QueueScheduler definitions |
| `src/lib/services/option-scanner.service.ts` | Alert detection logic (pure functions, no side effects) |
| `workers/option-scanner.worker.ts` | BullMQ Worker — processes `options-scan` jobs |
| `workers/alert-processor.worker.ts` | BullMQ Worker — processes `option-alerts` jobs |
| `workers/index.ts` | Entry point — starts both workers |
| `src/routes/api/options/alerts/+server.ts` | GET active alerts from Redis |
| `src/routes/api/options/scan/+server.ts` | POST — trigger manual scan |
| `src/routes/api/options/history/+server.ts` | GET alert history from SQLite |

---

## Modified Files

| File | Change |
|---|---|
| `package.json` | Add `ioredis`, `bullmq` deps. Add `"workers": "tsx workers/index.ts"` script. Add `"dev:all": "concurrently 'npm run dev' 'npm run workers'"` |
| `prisma/schema.prisma` | Add `OptionAlert` model |
| `src/routes/broker/+page.server.ts` | After successful moomoo sync → enqueue `ScanOptionsJob` |
| `.env.example` | Add `REDIS_URL=redis://localhost:6379` |

---

## Environment

```env
REDIS_URL=redis://localhost:6379
```

Redis runs locally (standard port). No Docker required for development — just `redis-server` or Windows Redis.

---

## Worker Process

Workers run as a **separate Node.js process** alongside the SvelteKit dev server:

```bash
# Terminal 1
npm run dev

# Terminal 2  
npm run workers

# Or combined:
npm run dev:all
```

Workers connect to Redis via `REDIS_URL`, consume jobs from queues, process alerts, write back to Redis + Prisma.

---

## Error Handling

- **moomoo not connected** — `ScanOptionsJob` catches fetch error, logs, does not throw (job completes without alerts)
- **Redis down** — worker catches connection error, falls back to direct Prisma write, logs warning
- **Malformed position data** — alert detection skips invalid positions, continues with valid ones
- **Job failure** — BullMQ retries 3× with exponential backoff; failed jobs move to dead-letter queue for inspection

---

## API Endpoints

### `GET /api/options/alerts`
Returns active alerts from Redis for current user.
```json
{
  "alerts": OptionAlert[],
  "lastScan": "2026-05-23T10:32:00Z",
  "count": { "urgent": 1, "profitable": 1, "info": 0 }
}
```

### `POST /api/options/scan`
Triggers immediate manual scan. Enqueues `ScanOptionsJob` with `triggeredBy: 'manual'`.
```json
{ "queued": true, "jobId": "abc123" }
```

### `GET /api/options/history`
Returns alert history from SQLite. Supports `?limit=20&acknowledged=false`.

---

## Out of Scope

- Option position entry / trade execution
- Multi-broker support (moomoo only for now)
- Alert push notifications (Phase 2)
- Alert acknowledgement UI (Phase 2)
- Wheel strategy tracking (separate feature)
