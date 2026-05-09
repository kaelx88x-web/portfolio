# Phase 2 — Broker Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Moomoo broker sync, CSV import enhancement, and portfolio snapshots — fully self-contained inside the `portfolio` project without any dependency on the `az` backend.

**Architecture:** A small Python FastAPI microservice (`moomoo-service/`) lives inside the `portfolio` project and bridges Moomoo OpenD. SvelteKit calls it from server-side routes via `fetch`. After sync, holdings are written into the existing Prisma SQLite DB and a `PortfolioSnapshot` is recorded. The CSV import already exists — we enhance it with Moomoo CSV schema detection.

**Tech Stack:** SvelteKit · TypeScript · Prisma (SQLite) · Python FastAPI (local microservice, port 8001) · moomoo-api Python SDK

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Create | `moomoo-service/main.py` | FastAPI app — Moomoo status + sync + holdings |
| Create | `moomoo-service/requirements.txt` | Python deps |
| Create | `moomoo-service/.env.example` | OpenD host/port config |
| Create | `moomoo-service/start.ps1` | One-line start script |
| Modify | `.env` | Add `MOOMOO_SERVICE_URL` |
| Modify | `prisma/schema.prisma` | Add `PortfolioSnapshot` + `BrokerSyncLog` models |
| Modify | `src/lib/types/portfolio.ts` | Add broker + snapshot types |
| Create | `src/lib/services/broker.service.ts` | Call moomoo-service API |
| Create | `src/lib/services/snapshot.service.ts` | CRUD PortfolioSnapshot in Prisma |
| Create | `src/routes/broker/+page.server.ts` | Load status + handle sync action |
| Create | `src/routes/broker/+page.svelte` | Moomoo status + sync button + holdings table |
| Create | `src/routes/snapshots/+page.server.ts` | Load snapshot list |
| Create | `src/routes/snapshots/+page.svelte` | Snapshot history table |
| Modify | `src/routes/+layout.svelte` | Add Broker Sync + Snapshots to nav |

---

## Task 1: Build moomoo-service Python FastAPI

**Files:**
- Create: `moomoo-service/main.py`
- Create: `moomoo-service/requirements.txt`
- Create: `moomoo-service/.env.example`
- Create: `moomoo-service/start.ps1`

- [ ] **Step 1: Create requirements.txt**

Create `moomoo-service/requirements.txt`:

```
fastapi==0.115.5
uvicorn[standard]==0.32.1
moomoo-api==10.5.6508
python-dotenv==1.0.1
```

- [ ] **Step 2: Create .env.example**

Create `moomoo-service/.env.example`:

```
MOOMOO_OPEND_HOST=127.0.0.1
MOOMOO_OPEND_PORT=11111
PORT=8001
```

Copy to `.env`:
```powershell
Copy-Item moomoo-service\.env.example moomoo-service\.env
```

- [ ] **Step 3: Create main.py**

Create `moomoo-service/main.py`:

```python
import os
import re
from datetime import datetime, timezone
from typing import Any

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

load_dotenv()

OPEND_HOST = os.getenv("MOOMOO_OPEND_HOST", "127.0.0.1")
OPEND_PORT = int(os.getenv("MOOMOO_OPEND_PORT", "11111"))

app = FastAPI(title="Portfolio Moomoo Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://127.0.0.1:5173", "http://127.0.0.1:5174", "http://localhost:5173", "http://localhost:5174"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"service": "moomoo-bridge", "version": "1.0.0"}


@app.get("/status")
def status():
    try:
        from moomoo import OpenQuoteContext, RET_OK
    except ImportError:
        return {
            "connected": False,
            "quote_logged_in": False,
            "trade_logged_in": False,
            "host": OPEND_HOST,
            "port": OPEND_PORT,
            "message": "moomoo-api is not installed.",
        }

    ctx = None
    try:
        ctx = OpenQuoteContext(host=OPEND_HOST, port=OPEND_PORT, ai_type=1)
        ret, data = ctx.get_global_state()
        if ret != RET_OK:
            return {"connected": False, "quote_logged_in": False, "trade_logged_in": False,
                    "host": OPEND_HOST, "port": OPEND_PORT, "message": str(data)}
        return {
            "connected": True,
            "quote_logged_in": bool(data.get("qot_logined")),
            "trade_logged_in": bool(data.get("trd_logined")),
            "host": OPEND_HOST,
            "port": OPEND_PORT,
            "server_version": data.get("server_ver"),
            "markets": {
                "hk": data.get("market_hk"),
                "us": data.get("market_us"),
                "sh": data.get("market_sh"),
                "sz": data.get("market_sz"),
            },
            "message": "OpenD is connected.",
        }
    except Exception as exc:
        return {"connected": False, "quote_logged_in": False, "trade_logged_in": False,
                "host": OPEND_HOST, "port": OPEND_PORT, "message": str(exc)}
    finally:
        if ctx is not None:
            ctx.close()


@app.post("/sync")
def sync(prefer_real: bool = True):
    try:
        from moomoo import OpenSecTradeContext, RET_OK, SecurityFirm, TrdEnv
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    firms = [
        SecurityFirm.FUTUINC,
        SecurityFirm.FUTUMY,
        SecurityFirm.FUTUSG,
        SecurityFirm.FUTUSECURITIES,
        SecurityFirm.FUTUAU,
        SecurityFirm.FUTUCA,
        SecurityFirm.FUTUJP,
    ]

    for firm in firms:
        ctx = None
        try:
            ctx = OpenSecTradeContext(host=OPEND_HOST, port=OPEND_PORT, security_firm=firm)
            ret, accounts = ctx.get_acc_list()
            if ret != RET_OK:
                continue
            account = _select_account(accounts, prefer_real)
            if account is None:
                continue

            trd_env = TrdEnv.REAL if str(account.get("trd_env")) == "REAL" else TrdEnv.SIMULATE
            ret, positions = ctx.position_list_query(
                trd_env=trd_env,
                acc_id=int(account.get("acc_id")),
                refresh_cache=True,
            )
            if ret != RET_OK:
                continue

            ret, acc_info = ctx.accinfo_query(
                trd_env=trd_env,
                acc_id=int(account.get("acc_id")),
                refresh_cache=True,
                currency="USD",
            )

            holdings = _parse_positions(positions)
            account_info = _parse_acc_info(acc_info if ret == RET_OK else None)

            return {
                "account_label": "Moomoo Live" if trd_env == TrdEnv.REAL else "Moomoo Simulated",
                "trade_environment": str(account.get("trd_env")),
                "security_firm": str(firm),
                "synced_at": datetime.now(timezone.utc).isoformat(),
                "holdings_count": len(holdings),
                "holdings": holdings,
                "account_info": account_info,
            }
        finally:
            if ctx is not None:
                ctx.close()

    raise HTTPException(status_code=400, detail="No active Moomoo account available from OpenD.")


@app.get("/holdings")
def holdings(prefer_real: bool = True):
    return sync(prefer_real=prefer_real)


def _select_account(accounts, prefer_real: bool):
    if accounts is None or len(accounts) == 0:
        return None
    active = accounts[accounts["acc_status"] == "ACTIVE"]
    if active.empty:
        return None
    order = ["REAL", "SIMULATE"] if prefer_real else ["SIMULATE", "REAL"]
    for env in order:
        matches = active[active["trd_env"] == env]
        if not matches.empty:
            return matches.iloc[0].to_dict()
    return active.iloc[0].to_dict()


def _parse_positions(positions) -> list[dict[str, Any]]:
    rows = []
    for row in positions.to_dict("records"):
        qty = _f(row.get("qty"))
        if qty == 0:
            continue
        avg_cost = _f(row.get("cost_price")) or _f(row.get("average_cost"))
        market_price = _f(row.get("nominal_price"))
        market_value = _f(row.get("market_val"))
        unrealized_pl = _f(row.get("pl_val")) or _f(row.get("unrealized_pl"))
        unrealized_pl_pct = _f(row.get("pl_ratio"))
        symbol = str(row.get("code") or "").upper()
        rows.append({
            "symbol": symbol,
            "asset_type": _asset_type(symbol),
            "quantity": qty,
            "average_cost": avg_cost,
            "total_cost": qty * avg_cost,
            "market_price": market_price,
            "market_value": market_value,
            "unrealized_pl": unrealized_pl,
            "unrealized_pl_percent": unrealized_pl_pct,
            "currency": str(row.get("currency") or "USD"),
        })
    return rows


def _parse_acc_info(acc_info) -> dict[str, float]:
    if acc_info is None or len(acc_info) == 0:
        return {}
    row = acc_info.iloc[0].to_dict()
    keys = ["total_assets", "securities_assets", "cash", "market_val", "unrealized_pl", "realized_pl"]
    return {k: _f(row.get(k)) for k in keys}


def _asset_type(symbol: str) -> str:
    ticker = symbol.split(".", 1)[-1]
    return "option" if re.search(r"\d{6}[CP]\d+$", ticker) else "stock"


def _f(value: Any) -> float:
    try:
        if value in (None, "", "N/A"):
            return 0.0
        return float(value)
    except (TypeError, ValueError):
        return 0.0


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8001"))
    uvicorn.run("main:app", host="127.0.0.1", port=port, reload=True)
```

- [ ] **Step 4: Create start.ps1**

Create `moomoo-service/start.ps1`:

```powershell
Set-Location $PSScriptRoot
if (-not (Test-Path "venv")) {
    python -m venv venv
    venv\Scripts\pip install -r requirements.txt
}
venv\Scripts\uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

- [ ] **Step 5: Install dependencies and test**

```powershell
cd c:\Ampps\www\portfolio\moomoo-service
python -m venv venv
venv\Scripts\pip install -r requirements.txt
```

Start service in a new terminal:
```powershell
cd c:\Ampps\www\portfolio\moomoo-service
venv\Scripts\uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

Verify:
```powershell
curl http://127.0.0.1:8001/status
```

Expected: JSON with `"connected": true/false`.

---

## Task 2: Add MOOMOO_SERVICE_URL to portfolio .env

**Files:**
- Modify: `.env`

- [ ] **Step 1: Append env var**

Open `c:/Ampps/www/portfolio/.env` and append:

```
MOOMOO_SERVICE_URL="http://127.0.0.1:8001"
```

---

## Task 3: Prisma schema — PortfolioSnapshot + BrokerSyncLog

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Update User model to add reverse relations**

In `prisma/schema.prisma`, replace the `User` model with:

```prisma
model User {
  id               String              @id @default(cuid())
  name             String
  email            String              @unique
  passwordHash     String
  baseCurrency     String              @default("USD")
  accounts         Account[]
  transactions     Transaction[]
  holdingSnaps     HoldingSnapshot[]
  watchlists       Watchlist[]
  portfolioSnaps   PortfolioSnapshot[]
  brokerSyncLogs   BrokerSyncLog[]
  createdAt        DateTime            @default(now())
  updatedAt        DateTime            @updatedAt
}
```

- [ ] **Step 2: Add new models at end of schema**

Append after the `WatchlistItem` model:

```prisma
model PortfolioSnapshot {
  id             String   @id @default(cuid())
  userId         String
  user           User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  snapshotDate   DateTime
  totalValue     Float
  cashBalance    Float    @default(0)
  holdingsCount  Int      @default(0)
  holdingsJson   String   @default("[]")
  allocationJson String   @default("{}")
  createdAt      DateTime @default(now())

  @@unique([userId, snapshotDate])
  @@index([userId, snapshotDate])
}

model BrokerSyncLog {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  broker       String
  status       String
  recordCount  Int      @default(0)
  errorMessage String?
  createdAt    DateTime @default(now())

  @@index([userId, createdAt])
}
```

- [ ] **Step 3: Push and generate**

```powershell
cd c:\Ampps\www\portfolio
npx prisma db push
npx prisma generate
```

Expected: `Your database is now in sync with your Prisma schema.`

---

## Task 4: Add types

**Files:**
- Modify: `src/lib/types/portfolio.ts`

- [ ] **Step 1: Append to types file**

Open `src/lib/types/portfolio.ts` and append:

```typescript
export type MoomooStatus = {
  connected: boolean;
  quote_logged_in: boolean;
  trade_logged_in: boolean;
  host: string;
  port: number;
  message: string;
  server_version?: string;
  markets?: Record<string, string>;
};

export type BrokerHolding = {
  symbol: string;
  asset_type: string;
  quantity: number;
  average_cost: number;
  total_cost: number;
  market_price: number;
  market_value: number;
  unrealized_pl: number;
  unrealized_pl_percent: number;
  currency: string;
};

export type MoomooSyncResult = {
  account_label: string;
  trade_environment: string;
  security_firm: string;
  synced_at: string;
  holdings_count: number;
  holdings: BrokerHolding[];
  account_info: Record<string, number>;
};

export type SnapshotHolding = {
  symbol: string;
  quantity: number;
  averageCost: number;
  marketPrice: number;
  marketValue: number;
  unrealizedPnl: number;
};
```

---

## Task 5: Create broker.service.ts

**Files:**
- Create: `src/lib/services/broker.service.ts`

- [ ] **Step 1: Create service**

Create `src/lib/services/broker.service.ts`:

```typescript
import type { BrokerHolding, MoomooStatus, MoomooSyncResult } from '$lib/types/portfolio';
import { env } from '$env/dynamic/private';

function base(): string {
  return env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';
}

export async function getMoomooStatus(): Promise<MoomooStatus> {
  const res = await fetch(`${base()}/status`);
  if (!res.ok) throw new Error(`Status check failed: ${res.status}`);
  return res.json();
}

export async function syncMoomoo(): Promise<MoomooSyncResult> {
  const res = await fetch(`${base()}/sync`, { method: 'POST' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(body.detail ?? `Sync failed: ${res.status}`);
  }
  return res.json();
}

export async function getBrokerHoldings(): Promise<BrokerHolding[]> {
  const result: MoomooSyncResult = await syncMoomoo();
  return result.holdings;
}
```

---

## Task 6: Create snapshot.service.ts

**Files:**
- Create: `src/lib/services/snapshot.service.ts`

- [ ] **Step 1: Create service**

Create `src/lib/services/snapshot.service.ts`:

```typescript
import { prisma } from '$lib/server/db';
import type { BrokerHolding, SnapshotHolding } from '$lib/types/portfolio';

export async function takeSnapshot(
  userId: string,
  holdings: BrokerHolding[],
  cashBalance: number
): Promise<void> {
  const snapshotDate = new Date();
  snapshotDate.setUTCHours(0, 0, 0, 0);

  const totalValue = holdings.reduce((sum, h) => sum + h.market_value, 0) + cashBalance;

  const holdingRows: SnapshotHolding[] = holdings.map((h) => ({
    symbol: h.symbol,
    quantity: h.quantity,
    averageCost: h.average_cost,
    marketPrice: h.market_price,
    marketValue: h.market_value,
    unrealizedPnl: h.unrealized_pl
  }));

  const allocationBySymbol: Record<string, number> = {};
  for (const h of holdingRows) {
    allocationBySymbol[h.symbol] =
      totalValue > 0 ? Math.round((h.marketValue / totalValue) * 10000) / 100 : 0;
  }

  await prisma.portfolioSnapshot.upsert({
    where: { userId_snapshotDate: { userId, snapshotDate } },
    create: {
      userId,
      snapshotDate,
      totalValue,
      cashBalance,
      holdingsCount: holdings.length,
      holdingsJson: JSON.stringify(holdingRows),
      allocationJson: JSON.stringify(allocationBySymbol)
    },
    update: {
      totalValue,
      cashBalance,
      holdingsCount: holdings.length,
      holdingsJson: JSON.stringify(holdingRows),
      allocationJson: JSON.stringify(allocationBySymbol)
    }
  });
}

export async function listSnapshots(userId: string, limit = 30) {
  return prisma.portfolioSnapshot.findMany({
    where: { userId },
    orderBy: { snapshotDate: 'desc' },
    take: limit
  });
}

export async function getLatestSnapshot(userId: string) {
  return prisma.portfolioSnapshot.findFirst({
    where: { userId },
    orderBy: { snapshotDate: 'desc' }
  });
}

export async function writeSyncLog(
  userId: string,
  status: 'success' | 'failed',
  recordCount: number,
  errorMessage?: string
): Promise<void> {
  await prisma.brokerSyncLog.create({
    data: { userId, broker: 'moomoo', status, recordCount, errorMessage }
  });
}
```

---

## Task 7: Build /broker page

**Files:**
- Create: `src/routes/broker/+page.server.ts`
- Create: `src/routes/broker/+page.svelte`

- [ ] **Step 1: Create page.server.ts**

Create `src/routes/broker/+page.server.ts`:

```typescript
import { getMoomooStatus, syncMoomoo } from '$lib/services/broker.service';
import { takeSnapshot, writeSyncLog } from '$lib/services/snapshot.service';
import { getDemoUser } from '$lib/server/demo-user';
import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const status = await getMoomooStatus().catch(() => null);
  return { status };
};

export const actions: Actions = {
  sync: async () => {
    const user = await getDemoUser();
    try {
      const result = await syncMoomoo();
      await takeSnapshot(user.id, result.holdings, result.account_info?.cash ?? 0);
      await writeSyncLog(user.id, 'success', result.holdings_count);
      return {
        success: true,
        message: `Synced ${result.holdings_count} holdings from ${result.account_label}.`,
        synced_at: result.synced_at,
        holdings: result.holdings,
        account_info: result.account_info
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Sync failed.';
      await getDemoUser().then((u) => writeSyncLog(u.id, 'failed', 0, msg)).catch(() => {});
      return fail(400, { success: false, message: msg, holdings: [] });
    }
  }
};
```

- [ ] **Step 2: Create page.svelte**

Create `src/routes/broker/+page.svelte`:

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import type { BrokerHolding } from '$lib/types/portfolio';
  import type { PageData } from './$types';

  export let data: PageData;
  export let form: {
    success?: boolean;
    message?: string;
    synced_at?: string;
    holdings?: BrokerHolding[];
    account_info?: Record<string, number>;
  } | null = null;

  $: status = data.status;
  $: holdings = form?.holdings ?? [];
  $: accountInfo = form?.account_info ?? {};

  let syncing = false;

  function fmt(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }
  function pct(n: number) {
    return (n >= 0 ? '+' : '') + (n * 100).toFixed(2) + '%';
  }
</script>

<div class="mb-6 flex flex-wrap items-start justify-between gap-4">
  <div>
    <h1 class="text-2xl font-bold">Broker Sync</h1>
    <p class="mt-1 text-sm text-slate-500">Moomoo OpenD — sync live positions into your portfolio.</p>
  </div>

  <form
    method="POST"
    action="?/sync"
    use:enhance={() => {
      syncing = true;
      return async ({ update }) => {
        await update();
        syncing = false;
      };
    }}
  >
    <button class="button" disabled={!status?.connected || syncing}>
      {syncing ? 'Syncing…' : 'Sync Moomoo'}
    </button>
  </form>
</div>

{#if form?.message}
  <div class="mb-5 rounded-md border px-4 py-3 text-sm {form.success ? 'border-green-200 bg-green-50 text-green-800' : 'border-red-200 bg-red-50 text-red-800'}">
    {form.message}
    {#if form.synced_at}
      <span class="ml-2 text-xs opacity-60">at {new Date(form.synced_at).toLocaleTimeString()}</span>
    {/if}
  </div>
{/if}

<!-- Status Cards -->
<div class="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
  <div class="card p-4">
    <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">OpenD</div>
    <div class="mt-2 flex items-center gap-2">
      <span class="h-2.5 w-2.5 rounded-full {status?.connected ? 'bg-green-500' : 'bg-red-400'}"></span>
      <span class="font-semibold">{status?.connected ? 'Connected' : 'Disconnected'}</span>
    </div>
    <p class="mt-1 truncate text-xs text-slate-400">{status?.message ?? '—'}</p>
  </div>

  <div class="card p-4">
    <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Quote</div>
    <div class="mt-2 font-semibold">{status?.quote_logged_in ? 'Logged in' : '—'}</div>
  </div>

  <div class="card p-4">
    <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Trade</div>
    <div class="mt-2 font-semibold">{status?.trade_logged_in ? 'Logged in' : '—'}</div>
  </div>

  <div class="card p-4">
    <div class="text-xs font-semibold uppercase tracking-wide text-slate-500">Total Assets</div>
    <div class="mt-2 font-semibold">{accountInfo.total_assets ? fmt(accountInfo.total_assets) : '—'}</div>
    {#if accountInfo.cash}
      <p class="mt-0.5 text-xs text-slate-400">Cash: {fmt(accountInfo.cash)}</p>
    {/if}
  </div>
</div>

<!-- Holdings Table -->
<div class="card">
  <div class="border-b border-line px-5 py-4">
    <h2 class="font-bold">Live Holdings {holdings.length ? `(${holdings.length})` : ''}</h2>
    <p class="mt-0.5 text-xs text-slate-500">
      {#if holdings.length}
        From last sync. Click Sync Moomoo to refresh.
      {:else}
        Click Sync Moomoo to load positions from OpenD.
      {/if}
    </p>
  </div>

  {#if holdings.length === 0}
    <div class="px-5 py-12 text-center text-sm text-slate-400">
      {status?.connected ? 'Click "Sync Moomoo" to pull live positions.' : 'Start Moomoo OpenD first, then sync.'}
    </div>
  {:else}
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Symbol</th>
            <th>Type</th>
            <th class="text-right">Qty</th>
            <th class="text-right">Avg Cost</th>
            <th class="text-right">Price</th>
            <th class="text-right">Market Value</th>
            <th class="text-right">Unrealized P/L</th>
            <th class="text-right">P/L %</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          {#each holdings as h}
            <tr>
              <td class="font-semibold">{h.symbol}</td>
              <td class="text-xs text-slate-500">{h.asset_type}</td>
              <td class="text-right">{h.quantity}</td>
              <td class="text-right">{fmt(h.average_cost)}</td>
              <td class="text-right">{fmt(h.market_price)}</td>
              <td class="text-right font-semibold">{fmt(h.market_value)}</td>
              <td class="text-right {h.unrealized_pl >= 0 ? 'positive' : 'negative'}">{fmt(h.unrealized_pl)}</td>
              <td class="text-right {h.unrealized_pl_percent >= 0 ? 'positive' : 'negative'}">{pct(h.unrealized_pl_percent)}</td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  {/if}
</div>
```

---

## Task 8: Build /snapshots page

**Files:**
- Create: `src/routes/snapshots/+page.server.ts`
- Create: `src/routes/snapshots/+page.svelte`

- [ ] **Step 1: Create page.server.ts**

Create `src/routes/snapshots/+page.server.ts`:

```typescript
import { listSnapshots } from '$lib/services/snapshot.service';
import { getDemoUser } from '$lib/server/demo-user';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const user = await getDemoUser();
  const snapshots = await listSnapshots(user.id);
  return { snapshots };
};
```

- [ ] **Step 2: Create page.svelte**

Create `src/routes/snapshots/+page.svelte`:

```svelte
<script lang="ts">
  import type { PageData } from './$types';

  export let data: PageData;
  $: snapshots = data.snapshots ?? [];

  function fmt(n: number) {
    return n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
  }
  function fmtDate(d: string | Date) {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
</script>

<div class="mb-6">
  <h1 class="text-2xl font-bold">Portfolio Snapshots</h1>
  <p class="mt-1 text-sm text-slate-500">Point-in-time portfolio state recorded after each Moomoo sync.</p>
</div>

{#if snapshots.length === 0}
  <div class="card px-6 py-16 text-center text-sm text-slate-400">
    No snapshots yet. Go to <a href="/broker" class="underline">Broker Sync</a> and click Sync Moomoo to create the first one.
  </div>
{:else}
  <div class="card">
    <div class="table-wrap">
      <table class="data-table">
        <thead>
          <tr>
            <th>Date</th>
            <th class="text-right">Total Value</th>
            <th class="text-right">Cash</th>
            <th class="text-right">Holdings</th>
            <th>Top Allocations</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-line">
          {#each snapshots as snap}
            {@const allocation = JSON.parse(snap.allocationJson)}
            {@const topAllocs = Object.entries(allocation)
              .sort((a, b) => Number(b[1]) - Number(a[1]))
              .slice(0, 5)}
            <tr>
              <td class="font-semibold">{fmtDate(snap.snapshotDate)}</td>
              <td class="text-right font-semibold">{fmt(snap.totalValue)}</td>
              <td class="text-right text-slate-500">{fmt(snap.cashBalance)}</td>
              <td class="text-right">{snap.holdingsCount}</td>
              <td>
                <div class="flex flex-wrap gap-1">
                  {#each topAllocs as [symbol, p]}
                    <span class="rounded bg-panel px-2 py-0.5 text-xs font-medium">
                      {symbol} {Number(p).toFixed(1)}%
                    </span>
                  {/each}
                </div>
              </td>
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </div>
{/if}
```

---

## Task 9: Update navigation

**Files:**
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Update script block**

In `src/routes/+layout.svelte`, replace the entire `<script>` block:

```svelte
<script lang="ts">
  import '../app.css';
  import {
    BarChart3,
    BriefcaseBusiness,
    Camera,
    Eye,
    FileUp,
    LayoutDashboard,
    ListChecks,
    RefreshCw,
    Settings,
    WalletCards
  } from 'lucide-svelte';

  const nav = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/accounts', label: 'Accounts', icon: WalletCards },
    { href: '/assets', label: 'Assets', icon: BriefcaseBusiness },
    { href: '/holdings', label: 'Holdings', icon: BarChart3 },
    { href: '/transactions', label: 'Transactions', icon: ListChecks },
    { href: '/broker', label: 'Broker Sync', icon: RefreshCw },
    { href: '/snapshots', label: 'Snapshots', icon: Camera },
    { href: '/import', label: 'Import', icon: FileUp },
    { href: '/watchlist', label: 'Watchlist', icon: Eye },
    { href: '/settings', label: 'Settings', icon: Settings }
  ];
</script>
```

- [ ] **Step 2: Update header subtitle**

In the same file, change the subtitle text from:

```svelte
<div class="hidden text-sm text-slate-500 lg:block">Phase 1 - Portfolio Insight</div>
```

to:

```svelte
<div class="hidden text-sm text-slate-500 lg:block">Phase 2 - Broker Sync</div>
```

---

## Task 10: Smoke test end-to-end

- [ ] **Step 1: Start moomoo-service**

In a new terminal:
```powershell
cd c:\Ampps\www\portfolio\moomoo-service
venv\Scripts\uvicorn main:app --host 127.0.0.1 --port 8001 --reload
```

- [ ] **Step 2: Restart SvelteKit**

```powershell
cd c:\Ampps\www\portfolio
npm run dev
```

- [ ] **Step 3: Verify /broker page loads**

Open `http://127.0.0.1:5174/broker`. Expected: Status cards visible. If OpenD is running, green "Connected".

- [ ] **Step 4: Click Sync Moomoo**

Expected: Success banner → holdings table populates with live positions.

- [ ] **Step 5: Verify /snapshots**

Open `http://127.0.0.1:5174/snapshots`. Expected: One row with today's date, total value, and allocation tags.

- [ ] **Step 6: Verify nav**

"Broker Sync" and "Snapshots" links appear in sidebar.

---

## Self-Review

- `broker.service.ts` calls `getMoomooStatus()` on page load (no sync) — safe, read-only.
- `getBrokerHoldings()` calls `syncMoomoo()` internally — rename to avoid confusion; in the current plan `getBrokerHoldings` is unused, `syncMoomoo` is called directly in the action. No issue.
- `unrealized_pl_percent` from moomoo-service is a raw ratio (e.g. `0.05`). The svelte component multiplies by 100 in `pct()` for display — consistent.
- `PortfolioSnapshot.snapshotDate` is zeroed to UTC midnight in `takeSnapshot` before upsert — the `@@unique([userId, snapshotDate])` constraint works correctly.
- `writeSyncLog` is imported in `broker/+page.server.ts` from `snapshot.service` — ✅ defined in Task 6.
- `getDemoUser()` returns the full User object; `.id` is used for all Prisma writes — ✅ consistent across all tasks.
