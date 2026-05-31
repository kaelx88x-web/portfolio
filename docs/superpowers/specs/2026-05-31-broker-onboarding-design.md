# Broker Onboarding — Design Spec
**Date:** 2026-05-31
**Status:** Approved

---

## Problem

Users land on an empty or error-state dashboard immediately after registration because no broker is connected. The app auto-created an internal "Paper Portfolio" account as a workaround, which created false expectations that the app itself simulates trades. Paper and live trading are powered exclusively by the connected broker (Moomoo).

---

## Goal

Force broker connection as a mandatory onboarding step before any protected route is accessible. Once connected, the user's selected account (paper or live) is persisted so subsequent logins skip onboarding entirely.

---

## Decisions

| Question | Decision |
|---|---|
| Broker offline during onboarding | Block — show error + retry, no dashboard access |
| State persistence | Save `activeBrokerAccId` in DB; next login skips onboarding |
| Account switching | Topbar switcher (existing) |
| Route protection scope | All routes except `/login`, `/register`, `/api/auth`, `/onboarding` |
| Gate mechanism | `activeBrokerAccId === null` → redirect to onboarding |
| DB migration | None — reuse existing `activeBrokerAccId` field |

---

## Architecture

### Route Guard — `hooks.server.ts`

Add one check after the existing auth guard:

```
if (user.activeBrokerAccId === null)
  AND pathname NOT in ['/login', '/register', '/api/auth', '/onboarding']
→ redirect 303 /onboarding/connect-broker
```

No DB migration required. `activeBrokerAccId` is already nullable and defaults to null for all new users.

### Onboarding Page — `src/routes/onboarding/connect-broker/+page.svelte`

Single page, three wizard steps managed via client-side state:

**Step 1 — Choose Broker**
- Render broker tiles: Moomoo (active), Webull (disabled/coming soon), Others (disabled)
- Selecting Moomoo advances to Step 2
- If `activeBrokerAccId` is already set (reconnect flow), skip Step 1, go directly to Step 2

**Step 2 — Connection Check**
Run three checks sequentially, display live status per check:

1. OpenD running — `GET /api/broker/health/opend`
2. moomoo-service running — `GET /api/broker/health/service`
3. Fetch accounts — `GET /api/broker/accounts`

Each check shows: spinner → ● Connected (green) or ✕ Failed (red).

On any failure:
- Show user-friendly message: "Moomoo bridge is not running"
- Show **Retry** button (re-runs all checks from top)
- Show expandable **Developer details** with raw error and terminal commands
- Block progression to Step 3

On all checks pass → auto-advance to Step 3.

**Step 3 — Select Account**
- Display accounts fetched in Step 2
- Each row shows: account name, type (Paper / Live), account ID (last 6 digits)
- User selects one → POST `/api/broker/accounts/select` (existing endpoint)
- On success → `activeBrokerAccId` set in DB → redirect `/dashboard`

**Page guard:** If `activeBrokerAccId` already set and user navigates to `/onboarding/connect-broker` directly → redirect to `/dashboard`. Exception: coming from "Reconnect Broker" action (query param `?reconnect=1`) — allow access, skip to Step 2.

### Remove Internal Paper Account Creation

Three locations to remove:

1. **`src/lib/server/auth.ts`** — delete `databaseHooks.user.create.after` block that creates `Paper Portfolio` account
2. **`src/routes/dashboard/+page.server.ts`** — delete safety-net block that creates paper account when `existingAccounts.length === 0`
3. These are the only two auto-creation sites; no other changes required

Existing paper account data in DB is preserved — no data loss for current users.

### Topbar — Add "Reconnect Broker" Entry

Add one item to the existing account switcher dropdown:

```
[ ● Moomoo Paper  acc: xxxxxx ]
[ ● Moomoo Live   acc: xxxxxx ]
────────────────────────────────
[ ⚙  Reconnect Broker         ]  → goto /onboarding/connect-broker?reconnect=1
```

No other topbar changes required.

---

## Data Flow

```
Register/Login
     │
     ▼
hooks.server.ts
     │ activeBrokerAccId === null?
     ├─ YES → redirect /onboarding/connect-broker
     └─ NO  → proceed to requested route
                    │
                    ▼
         /onboarding/connect-broker
                    │
          Step 1: Choose Broker (Moomoo)
                    │
          Step 2: Connection Check
          ┌─────────────────────────┐
          │ OpenD OK?               │
          │ moomoo-service OK?      │
          │ Accounts fetched?       │
          └─────────────────────────┘
                    │ all pass
                    ▼
          Step 3: Select Account
                    │ POST /api/broker/accounts/select
                    ▼
              activeBrokerAccId set in DB
                    │
                    ▼
              redirect /dashboard
```

---

## New API Endpoints

Two lightweight health check endpoints needed for Step 2:

| Endpoint | Purpose | Implementation |
|---|---|---|
| `GET /api/broker/health/opend` | Check if OpenD is reachable | Call `GET http://127.0.0.1:8001/health/opend` on moomoo-service; service proxies the OpenD connection check |
| `GET /api/broker/health/service` | Check if moomoo-service is running | `GET http://127.0.0.1:8001/health` with 3s timeout; 200 = running |

`GET /api/broker/accounts` already exists — reuse as-is for Step 2 account fetch.

---

## Error States

| Scenario | Behaviour |
|---|---|
| OpenD not running | Step 2 fails check 1, show "Open Moomoo OpenD and log in", Retry button |
| moomoo-service not running | Step 2 fails check 2, show "Start moomoo-service", terminal command in expandable details |
| No accounts returned | Step 2 fails check 3, show "No accounts found — check OpenD login" |
| `/api/broker/accounts/select` fails | Step 3 error toast, stay on Step 3, allow retry |
| User navigates away mid-onboarding | Hook redirects back to `/onboarding/connect-broker` on next request |

---

## Out of Scope

- Webull integration (placeholder tile only)
- Email verification gate
- Multiple broker connections (single broker per user in V1)
- Admin bypass of onboarding

---

## Affected Files

| File | Change |
|---|---|
| `src/hooks.server.ts` | Add broker gate check |
| `src/lib/server/auth.ts` | Remove paper account creation hook |
| `src/routes/dashboard/+page.server.ts` | Remove paper account safety net |
| `src/routes/onboarding/connect-broker/+page.svelte` | New — wizard UI |
| `src/routes/onboarding/connect-broker/+page.server.ts` | New — load guard (redirect if already set) |
| `src/routes/api/broker/health/opend/+server.ts` | New — OpenD health check |
| `src/routes/api/broker/health/service/+server.ts` | New — moomoo-service health check |
| `src/lib/components/portfolioai/Topbar.svelte` | Add "Reconnect Broker" dropdown item |
