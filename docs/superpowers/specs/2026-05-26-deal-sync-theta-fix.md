# Deal History Sync + Option Symbol Fix Design

**Date:** 2026-05-26  
**Status:** Approved  
**Goal:** Fix two related issues: (1) theta/options showing "—" due to a symbol-parsing bug, and (2) total return being wrong because 2025 closed-trade P&L is never persisted.

---

## Context

Two bugs surfaced after the DailyBriefingCard shipped:

1. **Theta shows "—" / options not recognised** — the moomoo bridge returns option symbols in `MARKET.TICKER` format (e.g. `US.PATH260529P10000`) but `stripMarketSuffix` takes `split('.')[0]` which yields `'US'`, not the OCC ticker. The OCC regex never matches, so the option is silently ignored.

2. **Total return discrepancy** — dashboard shows −9.86% while the moomoo app shows 2025 = −27.29%, 2026 = +4.31%. Root cause: `history_deal_list_query` is called by the bridge and its results arrive in `/sync` payload, but `MoomooSyncResult` doesn't expose `deals` and nothing writes them to the `transactions` table. Realized losses from closed 2025 positions are invisible to `calcCapitalAndRealized`.

---

## Fix 1 — Option Symbol Parsing Bug

### File

`src/lib/services/briefing.service.ts`

### Change

Replace the `stripMarketSuffix` function body:

```typescript
// Before — returns first segment: 'US' for 'US.PATH260529P10000'
function stripMarketSuffix(symbol: string): string {
  return (symbol.split('.')[0] ?? symbol).toUpperCase();
}

// After — returns longest segment: 'PATH260529P10000' for 'US.PATH260529P10000'
//         Also handles suffix format: 'NIO260530C00005500' for 'NIO260530C00005500.US'
function stripMarketSuffix(symbol: string): string {
  const parts = symbol.split('.');
  return parts.reduce((a, b) => (a.length >= b.length ? a : b)).toUpperCase();
}
```

**Why longest segment works:**  
- `US.PATH260529P10000` → `['US', 'PATH260529P10000']` → longest = `PATH260529P10000` ✓  
- `NIO260530C00005500.US` → `['NIO260530C00005500', 'US']` → longest = `NIO260530C00005500` ✓  
- `AAPL` → `['AAPL']` → only one segment = `AAPL` ✓

This is a **one-line change** with no side effects on existing logic.

---

## Fix 2 — Deal History Sync

### Overview

Sync filled trades from the moomoo bridge into the local `transactions` table on every `/refresh`. This lets `calcCapitalAndRealized` see historical realized P&L and produce an accurate total return.

### Architecture

```
moomoo bridge /sync response
  └── deals: MoomooDealItem[]
        └── normalizeSyncResult()          (broker.service.ts — pass-through)
              └── syncDealsToTransactions() (deal-sync.service.ts)
                    ├── fetch existing brokerDealIds (skip duplicates)
                    ├── for each new deal:
                    │     ├── stripPrefix(code) → ticker
                    │     ├── upsert Asset (find or create)
                    │     └── insert Transaction (type = side.toLowerCase())
                    └── return { inserted, skipped }
```

### Schema Change

Add one optional field + unique index to `Transaction`:

```prisma
model Transaction {
  // ... existing fields ...
  brokerDealId  String?   // moomoo deal_id — null for manual entries

  @@unique([userId, brokerDealId])  // prevents duplicate sync
}
```

Migration: `prisma migrate dev --name add_broker_deal_id`

The `@@unique` on `[userId, brokerDealId]` means a re-sync is idempotent — no duplicates possible even if called multiple times.

### Type Changes (`src/lib/types/portfolio.ts`)

Add to `MoomooSyncResult`:

```typescript
export type MoomooDealItem = {
  deal_id: string;
  code: string;        // e.g. 'US.PATH' or 'US.NIO260530C00005500'
  side: string;        // 'BUY' | 'SELL'
  qty: number;
  price: number;
  create_time: string; // ISO timestamp string from bridge
  fee?: number;
};

export type MoomooSyncResult = {
  holdings: MoomooHolding[];
  deals: MoomooDealItem[];   // ← new
  // ... other existing fields
};
```

### `broker.service.ts` Change

`normalizeSyncResult()` currently maps `holdings` and drops everything else. Add `deals` pass-through:

```typescript
function normalizeSyncResult(raw: unknown): MoomooSyncResult {
  // ... existing holdings mapping ...
  return {
    holdings: /* existing */,
    deals: (raw as any).deals ?? [],
  };
}
```

### New Service: `src/lib/services/deal-sync.service.ts`

```typescript
import { prisma } from '$lib/server/db';
import type { MoomooDealItem } from '$lib/types/portfolio';

function stripBrokerPrefix(code: string): string {
  // 'US.PATH' → 'PATH', 'US.NIO260530C00005500' → 'NIO260530C00005500'
  const parts = code.split('.');
  return parts.reduce((a, b) => (a.length >= b.length ? a : b)).toUpperCase();
}

export async function syncDealsToTransactions(
  userId: string,
  accountId: string,
  deals: MoomooDealItem[],
): Promise<{ inserted: number; skipped: number }> {
  if (deals.length === 0) return { inserted: 0, skipped: 0 };

  // 1. Fetch deal IDs already stored for this user
  const existing = await prisma.transaction.findMany({
    where: { userId, brokerDealId: { not: null } },
    select: { brokerDealId: true },
  });
  const existingIds = new Set(existing.map((r) => r.brokerDealId!));

  // 2. Filter new deals
  const newDeals = deals.filter((d) => !existingIds.has(d.deal_id));

  let inserted = 0;
  for (const deal of newDeals) {
    const ticker = stripBrokerPrefix(deal.code);
    const tradeDate = new Date(deal.create_time);
    if (isNaN(tradeDate.getTime())) continue; // skip malformed timestamps

    // Upsert Asset (find or create)
    const asset = await prisma.asset.upsert({
      where: { symbol: ticker },
      update: {},
      create: {
        symbol: ticker,
        name: ticker,
        assetType: 'STOCK',  // default; user can correct later
        currency: 'USD',
      },
    });

    await prisma.transaction.create({
      data: {
        userId,
        accountId,
        assetId: asset.id,
        brokerDealId: deal.deal_id,
        type: deal.side.toLowerCase(),  // 'buy' | 'sell'
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

### Dashboard `refresh` Action Change

In `src/routes/dashboard/+page.server.ts`, after `takeSnapshot` call, add:

```typescript
import { syncDealsToTransactions } from '$lib/services/deal-sync.service';

// Inside refresh action, after takeSnapshot():
const syncResult = await syncDealsToTransactions(userId, account.id, syncData.deals);
console.log(`[deal-sync] inserted=${syncResult.inserted} skipped=${syncResult.skipped}`);
```

---

## Data Flow Summary

| Step | Where | What happens |
|------|-------|-------------|
| `/refresh` triggered | `+page.server.ts` | Fetches moomoo /sync (holdings + deals) |
| `normalizeSyncResult` | `broker.service.ts` | Passes `deals[]` through |
| `takeSnapshot` | existing | Saves current holdings snapshot |
| `syncDealsToTransactions` | `deal-sync.service.ts` | Writes new deal → Transaction rows |
| Next dashboard load | `+page.server.ts` | `calcCapitalAndRealized` now sees all transactions |
| Total return | `+page.server.ts` | Reflects real realized P&L |

---

## What This Does NOT Change

- Existing manual transaction entries (no `brokerDealId`) — unaffected
- Snapshot logic — unchanged
- Any other page or route
- Options data for theta — that's Fix 1, not related to transactions
- Asset types — synced as 'STOCK' by default; OCC symbols will be identifiable by regex if needed later

---

## File Changes Summary

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `brokerDealId String?` + `@@unique([userId, brokerDealId])` to Transaction |
| `src/lib/types/portfolio.ts` | Add `MoomooDealItem` type; add `deals` to `MoomooSyncResult` |
| `src/lib/services/briefing.service.ts` | Fix `stripMarketSuffix` — use longest segment |
| `src/lib/services/broker.service.ts` | Pass `deals` through in `normalizeSyncResult` |
| `src/lib/services/deal-sync.service.ts` | **Create** — `syncDealsToTransactions` function |
| `src/routes/dashboard/+page.server.ts` | Call `syncDealsToTransactions` after `takeSnapshot` in refresh action |

No new routes. No UI changes. No new dependencies.

---

## Out of Scope

- Options deal sync with correct asset type detection (separate feature)
- Historical sync UI (progress, status page)
- Real-time VIX or market data
- Dividend / fee transaction type handling from moomoo
