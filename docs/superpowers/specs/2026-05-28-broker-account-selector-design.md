# Broker Account Selector Design

## Goal

Let users connect and switch between Moomoo broker accounts directly from the topbar. The dashboard always loads data from the currently selected account. New accounts are auto-linked on first selection.

## Architecture

SvelteKit (TypeScript), Prisma (SQLite), moomoo-service FastAPI bridge. Custom CSS vars, no Tailwind.

---

## Section 1 — Data model

### `prisma/schema.prisma` changes

Add to `model User`:
```prisma
activeBrokerAccId String?   // selected Moomoo acc_id, e.g. "4652657"
```

Add to `model Account`:
```prisma
brokerAccId String?         // links this portfolio account to a Moomoo acc_id
```

When a user selects a broker account that has no matching portfolio `Account` (matched by `brokerAccId`), one is auto-created with:
- `name` = account name from bridge (e.g. "Moomoo Live")
- `brokerName` = `"moomoo"`
- `accountType` = `"live"` for REAL, `"paper"` for SIMULATE
- `currency` = from bridge response (default `"USD"`)
- `brokerAccId` = the selected acc_id

---

## Section 2 — API routes

### `GET /api/broker/accounts`

- Auth-gated (`locals.user` → 401 if missing)
- Fetches from bridge: `GET MOOMOO_SERVICE_URL/accounts`
- Returns array: `{ acc_id: string; name: string; trd_env: 'REAL' | 'SIMULATE'; currency: string }[]`
- Response cached 60 s (SvelteKit `setHeaders({ 'cache-control': 'max-age=60' })`)
- On bridge timeout/error: `{ error: 'Bridge offline' }` with HTTP 503

### `POST /api/broker/accounts/select`

- Auth-gated
- Body (JSON): `{ acc_id: string; trd_env: string; name: string; currency?: string }`
- Updates `User.activeBrokerAccId = acc_id`
- Upserts portfolio `Account`: if no account with `brokerAccId === acc_id` exists for this user, create one
- Returns `{ ok: true, accountId: string }`

---

## Section 3 — Topbar dropdown

Replace the existing two-option Live/Paper switcher with a multi-account dropdown.

### Behaviour

1. On dropdown open: fetch `GET /api/broker/accounts` (shows spinner while loading, "Bridge offline" on error)
2. Each broker account shown as a row with: coloured dot (green = REAL, amber = SIMULATE), account name, short acc_id, checkmark if currently selected
3. Static last row: `⚗ Paper Trading` — navigates to `/paper-trading` (existing behaviour)
4. Selecting a broker account row:
   - POST `/api/broker/accounts/select`
   - On success: close dropdown, call `invalidateAll()` to reload dashboard with new account
   - On error: show amber toast "Bridge offline — account not switched"

### Topbar state

```
$: selectedAccId = $portfolioSummary.activeBrokerAccId ?? null;
$: accountLabel = derived from bridge accounts list or fallback to existing accountName
```

The `portfolioSummary` store gains `activeBrokerAccId: string | null`.

### Layout (text mockup)

```
┌──────────────────────────────────┐
│ BROKER ACCOUNTS                  │
│  ● Moomoo Live  [4652657]  ✓    │  ← REAL, selected
│  ○ Moomoo Sim   [4652658]       │  ← SIMULATE
├──────────────────────────────────┤
│  ⚗ Paper Trading                │
└──────────────────────────────────┘
```

---

## Section 4 — Dashboard data loading

### `src/routes/dashboard/+page.server.ts`

`load()` reads `locals.user.activeBrokerAccId` (string | null). Passes to `syncMoomoo({ accId })`.

### `src/lib/services/broker.service.ts`

`syncMoomoo()` accepts optional `accId?: string`. When provided, appends `&acc_id=XXXX` to the bridge `/sync` call. The `preferReal` flag is still passed (determines fallback if acc_id not found).

### `moomoo-service/main.py`

Three endpoints gain an optional `acc_id: str | None = None` query param:
- `POST /sync`
- `GET /fund_balance`
- `GET /fund_positions`

When `acc_id` is provided, skip `_select_account()` and fetch directly:
```python
if acc_id:
    account = next((a for a in accounts if str(a['acc_id']) == str(acc_id)), None)
    if not account:
        raise HTTPException(404, f"Account {acc_id} not found")
```

---

## Section 5 — Error handling & edge cases

| Scenario | Behaviour |
|---|---|
| Bridge offline when dropdown opens | Show "Bridge offline" row, no accounts listed |
| Selected acc_id no longer exists in bridge | Dashboard falls back to `prefer_real=true`, amber toast warning |
| User has no `activeBrokerAccId` | Falls back to existing `prefer_real=true` behaviour (no regression) |
| New account selected, no portfolio Account exists | Auto-created on `POST /api/broker/accounts/select` |

---

## Files

| Action | File |
|---|---|
| Modify | `prisma/schema.prisma` |
| Create | `src/routes/api/broker/accounts/+server.ts` |
| Create | `src/routes/api/broker/accounts/select/+server.ts` |
| Modify | `src/lib/components/portfolioai/Topbar.svelte` |
| Modify | `src/lib/stores/portfolio-summary.ts` |
| Modify | `src/lib/services/broker.service.ts` |
| Modify | `src/routes/dashboard/+page.server.ts` |
| Modify | `src/routes/dashboard/+page.svelte` |
| Modify | `moomoo-service/main.py` |

---

## Out of scope

- Syncing transaction history per-account (separate feature)
- HK market accounts (US only for now)
- Real-time account balance refresh (existing Refresh button is sufficient)
- Delinking / removing a connected account
