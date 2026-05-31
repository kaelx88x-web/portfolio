# Broker Onboarding — Design Spec
**Date:** 2026-05-31
**Status:** Approved (rev 2 — post user review)

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
| Route protection scope | All routes except public paths and broker onboarding API paths (see below) |
| Gate mechanism | `activeBrokerAccId === null` → redirect to onboarding (DB fetch, not locals) |
| DB migration | None — reuse existing `activeBrokerAccId` field |

---

## Architecture

### Route Guard — `hooks.server.ts`

Add one check after the existing auth guard. Two path groups are exempt:

```ts
const PUBLIC_PATHS = ['/login', '/register', '/api/auth'];

// These must be callable before activeBrokerAccId is set —
// the onboarding wizard calls them to run connection checks and select accounts.
const BROKER_ONBOARDING_PATHS = [
  '/onboarding',
  '/api/broker/health',
  '/api/broker/accounts',
  '/api/broker/accounts/select',
];

const isPublic = PUBLIC_PATHS.some(p => pathname.startsWith(p));
const isBrokerOnboarding = BROKER_ONBOARDING_PATHS.some(p => pathname.startsWith(p));

if (!isPublic && !isBrokerOnboarding) {
  // Fetch from DB — Better Auth locals does not reliably include custom fields
  const dbUser = await prisma.user.findUnique({
    where: { id: event.locals.user.id },
    select: { activeBrokerAccId: true },
  });
  if (!dbUser?.activeBrokerAccId) {
    throw redirect(303, '/onboarding/connect-broker');
  }
}
```

`activeBrokerAccId` is already nullable and defaults to null for all new users. No migration required.

> **Why DB fetch instead of `locals.user`:** Better Auth populates `locals.user` from the session JWT. Custom fields like `activeBrokerAccId` may not be included unless explicitly configured. A targeted `findUnique` with `select` is cheap (single indexed lookup) and authoritative.

### Onboarding Page — `src/routes/onboarding/connect-broker/`

**`+page.server.ts` — load guard**

```ts
export const load: PageServerLoad = async ({ locals, url }) => {
  const isReconnect = url.searchParams.get('reconnect') === '1';
  if (!isReconnect) {
    const dbUser = await prisma.user.findUnique({
      where: { id: locals.user!.id },
      select: { activeBrokerAccId: true },
    });
    if (dbUser?.activeBrokerAccId) {
      throw redirect(303, '/dashboard');
    }
  }
  // Pass reconnect flag to page so wizard can skip Step 1
  return { isReconnect };
};
```

> **Reconnect flow timing:** The global route guard exempts all `/onboarding` paths, so the guard never fires before `+page.server.ts` reads `?reconnect=1`. No conflict.

**`+page.svelte` — wizard UI**

Single page, three wizard steps via client-side state (`step: 1 | 2 | 3`):

**Step 1 — Choose Broker**
- Render broker tiles: Moomoo (active), Webull (disabled/coming soon), Others (disabled)
- Selecting Moomoo advances to Step 2
- Skipped automatically when `data.isReconnect === true` (already on Moomoo)

**Step 2 — Connection Check**
Run three checks sequentially, each with live status indicator:

1. `GET /api/broker/health/service` — moomoo-service running?
2. `GET /api/broker/health/opend` — OpenD connected?
3. `GET /api/broker/accounts` — accounts fetched?

Each check shows: spinner → ● OK (green) or ✕ Failed (red).

On any failure:
- Show user-friendly message per check (e.g. "Start moomoo-service")
- **Retry** button re-runs all three checks from the top
- Expandable **Developer details** with raw error + terminal commands
- Step 3 blocked until all pass

On all checks pass → auto-advance to Step 3.

**Step 3 — Select Account**
- Display accounts from Step 2 check result
- Each row: account name, type badge (PAPER / LIVE), account ID (last 6 digits)
- User selects one → POST `/api/broker/accounts/select` (existing endpoint)
- On success → `activeBrokerAccId` set in DB → `goto('/dashboard')`

### Remove Internal Paper Account Creation

Two sites confirmed present:

1. **`src/lib/server/auth.ts` line ~32** — `databaseHooks.user.create.after` block creates `Paper Portfolio` account on registration. Delete entire block.
2. **`src/routes/dashboard/+page.server.ts` line ~157** — safety-net creates paper account when `existingAccounts.length === 0`. Delete entire block.

Existing paper account data in DB is preserved. No data loss.

### Topbar — Replace "Paper Trading" with "Manage Broker Connection"

Remove the existing "Paper Trading" link (which navigated to `/paper-trading`) from the account switcher dropdown. Replace with:

```
[ ● Moomoo Paper  acc: xxxxxx ]
[ ● Moomoo Live   acc: xxxxxx ]
────────────────────────────────
[ ⚙  Manage Broker Connection ]  → goto /onboarding/connect-broker?reconnect=1
```

Rationale: "Paper Trading" implied the app creates paper accounts. The new label accurately describes the action — managing the broker connection. The destination is the onboarding wizard in reconnect mode (skips Step 1, goes to connection check).

---

## Data Flow

```
Register/Login
     │
     ▼
hooks.server.ts
     │ activeBrokerAccId === null? (DB fetch)
     ├─ YES → redirect /onboarding/connect-broker
     └─ NO  → proceed to requested route

/onboarding/connect-broker
     │
     ├─ ?reconnect=1 → skip Step 1
     │
     Step 1: Choose Broker → Moomoo
     │
     Step 2: Connection Check
     ├─ moomoo-service OK?
     ├─ OpenD OK?
     └─ accounts fetched?
          │ all pass
          ▼
     Step 3: Select Account
          │ POST /api/broker/accounts/select
          ▼
     activeBrokerAccId set in DB
          │
          ▼
     goto /dashboard
```

---

## New API Endpoints

| Endpoint | Purpose | Implementation |
|---|---|---|
| `GET /api/broker/health/service` | Check if moomoo-service is running | `GET http://127.0.0.1:8001/health` with 3s timeout; 200 = running |
| `GET /api/broker/health/opend` | Check if OpenD is connected | `GET http://127.0.0.1:8001/health/opend`; moomoo-service proxies the OpenD connection state |

Both endpoints must be in `BROKER_ONBOARDING_PATHS` so they are callable before `activeBrokerAccId` is set.

`GET /api/broker/accounts` and `POST /api/broker/accounts/select` already exist — reuse as-is.

---

## Error States

| Scenario | Behaviour |
|---|---|
| moomoo-service not running | Check 1 fails, "Start moomoo-service", terminal cmd in expandable details, Retry button |
| OpenD not running | Check 2 fails, "Open Moomoo OpenD and log in", Retry button |
| No accounts returned | Check 3 fails, "No accounts found — check OpenD login", Retry button |
| `/api/broker/accounts/select` fails | Step 3 error, stay on Step 3, allow retry |
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
| `src/hooks.server.ts` | Add broker gate — DB fetch, two exempt path groups |
| `src/lib/server/auth.ts` | Remove paper account creation hook |
| `src/routes/dashboard/+page.server.ts` | Remove paper account safety net |
| `src/routes/onboarding/connect-broker/+page.svelte` | New — 3-step wizard UI |
| `src/routes/onboarding/connect-broker/+page.server.ts` | New — load guard with reconnect support |
| `src/routes/api/broker/health/service/+server.ts` | New — moomoo-service health check |
| `src/routes/api/broker/health/opend/+server.ts` | New — OpenD health check (via moomoo-service) |
| `src/lib/components/portfolioai/Topbar.svelte` | Replace "Paper Trading" link with "Manage Broker Connection" |
