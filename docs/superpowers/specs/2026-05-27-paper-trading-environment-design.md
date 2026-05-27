# Paper Trading Environment Design

## Goal

Make the paper trading section a fully self-contained environment: amber-tinted topbar signals paper mode clearly, and users can place stock and option orders directly from the paper trading page.

## Architecture

The topbar gets a visual treatment when on `/paper-trading` routes. The paper trading page gains an inline order form (stock + option) that calls the moomoo bridge directly with `trade_env: SIMULATE` — no full trade-ticket DB flow needed for paper. Option chain data is fetched via two new SvelteKit API proxy routes.

## Tech Stack

SvelteKit (Svelte 5 / TypeScript), existing moomoo-service Python bridge, Tailwind-free custom CSS vars (existing pattern).

---

## Section 1 — Topbar paper mode treatment

When `$page.url.pathname.startsWith('/paper-trading')`:

- Topbar row background: `rgba(245,158,11,0.08)` amber tint
- Topbar bottom border: `rgba(245,158,11,0.4)`
- Account badge: existing amber dot + "Paper Trading" + SIMULATE pill (no change needed to logic)
- Warning banner: 24px strip **below** the topbar (inside the topbar component, rendered conditionally) with text `⚠ You are in paper trading mode — no real money is at risk`
- Banner background: `rgba(245,158,11,0.06)`, border-bottom: `rgba(245,158,11,0.2)`, text: `var(--warning)`

The Topbar component already has `$: isPaperRoute = $page.url.pathname.startsWith('/paper-trading')` — use this reactive variable for all conditional styling.

---

## Section 2 — API proxy routes

### `GET /api/paper/options/expiry?symbol=AAPL`

Proxies to `MOOMOO_SERVICE_URL/options/expiry?symbol=US.AAPL` (auto-prepends `US.` if no market prefix). Returns JSON array of expiry date strings e.g. `["2025-06-20", "2025-07-18"]`. On bridge error returns `{ error: string }` with status 500.

### `GET /api/paper/options/chain?symbol=AAPL&expiry=2025-06-20&option_type=call`

Proxies to `MOOMOO_SERVICE_URL/options/chain?symbol=US.AAPL&expiry=...&option_type=...`. Returns array of option rows: `{ strike: number, bid: number, ask: number, iv: number, option_code: string }`. On bridge error returns `{ error: string }` with status 500.

Both routes require an authenticated session (`locals.user` check) and return 401 if not logged in.

---

## Section 3 — Order form on paper trading page

### Trigger

A `+ New Order` button in the page header (right side, next to the PageHeader). Clicking it toggles `showOrderForm = true`, collapsing it sets `showOrderForm = false`.

### Form layout (inline, above positions table)

Two tabs: **Stock** | **Option**

#### Stock tab fields

| Field | Type | Notes |
|---|---|---|
| Side | BUY / SELL toggle | Default BUY |
| Symbol | Text input | e.g. AAPL, auto-uppercase |
| Order type | Market / Limit toggle | Default Limit |
| Qty | Number input | Min 1 |
| Limit price | Number input | Hidden when Market |

#### Option tab fields

**Step 1 — Select contract:**
- Symbol text input (underlying, e.g. AAPL)
- Expiry dropdown — populated by `GET /api/paper/options/expiry?symbol=AAPL` when symbol is 4+ chars and user blurs or presses Enter; shows "Loading…" while fetching
- CALL / PUT toggle

**Step 2 — Option chain table** (shown after expiry selected):
- Fetches `GET /api/paper/options/chain?symbol=...&expiry=...&option_type=call|put`
- Columns: Strike | Bid | Ask | IV%
- Clicking a row selects that strike; selected row highlighted in blue
- Stores `selectedOptionCode` (e.g. `US.AAPL250620C00180000`)

**Step 3 — Order details** (shown after strike selected):
- Side: BUY / SELL toggle
- Qty (contracts): number input, default 1
- Limit price: number input, pre-filled with Ask price from selected row

#### Paper mode notice

Small amber notice at the bottom of the form: `⚗ Paper mode — no real money will be used`

### Preview → Submit flow

1. User fills form and clicks **Preview Order →**
2. Form posts to `?/previewOrder` server action
3. Server action calls moomoo bridge: `POST /execution/orders` with `{ symbol, side, order_type, quantity, price, trade_env: "SIMULATE", acc_id: 4652657 (US paper) }` and `dry_run: true`
4. Returns preview data: `{ symbol, side, qty, estimated_value, safety_status: 'pass'|'warn'|'block', message }`
5. UI renders a preview card below the form showing the above details
6. If safety_status is 'block': show error, no confirm button
7. If pass or warn: show **Confirm & Submit** button
8. Clicking Confirm posts to `?/submitOrder` with the same order params + `dry_run: false`
9. Bridge places the order in SIMULATE mode; returns `{ broker_order_id, status }`
10. Success: show green toast, close form, page reloads (full page navigate) to refresh positions/orders

---

## Section 4 — Server actions

### `?/previewOrder` (in `paper-trading/+page.server.ts`)

```typescript
// Input (from formData):
// symbol: string, side: 'buy'|'sell', order_type: 'limit'|'market'
// quantity: number, price: number|null, asset_type: 'stock'|'option'
// option_code: string|null (for options)

// Logic:
// 1. Build order: { symbol: toMoomooSymbol(symbol), side, order_type, quantity, price, trade_env: 'SIMULATE', acc_id: 4652657, dry_run: true }
// 2. POST to MOOMOO_SERVICE_URL/execution/orders
// 3. Return preview summary
```

### `?/submitOrder` (in `paper-trading/+page.server.ts`)

```typescript
// Same input as preview but dry_run: false
// Returns: { submitted: true, broker_order_id, status } or fail(400, { message })
```

---

## Out of scope

- Full trade-ticket DB persistence for paper orders (not needed — bridge handles it in SIMULATE mode)
- HK market paper trading (US only for now — acc_id 4652657)
- Option order for non-Moomoo-connected users (form is only shown when bridge is reachable)
- Cancel order UI (already exists in positions/orders table)
