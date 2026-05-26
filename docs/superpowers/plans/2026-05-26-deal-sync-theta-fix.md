# Deal History Sync + Option Symbol Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix option symbol parsing so theta displays correctly, then sync moomoo deal history into the local transactions table so total return reflects real realized P&L.

**Architecture:** Two independent fixes executed in order. Fix 1 is a one-line change in `briefing.service.ts`. Fix 2 adds a `brokerDealId` field to the Prisma `Transaction` model, a new `deal-sync.service.ts` that idempotently upserts deals, and wires it into the existing `refresh` form action in the dashboard.

**Tech Stack:** SvelteKit, Prisma ORM (SQLite), TypeScript, Vitest

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/services/briefing.service.ts` | Modify line 16 | Fix `stripMarketSuffix` to use longest segment |
| `src/lib/services/briefing.service.test.ts` | Create | Unit tests for `stripMarketSuffix` and option parsing |
| `prisma/schema.prisma` | Modify | Add `brokerDealId String?` + unique index to Transaction |
| `src/lib/types/portfolio.ts` | Modify | Add `MoomooDealItem` type; add `deals` to `MoomooSyncResult` |
| `src/lib/services/broker.service.ts` | Modify | Pass `deals` through in `normalizeSyncResult` |
| `src/lib/services/deal-sync.service.ts` | Create | `syncDealsToTransactions` — idempotent deal upsert |
| `src/lib/services/deal-sync.service.test.ts` | Create | Unit tests for `syncDealsToTransactions` |
| `src/routes/dashboard/+page.server.ts` | Modify | Call `syncDealsToTransactions` in `refresh` action |

---

## Task 1: Fix `stripMarketSuffix` and add unit tests

**Spec:** Fix 1 — Option Symbol Parsing Bug  
**Files:**
- Modify: `src/lib/services/briefing.service.ts:15-17`
- Create: `src/lib/services/briefing.service.test.ts`

### Background
`stripMarketSuffix` currently does `symbol.split('.')[0]` which returns `'US'` for moomoo's `'US.PATH260529P10000'` format. The OCC regex never matches so the option is silently ignored and theta shows `—`. Fix: take the **longest** segment instead.

Current code (line 15–17):
```typescript
function stripMarketSuffix(symbol: string): string {
  return (symbol.split('.')[0] ?? symbol).toUpperCase();
}
```

- [ ] **Step 1: Write the failing test**

Create `src/lib/services/briefing.service.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseOptionsFromSnapshot } from './briefing.service';
import type { SnapshotHolding } from '$lib/types/portfolio';

function makeHolding(symbol: string, overrides: Partial<SnapshotHolding> = {}): SnapshotHolding {
  return {
    symbol,
    name: symbol,
    assetType: 'OPTION',
    quantity: -1,
    averageCost: 100,
    marketPrice: 50,
    marketValue: -50,
    unrealizedPnl: 50,
    todayPl: 0,
    currency: 'USD',
    ...overrides,
  };
}

describe('parseOptionsFromSnapshot', () => {
  it('parses suffix-format OCC symbol: NIO260530C00005500.US', () => {
    const result = parseOptionsFromSnapshot([makeHolding('NIO260530C00005500.US')]);
    expect(result).toHaveLength(1);
    expect(result[0].underlying).toBe('NIO');
    expect(result[0].optionType).toBe('call');
    expect(result[0].strike).toBe(5.5);
  });

  it('parses prefix-format moomoo symbol: US.PATH260529P10000', () => {
    const result = parseOptionsFromSnapshot([makeHolding('US.PATH260529P10000')]);
    expect(result).toHaveLength(1);
    expect(result[0].underlying).toBe('PATH');
    expect(result[0].optionType).toBe('put');
    expect(result[0].strike).toBe(10);
  });

  it('returns empty for plain stock symbol', () => {
    const result = parseOptionsFromSnapshot([makeHolding('AAPL')]);
    expect(result).toHaveLength(0);
  });

  it('returns empty for stock with suffix: AAPL.US', () => {
    const result = parseOptionsFromSnapshot([makeHolding('AAPL.US')]);
    expect(result).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
npx vitest run src/lib/services/briefing.service.test.ts
```

Expected: 1 failure — `'US.PATH260529P10000'` test fails because `stripMarketSuffix` returns `'US'`.

- [ ] **Step 3: Fix `stripMarketSuffix` in `briefing.service.ts`**

Open `src/lib/services/briefing.service.ts` and replace lines 15–17:

```typescript
// BEFORE
function stripMarketSuffix(symbol: string): string {
  return (symbol.split('.')[0] ?? symbol).toUpperCase();
}

// AFTER
function stripMarketSuffix(symbol: string): string {
  const parts = symbol.split('.');
  return parts.reduce((a, b) => (a.length >= b.length ? a : b)).toUpperCase();
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npx vitest run src/lib/services/briefing.service.test.ts
```

Expected: All 4 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/briefing.service.ts src/lib/services/briefing.service.test.ts
git commit -m "fix: stripMarketSuffix uses longest segment — fixes theta for moomoo prefix symbols"
```

---

## Task 2: Add `brokerDealId` to Prisma schema and migrate

**Spec:** Fix 2 — Schema Change  
**Files:**
- Modify: `prisma/schema.prisma:104-126`

### Background
The `Transaction` model (lines 104–126 of `schema.prisma`) currently has no field to track broker deal IDs. We need `brokerDealId String?` plus a `@@unique([userId, brokerDealId])` index so syncing is idempotent.

Current model end:
```prisma
  notes       String?
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([id, userId])
  @@index([userId, tradeDate])
  @@index([accountId])
  @@index([assetId])
}
```

- [ ] **Step 1: Add `brokerDealId` field to Transaction model**

Open `prisma/schema.prisma`. Inside the `Transaction` model, add after `notes String?`:

```prisma
  brokerDealId  String?   // moomoo deal_id; null for manual entries
```

And add a new unique constraint after `@@unique([id, userId])`:

```prisma
  @@unique([userId, brokerDealId])
```

The full Transaction model should now look like:

```prisma
model Transaction {
  id          String    @id @default(cuid())
  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accountId   String
  account     Account   @relation(fields: [accountId], references: [id], onDelete: Cascade)
  assetId     String?
  asset       Asset?    @relation(fields: [assetId], references: [id], onDelete: SetNull)
  type        String
  tradeDate   DateTime
  quantity    Float     @default(0)
  price       Float     @default(0)
  fee         Float     @default(0)
  currency    String    @default("USD")
  notes       String?
  brokerDealId  String?

  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  @@unique([id, userId])
  @@unique([userId, brokerDealId])
  @@index([userId, tradeDate])
  @@index([accountId])
  @@index([assetId])
}
```

- [ ] **Step 2: Run Prisma migration**

```bash
npx prisma migrate dev --name add_broker_deal_id
```

Expected output includes:
```
The following migration(s) have been created and applied from new schema changes:

migrations/
  └─ 20260526xxxxxx_add_broker_deal_id/
    └─ migration.sql
```

If you see an error about the unique index and existing null values, that is fine — SQLite allows multiple NULLs in a unique index.

- [ ] **Step 3: Generate Prisma client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add brokerDealId to Transaction for idempotent deal sync"
```

---

## Task 3: Add `MoomooDealItem` type and extend `MoomooSyncResult`

**Spec:** Fix 2 — Type Changes  
**Files:**
- Modify: `src/lib/types/portfolio.ts:80-91`

### Background
`MoomooSyncResult` (lines 80–91 of `portfolio.ts`) currently has no `deals` field. The moomoo bridge already returns deals in the `/sync` response but they are discarded. We add the type and the field.

- [ ] **Step 1: Add `MoomooDealItem` type**

Open `src/lib/types/portfolio.ts`. After the closing `};` of `AccountInfo` (line 78) and before `export type MoomooSyncResult`, insert:

```typescript
export type MoomooDealItem = {
  deal_id: string;
  code: string;       // e.g. 'US.PATH' or 'US.NIO260530C00005500'
  side: string;       // 'BUY' | 'SELL'
  qty: number;
  price: number;
  create_time: string; // ISO timestamp from bridge
  fee?: number;
};
```

- [ ] **Step 2: Add `deals` field to `MoomooSyncResult`**

Inside the `MoomooSyncResult` type, add after `holdings: BrokerHolding[];`:

```typescript
  deals: MoomooDealItem[];
```

The full updated type:

```typescript
export type MoomooSyncResult = {
  account_label: string;
  account_number: string;
  acc_role: string;
  trade_environment: string;
  security_firm: string;
  trdmarket_auth: string[];
  synced_at: string;
  holdings_count: number;
  holdings: BrokerHolding[];
  deals: MoomooDealItem[];
  account_info: AccountInfo;
};
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors. If you see errors about `deals` being missing, that's because `normalizeSyncResult` doesn't return it yet — fix that in Task 4.

- [ ] **Step 4: Commit**

```bash
git add src/lib/types/portfolio.ts
git commit -m "feat: add MoomooDealItem type and deals field to MoomooSyncResult"
```

---

## Task 4: Pass `deals` through `normalizeSyncResult`

**Spec:** Fix 2 — broker.service.ts change  
**Files:**
- Modify: `src/lib/services/broker.service.ts:701-727`

### Background
`normalizeSyncResult` (lines 701–727) builds and returns a `MoomooSyncResult` object but doesn't include `deals`. The bridge returns deals in `data.deals`. We pass it through.

- [ ] **Step 1: Update `normalizeSyncResult` return value**

Open `src/lib/services/broker.service.ts`. In the `normalizeSyncResult` function's return object (after `holdings: data.holdings ?? [],`), add:

```typescript
deals: data.deals ?? [],
```

The full return object becomes:

```typescript
  return {
    account_label: data.account_label ?? 'Moomoo Account',
    account_number: data.account_number ?? '',
    acc_role: data.acc_role ?? '',
    trade_environment: data.trade_environment ?? '',
    security_firm: data.security_firm ?? '',
    trdmarket_auth: data.trdmarket_auth ?? [],
    synced_at: data.synced_at ?? new Date().toISOString(),
    holdings_count: Number(data.holdings_count ?? data.holdings?.length ?? 0),
    holdings: data.holdings ?? [],
    deals: data.deals ?? [],
    account_info: {
      total_assets: Number(accountInfo.total_assets ?? 0),
      securities_assets: Number(accountInfo.securities_assets ?? 0),
      cash: Number(accountInfo.cash ?? 0),
      market_val: Number(accountInfo.market_val ?? 0),
      unrealized_pl: Number(accountInfo.unrealized_pl ?? 0),
      realized_pl: Number(accountInfo.realized_pl ?? 0),
      power: Number(accountInfo.power ?? 0),
      avl_withdrawal_cash: Number(accountInfo.avl_withdrawal_cash ?? 0),
      is_pdt: Boolean(accountInfo.is_pdt ?? false),
      pdt_seq: String(accountInfo.pdt_seq ?? '')
    }
  };
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors. The `MoomooSyncResult.deals` field is now satisfied.

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/broker.service.ts
git commit -m "feat: pass deals through normalizeSyncResult"
```

---

## Task 5: Create `deal-sync.service.ts` with unit tests

**Spec:** Fix 2 — New service  
**Files:**
- Create: `src/lib/services/deal-sync.service.ts`
- Create: `src/lib/services/deal-sync.service.test.ts`

### Background
This service receives a `MoomooDealItem[]` array and writes new deals to the `transactions` table, skipping any with a `brokerDealId` already stored. The `side` field from moomoo is `'BUY'` or `'SELL'`; it must be lowercased because `calcCapitalAndRealized` uses `'buy'`/`'sell'`.

The function also must:
1. Strip the broker prefix from `code` (`'US.PATH'` → `'PATH'`) using the same longest-segment logic
2. Upsert an `Asset` row (find or create by symbol) before inserting the transaction
3. Skip deals with malformed timestamps (guard against bridge bugs)

### Unit test approach
We mock `prisma` using Vitest's `vi.mock`. The mock returns canned values from `findMany` and resolves `upsert`/`create` successfully.

- [ ] **Step 1: Write the failing tests**

Create `src/lib/services/deal-sync.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock prisma before importing the service
vi.mock('$lib/server/db', () => ({
  prisma: {
    transaction: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    asset: {
      upsert: vi.fn(),
    },
  },
}));

import { syncDealsToTransactions } from './deal-sync.service';
import { prisma } from '$lib/server/db';

const mockPrisma = prisma as {
  transaction: { findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  asset: { upsert: ReturnType<typeof vi.fn> };
};

const ASSET_STUB = { id: 'asset-1', symbol: 'PATH' };
const USER_ID = 'user-1';
const ACCOUNT_ID = 'acct-1';

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.asset.upsert.mockResolvedValue(ASSET_STUB);
  mockPrisma.transaction.create.mockResolvedValue({});
});

describe('syncDealsToTransactions', () => {
  it('returns 0/0 for empty deals array', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    const result = await syncDealsToTransactions(USER_ID, ACCOUNT_ID, []);
    expect(result).toEqual({ inserted: 0, skipped: 0 });
    expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
  });

  it('inserts a new BUY deal with lowercased type', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    const result = await syncDealsToTransactions(USER_ID, ACCOUNT_ID, [
      {
        deal_id: 'deal-1',
        code: 'US.PATH',
        side: 'BUY',
        qty: 10,
        price: 15.5,
        create_time: '2025-06-01T10:00:00Z',
        fee: 0.5,
      },
    ]);
    expect(result).toEqual({ inserted: 1, skipped: 0 });
    expect(mockPrisma.transaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: USER_ID,
        accountId: ACCOUNT_ID,
        assetId: 'asset-1',
        brokerDealId: 'deal-1',
        type: 'buy',
        quantity: 10,
        price: 15.5,
        fee: 0.5,
      }),
    });
  });

  it('skips a deal whose deal_id is already stored', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([{ brokerDealId: 'deal-existing' }]);
    const result = await syncDealsToTransactions(USER_ID, ACCOUNT_ID, [
      {
        deal_id: 'deal-existing',
        code: 'US.AAPL',
        side: 'SELL',
        qty: 5,
        price: 200,
        create_time: '2025-06-01T10:00:00Z',
      },
    ]);
    expect(result).toEqual({ inserted: 0, skipped: 1 });
    expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
  });

  it('strips prefix-format code correctly: US.PATH → PATH', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    await syncDealsToTransactions(USER_ID, ACCOUNT_ID, [
      {
        deal_id: 'deal-2',
        code: 'US.PATH',
        side: 'BUY',
        qty: 5,
        price: 10,
        create_time: '2025-06-01T10:00:00Z',
      },
    ]);
    expect(mockPrisma.asset.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { symbol: 'PATH' } }),
    );
  });

  it('skips deals with malformed timestamps', async () => {
    mockPrisma.transaction.findMany.mockResolvedValue([]);
    const result = await syncDealsToTransactions(USER_ID, ACCOUNT_ID, [
      {
        deal_id: 'deal-bad-time',
        code: 'US.NVDA',
        side: 'BUY',
        qty: 1,
        price: 100,
        create_time: 'not-a-date',
      },
    ]);
    expect(result).toEqual({ inserted: 0, skipped: 0 });
    expect(mockPrisma.transaction.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests and confirm they fail**

```bash
npx vitest run src/lib/services/deal-sync.service.test.ts
```

Expected: All tests fail because `deal-sync.service.ts` does not exist yet.

- [ ] **Step 3: Create `src/lib/services/deal-sync.service.ts`**

```typescript
// src/lib/services/deal-sync.service.ts

import { prisma } from '$lib/server/db';
import type { MoomooDealItem } from '$lib/types/portfolio';

function stripBrokerPrefix(code: string): string {
  // 'US.PATH' → 'PATH'   (prefix format — moomoo bridge)
  // 'NIO260530C00005500.US' → 'NIO260530C00005500'  (suffix format — legacy)
  const parts = code.split('.');
  return parts.reduce((a, b) => (a.length >= b.length ? a : b)).toUpperCase();
}

export async function syncDealsToTransactions(
  userId: string,
  accountId: string,
  deals: MoomooDealItem[],
): Promise<{ inserted: number; skipped: number }> {
  if (deals.length === 0) return { inserted: 0, skipped: 0 };

  // 1. Fetch deal IDs already stored for this user so we can skip duplicates
  const existing = await prisma.transaction.findMany({
    where: { userId, brokerDealId: { not: null } },
    select: { brokerDealId: true },
  });
  const existingIds = new Set(existing.map((r) => r.brokerDealId!));

  // 2. Filter to only new deals
  const newDeals = deals.filter((d) => !existingIds.has(d.deal_id));

  let inserted = 0;
  for (const deal of newDeals) {
    // Guard against malformed timestamps from the bridge
    const tradeDate = new Date(deal.create_time);
    if (isNaN(tradeDate.getTime())) continue;

    const ticker = stripBrokerPrefix(deal.code);

    // Upsert Asset (find or create by symbol)
    const asset = await prisma.asset.upsert({
      where: { symbol: ticker },
      update: {},
      create: {
        symbol: ticker,
        name: ticker,
        assetType: 'STOCK',
        currency: 'USD',
      },
    });

    await prisma.transaction.create({
      data: {
        userId,
        accountId,
        assetId: asset.id,
        brokerDealId: deal.deal_id,
        type: deal.side.toLowerCase(), // 'buy' | 'sell' — matches calcCapitalAndRealized
        tradeDate,
        quantity: deal.qty,
        price: deal.price,
        fee: deal.fee ?? 0,
        currency: 'USD',
        notes: `Synced from moomoo deal ${deal.deal_id}`,
      },
    });
    inserted++;
  }

  return { inserted, skipped: deals.length - newDeals.length };
}
```

- [ ] **Step 4: Run tests and confirm they pass**

```bash
npx vitest run src/lib/services/deal-sync.service.test.ts
```

Expected: All 5 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/services/deal-sync.service.ts src/lib/services/deal-sync.service.test.ts
git commit -m "feat: add syncDealsToTransactions service with idempotent deal upsert"
```

---

## Task 6: Wire deal sync into the dashboard `refresh` action

**Spec:** Fix 2 — Dashboard server change  
**Files:**
- Modify: `src/routes/dashboard/+page.server.ts:1-24`

### Background
The `refresh` action (lines 15–24) currently calls `syncMoomoo()` then `takeSnapshot()` then returns. We add `syncDealsToTransactions` after `takeSnapshot`. The `account` variable is already available in the surrounding `load()` — but inside the action we call `getDemoUser()` and need to get the account too. Check how the load function gets `account`.

- [ ] **Step 1: Check how `account` is obtained in `load()`**

Read `src/routes/dashboard/+page.server.ts`. Look for how `account` / `accountId` is obtained (it's used in `takeSnapshot`). Note the pattern — you'll replicate it in the action.

Look for something like:
```typescript
const accounts = await listAccounts(user.id);
const account = accounts[0];
```

- [ ] **Step 2: Add `syncDealsToTransactions` import**

At the top of `src/routes/dashboard/+page.server.ts`, add the import:

```typescript
import { syncDealsToTransactions } from '$lib/services/deal-sync.service';
```

- [ ] **Step 3: Update the `refresh` action**

Replace the current `refresh` action:

```typescript
refresh: async () => {
  const user = await getDemoUser();
  try {
    const result = await syncMoomoo();
    await takeSnapshot(user.id, result.holdings, result.account_info?.cash ?? 0, result.account_info?.total_assets || undefined);
    return { refreshed: true, updatedAt: new Date().toISOString(), count: result.holdings_count };
  } catch (e) {
    return { refreshed: false, error: e instanceof Error ? e.message : 'Sync failed' };
  }
},
```

With:

```typescript
refresh: async () => {
  const user = await getDemoUser();
  try {
    const result = await syncMoomoo();
    const accounts = await listAccounts(user.id);
    const account = accounts[0];
    await takeSnapshot(user.id, result.holdings, result.account_info?.cash ?? 0, result.account_info?.total_assets || undefined);
    if (account && result.deals.length > 0) {
      const syncResult = await syncDealsToTransactions(user.id, account.id, result.deals);
      console.log(`[deal-sync] inserted=${syncResult.inserted} skipped=${syncResult.skipped}`);
    }
    return { refreshed: true, updatedAt: new Date().toISOString(), count: result.holdings_count };
  } catch (e) {
    return { refreshed: false, error: e instanceof Error ? e.message : 'Sync failed' };
  }
},
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Run full test suite**

```bash
npx vitest run
```

Expected: All tests pass (briefing.service tests + deal-sync.service tests + existing nav/clickOutside tests).

- [ ] **Step 6: Commit**

```bash
git add src/routes/dashboard/+page.server.ts
git commit -m "feat: call syncDealsToTransactions in refresh action — wires deal history to transactions table"
```

---

## Task 7: Manual smoke test

**Files:** None — verification only

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Navigate to dashboard and trigger Refresh**

Open `http://localhost:5173/dashboard`. Click the **Refresh** button. Check the browser console and server terminal for:
- No TypeScript / runtime errors
- Server log: `[deal-sync] inserted=N skipped=M` (N may be 0 if broker returns no deals, that is OK)

- [ ] **Step 3: Verify theta section shows a value**

After refresh, the **DailyBriefingCard** THETA column should show a dollar amount instead of `—` if you have open options positions. If you have no options, it correctly shows `$0.00`.

To confirm the fix is working with the moomoo prefix format, check the browser for any option symbols that looked like `US.XYZ...` before — they should now appear in the THETA count.

- [ ] **Step 4: Verify total return moves**

After refresh, if deal history was synced (N > 0 from Step 2), navigate to the dashboard and check **Total Return** in the stat cards. It should now reflect realized P&L from synced deals.

If N = 0 (moomoo bridge returned no deals), check the bridge response by visiting `http://localhost:8888/sync` and inspecting the `deals` array in the JSON.

- [ ] **Step 5: Final commit if any tweaks were needed**

```bash
git add -A
git commit -m "fix: smoke test tweaks" # only if changes were needed
```
