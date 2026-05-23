# Option Alert System — Redis + BullMQ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an async option alert system that scans option positions after every moomoo sync, detects actionable alerts (expiry, profit targets, assignment risk), caches results in Redis, and persists history to MySQL via Prisma.

**Architecture:** BullMQ workers run as a separate Node.js process (`npm run workers`) alongside the SvelteKit dev server. The moomoo sync action enqueues a `ScanOptionsJob` after every successful sync. Workers read from the existing `OptionsPosition` DB table (falling back to live moomoo holdings), apply alert rules, store active alerts in Redis, and persist to a new `OptionAlert` MySQL table. Three API endpoints expose alerts and history to the UI.

**Tech Stack:** `bullmq`, `ioredis`, `dotenv`, `concurrently` · MySQL via Prisma · SvelteKit server routes · tsx for workers

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `package.json` | modify | add deps + worker scripts |
| `.env.example` | modify | add `REDIS_URL` |
| `src/lib/server/redis.ts` | create | ioredis singleton for SvelteKit server routes |
| `src/lib/server/queues.ts` | create | BullMQ queue names, job types, queue factories |
| `src/lib/services/option-scanner.service.ts` | create | pure alert detection logic |
| `prisma/schema.prisma` | modify | add `OptionAlert` model + User relation |
| `workers/connection.ts` | create | Redis connection options for workers (uses process.env) |
| `workers/option-scanner.worker.ts` | create | BullMQ Worker — processes scan jobs |
| `workers/alert-processor.worker.ts` | create | BullMQ Worker — stores alerts |
| `workers/index.ts` | create | entry point — starts both workers |
| `src/routes/api/options/alerts/+server.ts` | create | GET active alerts from Redis |
| `src/routes/api/options/scan/+server.ts` | create | POST trigger manual scan |
| `src/routes/api/options/history/+server.ts` | create | GET alert history from MySQL |
| `src/routes/broker/+page.server.ts` | modify | enqueue scan after successful moomoo sync |

---

## Task 1: Install Dependencies and Add Scripts

**Files:** `package.json`, `.env.example`

- [ ] **Step 1: Install packages**

```bash
cd c:/Ampps/www/portfolio
npm install bullmq ioredis dotenv concurrently
```

Expected output: packages added, no peer dependency errors.

- [ ] **Step 2: Add scripts to package.json**

Open `package.json` and update the `scripts` section:

```json
{
  "scripts": {
    "dev": "vite --host 127.0.0.1",
    "build": "vite build",
    "preview": "vite preview --host 127.0.0.1",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "db:push": "prisma db push",
    "db:init": "php scripts/init-sqlite.php && prisma generate",
    "db:seed": "tsx prisma/seed.ts",
    "db:studio": "prisma studio",
    "workers": "tsx workers/index.ts",
    "dev:all": "concurrently \"npm run dev\" \"npm run workers\""
  }
}
```

- [ ] **Step 3: Add REDIS_URL to .env.example**

Add this line to `.env.example`:

```
REDIS_URL=redis://localhost:6379
```

Also add to your local `.env`:

```
REDIS_URL=redis://localhost:6379
```

- [ ] **Step 4: Verify Redis is running**

```bash
redis-cli ping
```

Expected: `PONG`

If Redis is not installed on Windows: download from [https://github.com/tporadowski/redis/releases](https://github.com/tporadowski/redis/releases) and run `redis-server`.

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json .env.example
git commit -m "chore: add bullmq, ioredis, dotenv, concurrently — option alert system deps"
```

---

## Task 2: Redis Client Singleton

**Files:** `src/lib/server/redis.ts`

- [ ] **Step 1: Create the Redis client**

```ts
// src/lib/server/redis.ts
import Redis from 'ioredis';

let _client: Redis | null = null;

export function getRedis(): Redis {
  if (!_client) {
    _client = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', {
      maxRetriesPerRequest: null, // required by BullMQ
      lazyConnect: false,
    });
    _client.on('error', (err) => {
      console.error('[Redis] connection error:', err.message);
    });
    _client.on('connect', () => {
      console.log('[Redis] connected');
    });
  }
  return _client;
}

export async function redisSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  const r = getRedis();
  if (ttlSeconds) {
    await r.setex(key, ttlSeconds, value);
  } else {
    await r.set(key, value);
  }
}

export async function redisGet(key: string): Promise<string | null> {
  return getRedis().get(key);
}

export async function redisDel(key: string): Promise<void> {
  await getRedis().del(key);
}
```

- [ ] **Step 2: Verify it imports cleanly**

```bash
cd c:/Ampps/www/portfolio
npx tsx -e "import('./src/lib/server/redis.ts').then(m => { const r = m.getRedis(); r.ping().then(v => { console.log('ping:', v); r.disconnect(); }); })"
```

Expected: `ping: PONG`

- [ ] **Step 3: Commit**

```bash
git add src/lib/server/redis.ts
git commit -m "feat: add ioredis singleton client"
```

---

## Task 3: BullMQ Queue Definitions and Job Types

**Files:** `src/lib/server/queues.ts`

- [ ] **Step 1: Create queue definitions**

```ts
// src/lib/server/queues.ts
import { Queue } from 'bullmq';
import type { ConnectionOptions } from 'bullmq';

// ─── Queue Names ────────────────────────────────────────────────────────────
export const QUEUE_OPTIONS_SCAN   = 'options-scan';
export const QUEUE_OPTION_ALERTS  = 'option-alerts';

// ─── Job Data Types ─────────────────────────────────────────────────────────
export type ScanOptionsJobData = {
  userId: string;
  triggeredBy: 'moomoo-sync' | 'schedule' | 'manual';
};

export type OptionType = 'covered_call' | 'cash_secured_put' | 'long_call' | 'long_put';
export type AlertSeverity = 'urgent' | 'profitable' | 'info';

export type OptionPosition = {
  symbol: string;
  name: string;
  optionType: OptionType;
  strike: number;
  expiry: string;       // ISO date string e.g. "2026-05-29"
  dte: number;          // days to expiry, ≥ 0
  quantity: number;
  premiumCollected: number;  // premium received per share (positive)
  currentValue: number;      // current option price per share
  unrealizedPnl: number;
  profitPct: number;    // % of max premium already captured, 0–100
  currentPrice: number; // underlying stock price
  costBasis?: number;   // avg cost of underlying shares (for covered calls)
};

export type OptionAlert = {
  id: string;
  userId: string;
  symbol: string;
  optionType: OptionType;
  severity: AlertSeverity;
  message: string;
  recommendation: string;
  position: OptionPosition;
  detectedAt: string;   // ISO timestamp
  acknowledged: boolean;
};

export type ProcessAlertJobData = {
  userId: string;
  alert: OptionAlert;
};

// ─── Connection Options ──────────────────────────────────────────────────────
export function getRedisConnectionOptions(): ConnectionOptions {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379'),
      password: parsed.password || undefined,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

// ─── Queue Factories ─────────────────────────────────────────────────────────
export function getOptionScanQueue(): Queue<ScanOptionsJobData> {
  return new Queue<ScanOptionsJobData>(QUEUE_OPTIONS_SCAN, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: {
      removeOnComplete: 50,
      removeOnFail: 20,
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
    },
  });
}

export function getOptionAlertsQueue(): Queue<ProcessAlertJobData> {
  return new Queue<ProcessAlertJobData>(QUEUE_OPTION_ALERTS, {
    connection: getRedisConnectionOptions(),
    defaultJobOptions: {
      removeOnComplete: 100,
      removeOnFail: 50,
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    },
  });
}

// ─── Redis Keys ──────────────────────────────────────────────────────────────
export const redisKey = {
  positions: (userId: string) => `option:positions:${userId}`,
  activeAlerts: (userId: string) => `option:alerts:active:${userId}`,
  lastScan: (userId: string) => `option:scan:last:${userId}`,
};

export const redisTTL = {
  positions: 900,    // 15 minutes
  activeAlerts: 3600, // 1 hour
  lastScan: 86400,   // 24 hours
};
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/server/queues.ts
git commit -m "feat: add BullMQ queue definitions and job types"
```

---

## Task 4: Option Scanner Service (Pure Alert Detection)

**Files:** `src/lib/services/option-scanner.service.ts`

- [ ] **Step 1: Create the service**

```ts
// src/lib/services/option-scanner.service.ts
import { randomUUID } from 'node:crypto';
import type { OptionAlert, OptionPosition, OptionType } from '$lib/server/queues';
import type { BrokerHolding } from '$lib/types/portfolio';

// ─── Alert Detection ─────────────────────────────────────────────────────────

export function detectAlerts(positions: OptionPosition[], userId: string): OptionAlert[] {
  const alerts: OptionAlert[] = [];
  const now = new Date().toISOString();

  for (const pos of positions) {
    // ── Expiry: urgent (≤ 3 days) ────────────────────────────────────────
    if (pos.dte <= 3) {
      alerts.push({
        id: randomUUID(),
        userId,
        symbol: pos.symbol,
        optionType: pos.optionType,
        severity: 'urgent',
        message: `${pos.symbol} expiring in ${pos.dte} day${pos.dte === 1 ? '' : 's'}`,
        recommendation: buildExpiryRecommendation(pos),
        position: pos,
        detectedAt: now,
        acknowledged: false,
      });
    }
    // ── Expiry: info (4–7 days) ───────────────────────────────────────────
    else if (pos.dte <= 7) {
      alerts.push({
        id: randomUUID(),
        userId,
        symbol: pos.symbol,
        optionType: pos.optionType,
        severity: 'info',
        message: `${pos.symbol} expiring in ${pos.dte} days — review soon`,
        recommendation: 'Monitor this position. Plan your action: roll, close, or let expire.',
        position: pos,
        detectedAt: now,
        acknowledged: false,
      });
    }

    // ── Assignment risk: covered call in-the-money ────────────────────────
    if (pos.optionType === 'covered_call' && pos.currentPrice > pos.strike && pos.dte <= 7) {
      alerts.push({
        id: randomUUID(),
        userId,
        symbol: pos.symbol,
        optionType: pos.optionType,
        severity: 'urgent',
        message: `${pos.symbol} covered call is in-the-money — assignment likely`,
        recommendation:
          'Stock may be called away at expiry. If you want to keep your shares, roll up or out. ' +
          'If you are happy selling at the strike price, let it be assigned.',
        position: pos,
        detectedAt: now,
        acknowledged: false,
      });
    }

    // ── Strike below cost basis (covered call) ────────────────────────────
    if (
      pos.optionType === 'covered_call' &&
      pos.costBasis !== undefined &&
      pos.strike < pos.costBasis
    ) {
      alerts.push({
        id: randomUUID(),
        userId,
        symbol: pos.symbol,
        optionType: pos.optionType,
        severity: 'urgent',
        message: `${pos.symbol} CC strike $${pos.strike} is below your cost basis $${pos.costBasis?.toFixed(2)}`,
        recommendation:
          'If assigned at this strike you will lock in a loss on your shares. ' +
          'Consider rolling up to a strike above your cost basis, or closing the covered call.',
        position: pos,
        detectedAt: now,
        acknowledged: false,
      });
    }

    // ── Profit targets ────────────────────────────────────────────────────
    if (pos.profitPct >= 80) {
      alerts.push({
        id: randomUUID(),
        userId,
        symbol: pos.symbol,
        optionType: pos.optionType,
        severity: 'profitable',
        message: `${pos.symbol} has captured ${pos.profitPct.toFixed(0)}% of max premium`,
        recommendation:
          'You have locked in most of the available profit. Closing now frees up capital ' +
          'and removes the remaining risk for a small additional gain. Strongly consider closing early.',
        position: pos,
        detectedAt: now,
        acknowledged: false,
      });
    } else if (pos.profitPct >= 70) {
      alerts.push({
        id: randomUUID(),
        userId,
        symbol: pos.symbol,
        optionType: pos.optionType,
        severity: 'profitable',
        message: `${pos.symbol} at ${pos.profitPct.toFixed(0)}% of max profit`,
        recommendation:
          'Good profit captured. You can close now for a solid gain, or hold for the remaining 30%. ' +
          'Closing reduces risk from unexpected price moves.',
        position: pos,
        detectedAt: now,
        acknowledged: false,
      });
    } else if (pos.profitPct >= 50) {
      alerts.push({
        id: randomUUID(),
        userId,
        symbol: pos.symbol,
        optionType: pos.optionType,
        severity: 'info',
        message: `${pos.symbol} at 50% of max profit — early close opportunity`,
        recommendation:
          'Many traders close at 50% profit to reduce risk and redeploy capital. ' +
          'Assess whether the remaining premium is worth the time and risk.',
        position: pos,
        detectedAt: now,
        acknowledged: false,
      });
    }
  }

  return alerts;
}

function buildExpiryRecommendation(pos: OptionPosition): string {
  if (pos.optionType === 'covered_call') {
    if (pos.currentPrice > pos.strike) {
      return (
        'Your covered call is in-the-money and expiring soon. ' +
        'If you want to keep your shares: roll out to a later date and higher strike. ' +
        'If you are OK with selling: let it expire and collect your premium.'
      );
    }
    return (
      'Your covered call is expiring out-of-the-money — you keep the premium. ' +
      'You can let it expire worthless and sell a new covered call next week.'
    );
  }
  if (pos.optionType === 'cash_secured_put') {
    if (pos.currentPrice < pos.strike) {
      return (
        'Your put is in-the-money and expiring soon — assignment likely. ' +
        'You will need to buy 100 shares at the strike price. ' +
        'If you want the shares: let it happen. If not: buy back the put now to avoid assignment.'
      );
    }
    return (
      'Your cash secured put is expiring out-of-the-money — you keep the premium. ' +
      'No action needed unless you want to roll to a new put.'
    );
  }
  return 'Position expiring soon. Review and decide: close, roll, or let expire.';
}

// ─── Parse moomoo holdings into OptionPosition ───────────────────────────────

export function parseOptionPositions(holdings: BrokerHolding[]): OptionPosition[] {
  return holdings
    .filter((h) => isOptionHolding(h))
    .map((h) => parseOptionPosition(h))
    .filter((p): p is OptionPosition => p !== null);
}

function isOptionHolding(h: BrokerHolding): boolean {
  const type = h.asset_type?.toLowerCase() ?? '';
  return (
    type.includes('option') ||
    type.includes('call') ||
    type.includes('put') ||
    isOptionSymbol(h.symbol)
  );
}

function isOptionSymbol(symbol: string): boolean {
  // Standard US option format: TICKER + YYMMDD + C/P + STRIKE_x1000
  return /^[A-Z]+\d{6}[CP]\d+$/.test(symbol);
}

function parseOptionPosition(h: BrokerHolding): OptionPosition | null {
  const match = h.symbol.match(/^([A-Z]+)(\d{6})([CP])(\d+)$/);
  if (!match) return null;

  const [, , dateStr, callPut, strikeStr] = match;
  const expiry = parseOptionDate(dateStr);
  const strike = parseInt(strikeStr) / 1000;
  const dte = Math.max(0, Math.ceil((new Date(expiry).getTime() - Date.now()) / 86_400_000));

  const isShort = h.quantity < 0;
  const optionType: OptionType =
    callPut === 'C'
      ? isShort ? 'covered_call' : 'long_call'
      : isShort ? 'cash_secured_put' : 'long_put';

  const premiumCollected = isShort ? Math.abs(h.average_cost) : 0;
  const currentValue = Math.abs(h.market_price);
  const profitPct =
    premiumCollected > 0
      ? Math.min(100, ((premiumCollected - currentValue) / premiumCollected) * 100)
      : 0;

  return {
    symbol: h.symbol,
    name: h.name,
    optionType,
    strike,
    expiry,
    dte,
    quantity: Math.abs(h.quantity),
    premiumCollected,
    currentValue,
    unrealizedPnl: h.unrealized_pl,
    profitPct: Math.max(0, profitPct),
    currentPrice: 0, // underlying price not available from option holding alone
  };
}

function parseOptionDate(dateStr: string): string {
  const year = 2000 + parseInt(dateStr.slice(0, 2));
  const month = dateStr.slice(2, 4);
  const day = dateStr.slice(4, 6);
  return `${year}-${month}-${day}`;
}

// ─── Convert DB OptionsPosition to OptionPosition ────────────────────────────

export function fromDbOptionsPosition(row: {
  symbol: string;
  optionType: string;
  strike: number;
  expirationDate: Date;
  contracts: number;
  premium: number;
  collateral: number;
  status: string;
  metadataJson: string;
}): OptionPosition {
  const expiry = row.expirationDate.toISOString().slice(0, 10);
  const dte = Math.max(0, Math.ceil((row.expirationDate.getTime() - Date.now()) / 86_400_000));

  let meta: Record<string, unknown> = {};
  try { meta = JSON.parse(row.metadataJson); } catch { /* ignore */ }

  const currentValue = typeof meta.currentValue === 'number' ? meta.currentValue : 0;
  const profitPct =
    row.premium > 0
      ? Math.min(100, Math.max(0, ((row.premium - currentValue) / row.premium) * 100))
      : 0;

  return {
    symbol: row.symbol,
    name: typeof meta.name === 'string' ? meta.name : row.symbol,
    optionType: row.optionType as OptionType,
    strike: row.strike,
    expiry,
    dte,
    quantity: row.contracts,
    premiumCollected: row.premium,
    currentValue,
    unrealizedPnl: typeof meta.unrealizedPnl === 'number' ? meta.unrealizedPnl : 0,
    profitPct,
    currentPrice: typeof meta.currentPrice === 'number' ? meta.currentPrice : 0,
    costBasis: typeof meta.costBasis === 'number' ? meta.costBasis : undefined,
  };
}
```

- [ ] **Step 2: Verify types are consistent**

Check: `OptionPosition`, `OptionAlert`, `OptionType`, `AlertSeverity` — all imported from `$lib/server/queues`. No redefinitions.

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/option-scanner.service.ts
git commit -m "feat: add option scanner service — alert detection and position parsing"
```

---

## Task 5: Prisma — Add OptionAlert Model

**Files:** `prisma/schema.prisma`

- [ ] **Step 1: Add `optionAlerts` to the User model**

In `prisma/schema.prisma`, find the `User` model and add one line in the relations block (after `optionsPositions`):

```prisma
  optionAlerts      OptionAlert[]
```

- [ ] **Step 2: Add the OptionAlert model at the end of the schema**

Append to `prisma/schema.prisma`:

```prisma
model OptionAlert {
  id             String    @id @default(cuid())
  userId         String    @map("user_id")
  user           User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  symbol         String    @db.VarChar(80)
  optionType     String    @map("option_type") @db.VarChar(30)
  severity       String    @db.VarChar(30)
  message        String    @db.Text
  recommendation String    @db.Text
  positionJson   String    @map("position_json") @db.LongText
  acknowledged   Boolean   @default(false)
  acknowledgedAt DateTime? @map("acknowledged_at")
  detectedAt     DateTime  @map("detected_at") @default(now())
  createdAt      DateTime  @default(now()) @map("created_at")
  updatedAt      DateTime  @updatedAt @map("updated_at")

  @@index([userId, detectedAt])
  @@index([userId, acknowledged])
  @@map("option_alerts")
}
```

- [ ] **Step 3: Push schema to database**

```bash
npm run db:push
```

Expected: `✔ Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Verify table created**

```bash
npx prisma studio
```

Check that `option_alerts` table appears in Prisma Studio.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add OptionAlert model to Prisma schema"
```

---

## Task 6: Worker — Connection Helper

**Files:** `workers/connection.ts`

Workers run outside SvelteKit and cannot use `$env/dynamic/private`. They load env via dotenv.

- [ ] **Step 1: Create workers directory and connection helper**

```ts
// workers/connection.ts
import 'dotenv/config';
import type { ConnectionOptions } from 'bullmq';

export function getConnectionOptions(): ConnectionOptions {
  const url = process.env.REDIS_URL ?? 'redis://localhost:6379';
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parseInt(parsed.port || '6379'),
      password: parsed.password || undefined,
      maxRetriesPerRequest: null,
    };
  } catch {
    return { host: 'localhost', port: 6379, maxRetriesPerRequest: null };
  }
}

export const MOOMOO_URL = process.env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';
```

- [ ] **Step 2: Commit**

```bash
git add workers/connection.ts
git commit -m "feat: add worker Redis connection helper"
```

---

## Task 7: Worker — Option Scanner

**Files:** `workers/option-scanner.worker.ts`

- [ ] **Step 1: Create the scanner worker**

```ts
// workers/option-scanner.worker.ts
import 'dotenv/config';
import { Worker, Queue } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { getConnectionOptions, MOOMOO_URL } from './connection.js';
import {
  QUEUE_OPTIONS_SCAN,
  QUEUE_OPTION_ALERTS,
  redisKey,
  redisTTL,
} from '../src/lib/server/queues.js';
import type {
  ScanOptionsJobData,
  ProcessAlertJobData,
  OptionPosition,
} from '../src/lib/server/queues.js';
import {
  parseOptionPositions,
  detectAlerts,
  fromDbOptionsPosition,
} from '../src/lib/services/option-scanner.service.js';

const redis  = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
const prisma = new PrismaClient();

export const optionScannerWorker = new Worker<ScanOptionsJobData>(
  QUEUE_OPTIONS_SCAN,
  async (job) => {
    const { userId, triggeredBy } = job.data;
    console.log(`[OptionScanner] userId=${userId} trigger=${triggeredBy}`);

    // ── 1. Load option positions ─────────────────────────────────────────
    let positions: OptionPosition[] = [];

    // Try DB first (OptionsPosition table)
    const dbPositions = await prisma.optionsPosition.findMany({
      where: { userId, status: 'open' },
    });

    if (dbPositions.length > 0) {
      positions = dbPositions.map(fromDbOptionsPosition);
      console.log(`[OptionScanner] Loaded ${positions.length} positions from DB`);
    } else {
      // Fallback: parse from live moomoo holdings
      try {
        const res = await fetch(`${MOOMOO_URL}/holdings`, { signal: AbortSignal.timeout(10_000) });
        if (res.ok) {
          const data = await res.json() as { holdings?: unknown[] };
          const holdings = Array.isArray(data.holdings) ? data.holdings : [];
          positions = parseOptionPositions(holdings as Parameters<typeof parseOptionPositions>[0]);
          console.log(`[OptionScanner] Parsed ${positions.length} option positions from moomoo`);
        } else {
          console.warn('[OptionScanner] moomoo returned', res.status, '— skipping live fallback');
        }
      } catch (err) {
        console.warn('[OptionScanner] moomoo unreachable:', (err as Error).message);
      }
    }

    // ── 2. Cache positions in Redis ──────────────────────────────────────
    await redis.setex(redisKey.positions(userId), redisTTL.positions, JSON.stringify(positions));

    // ── 3. Detect alerts ─────────────────────────────────────────────────
    const alerts = detectAlerts(positions, userId);
    console.log(`[OptionScanner] Detected ${alerts.length} alerts`);

    if (alerts.length === 0) {
      await redis.setex(redisKey.activeAlerts(userId), redisTTL.activeAlerts, JSON.stringify([]));
      await redis.setex(redisKey.lastScan(userId), redisTTL.lastScan, new Date().toISOString());
      return;
    }

    // ── 4. Enqueue each alert for processing ─────────────────────────────
    const alertsQueue = new Queue<ProcessAlertJobData>(QUEUE_OPTION_ALERTS, {
      connection: getConnectionOptions(),
    });

    for (const alert of alerts) {
      await alertsQueue.add('process-alert', { userId, alert });
    }
    await alertsQueue.close();

    // ── 5. Update last scan timestamp ────────────────────────────────────
    await redis.setex(redisKey.lastScan(userId), redisTTL.lastScan, new Date().toISOString());
    console.log(`[OptionScanner] Done. Enqueued ${alerts.length} alert jobs.`);
  },
  {
    connection: getConnectionOptions(),
    concurrency: 1,
  }
);

optionScannerWorker.on('completed', (job) =>
  console.log(`[OptionScanner] Job ${job.id} completed`)
);
optionScannerWorker.on('failed', (job, err) =>
  console.error(`[OptionScanner] Job ${job?.id} failed:`, err.message)
);
```

- [ ] **Step 2: Commit**

```bash
git add workers/option-scanner.worker.ts
git commit -m "feat: add option scanner BullMQ worker"
```

---

## Task 8: Worker — Alert Processor

**Files:** `workers/alert-processor.worker.ts`

- [ ] **Step 1: Create the alert processor worker**

```ts
// workers/alert-processor.worker.ts
import 'dotenv/config';
import { Worker } from 'bullmq';
import Redis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import { getConnectionOptions } from './connection.js';
import { QUEUE_OPTION_ALERTS, redisKey, redisTTL } from '../src/lib/server/queues.js';
import type { ProcessAlertJobData, OptionAlert } from '../src/lib/server/queues.js';

const redis  = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379', { maxRetriesPerRequest: null });
const prisma = new PrismaClient();

export const alertProcessorWorker = new Worker<ProcessAlertJobData>(
  QUEUE_OPTION_ALERTS,
  async (job) => {
    const { userId, alert } = job.data;
    console.log(`[AlertProcessor] Processing ${alert.severity} alert for ${alert.symbol}`);

    // ── 1. Merge into active alerts in Redis ─────────────────────────────
    const existing = await redis.get(redisKey.activeAlerts(userId));
    const current: OptionAlert[] = existing ? JSON.parse(existing) : [];

    // Deduplicate: replace alert with same symbol + optionType + severity
    const filtered = current.filter(
      (a) =>
        !(a.symbol === alert.symbol &&
          a.optionType === alert.optionType &&
          a.severity === alert.severity)
    );
    filtered.push(alert);

    // Sort: urgent first, then profitable, then info
    const order: Record<string, number> = { urgent: 0, profitable: 1, info: 2 };
    filtered.sort((a, b) => (order[a.severity] ?? 3) - (order[b.severity] ?? 3));

    await redis.setex(
      redisKey.activeAlerts(userId),
      redisTTL.activeAlerts,
      JSON.stringify(filtered)
    );

    // ── 2. Persist to MySQL ───────────────────────────────────────────────
    await prisma.optionAlert.create({
      data: {
        userId,
        symbol: alert.symbol,
        optionType: alert.optionType,
        severity: alert.severity,
        message: alert.message,
        recommendation: alert.recommendation,
        positionJson: JSON.stringify(alert.position),
        acknowledged: false,
        detectedAt: new Date(alert.detectedAt),
      },
    });

    console.log(`[AlertProcessor] Stored alert for ${alert.symbol} (${alert.severity})`);
  },
  {
    connection: getConnectionOptions(),
    concurrency: 5,
  }
);

alertProcessorWorker.on('completed', (job) =>
  console.log(`[AlertProcessor] Job ${job.id} completed`)
);
alertProcessorWorker.on('failed', (job, err) =>
  console.error(`[AlertProcessor] Job ${job?.id} failed:`, err.message)
);
```

- [ ] **Step 2: Commit**

```bash
git add workers/alert-processor.worker.ts
git commit -m "feat: add alert processor BullMQ worker"
```

---

## Task 9: Workers Entry Point

**Files:** `workers/index.ts`

- [ ] **Step 1: Create the entry point**

```ts
// workers/index.ts
import 'dotenv/config';
import { Queue } from 'bullmq';
import { optionScannerWorker } from './option-scanner.worker.js';
import { alertProcessorWorker } from './alert-processor.worker.js';
import { getConnectionOptions, MOOMOO_URL } from './connection.js';
import { QUEUE_OPTIONS_SCAN } from '../src/lib/server/queues.js';
import type { ScanOptionsJobData } from '../src/lib/server/queues.js';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

console.log('[Workers] Starting option alert workers...');
console.log('[Workers] Redis:', process.env.REDIS_URL ?? 'redis://localhost:6379');

// ── Register scheduled 15-minute fallback scan ───────────────────────────────
async function registerScheduledScan() {
  // Get all users who have option positions
  const users = await prisma.optionsPosition.findMany({
    where: { status: 'open' },
    select: { userId: true },
    distinct: ['userId'],
  });

  const scanQueue = new Queue<ScanOptionsJobData>(QUEUE_OPTIONS_SCAN, {
    connection: getConnectionOptions(),
  });

  for (const { userId } of users) {
    // BullMQ repeatable job — fires every 15 minutes per user
    await scanQueue.add(
      'scan-options-scheduled',
      { userId, triggeredBy: 'schedule' },
      {
        repeat: { every: 15 * 60 * 1000 }, // 15 minutes in ms
        jobId: `scheduled-scan-${userId}`,  // stable ID prevents duplicates
      }
    );
    console.log(`[Workers] Scheduled 15-min scan registered for userId=${userId}`);
  }

  await scanQueue.close();
}

registerScheduledScan().catch((err) =>
  console.warn('[Workers] Could not register scheduled scans:', err.message)
);

// ── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  console.log(`[Workers] ${signal} received — shutting down gracefully...`);
  await Promise.all([
    optionScannerWorker.close(),
    alertProcessorWorker.close(),
  ]);
  process.exit(0);
}

process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

console.log('[Workers] option-scanner-worker: READY');
console.log('[Workers] alert-processor-worker: READY');
```

- [ ] **Step 2: Run workers and verify startup**

Open a new terminal:

```bash
cd c:/Ampps/www/portfolio
npm run workers
```

Expected output:
```
[Workers] Starting option alert workers...
[Workers] Redis: redis://localhost:6379
[Workers] option-scanner-worker: READY
[Workers] alert-processor-worker: READY
```

No errors about Redis connection. Workers stay running (do not exit).

- [ ] **Step 3: Commit**

```bash
git add workers/index.ts
git commit -m "feat: add workers entry point with graceful shutdown"
```

---

## Task 10: API Endpoints

**Files:** `src/routes/api/options/alerts/+server.ts`, `src/routes/api/options/scan/+server.ts`, `src/routes/api/options/history/+server.ts`

- [ ] **Step 1: Create GET /api/options/alerts**

```ts
// src/routes/api/options/alerts/+server.ts
import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { redisGet } from '$lib/server/redis';
import { redisKey } from '$lib/server/queues';
import type { OptionAlert } from '$lib/server/queues';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const user = await getDemoUser();

  const [alertsRaw, lastScanRaw] = await Promise.all([
    redisGet(redisKey.activeAlerts(user.id)),
    redisGet(redisKey.lastScan(user.id)),
  ]);

  const alerts: OptionAlert[] = alertsRaw ? JSON.parse(alertsRaw) : [];
  const lastScan: string | null = lastScanRaw ?? null;

  const count = {
    urgent:     alerts.filter((a) => a.severity === 'urgent').length,
    profitable: alerts.filter((a) => a.severity === 'profitable').length,
    info:       alerts.filter((a) => a.severity === 'info').length,
  };

  return json({ alerts, lastScan, count });
};
```

- [ ] **Step 2: Create POST /api/options/scan**

```ts
// src/routes/api/options/scan/+server.ts
import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { getOptionScanQueue } from '$lib/server/queues';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
  const user = await getDemoUser();

  const queue = getOptionScanQueue();
  const job = await queue.add('scan-options', {
    userId: user.id,
    triggeredBy: 'manual',
  });
  await queue.close();

  return json({ queued: true, jobId: job.id });
};
```

- [ ] **Step 3: Create GET /api/options/history**

```ts
// src/routes/api/options/history/+server.ts
import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { prisma } from '$lib/server/db';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const user = await getDemoUser();
  const limit = Math.min(parseInt(url.searchParams.get('limit') ?? '20'), 100);
  const onlyUnacknowledged = url.searchParams.get('acknowledged') === 'false';

  const alerts = await prisma.optionAlert.findMany({
    where: {
      userId: user.id,
      ...(onlyUnacknowledged ? { acknowledged: false } : {}),
    },
    orderBy: { detectedAt: 'desc' },
    take: limit,
    select: {
      id: true,
      symbol: true,
      optionType: true,
      severity: true,
      message: true,
      recommendation: true,
      acknowledged: true,
      acknowledgedAt: true,
      detectedAt: true,
    },
  });

  return json({ alerts, total: alerts.length });
};
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/options/
git commit -m "feat: add option alerts API endpoints (GET alerts, POST scan, GET history)"
```

---

## Task 11: Trigger Scan on Moomoo Sync

**Files:** `src/routes/broker/+page.server.ts`

- [ ] **Step 1: Modify the sync action**

Replace the entire `sync` action in `src/routes/broker/+page.server.ts`:

```ts
import { getMoomooStatus, syncMoomoo } from '$lib/services/broker.service';
import { takeSnapshot, writeSyncLog } from '$lib/services/snapshot.service';
import { getDemoUser } from '$lib/server/demo-user';
import { prisma } from '$lib/server/db';
import { getOptionScanQueue } from '$lib/server/queues';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const user = await getDemoUser();
  const [status, syncLogs] = await Promise.all([
    getMoomooStatus().catch(() => null),
    prisma.brokerSyncLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }).catch(() => []),
  ]);
  return { status, syncLogs };
};

export const actions: Actions = {
  sync: async () => {
    const user = await getDemoUser();
    try {
      const result = await syncMoomoo();
      await takeSnapshot(
        user.id,
        result.holdings,
        result.account_info?.cash ?? 0,
        result.account_info?.total_assets || undefined
      );
      await writeSyncLog(user.id, 'success', result.holdings_count);

      // Enqueue option scan job after successful sync
      try {
        const queue = getOptionScanQueue();
        await queue.add('scan-options', {
          userId: user.id,
          triggeredBy: 'moomoo-sync',
        });
        await queue.close();
        console.log('[BrokerSync] Option scan job enqueued');
      } catch (queueErr) {
        // Queue failure must not break the sync response
        console.warn('[BrokerSync] Could not enqueue option scan:', (queueErr as Error).message);
      }

      return {
        success: true,
        message: `Synced ${result.holdings_count} holdings from ${result.account_label}.`,
        synced_at: result.synced_at,
        holdings: result.holdings,
        account_info: result.account_info,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed.';
      await writeSyncLog(user.id, 'failed', 0, msg).catch(() => {});
      return fail(400, { success: false, message: msg, holdings: [] });
    }
  },
};
```

- [ ] **Step 2: Commit**

```bash
git add src/routes/broker/+page.server.ts
git commit -m "feat: enqueue option scan job after successful moomoo sync"
```

---

## Task 12: End-to-End Smoke Test

- [ ] **Step 1: Start Redis**

```bash
redis-server
```

(Or confirm it's already running: `redis-cli ping` → `PONG`)

- [ ] **Step 2: Start workers in one terminal**

```bash
npm run workers
```

Expected: both workers print READY, no errors.

- [ ] **Step 3: Start the SvelteKit dev server in another terminal**

```bash
npm run dev
```

- [ ] **Step 4: Seed a test OptionsPosition record**

Open `npx prisma studio` and insert a record in `options_positions` with:

```
userId:         [copy from User table]
symbol:         NIO260529C00005500
optionType:     covered_call
strike:         5.5
expirationDate: [3 days from today]
contracts:      1
premium:        0.28
collateral:     550
status:         open
metadataJson:   {"name":"NIO CC $5.50","costBasis":6.50,"currentValue":0.05,"currentPrice":5.44,"unrealizedPnl":23.00}
```

- [ ] **Step 5: Trigger a manual scan**

```bash
curl -X POST http://localhost:5173/api/options/scan
```

Expected response:
```json
{ "queued": true, "jobId": "..." }
```

- [ ] **Step 6: Verify workers processed the job**

Check the workers terminal. Expected logs:
```
[OptionScanner] userId=... trigger=manual
[OptionScanner] Loaded 1 positions from DB
[OptionScanner] Detected 2 alerts
[AlertProcessor] Processing urgent alert for NIO260529C00005500
[AlertProcessor] Stored alert for NIO260529C00005500 (urgent)
[AlertProcessor] Processing urgent alert for NIO260529C00005500
[AlertProcessor] Stored alert for NIO260529C00005500 (urgent)
```

- [ ] **Step 7: Verify alerts in Redis**

```bash
redis-cli get "option:alerts:active:<userId>"
```

Expected: JSON array with 2 alerts (DTE ≤ 3 + strike below cost basis).

- [ ] **Step 8: Verify alerts via API**

```bash
curl http://localhost:5173/api/options/alerts
```

Expected:
```json
{
  "alerts": [...],
  "lastScan": "2026-05-23T...",
  "count": { "urgent": 2, "profitable": 0, "info": 0 }
}
```

- [ ] **Step 9: Verify history in MySQL**

```bash
curl "http://localhost:5173/api/options/history?limit=5"
```

Expected: JSON with 2 alert records from MySQL.

- [ ] **Step 10: Final commit**

```bash
git add .
git commit -m "feat: option alert system complete — Redis + BullMQ + MySQL

- ioredis singleton for SvelteKit server routes
- BullMQ option-scan and option-alerts queues
- OptionScannerWorker: reads DB positions, detects alerts, enqueues
- AlertProcessorWorker: stores in Redis + MySQL
- API: GET /api/options/alerts, POST /api/options/scan, GET /api/options/history
- Moomoo sync action triggers scan job automatically

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```
