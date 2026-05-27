# Paper Trading Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a fully self-contained paper trading environment with amber topbar treatment, inline order form (stock + option with chain table), client-side validation, server-side risk guards, preview/submit flow, position simulator, order history update, and reset account functionality.

**Architecture:** All order-form UI lives in `paper-trading/+page.svelte`. Server actions (`previewOrder`, `submitOrder`, `resetAccount`) live in `+page.server.ts` and call the moomoo bridge. Two new auth-gated API routes proxy option chain data. The moomoo bridge gains `dry_run` support on `/execution/orders` and a new `/paper/reset` endpoint.

**Tech Stack:** SvelteKit (TypeScript), custom CSS vars (no Tailwind), moomoo-service Python FastAPI bridge.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/lib/components/portfolioai/Topbar.svelte` | Modify | Amber tint on `.tb` row + warning banner below topbar when on paper routes |
| `src/lib/components/portfolioai/AppShell.svelte` | Modify | Change `.shell-topbar` height from `56px` to `auto; min-height: 56px` so warning banner fits |
| `src/routes/api/paper/options/expiry/+server.ts` | Create | Auth-gated proxy → bridge `/options/expiry` |
| `src/routes/api/paper/options/chain/+server.ts` | Create | Auth-gated proxy → bridge `/options/chain` |
| `src/routes/paper-trading/+page.svelte` | Modify | Account balance panel, order form (stock + option tabs), preview card, position simulator, reset modal, toasts, order history update |
| `src/routes/paper-trading/+page.server.ts` | Modify | Add `previewOrder`, `submitOrder`, `resetAccount` actions |
| `moomoo-service/main.py` | Modify | Add `dry_run: bool` to `ExecutionOrderRequest` + `/paper/reset` endpoint |

---

## Task 1: Topbar amber treatment + AppShell height fix

**Files:**
- Modify: `src/lib/components/portfolioai/Topbar.svelte`
- Modify: `src/lib/components/portfolioai/AppShell.svelte`

### Background

`Topbar.svelte` already has `$: isPaperRoute = $page.url.pathname.startsWith('/paper-trading')`. We use this for all amber styling. AppShell currently has `.shell-topbar { height: 56px }` — change it to `min-height: 56px` so the 24px warning banner can fit below the topbar row.

- [ ] **Step 1: Add amber CSS class to the `.tb` div in Topbar.svelte**

In `src/lib/components/portfolioai/Topbar.svelte`, find the opening `<div class="tb">` and add the paper conditional class:

```svelte
<div class="tb" class:paper={isPaperRoute}>
```

- [ ] **Step 2: Add amber `.tb.paper` CSS to Topbar.svelte styles**

At the end of the `<style>` block (before `</style>`), add:

```css
/* ── Paper mode amber treatment ── */
.tb.paper {
  background: rgba(245,158,11,0.08);
  border-bottom: 2px solid rgba(245,158,11,0.4);
}
```

- [ ] **Step 3: Add the warning banner markup to Topbar.svelte**

The Topbar component currently renders only the `.tb` div. Wrap the whole thing in a container so we can add the banner below:

Replace the opening `<div class="tb" class:paper={isPaperRoute}>` with a wrapper structure. Find this in the template section:

```svelte
<div class="tb" class:paper={isPaperRoute}>
```

Replace with:

```svelte
<div class="topbar-root">
<div class="tb" class:paper={isPaperRoute}>
```

Then after the closing `</div>` of `.tb` (line that ends the topbar row), add:

```svelte
</div>

{#if isPaperRoute}
  <div class="paper-banner">
    <span class="paper-banner-icon">⚠</span>
    <span>You are in paper trading mode — no real money is at risk</span>
  </div>
{/if}
</div>
```

> **Important:** The existing final `</div>` closes the `.tb` row — change it so the structure is:
> `<div class="topbar-root"> <div class="tb paper"> ... </div> {#if isPaperRoute}<div class="paper-banner">...</div>{/if} </div>`

- [ ] **Step 4: Add CSS for `.topbar-root` and `.paper-banner`**

```css
.topbar-root { display: flex; flex-direction: column; }

.paper-banner {
  display: flex; align-items: center; gap: 6px;
  height: 24px; padding: 0 16px;
  background: rgba(245,158,11,0.06);
  border-bottom: 1px solid rgba(245,158,11,0.2);
  font-size: 0.7rem; color: var(--warning);
}
.paper-banner-icon { font-size: 0.7rem; }
```

- [ ] **Step 5: Fix AppShell.svelte `.shell-topbar` height**

In `src/lib/components/portfolioai/AppShell.svelte`, find:

```css
.shell-topbar {
  height: 56px; flex-shrink: 0;
```

Change `height: 56px` to `min-height: 56px` (keep rest unchanged):

```css
.shell-topbar {
  min-height: 56px; flex-shrink: 0;
```

- [ ] **Step 6: Verify in browser**

Navigate to `/paper-trading` and confirm:
- Topbar row has amber tint and bottom border
- 24px amber "⚠ You are in paper trading mode" banner appears below the topbar row
- Navigate away from `/paper-trading` and confirm topbar reverts to normal

- [ ] **Step 7: Commit**

```bash
git add src/lib/components/portfolioai/Topbar.svelte src/lib/components/portfolioai/AppShell.svelte
git commit -m "feat: topbar amber treatment and warning banner in paper trading mode"
```

---

## Task 2: API proxy routes for paper options (auth-gated)

**Files:**
- Create: `src/routes/api/paper/options/expiry/+server.ts`
- Create: `src/routes/api/paper/options/chain/+server.ts`

### Background

The existing `/api/options/expiry` and `/api/options/chain` routes don't check authentication. The paper trading routes need auth so only logged-in users can call them. They reuse the existing `getOptionExpiry` and `getOptionChain` from `$lib/services/broker.service`.

- [ ] **Step 1: Create the expiry proxy route**

Create `src/routes/api/paper/options/expiry/+server.ts`:

```typescript
import { json, error } from '@sveltejs/kit';
import { getOptionExpiry } from '$lib/services/broker.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');
  const symbol = url.searchParams.get('symbol');
  if (!symbol) throw error(400, 'symbol is required');
  try {
    const result = await getOptionExpiry(symbol);
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Bridge offline' }, { status: 500 });
  }
};
```

- [ ] **Step 2: Create the chain proxy route**

Create `src/routes/api/paper/options/chain/+server.ts`:

```typescript
import { json, error } from '@sveltejs/kit';
import { getOptionChain } from '$lib/services/broker.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');
  const symbol = url.searchParams.get('symbol');
  const expiry = url.searchParams.get('expiry');
  if (!symbol) throw error(400, 'symbol is required');
  if (!expiry) throw error(400, 'expiry is required');
  const optionType = (url.searchParams.get('option_type') ?? 'call') as 'call' | 'put' | 'all';
  try {
    const result = await getOptionChain(symbol, expiry, optionType);
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Bridge offline' }, { status: 500 });
  }
};
```

- [ ] **Step 3: Verify routes exist and respond**

Start dev server (`npm run dev`). In a browser logged in as a user, open DevTools and run:

```javascript
fetch('/api/paper/options/expiry?symbol=AAPL').then(r => r.json()).then(console.log)
```

Expected: JSON response (expiry list from bridge, or bridge error message if bridge is offline — not a 404 or 401).

Log out, repeat — expect 401.

- [ ] **Step 4: Commit**

```bash
git add src/routes/api/paper/options/expiry/+server.ts src/routes/api/paper/options/chain/+server.ts
git commit -m "feat: add auth-gated API proxy routes for paper options expiry and chain"
```

---

## Task 3: moomoo-service bridge additions

**Files:**
- Modify: `moomoo-service/main.py`

### Background

Two changes needed in the Python bridge:
1. Add `dry_run: bool = False` to `ExecutionOrderRequest` — when `True`, validate everything but skip the actual `place_order` call and return a mock `{ status: "dry_run_ok" }` response.
2. Add `POST /paper/reset` endpoint that cancels all open SIMULATE orders and closes all SIMULATE positions with market orders.

- [ ] **Step 1: Add `dry_run` field to `ExecutionOrderRequest`**

In `moomoo-service/main.py`, find the `ExecutionOrderRequest` class (currently around line 36):

```python
class ExecutionOrderRequest(BaseModel):
    symbol: str
    side: str
    order_type: str = "limit"
    quantity: float
    price: float | None = None
    trade_env: str = "SIMULATE"
    mode: str = "paper"
    acc_id: str | int | None = None
    client_order_id: str | None = None
    source_ticket_id: str | None = None
```

Add `dry_run: bool = False` before the closing of the class:

```python
class ExecutionOrderRequest(BaseModel):
    symbol: str
    side: str
    order_type: str = "limit"
    quantity: float
    price: float | None = None
    trade_env: str = "SIMULATE"
    mode: str = "paper"
    acc_id: str | int | None = None
    client_order_id: str | None = None
    source_ticket_id: str | None = None
    dry_run: bool = False
```

- [ ] **Step 2: Add dry_run short-circuit in `/execution/orders`**

In `execution_order()` function (around line 1200), after the validation checks (`if req.quantity <= 0`, `if req.order_type.lower() == "limit"`...) but BEFORE the `try: from moomoo import ...` block, insert the dry_run early return:

Find:
```python
    try:
        from moomoo import OpenSecTradeContext, OrderType, RET_OK, TrdEnv, TrdMarket, TrdSide
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")
```

Insert before it:
```python
    if req.dry_run:
        return {
            "status": "dry_run_ok",
            "broker_order_id": None,
            "account_id": None,
            "trade_env": req.trade_env,
            "market": "US",
            "dry_run": True,
        }
```

- [ ] **Step 3: Add `/paper/reset` endpoint**

At the end of `moomoo-service/main.py`, append:

```python
@app.post("/paper/reset")
def paper_reset():
    """Cancel all open SIMULATE orders and close all SIMULATE positions."""
    try:
        from moomoo import OpenSecTradeContext, RET_OK, TrdEnv, TrdMarket, TrdSide, OrderType, ModifyOrderOp
    except ImportError:
        raise HTTPException(status_code=500, detail="moomoo-api is not installed.")

    cancelled = 0
    closed = 0
    errors = []

    ctx = None
    try:
        ctx = OpenSecTradeContext(filter_trdmarket=TrdMarket.US, host=OPEND_HOST, port=OPEND_PORT)

        # 1. Get all open SIMULATE orders and cancel them
        ret, orders = ctx.order_list_query(trd_env=TrdEnv.SIMULATE)
        if ret == RET_OK and orders is not None and not orders.empty:
            for row in orders.to_dict("records"):
                order_id = str(row.get("order_id") or "")
                status = str(row.get("order_status") or "")
                # Only cancel pending/queued orders
                if order_id and status.upper() not in ("FILLED_ALL", "CANCELLED_ALL", "FAILED", "DISABLED"):
                    try:
                        ctx.modify_order(
                            modify_order_op=ModifyOrderOp.CANCEL,
                            order_id=order_id, qty=0, price=0,
                            trd_env=TrdEnv.SIMULATE,
                        )
                        cancelled += 1
                    except Exception as exc:
                        errors.append(f"cancel {order_id}: {exc}")

        # 2. Get all SIMULATE positions and close them with market orders
        ret2, positions = ctx.position_list_query(trd_env=TrdEnv.SIMULATE)
        if ret2 == RET_OK and positions is not None and not positions.empty:
            for row in positions.to_dict("records"):
                code = str(row.get("code") or "")
                qty = float(row.get("qty") or 0)
                if not code or qty <= 0:
                    continue
                close_side = TrdSide.SELL  # long positions
                try:
                    ctx.place_order(
                        price=0, qty=qty, code=code,
                        trd_side=close_side, order_type=OrderType.MARKET,
                        trd_env=TrdEnv.SIMULATE,
                    )
                    closed += 1
                except Exception as exc:
                    errors.append(f"close {code}: {exc}")

        return {
            "reset": True,
            "cancelled_orders": cancelled,
            "closed_positions": closed,
            "errors": errors,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    finally:
        if ctx is not None:
            ctx.close()
```

- [ ] **Step 4: Verify bridge changes**

Restart moomoo-service (`python main.py` in `moomoo-service/`). Test dry_run with curl:

```bash
curl -s -X POST http://127.0.0.1:8001/execution/orders \
  -H "Content-Type: application/json" \
  -d '{"symbol":"US.AAPL","side":"buy","order_type":"limit","quantity":1,"price":180,"dry_run":true}' | python -m json.tool
```

Expected: `{"status": "dry_run_ok", ...}` — no actual order placed.

```bash
curl -s -X POST http://127.0.0.1:8001/paper/reset | python -m json.tool
```

Expected: `{"reset": true, "cancelled_orders": N, "closed_positions": N, "errors": []}` (or 403 if read-only mode).

- [ ] **Step 5: Commit**

```bash
git add moomoo-service/main.py
git commit -m "feat(bridge): add dry_run support to /execution/orders and /paper/reset endpoint"
```

---

## Task 4: Account balance amber panel + page header actions

**Files:**
- Modify: `src/routes/paper-trading/+page.svelte`

### Background

Add a 4-column amber stat strip ABOVE the existing stats cards, sourced from `paper.account_info`. Add `+ New Order` and `Reset Account` buttons to the `PageHeader` area. The form and modal are wired up in later tasks — for now just wire the state variables and button toggles.

- [ ] **Step 1: Add required imports and state variables to the `<script>` block**

At the top of the `<script lang="ts">` block in `src/routes/paper-trading/+page.svelte`, add after the existing imports:

```typescript
import { enhance } from '$app/forms';
import { invalidateAll } from '$app/navigation';
import type { ActionData } from './$types';

export let form: ActionData;

// Order form state
let showOrderForm = false;
let showResetModal = false;

// Toast state
let toasts: { id: number; type: 'success' | 'warn' | 'error'; message: string }[] = [];
let toastCounter = 0;

function addToast(type: 'success' | 'warn' | 'error', message: string) {
  const id = ++toastCounter;
  toasts = [...toasts, { id, type, message }];
  setTimeout(() => { toasts = toasts.filter(t => t.id !== id); }, 4000);
}

// Account balance panel helpers
function usedCollateral(ai: typeof info): number {
  return (ai.total_assets ?? 0) - (ai.cash ?? 0) - (ai.market_val ?? 0);
}
```

- [ ] **Step 2: Add the amber account balance panel markup**

After the existing `{#if fromAgent && agentPushedAt}` agent badge block and BEFORE the `<!-- ── Account bar ───── -->` comment, insert the amber balance panel:

```svelte
<!-- ── Account balance panel (amber) ─────────────────────────── -->
{#if !paper.error}
  <div class="balance-panel">
    <div class="balance-stat">
      <div class="balance-label">Cash Available</div>
      <div class="balance-value">{money(info.cash ?? 0)}</div>
    </div>
    <div class="balance-stat">
      <div class="balance-label">Buying Power</div>
      <div class="balance-value">{money(info.power ?? 0)}</div>
    </div>
    <div class="balance-stat">
      <div class="balance-label">Used Collateral</div>
      <div class="balance-value">{money(usedCollateral(info))}</div>
    </div>
    <div class="balance-stat">
      <div class="balance-label">Unrealized P&amp;L</div>
      <div class="balance-value" class:positive={info.unrealized_pl >= 0} class:negative={info.unrealized_pl < 0}>
        {fmt(info.unrealized_pl ?? 0)}
      </div>
    </div>
  </div>
{/if}
```

- [ ] **Step 3: Add action buttons to the page header area**

After the `<PageHeader>` component call, add the action button row:

```svelte
<!-- ── Header actions ─────────────────────────────────────────── -->
{#if !paper.error}
  <div class="header-actions">
    <button class="btn-new-order" on:click={() => showOrderForm = !showOrderForm}>
      {showOrderForm ? '✕ Close' : '+ New Order'}
    </button>
    <button class="btn-reset" on:click={() => showResetModal = true}>
      Reset Account
    </button>
  </div>
{/if}
```

- [ ] **Step 4: Add CSS for the new elements**

At the end of the `<style>` block, append:

```css
/* ── Account balance panel ───────────────────────────────────── */
.balance-panel {
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;
  margin-bottom: 16px; padding: 14px 16px;
  border: 1px solid rgba(245,158,11,0.25);
  border-radius: 10px; background: rgba(245,158,11,0.05);
}
.balance-stat { display: flex; flex-direction: column; gap: 3px; }
.balance-label {
  font-size: 0.62rem; font-weight: 600; color: rgba(245,158,11,0.7);
  text-transform: uppercase; letter-spacing: 0.05em;
}
.balance-value { font-size: 0.9rem; font-weight: 700; color: var(--text); }

/* ── Header actions ──────────────────────────────────────────── */
.header-actions {
  display: flex; gap: 8px; align-items: center;
  margin-bottom: 16px;
}
.btn-new-order {
  padding: 7px 16px; border-radius: 7px;
  background: var(--primary); border: none; color: #fff;
  font-size: 0.75rem; font-weight: 700; cursor: pointer;
  transition: opacity 0.15s;
}
.btn-new-order:hover { opacity: 0.85; }
.btn-reset {
  padding: 7px 14px; border-radius: 7px;
  background: rgba(var(--danger-rgb),0.1); border: 1px solid rgba(var(--danger-rgb),0.25);
  color: var(--danger); font-size: 0.75rem; font-weight: 600; cursor: pointer;
}
.btn-reset:hover { background: rgba(var(--danger-rgb),0.18); }

@media (max-width: 900px) { .balance-panel { grid-template-columns: repeat(2, 1fr); } }
@media (max-width: 500px) { .balance-panel { grid-template-columns: 1fr; } }
```

- [ ] **Step 5: Verify in browser**

Open `/paper-trading`. Confirm:
- Amber 4-column balance panel shows Cash, Buying Power, Used Collateral, Unrealized P&L
- `+ New Order` and `Reset Account` buttons appear below PageHeader
- Clicking `+ New Order` toggles the button label (form will be wired in Task 5)

- [ ] **Step 6: Commit**

```bash
git add src/routes/paper-trading/+page.svelte
git commit -m "feat(paper): add account balance amber panel and header action buttons"
```

---

## Task 5: Order form — Stock tab

**Files:**
- Modify: `src/routes/paper-trading/+page.svelte`

### Background

Add the inline order form that appears when `showOrderForm` is true. Stock tab with side toggle (BUY/SELL), symbol input (auto-uppercase), order type toggle (Market/Limit), qty, and limit price (hidden for Market). Uses SvelteKit `use:enhance` for form submission. `localStorage` saves/restores last-used symbol.

- [ ] **Step 1: Add stock order form state variables to the `<script>` block**

Append to the script block (after the existing state variables from Task 4):

```typescript
// Stock form
let activeTab: 'stock' | 'option' = 'stock';
let stockSide: 'BUY' | 'SELL' = 'BUY';
let stockSymbol = '';
let stockOrderType: 'market' | 'limit' = 'limit';
let stockQty: number | null = null;
let stockPrice: number | null = null;

// Restore last symbol from localStorage on mount
import { onMount } from 'svelte';
onMount(() => {
  const last = localStorage.getItem('paper_last_symbol');
  if (last) stockSymbol = last;
});
```

> Note: `onMount` is already imported at the top of the file — remove the duplicate `import` line if it conflicts. Just add the `onMount` body call to the existing onMount or add a new one.

Actually the page doesn't currently use `onMount`. Add it:

```typescript
import { onMount } from 'svelte';
// ...other imports

onMount(() => {
  const last = localStorage.getItem('paper_last_symbol');
  if (last) { stockSymbol = last; optSymbol = last; }
});
```

- [ ] **Step 2: Add the order form markup**

After the `<!-- ── Header actions ── -->` block (from Task 4), insert the order form:

```svelte
<!-- ── Inline order form ──────────────────────────────────────── -->
{#if showOrderForm}
  <div class="order-form-wrap">
    <div class="order-form-tabs">
      <button class="tab-btn" class:active={activeTab === 'stock'} on:click={() => activeTab = 'stock'}>Stock</button>
      <button class="tab-btn" class:active={activeTab === 'option'} on:click={() => activeTab = 'option'}>Option</button>
    </div>

    {#if activeTab === 'stock'}
      <form method="POST" action="?/previewOrder" use:enhance={handlePreviewEnhance}>
        <input type="hidden" name="asset_type" value="stock" />

        <!-- Side toggle -->
        <div class="form-field">
          <label class="field-label">Side</label>
          <div class="toggle-row">
            <button type="button" class="toggle-btn" class:buy={stockSide === 'BUY'} on:click={() => stockSide = 'BUY'}>BUY</button>
            <button type="button" class="toggle-btn" class:sell={stockSide === 'SELL'} on:click={() => stockSide = 'SELL'}>SELL</button>
          </div>
          <input type="hidden" name="side" value={stockSide} />
        </div>

        <!-- Symbol -->
        <div class="form-field">
          <label class="field-label" for="stock-symbol">Symbol</label>
          <input id="stock-symbol" name="symbol" type="text"
            bind:value={stockSymbol}
            on:input={() => stockSymbol = stockSymbol.toUpperCase()}
            placeholder="AAPL"
            class="form-input" />
        </div>

        <!-- Order type toggle -->
        <div class="form-field">
          <label class="field-label">Order Type</label>
          <div class="toggle-row">
            <button type="button" class="toggle-btn" class:active-type={stockOrderType === 'limit'} on:click={() => stockOrderType = 'limit'}>Limit</button>
            <button type="button" class="toggle-btn" class:active-type={stockOrderType === 'market'} on:click={() => stockOrderType = 'market'}>Market</button>
          </div>
          <input type="hidden" name="order_type" value={stockOrderType} />
        </div>

        <!-- Qty -->
        <div class="form-field">
          <label class="field-label" for="stock-qty">Qty (shares)</label>
          <input id="stock-qty" name="qty" type="number" min="1" step="1"
            bind:value={stockQty} placeholder="1" class="form-input" />
        </div>

        <!-- Limit price (hidden when Market) -->
        {#if stockOrderType === 'limit'}
          <div class="form-field">
            <label class="field-label" for="stock-price">Limit Price</label>
            <input id="stock-price" name="price" type="number" min="0.01" step="0.01"
              bind:value={stockPrice} placeholder="182.50" class="form-input" />
          </div>
        {/if}

        <!-- Validation errors -->
        {#if validationErrors.length > 0}
          <div class="validation-errors">
            {#each validationErrors as err}<div>• {err}</div>{/each}
          </div>
        {/if}

        <div class="form-actions">
          <button type="submit" class="btn-preview">Preview Order →</button>
        </div>

        <!-- Paper notice strip -->
        <div class="paper-notice">⚗ Paper mode — no real money will be used</div>
      </form>
    {:else}
      <!-- Option tab will be added in Task 6 -->
      <div class="empty" style="padding:24px;text-align:center;color:var(--muted);font-size:0.76rem;">
        Option tab — coming in next task
      </div>
    {/if}
  </div>
{/if}
```

- [ ] **Step 3: Add client form state for validation and preview (wired in later tasks)**

Add these state variables to the script block:

```typescript
let validationErrors: string[] = [];
let validationWarnings: string[] = [];
let previewData: {
  symbol: string; side: string; qty: number;
  estimated_value: number;
  safety_status: 'pass' | 'warn' | 'block';
  message: string; risk_notes: string[]; warnings: string[];
} | null = null;
let previewLoading = false;

function handlePreviewEnhance() {
  // Validate before submit
  validationErrors = validateOrder();
  if (validationErrors.length > 0) {
    return () => {}; // cancel submission
  }
  previewLoading = true;
  localStorage.setItem('paper_last_symbol', activeTab === 'stock' ? stockSymbol : optSymbol);
  return async ({ result, update }: { result: any; update: () => Promise<void> }) => {
    previewLoading = false;
    if (result.type === 'success' && result.data) {
      previewData = result.data;
    } else if (result.type === 'failure') {
      addToast('error', result.data?.message ?? 'Preview failed');
    }
    await update();
  };
}

function validateOrder(): string[] {
  const errors: string[] = [];
  if (activeTab === 'stock') {
    if (!stockSymbol.trim()) errors.push('Symbol is required');
    if (!stockQty || stockQty <= 0) errors.push('Quantity is required and must be at least 1');
    if (stockOrderType === 'limit' && (!stockPrice || stockPrice <= 0)) errors.push('Limit price is required for limit orders');
  }
  return errors;
}
```

- [ ] **Step 4: Add CSS for the order form**

Append to `<style>`:

```css
/* ── Order form ──────────────────────────────────────────────── */
.order-form-wrap {
  margin-bottom: 20px; padding: 18px;
  border: 1px solid var(--border); border-radius: 12px;
  background: var(--card);
}
.order-form-tabs { display: flex; gap: 6px; margin-bottom: 16px; }
.tab-btn {
  padding: 5px 16px; border-radius: 6px;
  background: var(--surface-1); border: 1px solid var(--border);
  font-size: 0.72rem; font-weight: 600; color: var(--muted); cursor: pointer;
}
.tab-btn.active {
  background: rgba(var(--primary-rgb),0.12); border-color: rgba(var(--primary-rgb),0.4);
  color: var(--primary);
}
.form-field { margin-bottom: 12px; }
.field-label { display: block; font-size: 0.62rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 5px; }
.form-input {
  width: 100%; padding: 7px 10px; border-radius: 7px;
  background: var(--surface-1); border: 1px solid var(--border);
  color: var(--text); font-size: 0.8rem; box-sizing: border-box;
}
.form-input:focus { outline: none; border-color: rgba(var(--primary-rgb),0.5); }
.toggle-row { display: flex; gap: 4px; }
.toggle-btn {
  flex: 1; padding: 5px 10px; border-radius: 6px;
  background: var(--surface-1); border: 1px solid var(--border);
  font-size: 0.7rem; font-weight: 700; color: var(--muted); cursor: pointer;
}
.toggle-btn.buy  { background: rgba(var(--success-rgb),0.15); border-color: rgba(var(--success-rgb),0.4); color: var(--success); }
.toggle-btn.sell { background: rgba(var(--danger-rgb),0.15);  border-color: rgba(var(--danger-rgb),0.4);  color: var(--danger); }
.toggle-btn.active-type { background: rgba(var(--primary-rgb),0.12); border-color: rgba(var(--primary-rgb),0.4); color: var(--primary); }
.form-actions { margin-top: 14px; }
.btn-preview {
  width: 100%; padding: 9px; border-radius: 8px;
  background: var(--primary); border: none; color: #fff;
  font-size: 0.8rem; font-weight: 700; cursor: pointer;
}
.btn-preview:disabled { opacity: 0.6; cursor: not-allowed; }
.paper-notice {
  margin-top: 10px; padding: 6px 10px; border-radius: 6px;
  background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.2);
  font-size: 0.7rem; color: var(--warning);
}
.validation-errors {
  margin-bottom: 10px; padding: 8px 12px; border-radius: 7px;
  background: rgba(var(--danger-rgb),0.08); border: 1px solid rgba(var(--danger-rgb),0.25);
  color: var(--danger); font-size: 0.72rem; line-height: 1.6;
}
```

- [ ] **Step 5: Verify in browser**

Open `/paper-trading`. Click `+ New Order`:
- Order form appears inline with Stock/Option tabs
- BUY/SELL, Limit/Market toggles work
- Symbol input auto-uppercases
- Limit price field shows/hides based on order type toggle
- Paper notice appears at bottom of form

- [ ] **Step 6: Commit**

```bash
git add src/routes/paper-trading/+page.svelte
git commit -m "feat(paper): add inline order form shell with stock tab UI"
```

---

## Task 6: Order form — Option tab + chain table

**Files:**
- Modify: `src/routes/paper-trading/+page.svelte`

### Background

The Option tab has a 3-step flow: (1) symbol + expiry dropdown + CALL/PUT toggle, (2) mini chain table (strike, bid, ask, IV%, spread), (3) after strike selected: qty + limit price. Fetches `/api/paper/options/expiry` on symbol blur (≥2 chars), then `/api/paper/options/chain` when expiry + type selected.

- [ ] **Step 1: Add option form state variables**

Append to the `<script>` block:

```typescript
// Option form
let optSymbol = '';
let optExpiry = '';
let optType: 'call' | 'put' = 'call';
let optExpiryList: string[] = [];
let optChain: { strike: number; bid: number; ask: number; iv: number; option_code: string; spread_pct: number }[] = [];
let optSelectedCode = '';
let optSelectedBid = 0;
let optSelectedAsk = 0;
let optSelectedStrike = 0;
let optSide: 'BUY' | 'SELL' = 'BUY';
let optQty = 1;
let optPrice: number | null = null;
let optExpiryLoading = false;
let optChainLoading = false;
let optExpiryError = '';
let optChainError = '';

async function fetchExpiry() {
  if (optSymbol.trim().length < 2) return;
  optExpiryLoading = true;
  optExpiryError = '';
  optExpiryList = [];
  optExpiry = '';
  optChain = [];
  optSelectedCode = '';
  try {
    const r = await fetch(`/api/paper/options/expiry?symbol=${encodeURIComponent(optSymbol.trim())}`);
    const data = await r.json();
    if (data.error) { optExpiryError = 'Bridge offline'; return; }
    optExpiryList = data.expiry_dates ?? data ?? [];
  } catch {
    optExpiryError = 'Bridge offline';
  } finally {
    optExpiryLoading = false;
  }
}

async function fetchChain() {
  if (!optExpiry || !optSymbol.trim()) return;
  optChainLoading = true;
  optChainError = '';
  optChain = [];
  optSelectedCode = '';
  try {
    const params = new URLSearchParams({ symbol: optSymbol.trim(), expiry: optExpiry, option_type: optType });
    const r = await fetch(`/api/paper/options/chain?${params}`);
    const data = await r.json();
    if (data.error) { optChainError = 'Bridge offline'; return; }
    const rows = data.chain ?? data ?? [];
    optChain = rows.map((row: any) => ({
      strike: row.strike,
      bid: row.bid,
      ask: row.ask,
      iv: row.iv,
      option_code: row.option_code,
      spread_pct: row.ask > 0 ? (row.ask - row.bid) / row.ask * 100 : 0,
    }));
  } catch {
    optChainError = 'Bridge offline';
  } finally {
    optChainLoading = false;
  }
}

function selectStrike(row: typeof optChain[0]) {
  optSelectedCode = row.option_code;
  optSelectedBid = row.bid;
  optSelectedAsk = row.ask;
  optSelectedStrike = row.strike;
  optPrice = optSide === 'BUY' ? row.ask : row.bid;
}

// Watch expiry + optType changes → re-fetch chain
$: if (optExpiry || optType) fetchChain();

function daysToExpiry(expiry: string): number {
  const now = new Date();
  const exp = new Date(expiry);
  return Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}
```

- [ ] **Step 2: Replace the "option tab placeholder" with the real option tab markup**

Find this placeholder from Task 5:

```svelte
      <!-- Option tab will be added in Task 6 -->
      <div class="empty" style="padding:24px;text-align:center;color:var(--muted);font-size:0.76rem;">
        Option tab — coming in next task
      </div>
```

Replace with the full option tab:

```svelte
    {:else}
      <!-- OPTION TAB -->
      <form method="POST" action="?/previewOrder" use:enhance={handlePreviewEnhance}>
        <input type="hidden" name="asset_type" value="option" />
        <input type="hidden" name="option_code" value={optSelectedCode} />
        <input type="hidden" name="side" value={optSide} />
        <input type="hidden" name="symbol" value={optSymbol} />

        <!-- Step 1: Symbol + expiry + type -->
        <div class="form-field">
          <label class="field-label" for="opt-symbol">Underlying Symbol</label>
          <input id="opt-symbol" type="text"
            bind:value={optSymbol}
            on:input={() => optSymbol = optSymbol.toUpperCase()}
            on:blur={fetchExpiry}
            placeholder="AAPL"
            class="form-input" />
        </div>

        <div class="opt-row">
          <div class="form-field" style="flex:1">
            <label class="field-label" for="opt-expiry">Expiry</label>
            {#if optExpiryLoading}
              <div class="form-input muted-val">Loading…</div>
            {:else if optExpiryError}
              <div class="form-input muted-val danger-text">{optExpiryError}</div>
            {:else}
              <select id="opt-expiry" class="form-input" bind:value={optExpiry}>
                <option value="">Select expiry</option>
                {#each optExpiryList as d}<option value={d}>{d}</option>{/each}
              </select>
            {/if}
          </div>
          <div class="form-field" style="flex:0 0 auto">
            <label class="field-label">Type</label>
            <div class="toggle-row">
              <button type="button" class="toggle-btn" class:active-type={optType === 'call'} on:click={() => { optType = 'call'; }}>CALL</button>
              <button type="button" class="toggle-btn" class:active-type={optType === 'put'}  on:click={() => { optType = 'put'; }}>PUT</button>
            </div>
          </div>
        </div>

        <!-- Step 2: Option chain table -->
        {#if optExpiry && !optChainLoading && !optChainError && optChain.length > 0}
          <div class="chain-wrap">
            <table class="chain-table">
              <thead>
                <tr>
                  <th>Strike</th>
                  <th class="num">Bid</th>
                  <th class="num">Ask</th>
                  <th class="num">IV%</th>
                  <th class="num">Spread</th>
                </tr>
              </thead>
              <tbody>
                {#each optChain as row}
                  <tr
                    class:chain-selected={optSelectedCode === row.option_code}
                    on:click={() => selectStrike(row)}
                  >
                    <td class="sym">
                      ${row.strike}
                      {#if row.spread_pct > 30}<span class="spread-warn" title="Wide spread">⚠</span>{/if}
                    </td>
                    <td class="num">{row.bid.toFixed(2)}</td>
                    <td class="num">{row.ask.toFixed(2)}</td>
                    <td class="num">{row.iv.toFixed(1)}%</td>
                    <td class="num">{row.spread_pct.toFixed(1)}%</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {:else if optChainLoading}
          <div class="chain-status muted">Loading chain…</div>
        {:else if optChainError}
          <div class="chain-status danger-text">{optChainError}</div>
        {/if}

        <!-- Step 3: After strike selected -->
        {#if optSelectedCode}
          <div class="selected-contract">
            <span class="muted">Selected: </span>
            <strong style="color:var(--primary)">{optSymbol} {optExpiry} ${optSelectedStrike} {optType.toUpperCase()}</strong>
            · Ask ${optSelectedAsk.toFixed(2)}
          </div>

          <!-- Near-expiry warning -->
          {#if optExpiry && daysToExpiry(optExpiry) <= 7}
            <div class="warn-strip">⚠ Expiry in {daysToExpiry(optExpiry)} days — theta decay is accelerating</div>
          {/if}

          <div class="form-field">
            <label class="field-label">Side</label>
            <div class="toggle-row">
              <button type="button" class="toggle-btn" class:buy={optSide === 'BUY'} on:click={() => { optSide = 'BUY'; optPrice = optSelectedAsk; }}>BUY</button>
              <button type="button" class="toggle-btn" class:sell={optSide === 'SELL'} on:click={() => { optSide = 'SELL'; optPrice = optSelectedBid; }}>SELL</button>
            </div>
          </div>

          <div class="opt-row">
            <div class="form-field" style="flex:1">
              <label class="field-label" for="opt-qty">Qty (contracts)</label>
              <input id="opt-qty" name="qty" type="number" min="1" step="1"
                bind:value={optQty} class="form-input" />
            </div>
            <div class="form-field" style="flex:1">
              <label class="field-label" for="opt-price">Limit Price</label>
              <input id="opt-price" name="price" type="number" min="0.01" step="0.01"
                bind:value={optPrice} class="form-input" />
            </div>
          </div>
        {/if}

        <!-- Validation errors -->
        {#if validationErrors.length > 0}
          <div class="validation-errors">
            {#each validationErrors as err}<div>• {err}</div>{/each}
          </div>
        {/if}

        <div class="form-actions">
          <button type="submit" class="btn-preview" disabled={!optSelectedCode}>Preview Order →</button>
        </div>
        <div class="paper-notice">⚗ Paper mode — no real money will be used</div>
      </form>
```

Also update `validateOrder()` to handle option tab:

```typescript
function validateOrder(): string[] {
  const errors: string[] = [];
  if (activeTab === 'stock') {
    if (!stockSymbol.trim()) errors.push('Symbol is required');
    if (!stockQty || stockQty <= 0) errors.push('Quantity is required and must be at least 1');
    if (stockOrderType === 'limit' && (!stockPrice || stockPrice <= 0)) errors.push('Limit price is required for limit orders');
  } else {
    if (!optSymbol.trim()) errors.push('Symbol is required');
    if (!optSelectedCode) errors.push('Select a strike from the chain table');
    if (!optQty || optQty <= 0) errors.push('Quantity is required and must be at least 1');
    if (!optPrice || optPrice <= 0) errors.push('Limit price is required');
  }
  return errors;
}
```

Also add option warnings to the preview flow — update `handlePreviewEnhance` to compute warnings:

```typescript
function computeWarnings(): string[] {
  const warns: string[] = [];
  if (activeTab === 'option' && optSelectedCode) {
    if (optSelectedBid > 0 && optSelectedAsk > 0) {
      const sp = (optSelectedAsk - optSelectedBid) / optSelectedAsk;
      if (sp > 0.30) warns.push(`⚠ Wide spread (${(sp * 100).toFixed(0)}%) — you may get a worse fill`);
    }
    if (optExpiry && daysToExpiry(optExpiry) <= 7) {
      warns.push(`⚠ Expiry in ${daysToExpiry(optExpiry)} days — time decay (theta) is accelerating`);
    }
  }
  return warns;
}
```

- [ ] **Step 3: Add CSS for chain table and option-tab elements**

```css
/* ── Option chain table ──────────────────────────────────────── */
.opt-row { display: flex; gap: 10px; align-items: flex-end; }
.chain-wrap {
  border: 1px solid var(--border); border-radius: 8px; overflow: hidden;
  margin-bottom: 12px;
}
.chain-table { width: 100%; border-collapse: collapse; font-size: 0.74rem; }
.chain-table thead { background: var(--surface-1); }
.chain-table th {
  padding: 6px 10px; text-align: left;
  font-size: 0.6rem; font-weight: 700; color: var(--muted);
  text-transform: uppercase; letter-spacing: 0.04em;
  border-bottom: 1px solid var(--border);
}
.chain-table td { padding: 7px 10px; border-bottom: 1px solid var(--border); cursor: pointer; }
.chain-table tr:last-child td { border-bottom: none; }
.chain-table tr:hover td { background: rgba(var(--primary-rgb),0.05); }
.chain-selected td { background: rgba(var(--primary-rgb),0.12) !important; color: var(--primary); font-weight: 700; }
.spread-warn { color: var(--warning); margin-left: 4px; font-size: 0.65rem; }
.chain-status { padding: 12px; font-size: 0.74rem; text-align: center; }
.muted-val { color: var(--muted); }
.danger-text { color: var(--danger); }
.selected-contract {
  padding: 8px 10px; border-radius: 6px;
  background: var(--surface-1); border: 1px solid var(--border);
  font-size: 0.74rem; margin-bottom: 12px;
}
.warn-strip {
  padding: 6px 10px; border-radius: 6px; margin-bottom: 10px;
  background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.25);
  font-size: 0.72rem; color: var(--warning);
}
```

- [ ] **Step 4: Verify in browser**

Open `/paper-trading`. Click `+ New Order` → Option tab:
- Type `AAPL` in symbol field, tab out → expiry list fetches from bridge (or shows "Bridge offline" if bridge down)
- Select expiry → chain table loads with strikes, bid/ask, IV%, spread
- Clicking a row selects it (blue highlight); shows selected contract summary
- BUY/SELL toggle pre-fills limit price (ask for BUY, bid for SELL)
- Rows with spread > 30% show amber ⚠

- [ ] **Step 5: Commit**

```bash
git add src/routes/paper-trading/+page.svelte
git commit -m "feat(paper): add option tab with expiry fetch and chain table"
```

---

## Task 7: Server actions — previewOrder with risk guards

**Files:**
- Modify: `src/routes/paper-trading/+page.server.ts`

### Background

Add `export const actions` with `previewOrder`. It reads the submitted form data, calls the bridge with `dry_run: true`, applies risk guards (BUY max loss / SELL collateral estimate / covered call check), and returns a preview object. Returns `fail(503, ...)` if bridge is offline.

The paper trading `acc_id` for US simulate is `4652657`.

- [ ] **Step 1: Add imports to +page.server.ts**

At the top of `src/routes/paper-trading/+page.server.ts`, add after existing imports:

```typescript
import { fail } from '@sveltejs/kit';
import type { Actions } from './$types';

const BRIDGE = process.env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';
const PAPER_ACC_ID = 4652657;

function toMoomooSymbol(sym: string): string {
  const s = sym.trim().toUpperCase();
  if (/^(US\.|HK\.|SH\.|SZ\.)/.test(s)) return s;
  return `US.${s}`;
}
```

- [ ] **Step 2: Add the `previewOrder` action**

After the closing brace of the `load` function, append:

```typescript
export const actions: Actions = {
  async previewOrder({ request, locals }) {
    const user = locals.user;
    if (!user) return fail(401, { message: 'Unauthorized' });

    const data = await request.formData();
    const assetType = data.get('asset_type') as string;
    const side = (data.get('side') as string ?? 'BUY').toUpperCase();
    const symbol = (data.get('symbol') as string ?? '').trim().toUpperCase();
    const orderType = (data.get('order_type') as string) ?? 'limit';
    const qty = parseInt(data.get('qty') as string) || 0;
    const price = parseFloat(data.get('price') as string) || 0;
    const optionCode = (data.get('option_code') as string) ?? '';

    if (!symbol) return fail(400, { message: 'Symbol is required' });
    if (qty <= 0) return fail(400, { message: 'Quantity must be at least 1' });

    const orderPayload = {
      symbol: assetType === 'option' ? optionCode : toMoomooSymbol(symbol),
      side: side.toLowerCase(),
      order_type: assetType === 'option' ? 'limit' : orderType,
      quantity: qty,
      price: price > 0 ? price : undefined,
      trade_env: 'SIMULATE',
      acc_id: PAPER_ACC_ID,
      dry_run: true,
    };

    // Call bridge with dry_run
    let bridgeOk = true;
    let bridgeMsg = '';
    try {
      const res = await fetch(`${BRIDGE}/execution/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        bridgeMsg = err.detail ?? `Bridge error ${res.status}`;
        bridgeOk = false;
      }
    } catch (e) {
      return fail(503, { message: 'Bridge offline — start moomoo-service and retry', bridgeOffline: true });
    }

    if (!bridgeOk) {
      return fail(502, { message: bridgeMsg });
    }

    // Risk guards
    const riskNotes: string[] = [];
    let safetyStatus: 'pass' | 'warn' | 'block' = 'pass';

    if (assetType === 'option') {
      if (side === 'BUY') {
        const maxLoss = price * 100 * qty;
        riskNotes.push(`Max loss on this trade: $${maxLoss.toFixed(2)} (premium paid)`);
      } else {
        // SELL option
        const strikeFromCode = parseFloat(optionCode.split(/[CP]/i).slice(-1)[0] ?? '0') || 0;
        const collateral = (strikeFromCode || price * 10) * 100 * qty * 0.20;
        riskNotes.push(`Estimated collateral required: $${collateral.toFixed(2)}.`);
        riskNotes.push('Assignment risk: if exercised, you must buy/deliver 100 shares per contract.');
        safetyStatus = 'warn';
      }
    }

    const estimatedValue = price * (assetType === 'option' ? qty * 100 : qty);

    return {
      symbol, side, qty,
      estimated_value: estimatedValue,
      safety_status: safetyStatus,
      message: safetyStatus === 'warn' ? 'Review risk notes before confirming' : 'Order preview ready',
      risk_notes: riskNotes,
      warnings: [],
      asset_type: assetType,
      order_type: orderType,
      price,
      option_code: optionCode,
    };
  },
```

> Note: the covered-call check requires reading `paper.positions` from the bridge, which adds complexity. For the basic version, skip covered-call check in previewOrder — the warn status on any SELL option is sufficient. Covered-call check can be layered in as a follow-up.

- [ ] **Step 3: Write a unit test for `toMoomooSymbol`**

Create `src/routes/paper-trading/paper-trading.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

function toMoomooSymbol(sym: string): string {
  const s = sym.trim().toUpperCase();
  if (/^(US\.|HK\.|SH\.|SZ\.)/.test(s)) return s;
  return `US.${s}`;
}

describe('toMoomooSymbol', () => {
  it('prepends US. to bare symbols', () => {
    expect(toMoomooSymbol('AAPL')).toBe('US.AAPL');
  });
  it('preserves existing market prefix', () => {
    expect(toMoomooSymbol('HK.700')).toBe('HK.700');
    expect(toMoomooSymbol('US.TSLA')).toBe('US.TSLA');
  });
  it('uppercases the symbol', () => {
    expect(toMoomooSymbol('aapl')).toBe('US.AAPL');
  });
});
```

- [ ] **Step 4: Run tests**

```bash
npx vitest run src/routes/paper-trading/paper-trading.test.ts
```

Expected output:
```
✓ src/routes/paper-trading/paper-trading.test.ts (3 tests)
```

- [ ] **Step 5: Commit**

```bash
git add src/routes/paper-trading/+page.server.ts src/routes/paper-trading/paper-trading.test.ts
git commit -m "feat(paper): add previewOrder server action with risk guards and toMoomooSymbol util"
```

---

## Task 8: Preview card UI + submitOrder action

**Files:**
- Modify: `src/routes/paper-trading/+page.svelte`
- Modify: `src/routes/paper-trading/+page.server.ts`

### Background

After `previewOrder` returns data, show a preview card below the form. The card shows symbol, side, qty, estimated value, risk notes, warnings, and safety status badge. If `safety_status === 'block'`: red card, no confirm button. If `pass` or `warn`: show "Confirm & Submit" button that calls `?/submitOrder`.

- [ ] **Step 1: Add submitOrder action to +page.server.ts**

Inside the `export const actions = {` block (after `previewOrder`), add:

```typescript
  async submitOrder({ request, locals }) {
    const user = locals.user;
    if (!user) return fail(401, { message: 'Unauthorized' });

    const data = await request.formData();
    const assetType = data.get('asset_type') as string;
    const side = (data.get('side') as string ?? 'BUY').toLowerCase();
    const symbol = (data.get('symbol') as string ?? '').trim().toUpperCase();
    const orderType = (data.get('order_type') as string) ?? 'limit';
    const qty = parseInt(data.get('qty') as string) || 0;
    const price = parseFloat(data.get('price') as string) || 0;
    const optionCode = (data.get('option_code') as string) ?? '';

    const orderPayload = {
      symbol: assetType === 'option' ? optionCode : toMoomooSymbol(symbol),
      side,
      order_type: assetType === 'option' ? 'limit' : orderType,
      quantity: qty,
      price: price > 0 ? price : undefined,
      trade_env: 'SIMULATE',
      acc_id: PAPER_ACC_ID,
      dry_run: false,
    };

    try {
      const res = await fetch(`${BRIDGE}/execution/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(orderPayload),
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        return fail(502, { message: err.detail ?? `Bridge error ${res.status}` });
      }
      const result = await res.json();
      return {
        submitted: true,
        broker_order_id: result.broker_order_id ?? null,
        status: result.status ?? 'submitted',
        symbol,
        side: side.toUpperCase(),
        qty,
        price,
        asset_type: assetType,
      };
    } catch (e) {
      return fail(503, { message: 'Bridge offline — start moomoo-service and retry', bridgeOffline: true });
    }
  },
```

- [ ] **Step 2: Add preview card markup to +page.svelte**

After the closing `{/if}` of `{#if showOrderForm}`, add the preview card:

```svelte
<!-- ── Order preview card ──────────────────────────────────────── -->
{#if previewData}
  <div class="preview-card" class:preview-warn={previewData.safety_status === 'warn'} class:preview-block={previewData.safety_status === 'block'}>
    <div class="preview-header">
      <span class="preview-title">Order Preview</span>
      <span class="preview-badge {previewData.safety_status}">{previewData.safety_status.toUpperCase()}</span>
      <button class="preview-close" on:click={() => previewData = null}>✕</button>
    </div>
    <div class="preview-row">
      <span class="preview-label">Symbol</span><span class="preview-val sym">{previewData.symbol}</span>
    </div>
    <div class="preview-row">
      <span class="preview-label">Side</span>
      <span class="preview-val side-badge" class:buy={previewData.side === 'BUY'} class:sell={previewData.side === 'SELL'}>{previewData.side}</span>
    </div>
    <div class="preview-row">
      <span class="preview-label">Qty</span><span class="preview-val">{previewData.qty}</span>
    </div>
    <div class="preview-row">
      <span class="preview-label">Est. Value</span><span class="preview-val">{money(previewData.estimated_value)}</span>
    </div>
    {#if previewData.risk_notes.length > 0}
      <div class="preview-risk">
        {#each previewData.risk_notes as note}<div class="risk-note">⚑ {note}</div>{/each}
      </div>
    {/if}
    {#if previewData.warnings.length > 0}
      <div class="preview-warnings">
        {#each previewData.warnings as w}<div class="warn-note">{w}</div>{/each}
      </div>
    {/if}

    {#if previewData.safety_status !== 'block'}
      <form method="POST" action="?/submitOrder" use:enhance={handleSubmitEnhance}>
        <input type="hidden" name="asset_type" value={previewData.asset_type} />
        <input type="hidden" name="side" value={previewData.side} />
        <input type="hidden" name="symbol" value={previewData.symbol} />
        <input type="hidden" name="order_type" value={previewData.order_type ?? 'limit'} />
        <input type="hidden" name="qty" value={previewData.qty} />
        <input type="hidden" name="price" value={previewData.price ?? 0} />
        <input type="hidden" name="option_code" value={previewData.option_code ?? ''} />
        <button type="submit" class="btn-confirm" disabled={submitLoading}>
          {submitLoading ? 'Submitting…' : 'Confirm & Submit'}
        </button>
      </form>
    {:else}
      <div class="preview-blocked">⛔ Order blocked — see risk notes above</div>
    {/if}
  </div>
{/if}
```

- [ ] **Step 3: Add `handleSubmitEnhance` and `submitLoading` to script block**

```typescript
let submitLoading = false;

function handleSubmitEnhance() {
  submitLoading = true;
  return async ({ result, update }: { result: any; update: () => Promise<void> }) => {
    submitLoading = false;
    if (result.type === 'success' && result.data?.submitted) {
      const orderId = result.data.broker_order_id;
      addToast('success', `✓ Order submitted${orderId ? ` — broker_order_id: ${orderId}` : ''}`);
      // Position simulator banner (Task 10)
      showPositionEstimate(result.data);
      previewData = null;
      showOrderForm = false;
      await invalidateAll();
    } else if (result.type === 'failure') {
      const msg = result.data?.message ?? 'Submit failed';
      const isOffline = result.data?.bridgeOffline;
      addToast(isOffline ? 'warn' : 'error', isOffline ? `⚠ Bridge offline — ${msg}` : msg);
    }
    await update();
  };
}

// Placeholder for Task 10 — position simulator
function showPositionEstimate(_data: any) { /* wired in Task 10 */ }
```

- [ ] **Step 4: Add CSS for preview card**

```css
/* ── Preview card ────────────────────────────────────────────── */
.preview-card {
  margin-bottom: 20px; padding: 16px 18px;
  border: 1px solid rgba(var(--primary-rgb),0.3); border-radius: 12px;
  background: var(--card);
}
.preview-card.preview-warn { border-color: rgba(245,158,11,0.4); background: rgba(245,158,11,0.04); }
.preview-card.preview-block { border-color: rgba(var(--danger-rgb),0.4); background: rgba(var(--danger-rgb),0.04); }
.preview-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
.preview-title { font-size: 0.8rem; font-weight: 700; color: var(--text); flex: 1; }
.preview-close { background: none; border: none; color: var(--muted); cursor: pointer; font-size: 0.9rem; }
.preview-badge {
  font-size: 0.58rem; font-weight: 800; padding: 2px 7px; border-radius: 20px; letter-spacing: 0.06em;
}
.preview-badge.pass { background: rgba(var(--success-rgb),0.12); color: var(--success); }
.preview-badge.warn { background: rgba(245,158,11,0.12); color: var(--warning); }
.preview-badge.block { background: rgba(var(--danger-rgb),0.12); color: var(--danger); }
.preview-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; font-size: 0.78rem; }
.preview-label { color: var(--muted); min-width: 80px; }
.preview-val { color: var(--text); font-weight: 600; }
.preview-risk { margin: 10px 0; }
.risk-note { font-size: 0.72rem; color: var(--warning); margin-bottom: 4px; }
.preview-warnings { margin: 8px 0; }
.warn-note { font-size: 0.72rem; color: var(--warning); margin-bottom: 4px; }
.btn-confirm {
  width: 100%; margin-top: 12px; padding: 9px;
  background: var(--success); border: none; border-radius: 8px;
  color: #fff; font-size: 0.8rem; font-weight: 700; cursor: pointer;
}
.btn-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
.preview-blocked {
  margin-top: 10px; padding: 8px 12px; border-radius: 7px;
  background: rgba(var(--danger-rgb),0.08); color: var(--danger);
  font-size: 0.74rem; font-weight: 600;
}
```

- [ ] **Step 5: Verify end-to-end (bridge must be running)**

Open `/paper-trading`. Click `+ New Order`. Fill in symbol `AAPL`, qty `1`, price `182`, click Preview:
- Preview card appears with PASS status, estimated value shown
- Click "Confirm & Submit" → success toast appears with broker_order_id
- Form closes, page data reloads (positions/orders table refreshes)

Test bridge-offline case: stop moomoo-service, click Preview → amber toast "⚠ Bridge offline…"

- [ ] **Step 6: Commit**

```bash
git add src/routes/paper-trading/+page.svelte src/routes/paper-trading/+page.server.ts
git commit -m "feat(paper): add preview card UI and submitOrder action with toast feedback"
```

---

## Task 9: Position simulator

**Files:**
- Modify: `src/routes/paper-trading/+page.svelte`

### Background

After a successful `submitOrder`, show a transient position estimate banner: "BUY 100 AAPL @ $182.50 → new holding: ~100 shares, cost basis ~$18,250". Uses `paper.positions` to find existing position and add qty, recalculate avg cost. Displayed for 6 seconds.

- [ ] **Step 1: Add position estimate state**

Append to the `<script>` block:

```typescript
let positionEstimate: string | null = null;

function showPositionEstimate(data: { symbol: string; side: string; qty: number; price: number; asset_type: string }) {
  if (data.asset_type !== 'stock') { positionEstimate = null; return; }
  const sym = data.symbol.toUpperCase();
  const existing = positions.find(p => p.symbol.replace(/^US\.|^HK\./, '') === sym);
  const existingQty = existing?.quantity ?? 0;
  const existingCost = existing?.average_cost ?? 0;
  let newQty: number;
  let newCostBasis: number;
  if (data.side === 'BUY') {
    newQty = existingQty + data.qty;
    const totalCost = existingQty * existingCost + data.qty * data.price;
    newCostBasis = newQty > 0 ? totalCost / newQty : data.price;
  } else {
    newQty = Math.max(0, existingQty - data.qty);
    newCostBasis = existingCost;
  }
  positionEstimate = `${data.side} ${data.qty} ${sym} @ $${data.price.toFixed(2)} → estimated holding: ~${newQty} shares, cost basis ~$${(newQty * newCostBasis).toFixed(2)} (estimate — actual fill may differ)`;
  setTimeout(() => { positionEstimate = null; }, 6000);
}
```

- [ ] **Step 2: Replace the placeholder `showPositionEstimate` call**

Find the placeholder from Task 8:

```typescript
function showPositionEstimate(_data: any) { /* wired in Task 10 */ }
```

Delete it — the new implementation above replaces it.

- [ ] **Step 3: Add position estimate banner markup**

After the `<!-- ── Order preview card ── -->` block, add:

```svelte
<!-- ── Position simulator banner ─────────────────────────────── -->
{#if positionEstimate}
  <div class="position-estimate">
    <strong>Estimated position after fill:</strong>
    {positionEstimate}
  </div>
{/if}
```

- [ ] **Step 4: Add CSS for position estimate**

```css
.position-estimate {
  margin-bottom: 16px; padding: 10px 14px; border-radius: 8px;
  background: rgba(var(--primary-rgb),0.08); border: 1px solid rgba(var(--primary-rgb),0.25);
  font-size: 0.76rem; color: var(--text); line-height: 1.5;
}
```

- [ ] **Step 5: Add toast display markup**

At the VERY TOP of the page template (before `<PageHeader>`), add the toast container:

```svelte
<!-- ── Toasts ─────────────────────────────────────────────────── -->
<div class="toast-container">
  {#each toasts as t (t.id)}
    <div class="toast toast-{t.type}">
      {t.message}
    </div>
  {/each}
</div>
```

- [ ] **Step 6: Add CSS for toasts**

```css
/* ── Toasts ──────────────────────────────────────────────────── */
.toast-container {
  position: fixed; bottom: 24px; right: 24px; z-index: 999;
  display: flex; flex-direction: column; gap: 8px; align-items: flex-end;
}
.toast {
  padding: 10px 16px; border-radius: 8px;
  font-size: 0.76rem; font-weight: 600;
  max-width: 360px; box-shadow: 0 4px 16px rgba(0,0,0,0.25);
  animation: toast-in 0.2s ease;
}
@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
.toast-success { background: rgba(var(--success-rgb),0.15); border: 1px solid rgba(var(--success-rgb),0.4); color: var(--success); }
.toast-warn    { background: rgba(245,158,11,0.12);         border: 1px solid rgba(245,158,11,0.35);       color: var(--warning); }
.toast-error   { background: rgba(var(--danger-rgb),0.12);  border: 1px solid rgba(var(--danger-rgb),0.35); color: var(--danger); }
```

- [ ] **Step 7: Verify**

Submit a stock order → success toast appears at bottom-right. Position estimate banner appears for 6 seconds showing estimated new holding. Both auto-dismiss.

- [ ] **Step 8: Commit**

```bash
git add src/routes/paper-trading/+page.svelte
git commit -m "feat(paper): add position simulator banner and toast notification system"
```

---

## Task 10: Order history table update

**Files:**
- Modify: `src/routes/paper-trading/+page.svelte`

### Background

The existing Orders section renders from `orders.slice(0, 50)`. Update to: (1) cap at 20 rows, (2) add Broker Order ID column (first 8 chars, monospace), (3) improve status badge color classification to match spec (FILLED=green, PENDING/QUEUED=amber, CANCELLED/REJECTED=muted, other=blue).

- [ ] **Step 1: Update `statusClass()` function**

Find the existing `statusClass` function:

```typescript
function statusClass(s: string) {
  const u = s.toUpperCase();
  if (u.includes('FILL')) return 'filled';
  if (u.includes('CANCEL')) return 'cancelled';
  if (u.includes('SUBMIT') || u.includes('QUEUE')) return 'pending';
  return 'other';
}
```

Replace with:

```typescript
function statusClass(s: string) {
  const u = s.toUpperCase();
  if (u.includes('FILL')) return 'filled';
  if (u.includes('CANCEL') || u.includes('REJECT') || u.includes('FAIL')) return 'cancelled';
  if (u.includes('PENDING') || u.includes('SUBMIT') || u.includes('QUEUE') || u.includes('WAIT')) return 'pending';
  return 'other';
}
```

- [ ] **Step 2: Update the Orders table — add Broker Order ID column, cap at 20 rows**

Find the Orders table `<thead>`:

```svelte
          <tr>
            <th>Symbol</th>
            <th>Side</th>
            <th>Type</th>
            <th class="num">Qty</th>
            <th class="num">Filled</th>
            <th class="num">Price</th>
            <th class="num">Avg Fill</th>
            <th>Status</th>
            <th>Date</th>
          </tr>
```

Replace with:

```svelte
          <tr>
            <th>Symbol</th>
            <th>Side</th>
            <th>Type</th>
            <th class="num">Qty</th>
            <th class="num">Filled</th>
            <th class="num">Price</th>
            <th class="num">Avg Fill</th>
            <th>Status</th>
            <th>Order ID</th>
            <th>Date</th>
          </tr>
```

Find `{#each orders.slice(0, 50) as ord}` and change to `{#each orders.slice(0, 20) as ord}`.

Find the row template and add the Broker Order ID cell after the Status cell:

```svelte
              <td><span class="status-badge {statusClass(ord.status)}">{ord.status}</span></td>
              <td class="muted date">{formatDate(ord.submitted_at)}</td>
```

Replace with:

```svelte
              <td><span class="status-badge {statusClass(ord.status)}">{ord.status}</span></td>
              <td class="broker-id">{ord.order_id ? String(ord.order_id).slice(0, 8) : '—'}</td>
              <td class="muted date">{formatDate(ord.submitted_at)}</td>
```

- [ ] **Step 3: Add CSS for broker-id cell**

```css
.broker-id { font-family: monospace; font-size: 0.68rem; color: var(--muted); }
```

- [ ] **Step 4: Verify**

Open `/paper-trading`. Orders table now has an Order ID column showing first 8 chars of order ID in monospace. Status badges: FILLED=green, PENDING=amber, CANCELLED=muted. Table is capped at 20 rows.

- [ ] **Step 5: Commit**

```bash
git add src/routes/paper-trading/+page.svelte
git commit -m "feat(paper): update orders table — add broker order ID column, fix status badges, cap at 20 rows"
```

---

## Task 11: Reset account modal + server action

**Files:**
- Modify: `src/routes/paper-trading/+page.svelte`
- Modify: `src/routes/paper-trading/+page.server.ts`

### Background

Add `resetAccount` server action that calls `POST /paper/reset` on the bridge. Add a confirmation modal that opens when "Reset Account" is clicked. On success: green toast + page reload.

- [ ] **Step 1: Add `resetAccount` action to +page.server.ts**

Inside `export const actions = { ... }`, after `submitOrder`, add:

```typescript
  async resetAccount({ locals }) {
    const user = locals.user;
    if (!user) return fail(401, { message: 'Unauthorized' });

    try {
      const res = await fetch(`${BRIDGE}/paper/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        if (res.status === 501) {
          return fail(501, { message: 'Reset not supported by this bridge version' });
        }
        const err = await res.json().catch(() => ({}));
        return fail(502, { message: err.detail ?? `Bridge error ${res.status}` });
      }
      const result = await res.json();
      return {
        reset: true,
        cancelled_orders: result.cancelled_orders ?? 0,
        closed_positions: result.closed_positions ?? 0,
      };
    } catch (e) {
      return fail(503, { message: 'Bridge offline — start moomoo-service and retry', bridgeOffline: true });
    }
  },
};
```

(The closing `};` closes the `actions` export.)

- [ ] **Step 2: Add reset modal markup to +page.svelte**

At the bottom of the template (before `</style>`), add the modal and the `handleResetEnhance` variable reference. Put the markup just before `<style>`:

```svelte
<!-- ── Reset confirmation modal ───────────────────────────────── -->
{#if showResetModal}
  <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-static-element-interactions -->
  <div class="modal-backdrop" on:click={() => showResetModal = false}></div>
  <div class="modal">
    <div class="modal-title">Reset paper account?</div>
    <p class="modal-body">
      This will cancel all open SIMULATE orders and close all positions via the Moomoo OpenD simulate account reset.
      This cannot be undone.
    </p>
    <div class="modal-actions">
      <button class="modal-cancel" on:click={() => showResetModal = false}>Cancel</button>
      <form method="POST" action="?/resetAccount" use:enhance={handleResetEnhance}>
        <button type="submit" class="modal-confirm" disabled={resetLoading}>
          {resetLoading ? 'Resetting…' : 'Reset Account'}
        </button>
      </form>
    </div>
  </div>
{/if}
```

- [ ] **Step 3: Add `handleResetEnhance` and `resetLoading` to script block**

```typescript
let resetLoading = false;

function handleResetEnhance() {
  resetLoading = true;
  return async ({ result, update }: { result: any; update: () => Promise<void> }) => {
    resetLoading = false;
    showResetModal = false;
    if (result.type === 'success' && result.data?.reset) {
      addToast('success', `Paper account reset — ${result.data.cancelled_orders} orders cancelled, ${result.data.closed_positions} positions closed`);
      await invalidateAll();
    } else if (result.type === 'failure') {
      addToast('error', result.data?.message ?? 'Reset failed');
    }
    await update();
  };
}
```

- [ ] **Step 4: Add CSS for modal**

```css
/* ── Modal ───────────────────────────────────────────────────── */
.modal-backdrop {
  position: fixed; inset: 0; z-index: 100;
  background: rgba(0,0,0,0.6);
}
.modal {
  position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
  z-index: 101; width: min(420px, 90vw);
  background: var(--card); border: 1px solid var(--border);
  border-radius: 14px; padding: 24px;
  box-shadow: 0 12px 40px rgba(0,0,0,0.35);
}
.modal-title { font-size: 1rem; font-weight: 700; color: var(--text); margin-bottom: 12px; }
.modal-body  { font-size: 0.78rem; color: var(--muted); line-height: 1.6; margin-bottom: 20px; }
.modal-actions { display: flex; gap: 8px; justify-content: flex-end; }
.modal-cancel {
  padding: 8px 18px; border-radius: 7px;
  background: var(--surface-1); border: 1px solid var(--border);
  color: var(--text); font-size: 0.76rem; cursor: pointer;
}
.modal-confirm {
  padding: 8px 18px; border-radius: 7px;
  background: var(--danger); border: none; color: #fff;
  font-size: 0.76rem; font-weight: 700; cursor: pointer;
}
.modal-confirm:disabled { opacity: 0.6; cursor: not-allowed; }
```

- [ ] **Step 5: Verify**

Click "Reset Account" → modal appears with warning text. Click Cancel → modal closes. Click "Reset Account" in modal → loading state → success toast with counts. Page data reloads.

If bridge is offline: error toast "Bridge offline…"

- [ ] **Step 6: Commit**

```bash
git add src/routes/paper-trading/+page.svelte src/routes/paper-trading/+page.server.ts
git commit -m "feat(paper): add reset account confirmation modal and server action"
```

---

## Task 12: localStorage + UX polish

**Files:**
- Modify: `src/routes/paper-trading/+page.svelte`

### Background

Wire up remaining UX touches: (1) `localStorage` already saves `paper_last_symbol` in `handlePreviewEnhance` — verify it also restores on form open, (2) bridge offline toast when `form?.bridgeOffline` is truthy (catch any SSR form submission), (3) close form on successful submit (already done in Task 8 — verify).

- [ ] **Step 1: Verify `onMount` restores last symbol for both tabs**

The `onMount` from Task 5 already sets both `stockSymbol` and `optSymbol`. Confirm this is present in the script block.

Also ensure `handlePreviewEnhance` saves the correct symbol:

```typescript
localStorage.setItem('paper_last_symbol', activeTab === 'stock' ? stockSymbol : optSymbol);
```

- [ ] **Step 2: Handle `form` prop for bridge-offline feedback from SSR fallback**

If JavaScript is disabled (non-enhanced form submission), the server action returns `fail(503, { bridgeOffline: true })`. Add reactive handling:

```typescript
$: if (form?.bridgeOffline) {
  addToast('warn', '⚠ Bridge offline — start moomoo-service and retry');
}
$: if (form?.message && !form?.bridgeOffline && !form?.submitted && !form?.reset) {
  addToast('error', String(form.message));
}
```

> Add these reactive statements to the `<script>` block (they run whenever `form` prop changes after server action response).

- [ ] **Step 3: Final end-to-end smoke test**

Manual checklist:
- [ ] Navigate to `/paper-trading` — amber topbar tint and warning banner visible
- [ ] Click `+ New Order` — inline form appears
- [ ] Fill stock order → Preview → Confirm → success toast + position estimate banner
- [ ] Open `+ New Order` again — symbol field pre-filled from localStorage
- [ ] Switch to Option tab → type AAPL → blur → expiry list appears
- [ ] Select expiry + chain table loads → click strike → fill qty/price → Preview → Confirm
- [ ] Click Reset Account → modal → Cancel works → Reset confirms → success toast
- [ ] Stop moomoo-service → try Preview → amber "Bridge offline" toast

- [ ] **Step 4: Commit**

```bash
git add src/routes/paper-trading/+page.svelte
git commit -m "feat(paper): wire localStorage symbol persistence and form bridge-offline UX"
```

---

## Self-Review Checklist

### Spec coverage

| Spec section | Task(s) | Coverage |
|---|---|---|
| §1 Topbar amber tint + warning banner | Task 1 | ✅ |
| §2 API proxy routes `/api/paper/options/*` | Task 2 | ✅ |
| §3 Account balance panel | Task 4 | ✅ |
| §4 Order form — Stock tab | Task 5 | ✅ |
| §4 Order form — Option tab + chain table | Task 6 | ✅ |
| §5 Client-side validation (hard blocks) | Tasks 5–6 (validateOrder) | ✅ |
| §5 Warnings (wide spread, near expiry) | Task 6 (computeWarnings) | ✅ |
| §6 Risk guards — BUY max loss | Task 7 (previewOrder) | ✅ |
| §6 Risk guards — SELL collateral + assignment | Task 7 (previewOrder) | ✅ |
| §6 Covered call check | Task 7 (simplified, no position lookup) | ⚠ Partial — SELL CALL shows 'warn' but no covered-call position check |
| §7 Preview → Submit flow | Tasks 8 | ✅ |
| §7 Bridge offline handling | Tasks 8, 12 | ✅ |
| §8 Position simulator | Task 9 | ✅ (stock only, options skipped per spec scope) |
| §9 Order history — Broker Order ID + status badges | Task 10 | ✅ |
| §10 Reset account button + modal | Task 11 | ✅ |
| §11 localStorage last symbol | Tasks 5, 12 | ✅ |
| §11 invalidateAll after submit | Task 8 | ✅ |
| §11 Toasts for bridge offline / errors | Tasks 9, 12 | ✅ |

### Known partial: covered-call check

The spec says: check `paper.positions` to see if user holds ≥ `contracts × 100` shares of the underlying. This requires passing `positions` data into the server action (not trivially available). Simplified version: any SELL CALL shows `warn` status. Full covered-call check can be added later by passing current positions from page data to the action via a hidden form field or session.
