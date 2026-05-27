# SaaS Auth + Admin Panel Design

**Date:** 2026-05-27  
**Status:** Approved  
**Goal:** Transform the app from single-user (`getDemoUser()`) to a real multi-user SaaS with email/password auth, paper accounts for new users, an onboarding checklist, and an admin panel for user management.

---

## Context

The app currently uses `getDemoUser()` in 50+ routes and server files — it always returns a hardcoded `demo@portfolio-ai.local` user. There is no login, no session, no user isolation. This change replaces that pattern with real auth while keeping the demo user as the first admin account.

Subscriptions/billing is **out of scope** — that is Subsystem 2, to be designed separately after this ships.

---

## Decisions Made

| Decision | Choice | Reason |
|----------|--------|--------|
| Auth library | Better Auth | SvelteKit-native, Prisma adapter, built-in admin plugin, active development |
| Demo user | Kept as admin seed | Existing data preserved; `role = 'admin'` set on migration |
| Registration | Open (semi-public) | Anyone can register; admin can ban |
| Paper account | Auto-created on register | No broker needed to start |
| Onboarding | Checklist sidebar (B) | Non-blocking, user can complete in any order |
| Admin layout | Widget dashboard (C) | Comprehensive overview with drill-down pages |

---

## Architecture

```
Browser request
  └── hooks.server.ts          validates session → sets locals.user
        ├── /login, /register  public routes — no auth required
        ├── /admin/*            requires locals.user.role === 'admin'
        └── all other routes    requires locals.user (redirect /login if absent)

Register action
  └── better-auth createUser()
        └── create Account row { brokerName: 'paper' }
              └── redirect → /onboarding (or dashboard with checklist)

Admin panel /admin
  └── requires role === 'admin'
        ├── widget dashboard
        └── /admin/users → user table + ban/unban/impersonate
```

---

## Schema Changes (`prisma/schema.prisma`)

### New fields on `User`

```prisma
  role               String?   // 'admin' | null
  banned             Boolean   @default(false)
  banReason          String?
  banExpires         DateTime?
  emailVerified      Boolean   @default(false)
  onboardingCompleted Boolean  @default(false)
  image              String?
  // relations
  sessions           Session[]
  betterAuthAccounts BetterAuthAccount[]
  verifications      Verification[]
```

### New models (Better Auth managed)

```prisma
model Session {
  id        String   @id
  expiresAt DateTime
  token     String   @unique
  createdAt DateTime
  updatedAt DateTime
  ipAddress String?
  userAgent String?
  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
  @@index([token])
}

model BetterAuthAccount {
  id                    String    @id
  accountId             String
  providerId            String
  userId                String
  user                  User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  accessToken           String?   @db.Text
  refreshToken          String?   @db.Text
  idToken               String?   @db.Text
  accessTokenExpiresAt  DateTime?
  refreshTokenExpiresAt DateTime?
  scope                 String?
  password              String?
  createdAt             DateTime
  updatedAt             DateTime

  @@index([userId])
}

model Verification {
  id         String    @id
  identifier String
  value      String    @db.Text
  expiresAt  DateTime
  createdAt  DateTime?
  updatedAt  DateTime?

  @@index([identifier])
}
```

---

## New Files

### `src/lib/server/auth.ts`

Better Auth configuration:

```typescript
import { betterAuth } from 'better-auth';
import { prismaAdapter } from '@better-auth/prisma';
import { admin as adminPlugin } from 'better-auth/plugins';
import { prisma } from '$lib/server/db';

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'mysql' }),
  emailAndPassword: { enabled: true },
  plugins: [adminPlugin()],
  session: {
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
});

export type Session = typeof auth.$Infer.Session;
```

### `src/hooks.server.ts`

```typescript
import { auth } from '$lib/server/auth';
import { redirect } from '@sveltejs/kit';

const PUBLIC_PATHS = ['/login', '/register', '/api/auth'];

export async function handle({ event, resolve }) {
  const session = await auth.api.getSession({ headers: event.request.headers });
  event.locals.user = session?.user ?? null;
  event.locals.session = session?.session ?? null;

  const isPublic = PUBLIC_PATHS.some((p) => event.url.pathname.startsWith(p));
  if (!event.locals.user && !isPublic) {
    throw redirect(303, '/login');
  }

  if (event.url.pathname.startsWith('/admin') && event.locals.user?.role !== 'admin') {
    throw redirect(303, '/dashboard');
  }

  return resolve(event);
}
```

### `src/app.d.ts` additions

```typescript
declare global {
  namespace App {
    interface Locals {
      user: import('better-auth').User | null;
      session: import('better-auth').Session | null;
    }
  }
}
```

### `src/routes/api/auth/[...all]/+server.ts`

```typescript
import { auth } from '$lib/server/auth';
export const { GET, POST } = auth.handler;
```

### `src/lib/server/demo-user.ts` — updated

```typescript
// getDemoUser() kept for backward compat during migration — returns locals.user
// After migration complete, this file is deleted
```

---

## Modified Files

### `src/routes/+layout.server.ts`

Add `user` to all page data:

```typescript
export async function load({ locals }) {
  return { user: locals.user };
}
```

### `src/routes/login/+page.svelte` — replace placeholder

Email + password form calling `POST /api/auth/sign-in/email`. Redirect to `/dashboard` on success. Link to `/register`.

### `src/routes/register/+page.svelte` — replace placeholder

Name + email + password form calling `POST /api/auth/sign-up/email`. On success: server action creates paper Account row, redirects to `/dashboard`.

### `src/routes/register/+page.server.ts` — new

```typescript
// After Better Auth creates the user, create their paper Account
export const actions = {
  default: async ({ locals }) => {
    if (!locals.user) return;
    await prisma.account.create({
      data: {
        userId: locals.user.id,
        name: 'Paper Portfolio',
        brokerName: 'paper',
        accountType: 'paper',
        currency: 'USD',
      },
    });
  },
};
```

Actually, this is handled via Better Auth's `onEmailVerified` / `onCreate` hook in `auth.ts` rather than a separate action. The hook runs after user creation:

```typescript
betterAuth({
  // ...
  hooks: {
    after: [
      {
        matcher: (ctx) => ctx.path === '/sign-up/email',
        handler: async (ctx) => {
          const userId = ctx.context.newSession?.user?.id;
          if (userId) {
            await prisma.account.create({
              data: {
                userId,
                name: 'Paper Portfolio',
                brokerName: 'paper',
                accountType: 'paper',
                currency: 'USD',
              },
            });
          }
        },
      },
    ],
  },
});
```

### All `getDemoUser()` callers — migration

Every file calling `getDemoUser()` is updated to read `locals.user`:

```typescript
// BEFORE (in +page.server.ts)
const user = await getDemoUser();

// AFTER
const user = locals.user!;  // hooks.server.ts guarantees user exists for protected routes
```

For `+server.ts` API routes:
```typescript
// BEFORE
const user = await getDemoUser();

// AFTER
const user = event.locals.user!;
```

**Seed script** (`prisma/seed.ts`) ensures demo user exists with `role = 'admin'` and a known default password on first run.

---

## Onboarding Checklist Sidebar

### Component: `src/lib/components/portfolioai/OnboardingChecklist.svelte`

Props: `user: User`, `holdings: SnapshotHolding[]`, `hasCash: boolean`, `hasBroker: boolean`

5 checklist items (computed from props):

| # | Label | Checked when |
|---|-------|-------------|
| 1 | Create account | Always true (user is logged in) |
| 2 | Add first stock | `holdings.length > 0` |
| 3 | Set cash balance | `hasCash === true` |
| 4 | Connect broker *(optional)* | Account with `brokerName !== 'paper'` exists |
| 5 | Explore dashboard | `user.onboardingCompleted` (set to true after first dashboard visit post-login) |

**Dismiss behaviour:** "Dismiss" button sets `onboardingCompleted = true` via form action. Checklist hidden when all 5 checked OR dismissed.

**Placement:** Shown as a floating panel on the right side of `/dashboard` (above the watchlist table) when `!user.onboardingCompleted`.

### Form action in `src/routes/dashboard/+page.server.ts`

```typescript
dismissOnboarding: async ({ locals }) => {
  await prisma.user.update({
    where: { id: locals.user!.id },
    data: { onboardingCompleted: true },
  });
  return { dismissed: true };
},
```

---

## Admin Panel

### Routes

| Route | Description |
|-------|-------------|
| `/admin` | Widget dashboard (4 cards) |
| `/admin/users` | User table with search, ban/unban, impersonate |
| `/admin/users/[id]` | Single user detail — account info, portfolio summary |

All routes: `hooks.server.ts` already guards `role === 'admin'`.

### `/admin/+page.server.ts` — load data

```typescript
export async function load({ locals }) {
  const [totalUsers, activeUsers, bannedUsers, totalAccounts] = await Promise.all([
    prisma.user.count(),
    prisma.session.count({
      where: { updatedAt: { gte: new Date(Date.now() - 7 * 86400_000) } },
    }),
    prisma.user.count({ where: { banned: true } }),
    prisma.account.count(),
  ]);

  // Total AUM: sum of latest portfolio snapshot values
  const latestSnaps = await prisma.portfolioSnapshot.groupBy({
    by: ['userId'],
    _max: { createdAt: true },
  });
  // ... sum totalValue across all users' latest snapshots

  return { totalUsers, activeUsers, bannedUsers, totalAccounts, totalAum };
}
```

### `/admin` widget dashboard — 4 cards

```
┌──────────────────┬──────────────────┐
│ 👥 USER MGMT     │ 🚨 PENDING       │
│ 12 total         │ 2 banned         │
│ +3 this week     │ 0 flagged        │
│ [Manage Users →] │ [Review →]       │
├──────────────────┼──────────────────┤
│ 📊 PORTFOLIO     │ ⚙ SYSTEM        │
│ $48,210 AUM      │ DB: healthy ✓    │
│ 12 accounts      │ Bridge: online ✓ │
└──────────────────┴──────────────────┘
```

### `/admin/users` — user table

Columns: Name, Email, Joined, Last Active, Status (Active/Banned), Actions

Actions per row:
- **Ban** — opens modal: enter reason, optional expiry date → `POST /api/auth/admin/ban-user`
- **Unban** — `POST /api/auth/admin/unban-user`
- **View Portfolio** — navigate to `/admin/users/[id]`
- **Impersonate** — Better Auth admin plugin: `POST /api/auth/admin/impersonate-user` → opens new tab as that user

---

## Migration Strategy for getDemoUser()

The migration happens in one task — a bulk find-and-replace guided by the plan. The pattern is consistent across all files:

1. Remove `import { getDemoUser }` 
2. Remove `const user = await getDemoUser()`
3. Replace `user.id` → `locals.user!.id` (or `event.locals.user!.id` in API routes)

The `getDemoUser()` function in `src/lib/server/demo-user.ts` is kept until all callers are migrated, then deleted.

**Seed:** `npx prisma db seed` creates `demo@portfolio-ai.local` with password `demo123` and `role = 'admin'` if not exists.

---

## File Changes Summary

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add Session, BetterAuthAccount, Verification models; add fields to User |
| `prisma/seed.ts` | Seed demo admin user with known password |
| `src/lib/server/auth.ts` | **Create** — Better Auth config + paper account hook |
| `src/app.d.ts` | Add `locals.user` and `locals.session` types |
| `src/hooks.server.ts` | **Create** — session validation, auth guard, admin guard |
| `src/routes/api/auth/[...all]/+server.ts` | **Create** — Better Auth request handler |
| `src/routes/+layout.server.ts` | Add `user` to load return |
| `src/routes/login/+page.svelte` | Replace placeholder with real login form |
| `src/routes/register/+page.svelte` | Replace placeholder with real register form |
| `src/lib/components/portfolioai/OnboardingChecklist.svelte` | **Create** — checklist sidebar component |
| `src/routes/dashboard/+page.server.ts` | Add `dismissOnboarding` action + onboarding data |
| `src/routes/dashboard/+page.svelte` | Add `<OnboardingChecklist>` |
| `src/routes/admin/+page.server.ts` | **Create** — admin stats load |
| `src/routes/admin/+page.svelte` | **Create** — widget dashboard |
| `src/routes/admin/users/+page.server.ts` | **Create** — user list load + ban actions |
| `src/routes/admin/users/+page.svelte` | **Create** — user table |
| `src/routes/admin/users/[id]/+page.server.ts` | **Create** — single user detail |
| `src/routes/admin/users/[id]/+page.svelte` | **Create** — user detail page |
| All `getDemoUser()` callers (~50 files) | Migrate to `locals.user` |
| `src/lib/server/demo-user.ts` | Delete after migration |

---

## What This Does NOT Change

- Existing portfolio data — untouched
- All analytics, AI, optimization features — same behaviour, just use real user instead of demo user
- DB schema for portfolio data (Transaction, Asset, etc.) — no changes
- Subscriptions/billing — Subsystem 2, separate spec

---

## Out of Scope

- OAuth (Google, GitHub) — can be added via Better Auth plugins later
- Email verification flow — Better Auth supports it, disabled for now (too much friction for early users)
- Password reset — Phase 2
- Subscription plans and billing — Subsystem 2
