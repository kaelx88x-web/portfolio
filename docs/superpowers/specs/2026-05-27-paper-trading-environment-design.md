# Paper Trading Environment Design

## Goal

Make the paper trading section a fully self-contained simulate environment: amber-tinted topbar signals paper mode clearly; users can place stock and option orders with full validation, risk guards, and position preview; a mini order history table and account balance panel complete the trading experience.

## Architecture

The topbar gets a visual treatment when on `/paper-trading` routes. The paper trading page gains: an account balance panel, an inline order form (stock + option with chain picker), client-side validation, risk guards, position simulator, order history table, and a reset button. Two new SvelteKit API proxy routes serve option chain data. Server actions call the moomoo bridge directly with `trade_env: SIMULATE`. Last-used symbol is persisted in `localStorage`.

## Tech Stack

SvelteKit (TypeScript), existing moomoo-service Python bridge, custom CSS vars pattern (no Tailwind).

---

## Section 1 — Topbar paper mode treatment

When `$page.url.pathname.startsWith('/paper-trading')`:

- Topbar row background: `rgba(245,158,11,0.08)` amber tint
- Topbar bottom border: `rgba(245,158,11,0.4)`
- Account badge: existing amber dot + "Paper Trading" + SIMULATE pill (logic unchanged)
- **Warning banner**: 24px strip rendered below the topbar row (inside `Topbar.svelte`) with `⚠ You are in paper trading mode — no real money is at risk`
- Banner styles: background `rgba(245,158,11,0.06)`, border-bottom `1px solid rgba(245,158,11,0.2)`, text colour `var(--warning)`

The Topbar component already has `$: isPaperRoute = $page.url.pathname.startsWith('/paper-trading')` — use this for all conditional styling.

---

## Section 2 — API proxy routes

### `GET /api/paper/options/expiry?symbol=AAPL`

Proxies to `MOOMOO_SERVICE_URL/options/expiry?symbol=US.AAPL` (auto-prepends `US.` if no market prefix). Returns JSON array of expiry date strings e.g. `["2025-06-20","2025-07-18"]`. On bridge error returns `{ error: string }` with HTTP 500.

### `GET /api/paper/options/chain?symbol=AAPL&expiry=2025-06-20&option_type=call`

Proxies to `MOOMOO_SERVICE_URL/options/chain`. Returns array: `{ strike: number, bid: number, ask: number, iv: number, option_code: string }[]`. On bridge error returns `{ error: string }` with HTTP 500.

Both routes require authenticated session (`locals.user`) → 401 if missing.

---

## Section 3 — Account balance panel

Rendered at the top of the paper trading page (above the existing stat cards), sourced from `paper.account_info`:

| Label | Source field | Notes |
|---|---|---|
| Cash Available | `account_info.cash` | Available cash |
| Buying Power | `account_info.power` | Margin buying power |
| Used Collateral | `account_info.total_assets - account_info.cash - account_info.market_val` | Approximate margin used |
| Unrealized P&L | `account_info.unrealized_pl` | Green/red coloured |

Rendered as a 4-column stat strip (matching existing `.stats` grid style) with amber accent to distinguish from live dashboard.

---

## Section 4 — Order form

### Trigger

`+ New Order` button in the paper trading page header (right side). Toggles `showOrderForm`. Last-used symbol stored in and restored from `localStorage` key `paper_last_symbol`.

### Tabs: Stock | Option

#### Stock tab fields

| Field | Type | Notes |
|---|---|---|
| Side | BUY / SELL toggle | Default BUY |
| Symbol | Text input | Auto-uppercase |
| Order type | Market / Limit toggle | Default Limit |
| Qty | Number input | Min 1 |
| Limit price | Number input | Hidden when Market selected |

#### Option tab fields

**Step 1 — Contract selection:**
- Symbol text input (underlying, e.g. AAPL) — on blur (≥2 chars): fetch expiry list
- Expiry dropdown — populated from `/api/paper/options/expiry`; shows "Loading…" while fetching; shows "Bridge offline" on error
- CALL / PUT toggle

**Step 2 — Option chain table** (shown after expiry + type selected):
- Fetches `/api/paper/options/chain`
- Columns: Strike | Bid | Ask | IV% | Spread
- Clicking a row selects it (blue highlight); stores `selectedOptionCode`, `selectedBid`, `selectedAsk`
- **Spread** column = `(ask - bid) / ask * 100` — if spread > 30%: row shows amber ⚠ icon

**Step 3 — Order details** (shown after strike selected):
- Side: BUY / SELL toggle
- Qty (contracts): number input, default 1
- Limit price: pre-filled with ask (for BUY) or bid (for SELL)

#### Paper notice

Amber strip at bottom of form: `⚗ Paper mode — no real money will be used`

---

## Section 5 — Client-side validation (before server call)

All checks run on "Preview Order →" click. Errors shown inline below the field or as a red summary box — do NOT call the server if any hard block fails.

### Hard blocks (prevent submission)

| Check | Condition | Message |
|---|---|---|
| Qty empty/zero | `qty <= 0 or NaN` | "Quantity is required and must be at least 1" |
| Limit price missing | `order_type === 'limit' && !price` | "Limit price is required for limit orders" |
| No symbol | `symbol.trim() === ''` | "Symbol is required" |
| No option selected | Option tab + no strike selected | "Select a strike from the chain table" |

### Warnings (allow submission but shown in preview card)

| Check | Condition | Warning |
|---|---|---|
| Wide bid/ask spread | `(ask - bid) / ask > 0.30` | "⚠ Wide spread (>30%) — you may get a worse fill" |
| Near expiry | Days to expiry ≤ 7 | "⚠ Expiry in {N} days — time decay (theta) is accelerating" |

---

## Section 6 — Risk guards for options

Run server-side in `?/previewOrder` and returned in preview data. Displayed in preview card.

### BUY option

- **Max loss** = `premium × 100 × contracts` where premium = limit price
- Display: "Max loss on this trade: $350 (premium paid)"
- Status: always `pass` — informational only

### SELL option (uncovered)

- **Assignment risk**: if PUT → must be able to buy 100×contracts shares at strike; if CALL → covered call check (see below)
- **Collateral estimate**: `strike × 100 × contracts × 0.20` (20% of notional, approximate)
- Display: "Estimated collateral required: $3,600. Assignment risk: if exercised, you must buy/deliver 100 shares per contract."
- Status: `warn`

### Covered call check (SELL CALL only)

- Read current positions from `paper.positions`
- Check if user holds ≥ `contracts × 100` shares of the underlying
- If yes: status `pass`, message "Covered call — you hold sufficient shares"
- If no: status `warn`, message "⚠ Uncovered call — you do not hold {needed} shares of {symbol}. Assignment would require delivering shares you don't own."

---

## Section 7 — Preview → Submit flow

1. Client validates (Section 5) — abort if any hard block
2. Client POSTs to `?/previewOrder`
3. Server builds order: `{ symbol: toMoomooSymbol(symbol), side, order_type, quantity, price, trade_env: 'SIMULATE', acc_id: 4652657, dry_run: true }`
4. Server calls `POST MOOMOO_SERVICE_URL/execution/orders`
5. Server applies risk guards (Section 6) and merges with bridge response
6. Returns: `{ symbol, side, qty, estimated_value, safety_status: 'pass'|'warn'|'block', message, risk_notes: string[], warnings: string[] }`
7. UI shows preview card with all details
8. If `safety_status === 'block'`: red card, no confirm button
9. If pass or warn: show **Confirm & Submit** button
10. Confirm POSTs to `?/submitOrder` (same params, `dry_run: false`)
11. Bridge returns `{ broker_order_id, status }`
12. Success: green toast `✓ Order submitted — broker_order_id: XXXX`, form closes, page data reloads

**Bridge offline handling**: if fetch to moomoo-service times out or returns non-2xx → return `fail(503, { message: 'Bridge offline — start moomoo-service and retry' })` → UI shows amber toast "⚠ Bridge offline…"

---

## Section 8 — Position simulator

After `?/submitOrder` returns successfully, before page reload, show a transient info banner:

> **Estimated position after fill:**  
> BUY 100 AAPL @ $182.50 → new holding: ~100 shares, cost basis ~$18,250

Logic (client-side, approximate):
- Find existing position for symbol in `paper.positions` (if any)
- Add qty to existing quantity, recalculate average cost
- Show as one-liner in the success toast or as a card below it
- Marked "estimate — actual fill may differ"

---

## Section 9 — Order history mini table

A collapsible section on the paper trading page (below Positions, above Fills) titled **"Paper Orders"**. Sourced from `paper.orders` (already loaded on page).

Columns: Symbol | Side | Type | Qty | Filled | Price | Status | Broker Order ID | Date

- Status badges: FILLED (green), PENDING / QUEUED (amber), CANCELLED / REJECTED (muted), other (blue)
- `broker_order_id` shown as a monospace short code (first 8 chars)
- Limited to 20 most recent rows (already `orders.slice(0, 50)` in current page — cap at 20 here)
- The existing Orders section already renders this — **no new component needed**, but add the Broker Order ID column and improve status badge colours to match the spec above

---

## Section 10 — Reset paper account button

A **"Reset Account"** button in the page header alongside "+ New Order". Clicking it opens a confirmation modal:

> **Reset paper account?**  
> This will cancel all open SIMULATE orders and close all positions via the Moomoo OpenD simulate account reset. This cannot be undone.  
> [Cancel] [Reset Account]

On confirm: POST to `?/resetAccount` server action → calls `POST MOOMOO_SERVICE_URL/paper/reset` (new endpoint to add to moomoo-service `main.py`) → on success shows toast "Paper account reset", page reloads.

If moomoo-service does not have a `/paper/reset` endpoint: the action returns `fail(501, { message: 'Reset not supported by this bridge version' })`.

---

## Section 11 — Better UX

| Feature | Implementation |
|---|---|
| Save last symbol | `localStorage.setItem('paper_last_symbol', symbol)` on preview; restore on form open |
| Auto-refresh after submit | After `?/submitOrder` success: `await invalidateAll()` (SvelteKit) to reload page data without full navigation |
| Toast for bridge offline | `fail(503, ...)` from server action → client checks `form?.bridgeOffline` → shows amber toast |
| Toast for preview error | Any `fail(4xx/5xx)` → client shows red toast with `form.message` |

---

## Server actions summary (`paper-trading/+page.server.ts`)

| Action | Input | Calls | Returns |
|---|---|---|---|
| `previewOrder` | symbol, side, order_type, qty, price, asset_type, option_code | bridge `/execution/orders` dry_run=true | preview object |
| `submitOrder` | same | bridge `/execution/orders` dry_run=false | `{ submitted, broker_order_id, status }` |
| `resetAccount` | — | bridge `/paper/reset` | `{ reset: true }` or fail |

---

## Files

| Action | File |
|---|---|
| Create | `src/routes/api/paper/options/expiry/+server.ts` |
| Create | `src/routes/api/paper/options/chain/+server.ts` |
| Modify | `src/lib/components/portfolioai/Topbar.svelte` |
| Modify | `src/routes/paper-trading/+page.svelte` |
| Modify | `src/routes/paper-trading/+page.server.ts` |
| Modify | `moomoo-service/main.py` (add `/paper/reset` endpoint) |

---

## Out of scope

- Full trade-ticket DB persistence for paper orders (bridge handles state in SIMULATE mode)
- HK market paper trading (US only — acc_id 4652657)
- Real-time price feed / WebSocket live updates
- Cancel individual order from this page (use Moomoo app or existing orders table)
