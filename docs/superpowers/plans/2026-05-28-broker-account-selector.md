# Broker Account Selector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users connect and switch between Moomoo broker accounts from the topbar; the dashboard always loads data from the selected account.

**Architecture:** DB stores `activeBrokerAccId` on the `User` row. A topbar dropdown fetches live accounts from the bridge, POSTs the selection, and triggers a full page reload. The bridge `/sync` gains an explicit `acc_id` override so it fetches exactly the selected account. A portfolio `Account` row is auto-created on first selection.

**Tech Stack:** SvelteKit (TypeScript), Prisma (MySQL), moomoo-service FastAPI, custom CSS vars.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `prisma/schema.prisma` | Modify | Add `activeBrokerAccId` to `User`, `brokerAccId` to `Account` |
| `moomoo-service/main.py` | Modify | Add `acc_id` override to `/sync` and `_fetch_account_bundle` |
| `src/routes/api/broker/accounts/+server.ts` | Create | GET — proxy bridge `/accounts`, 60 s cache |
| `src/routes/api/broker/accounts/select/+server.ts` | Create | POST — save acc_id to user, auto-create Account |
| `src/lib/services/broker.service.ts` | Modify | `syncMoomoo()` accepts optional `accId` param |
| `src/lib/stores/portfolio-summary.ts` | Modify | Add `activeBrokerAccId: string \| null` to store type |
| `src/lib/components/portfolioai/Topbar.svelte` | Modify | Replace two-option switcher with full broker account dropdown |
| `src/routes/dashboard/+page.server.ts` | Modify | Read `user.activeBrokerAccId`, pass to `syncMoomoo` |
| `src/routes/dashboard/+page.svelte` | Modify | Pass `activeBrokerAccId` into `portfolioSummary` store |

---

## Task 1: DB migration — add broker account fields

**Files:**
- Modify: `prisma/schema.prisma`

### Background

The `User` model needs `activeBrokerAccId String?` to remember the selected Moomoo account. The `Account` model needs `brokerAccId String?` to link a portfolio account to a specific Moomoo acc_id. DB is **MySQL** (not SQLite).

- [ ] **Step 1: Add fields to schema**

In `prisma/schema.prisma`, find `model User {` (line ~10). After the `portfolioMode` field, add:

```prisma
activeBrokerAccId String?   @db.VarChar(64)
```

Find `model Account {` (line ~124). After the `cashBalance` field, add:

```prisma
brokerAccId       String?   @db.VarChar(64)
```

- [ ] **Step 2: Generate migration and apply**

```bash
cd c:/Ampps/www/portfolio
npx prisma migrate dev --name add_broker_account_selector
```

Expected output contains: `Your database is now in sync with your schema.`

- [ ] **Step 3: Verify Prisma client regenerated**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Write a test that the fields exist on the type**

Create `src/lib/server/broker-account.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// These are compile-time type checks — if Prisma regenerated correctly,
// this file will compile without errors.
import type { User, Account } from '@prisma/client';

describe('Prisma schema broker fields', () => {
  it('User has activeBrokerAccId', () => {
    const u: Partial<User> = { activeBrokerAccId: '4652657' };
    expect(u.activeBrokerAccId).toBe('4652657');
  });
  it('Account has brokerAccId', () => {
    const a: Partial<Account> = { brokerAccId: '4652657' };
    expect(a.brokerAccId).toBe('4652657');
  });
});
```

- [ ] **Step 5: Run test**

```bash
cd c:/Ampps/www/portfolio && npx vitest run src/lib/server/broker-account.test.ts
```

Expected: `✓ src/lib/server/broker-account.test.ts (2 tests)`

- [ ] **Step 6: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/lib/server/broker-account.test.ts
git commit -m "feat(schema): add activeBrokerAccId to User and brokerAccId to Account"
```

---

## Task 2: Bridge — add acc_id override to /sync

**Files:**
- Modify: `moomoo-service/main.py`

### Background

The bridge `/sync` endpoint currently accepts only `prefer_real: bool`. We need it to also accept `acc_id: str | None = None`. When `acc_id` is provided, `_fetch_account_bundle` skips `_select_account()` and fetches directly for that account.

The `_fetch_account_bundle` helper (line ~1394) loops over SecurityFirms to find an account. When `acc_id` is given, we match the exact account by `acc_id` field.

- [ ] **Step 1: Add `acc_id` param to `/sync` endpoint**

Find the `/sync` endpoint (line ~1369):
```python
@app.post("/sync")
def sync(prefer_real: bool = True):
    bundle = _fetch_account_bundle(prefer_real=prefer_real)
```

Replace with:
```python
@app.post("/sync")
def sync(prefer_real: bool = True, acc_id: str | None = None):
    bundle = _fetch_account_bundle(prefer_real=prefer_real, acc_id=acc_id)
```

- [ ] **Step 2: Add `acc_id` param to `_fetch_account_bundle`**

Find `def _fetch_account_bundle(` (line ~1394). Change the signature from:
```python
def _fetch_account_bundle(
    prefer_real: bool = True,
    include_positions: bool = True,
    include_orders: bool = True,
    include_deals: bool = True,
    include_history: bool = True,
):
```

To:
```python
def _fetch_account_bundle(
    prefer_real: bool = True,
    include_positions: bool = True,
    include_orders: bool = True,
    include_deals: bool = True,
    include_history: bool = True,
    acc_id: str | None = None,
):
```

- [ ] **Step 3: Add explicit account lookup inside `_fetch_account_bundle`**

Inside `_fetch_account_bundle`, find the line (inside the firm loop):
```python
            account = _select_account(accounts, prefer_real)
            if account is None:
                continue

            if prefer_real and str(account.get("trd_env")) != "REAL":
                continue
```

Replace with:
```python
            if acc_id is not None:
                # explicit account requested — find by acc_id, skip prefer_real filter
                matches = accounts[accounts["acc_id"].astype(str) == str(acc_id)]
                if matches.empty:
                    continue
                account = matches.iloc[0].to_dict()
            else:
                account = _select_account(accounts, prefer_real)
                if account is None:
                    continue
                if prefer_real and str(account.get("trd_env")) != "REAL":
                    continue
```

- [ ] **Step 4: Restart bridge and manual smoke test**

```bash
cd c:/Ampps/www/portfolio/moomoo-service
python main.py &
# wait 2s, then:
curl -s -X POST "http://127.0.0.1:8001/sync?acc_id=INVALID" | python -m json.tool | head -5
```

Expected: either a 404 JSON error or empty holdings (bridge found no account with that id and tried next firm).

```bash
curl -s -X POST "http://127.0.0.1:8001/sync" | python -m json.tool | grep "broker_account_id"
```

Expected: prints a `broker_account_id` value.

- [ ] **Step 5: Commit**

```bash
git add moomoo-service/main.py
git commit -m "feat(bridge): add acc_id override to /sync and _fetch_account_bundle"
```

---

## Task 3: API route GET /api/broker/accounts

**Files:**
- Create: `src/routes/api/broker/accounts/+server.ts`

### Background

This proxies the bridge `/accounts` endpoint. Returns the simplified shape the topbar needs. Cached 60 s. Auth-gated.

The bridge returns `{ count: N, accounts: [...] }` where each account has `acc_id`, `trd_env`, `acc_status`, `trdmarket_auth`, etc. We return a simplified array.

`MOOMOO_SERVICE_URL` is available in server code via `process.env.MOOMOO_SERVICE_URL`.

- [ ] **Step 1: Write the test**

Create `src/routes/api/broker/accounts/broker-accounts.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

interface BridgeAccount {
  acc_id: string;
  trd_env: string;
  acc_status: string;
  trdmarket_auth: string[];
}

function mapBridgeAccount(a: BridgeAccount) {
  return {
    acc_id: a.acc_id,
    trd_env: a.trd_env as 'REAL' | 'SIMULATE',
    is_real: a.trd_env === 'REAL',
    is_active: a.acc_status === 'ACTIVE',
    markets: a.trdmarket_auth ?? [],
    name: a.trd_env === 'REAL' ? `Live Account (${a.acc_id})` : `Simulate Account (${a.acc_id})`,
  };
}

describe('mapBridgeAccount', () => {
  it('maps REAL account', () => {
    const result = mapBridgeAccount({ acc_id: '1234', trd_env: 'REAL', acc_status: 'ACTIVE', trdmarket_auth: ['US'] });
    expect(result.is_real).toBe(true);
    expect(result.is_active).toBe(true);
    expect(result.name).toBe('Live Account (1234)');
  });
  it('maps SIMULATE account', () => {
    const result = mapBridgeAccount({ acc_id: '5678', trd_env: 'SIMULATE', acc_status: 'ACTIVE', trdmarket_auth: [] });
    expect(result.is_real).toBe(false);
    expect(result.name).toBe('Simulate Account (5678)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd c:/Ampps/www/portfolio && npx vitest run src/routes/api/broker/accounts/broker-accounts.test.ts
```

Expected: FAIL — `mapBridgeAccount is not defined`

- [ ] **Step 3: Create the route file**

Create `src/routes/api/broker/accounts/+server.ts`:

```typescript
import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const BRIDGE = process.env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';

interface BridgeAccount {
  acc_id: string;
  trd_env: string;
  acc_status: string;
  trdmarket_auth: string[];
}

export function mapBridgeAccount(a: BridgeAccount) {
  return {
    acc_id: a.acc_id,
    trd_env: a.trd_env as 'REAL' | 'SIMULATE',
    is_real: a.trd_env === 'REAL',
    is_active: a.acc_status === 'ACTIVE',
    markets: a.trdmarket_auth ?? [],
    name: a.trd_env === 'REAL' ? `Live Account (${a.acc_id})` : `Simulate Account (${a.acc_id})`,
  };
}

export const GET: RequestHandler = async ({ locals, setHeaders }) => {
  if (!locals.user) throw error(401, 'Unauthorized');

  try {
    const res = await fetch(`${BRIDGE}/accounts`, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`Bridge error ${res.status}`);
    const data = await res.json() as { accounts: BridgeAccount[] };
    const accounts = (data.accounts ?? []).map(mapBridgeAccount);
    setHeaders({ 'cache-control': 'max-age=60' });
    return json(accounts);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Bridge offline' }, { status: 503 });
  }
};
```

- [ ] **Step 4: Update test to import from route**

Update `src/routes/api/broker/accounts/broker-accounts.test.ts` — replace the inline `mapBridgeAccount` definition and add an import:

```typescript
import { describe, it, expect } from 'vitest';
import { mapBridgeAccount } from './+server.js';

describe('mapBridgeAccount', () => {
  it('maps REAL account', () => {
    const result = mapBridgeAccount({ acc_id: '1234', trd_env: 'REAL', acc_status: 'ACTIVE', trdmarket_auth: ['US'] });
    expect(result.is_real).toBe(true);
    expect(result.is_active).toBe(true);
    expect(result.name).toBe('Live Account (1234)');
  });
  it('maps SIMULATE account', () => {
    const result = mapBridgeAccount({ acc_id: '5678', trd_env: 'SIMULATE', acc_status: 'ACTIVE', trdmarket_auth: [] });
    expect(result.is_real).toBe(false);
    expect(result.name).toBe('Simulate Account (5678)');
  });
});
```

- [ ] **Step 5: Run test**

```bash
cd c:/Ampps/www/portfolio && npx vitest run src/routes/api/broker/accounts/broker-accounts.test.ts
```

Expected: `✓ src/routes/api/broker/accounts/broker-accounts.test.ts (2 tests)`

- [ ] **Step 6: Commit**

```bash
git add src/routes/api/broker/accounts/+server.ts src/routes/api/broker/accounts/broker-accounts.test.ts
git commit -m "feat(api): add GET /api/broker/accounts proxy route with 60s cache"
```

---

## Task 4: API route POST /api/broker/accounts/select

**Files:**
- Create: `src/routes/api/broker/accounts/select/+server.ts`

### Background

Saves the user's chosen `acc_id` to `User.activeBrokerAccId`. Auto-creates a portfolio `Account` row if none exists for that `brokerAccId`. Uses Prisma directly (this is a server-only route).

- [ ] **Step 1: Write the test**

Create `src/routes/api/broker/accounts/select/select.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

function buildAccountName(trd_env: string, acc_id: string): string {
  return trd_env === 'REAL' ? `Live Account (${acc_id})` : `Simulate Account (${acc_id})`;
}

function buildAccountType(trd_env: string): string {
  return trd_env === 'REAL' ? 'live' : 'paper';
}

describe('account helpers', () => {
  it('builds REAL account name', () => {
    expect(buildAccountName('REAL', '4652657')).toBe('Live Account (4652657)');
  });
  it('builds SIMULATE account type', () => {
    expect(buildAccountType('SIMULATE')).toBe('paper');
  });
});
```

- [ ] **Step 2: Run test to verify it passes (pure helpers)**

```bash
cd c:/Ampps/www/portfolio && npx vitest run src/routes/api/broker/accounts/select/select.test.ts
```

Expected: FAIL — file doesn't exist yet

- [ ] **Step 3: Create the route**

Create `src/routes/api/broker/accounts/select/+server.ts`:

```typescript
import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import type { RequestHandler } from './$types';

export function buildAccountName(trd_env: string, acc_id: string): string {
  return trd_env === 'REAL' ? `Live Account (${acc_id})` : `Simulate Account (${acc_id})`;
}

export function buildAccountType(trd_env: string): string {
  return trd_env === 'REAL' ? 'live' : 'paper';
}

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');

  const body = await request.json() as { acc_id: string; trd_env: string; name?: string; currency?: string };
  const { acc_id, trd_env, name, currency = 'USD' } = body;

  if (!acc_id) throw error(400, 'acc_id is required');

  // Save selection on User
  await prisma.user.update({
    where: { id: locals.user.id },
    data: { activeBrokerAccId: acc_id },
  });

  // Auto-create portfolio Account if none exists for this brokerAccId
  const existing = await prisma.account.findFirst({
    where: { userId: locals.user.id, brokerAccId: acc_id },
  });

  let accountId = existing?.id;
  if (!existing) {
    const created = await prisma.account.create({
      data: {
        userId: locals.user.id,
        name: name ?? buildAccountName(trd_env, acc_id),
        brokerName: 'moomoo',
        accountType: buildAccountType(trd_env),
        currency,
        brokerAccId: acc_id,
      },
    });
    accountId = created.id;
  }

  return json({ ok: true, accountId });
};
```

- [ ] **Step 4: Update test to import from route**

Update `src/routes/api/broker/accounts/select/select.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { buildAccountName, buildAccountType } from './+server.js';

describe('account helpers', () => {
  it('builds REAL account name', () => {
    expect(buildAccountName('REAL', '4652657')).toBe('Live Account (4652657)');
  });
  it('builds SIMULATE account name', () => {
    expect(buildAccountName('SIMULATE', '4652658')).toBe('Simulate Account (4652658)');
  });
  it('maps REAL to live type', () => {
    expect(buildAccountType('REAL')).toBe('live');
  });
  it('maps SIMULATE to paper type', () => {
    expect(buildAccountType('SIMULATE')).toBe('paper');
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd c:/Ampps/www/portfolio && npx vitest run src/routes/api/broker/accounts/select/select.test.ts
```

Expected: `✓ src/routes/api/broker/accounts/select/select.test.ts (4 tests)`

- [ ] **Step 6: Commit**

```bash
git add src/routes/api/broker/accounts/select/+server.ts src/routes/api/broker/accounts/select/select.test.ts
git commit -m "feat(api): add POST /api/broker/accounts/select with auto-create portfolio account"
```

---

## Task 5: broker.service.ts — pass accId to bridge

**Files:**
- Modify: `src/lib/services/broker.service.ts`

### Background

`syncMoomoo()` (line ~632) calls the bridge `/sync` endpoint. It needs to accept an optional `accId?: string` and append `&acc_id=XXXX` when provided. The function tries three paths: Laravel API → legacy API → bridge directly. The `acc_id` param only makes sense for the bridge path (`syncMoomooBridge`).

- [ ] **Step 1: Update `syncMoomoo` signature**

Find `export async function syncMoomoo(preferReal = true)` (line ~632). Change to:

```typescript
export async function syncMoomoo(preferReal = true, accId?: string): Promise<MoomooSyncResult> {
```

- [ ] **Step 2: Pass accId through to bridge call**

Find the line near the bottom of `syncMoomoo` that calls `syncMoomooBridge`:

```typescript
    return await syncMoomooBridge(preferReal);
```

Change to:

```typescript
    return await syncMoomooBridge(preferReal, accId);
```

- [ ] **Step 3: Update `syncMoomooBridge` signature and URL**

Find `async function syncMoomooBridge(preferReal: boolean)` (line ~676). Change to:

```typescript
async function syncMoomooBridge(preferReal: boolean, accId?: string): Promise<MoomooSyncResult> {
```

Inside that function, find:

```typescript
    fetch(`${bridgeBase()}/sync?prefer_real=${preferReal ? 'true' : 'false'}`, { method: 'POST' }),
```

Change to:

```typescript
    fetch(`${bridgeBase()}/sync?prefer_real=${preferReal ? 'true' : 'false'}${accId ? `&acc_id=${encodeURIComponent(accId)}` : ''}`, { method: 'POST' }),
```

- [ ] **Step 4: Write unit test for URL building logic**

Create `src/lib/services/broker-sync-url.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

function buildSyncUrl(base: string, preferReal: boolean, accId?: string): string {
  return `${base}/sync?prefer_real=${preferReal ? 'true' : 'false'}${accId ? `&acc_id=${encodeURIComponent(accId)}` : ''}`;
}

describe('buildSyncUrl', () => {
  it('omits acc_id when not provided', () => {
    expect(buildSyncUrl('http://localhost:8001', true)).toBe('http://localhost:8001/sync?prefer_real=true');
  });
  it('appends acc_id when provided', () => {
    expect(buildSyncUrl('http://localhost:8001', true, '4652657')).toBe('http://localhost:8001/sync?prefer_real=true&acc_id=4652657');
  });
  it('URL-encodes acc_id', () => {
    expect(buildSyncUrl('http://localhost:8001', false, '465 2657')).toBe('http://localhost:8001/sync?prefer_real=false&acc_id=465%202657');
  });
});
```

- [ ] **Step 5: Run tests**

```bash
cd c:/Ampps/www/portfolio && npx vitest run src/lib/services/broker-sync-url.test.ts
```

Expected: `✓ src/lib/services/broker-sync-url.test.ts (3 tests)`

- [ ] **Step 6: Commit**

```bash
git add src/lib/services/broker.service.ts src/lib/services/broker-sync-url.test.ts
git commit -m "feat(broker): pass optional accId to syncMoomoo and bridge /sync call"
```

---

## Task 6: Update portfolioSummary store + dashboard load

**Files:**
- Modify: `src/lib/stores/portfolio-summary.ts`
- Modify: `src/routes/dashboard/+page.server.ts`
- Modify: `src/routes/dashboard/+page.svelte`

### Background

The store needs `activeBrokerAccId` so the Topbar can read the currently selected account. The dashboard `load()` reads `locals.user.activeBrokerAccId` and passes it to `syncMoomoo`. The `+page.svelte` sets the store value on load.

Note: `locals.user` is typed via `src/app.d.ts` — it has the Prisma `User` shape, so `activeBrokerAccId` is now available after the migration.

- [ ] **Step 1: Update portfolio-summary store**

Replace the entire content of `src/lib/stores/portfolio-summary.ts` with:

```typescript
import { writable } from 'svelte/store';

export interface PortfolioSummary {
  totalValue: number;
  dayChange: number;
  dayChangePct: number;
  accountName: string;
  accountMode: 'LIVE' | 'SANDBOX';
  activeBrokerAccId: string | null;
}

export const portfolioSummary = writable<PortfolioSummary>({
  totalValue: 0,
  dayChange: 0,
  dayChangePct: 0,
  accountName: 'Portfolio',
  accountMode: 'LIVE',
  activeBrokerAccId: null,
});
```

- [ ] **Step 2: Update dashboard `load()` to pass activeBrokerAccId**

In `src/routes/dashboard/+page.server.ts`, find the `load` function. Locate where `syncMoomoo` is called — it's inside the `refresh` action and also in the `load` function directly. Search for all calls to `syncMoomoo()`.

For the `load` function, find the `syncMoomoo()` call and change it to pass the user's active account:

```typescript
const result = await syncMoomoo(true, locals.user?.activeBrokerAccId ?? undefined);
```

For the `refresh` action (line ~26), change:

```typescript
      const result = await syncMoomoo();
```

To:

```typescript
      const result = await syncMoomoo(true, user.activeBrokerAccId ?? undefined);
```

Also add `activeBrokerAccId` to the `load` return value so the page can access it:

Find where `load` returns its data object (look for `return {` near the end of the load function that contains `accounts`, `totalValue`, etc.) and add:

```typescript
activeBrokerAccId: locals.user?.activeBrokerAccId ?? null,
```

- [ ] **Step 3: Update `+page.svelte` portfolioSummary.set to include activeBrokerAccId**

In `src/routes/dashboard/+page.svelte`, find the `portfolioSummary.set({` block (line ~49):

```typescript
  $: portfolioSummary.set({
    totalValue:  data.totalValue,
    dayChange:   dayPl ?? 0,
    dayChangePct: dayPlPct ?? 0,
    accountName: data.accounts?.[0]?.name ?? 'Portfolio',
    accountMode: 'LIVE',
  });
```

Replace with:

```typescript
  $: portfolioSummary.set({
    totalValue:  data.totalValue,
    dayChange:   dayPl ?? 0,
    dayChangePct: dayPlPct ?? 0,
    accountName: data.accounts?.[0]?.name ?? 'Portfolio',
    accountMode: 'LIVE',
    activeBrokerAccId: data.activeBrokerAccId ?? null,
  });
```

- [ ] **Step 4: Run full test suite**

```bash
cd c:/Ampps/www/portfolio && npx vitest run 2>&1 | tail -10
```

Expected: all tests pass (no regressions).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stores/portfolio-summary.ts src/routes/dashboard/+page.server.ts src/routes/dashboard/+page.svelte
git commit -m "feat(dashboard): pass activeBrokerAccId to syncMoomoo, expose in store"
```

---

## Task 7: Topbar — full broker account dropdown

**Files:**
- Modify: `src/lib/components/portfolioai/Topbar.svelte`

### Background

The topbar currently has `switchToLive()` and `switchToPaper()` which just navigate to routes. Replace the account menu with a full broker account dropdown:

1. On open: fetch `GET /api/broker/accounts` (spinner while loading)
2. Each account row: coloured dot, name, acc_id chip, checkmark if selected
3. Static bottom row: `⚗ Paper Trading` (navigates to `/paper-trading`)
4. Selecting a broker account: POST `/api/broker/accounts/select`, then `invalidateAll()`
5. On error: show inline "Bridge offline" message

The existing `showAccountMenu`, `accountMode`, `accountName` variables and all existing CSS stay. We add new ones for the broker list.

- [ ] **Step 1: Add script variables and fetch logic**

In `src/lib/components/portfolioai/Topbar.svelte`, find the `<script>` block. After existing variable declarations, add:

```typescript
  import { invalidateAll } from '$app/navigation';

  // Broker account selector
  interface BrokerAccount {
    acc_id: string;
    trd_env: 'REAL' | 'SIMULATE';
    is_real: boolean;
    is_active: boolean;
    name: string;
  }

  let brokerAccounts: BrokerAccount[] = [];
  let brokerAccountsLoading = false;
  let brokerAccountsError = '';
  let selectingAccId = '';

  async function fetchBrokerAccounts() {
    brokerAccountsLoading = true;
    brokerAccountsError = '';
    try {
      const res = await fetch('/api/broker/accounts');
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      brokerAccounts = data as BrokerAccount[];
    } catch (e) {
      brokerAccountsError = 'Bridge offline';
      brokerAccounts = [];
    } finally {
      brokerAccountsLoading = false;
    }
  }

  async function selectBrokerAccount(acc: BrokerAccount) {
    selectingAccId = acc.acc_id;
    try {
      const res = await fetch('/api/broker/accounts/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acc_id: acc.acc_id, trd_env: acc.trd_env, name: acc.name }),
      });
      if (!res.ok) throw new Error('Select failed');
      showAccountMenu = false;
      await invalidateAll();
    } catch {
      brokerAccountsError = 'Failed to switch account';
    } finally {
      selectingAccId = '';
    }
  }

  // Fetch accounts when menu opens
  $: if (showAccountMenu && brokerAccounts.length === 0 && !brokerAccountsLoading) {
    fetchBrokerAccounts();
  }
```

Also check if `invalidateAll` is already imported — if so, skip adding it again.

- [ ] **Step 2: Replace the account menu markup**

Find the existing account menu markup inside the topbar template. It looks like:

```svelte
        {#if showAccountMenu}
          <div class="tb-acc-menu">
            <button class="tb-acc-option" class:selected={accountMode === 'LIVE'} on:click={switchToLive}>
              ...Live Account...
            </button>
            <button class="tb-acc-option" class:selected={accountMode === 'SANDBOX'} on:click={switchToPaper}>
              ...Paper Trading...
            </button>
          </div>
        {/if}
```

Replace the entire `{#if showAccountMenu}...{/if}` block with:

```svelte
        {#if showAccountMenu}
          <div class="tb-acc-menu">
            <div class="tb-acc-menu-section">BROKER ACCOUNTS</div>

            {#if brokerAccountsLoading}
              <div class="tb-acc-loading">Loading…</div>
            {:else if brokerAccountsError}
              <div class="tb-acc-error">{brokerAccountsError}</div>
            {:else if brokerAccounts.length === 0}
              <div class="tb-acc-loading">No accounts found</div>
            {:else}
              {#each brokerAccounts as acc}
                <button
                  class="tb-acc-option"
                  class:selected={$portfolioSummary.activeBrokerAccId === acc.acc_id}
                  disabled={selectingAccId === acc.acc_id}
                  on:click={() => selectBrokerAccount(acc)}
                >
                  <span class="tb-acc-dot" class:live={acc.is_real} class:sandbox={!acc.is_real}></span>
                  <span class="tb-acc-opt-label">{acc.name}</span>
                  <span class="tb-acc-id-chip">{acc.acc_id.slice(-6)}</span>
                  {#if $portfolioSummary.activeBrokerAccId === acc.acc_id}
                    <span class="tb-acc-opt-check">✓</span>
                  {/if}
                  {#if selectingAccId === acc.acc_id}
                    <span class="tb-acc-opt-check">…</span>
                  {/if}
                </button>
              {/each}
            {/if}

            <div class="tb-acc-divider"></div>
            <button class="tb-acc-option" on:click={switchToPaper}>
              <span class="tb-acc-symbol">⚗</span>
              <span class="tb-acc-opt-label">Paper Trading</span>
            </button>
          </div>
        {/if}
```

- [ ] **Step 3: Add CSS for new dropdown elements**

In the `<style>` block, add after the existing `.tb-acc-option` styles:

```css
  .tb-acc-menu-section {
    font-size: 0.58rem; font-weight: 700; letter-spacing: 0.08em;
    color: var(--muted); padding: 8px 12px 4px; text-transform: uppercase;
  }
  .tb-acc-loading { font-size: 0.72rem; color: var(--muted); padding: 8px 12px; }
  .tb-acc-error   { font-size: 0.72rem; color: var(--danger); padding: 8px 12px; }
  .tb-acc-divider { height: 1px; background: var(--border); margin: 4px 0; }
  .tb-acc-id-chip {
    font-size: 0.58rem; font-family: monospace; color: var(--muted);
    background: var(--surface-1); border-radius: 4px; padding: 1px 5px; margin-left: 4px;
  }
  .tb-acc-symbol { font-size: 0.85rem; margin-right: 2px; }
  .tb-acc-opt-label { flex: 1; }
```

- [ ] **Step 4: Run full test suite (no regressions)**

```bash
cd c:/Ampps/www/portfolio && npx vitest run 2>&1 | tail -10
```

Expected: all existing tests still pass.

- [ ] **Step 5: Commit**

```bash
git add src/lib/components/portfolioai/Topbar.svelte
git commit -m "feat(topbar): replace two-option switcher with full broker account dropdown"
```

---

## Task 8: End-to-end smoke test

**Files:**
- No file changes — verification only

### Background

With all pieces in place, verify the full flow works end-to-end.

- [ ] **Step 1: Start dev server and moomoo bridge**

```bash
cd c:/Ampps/www/portfolio && npm run dev &
cd c:/Ampps/www/portfolio/moomoo-service && python main.py &
```

- [ ] **Step 2: Open dashboard and check account dropdown**

Navigate to `http://localhost:5173/dashboard`. Click the account badge in the topbar. Verify:
- A loading spinner appears briefly
- Accounts list from the bridge is shown (REAL and/or SIMULATE accounts)
- Currently selected account (or none) shows a checkmark

- [ ] **Step 3: Select a different account**

Click a different account in the dropdown. Verify:
- Page reloads with the selected account's data
- Account badge in topbar shows the new account name
- Dashboard holdings reflect the selected account

- [ ] **Step 4: Verify persistence**

Reload the page (`F5`). Verify the previously selected account is still shown (not reset to default).

- [ ] **Step 5: Verify bridge-offline handling**

Stop the moomoo bridge. Open the dropdown. Verify:
- "Bridge offline" message appears instead of account list
- Paper Trading option still works (navigates to `/paper-trading`)

- [ ] **Step 6: Run full test suite one final time**

```bash
cd c:/Ampps/www/portfolio && npx vitest run 2>&1 | tail -15
```

Expected: all tests pass.

---

## Spec coverage checklist (self-review)

| Spec requirement | Task |
|---|---|
| `activeBrokerAccId` on User | Task 1 |
| `brokerAccId` on Account | Task 1 |
| `GET /api/broker/accounts` | Task 3 |
| `POST /api/broker/accounts/select` | Task 4 |
| Auto-create Account on first select | Task 4 |
| Bridge `/sync` accepts `acc_id` | Task 2 |
| `_fetch_account_bundle` explicit acc lookup | Task 2 |
| `syncMoomoo()` passes `accId` | Task 5 |
| `portfolioSummary` store gains `activeBrokerAccId` | Task 6 |
| Dashboard load reads `activeBrokerAccId` | Task 6 |
| Topbar dropdown fetches accounts | Task 7 |
| Topbar selecting account POSTs + invalidateAll | Task 7 |
| Bridge offline shows "Bridge offline" | Task 7 |
| Paper Trading stays as static row | Task 7 |
| Fallback to `prefer_real=true` when no acc selected | Task 6 (null check) |
