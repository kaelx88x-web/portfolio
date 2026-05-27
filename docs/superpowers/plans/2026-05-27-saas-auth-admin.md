# SaaS Auth + Admin Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `getDemoUser()` throughout the app with real multi-user auth (Better Auth), auto-create a paper account on registration, add an onboarding checklist, and build an admin panel for user management.

**Architecture:** Better Auth handles sessions via `src/lib/server/auth.ts`; `hooks.server.ts` validates every request and sets `locals.user`; 138 route files are bulk-migrated from `getDemoUser()` to `locals.user!`; admin panel lives at `/admin` protected by `role === 'admin'`.

**Tech Stack:** SvelteKit, Better Auth (`better-auth`), Prisma (MySQL), Vitest, bcrypt (via Better Auth)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `prisma/schema.prisma` | Modify | Add Session, BetterAuthAccount, Verification models + User fields |
| `prisma/seed.ts` | Modify | Seed demo admin user with real bcrypt password |
| `src/lib/server/auth.ts` | Create | Better Auth config, paper account hook |
| `src/routes/api/auth/[...all]/+server.ts` | Create | Better Auth request handler |
| `src/app.d.ts` | Modify | Add `locals.user` and `locals.session` types |
| `src/hooks.server.ts` | Modify | Session validation, banned check, admin guard |
| `src/routes/+layout.server.ts` | Modify | Expose `user` to all pages via `locals.user` |
| `src/routes/+layout.svelte` | Modify | Add `<ImpersonationBanner>` |
| `src/routes/login/+page.svelte` | Modify | Real Better Auth login form |
| `src/routes/register/+page.svelte` | Modify | Real Better Auth register form |
| `src/lib/server/analytics-api.ts` | Modify | Add `userId` param, remove internal `getDemoUser()` |
| `src/lib/server/ai-context-api.ts` | Modify | Add `userId` param |
| `src/lib/server/ai-memory-api.ts` | Modify | Add `userId` param |
| `src/lib/server/prompt-builder-api.ts` | Modify | Add `userId` param |
| `src/lib/server/portfolio-metrics-api.ts` | Modify | Add `userId` param |
| `src/lib/server/risk-exposure-api.ts` | Modify | Add `userId` param |
| 131 route files | Modify | Bulk migrate `getDemoUser()` → `locals.user!` |
| `src/lib/server/demo-user.ts` | Delete | Removed after migration |
| `src/routes/dashboard/+page.server.ts` | Modify | Paper account fallback + onboarding data |
| `src/lib/components/portfolioai/OnboardingChecklist.svelte` | Create | Checklist sidebar for new users |
| `src/lib/components/portfolioai/ImpersonationBanner.svelte` | Create | Global impersonation banner |
| `src/routes/admin/+page.server.ts` | Create | Admin stats (AUM, users, banned) |
| `src/routes/admin/+page.svelte` | Create | Widget dashboard |
| `src/routes/admin/users/+page.server.ts` | Create | User list + ban/unban actions |
| `src/routes/admin/users/+page.svelte` | Create | User table |
| `src/routes/admin/users/[id]/+page.server.ts` | Create | Single user detail |
| `src/routes/admin/users/[id]/+page.svelte` | Create | User detail page |

---

## Task 1: Install Better Auth + schema migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Install Better Auth**

```
npm install better-auth
```

Expected: `better-auth` appears in `package.json` dependencies.

- [ ] **Step 2: Add new models and User fields to `prisma/schema.prisma`**

Inside the `User` model, add these fields after the existing `updatedAt DateTime @updatedAt` line (before the closing `}`):

```prisma
  role                String?
  banned              Boolean   @default(false)
  banReason           String?
  banExpires          DateTime?
  emailVerified       Boolean   @default(false)
  onboardingCompleted Boolean   @default(false)
  image               String?
  sessions            Session[]
  betterAuthAccounts  BetterAuthAccount[]
```

Then add these three new models **after** the `User` model closing brace:

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

- [ ] **Step 3: Run migration**

```
npx prisma migrate dev --name add_better_auth
```

Expected output: migration created and applied, no errors.

- [ ] **Step 4: Regenerate Prisma client**

```
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 5: Commit**

```
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add Better Auth schema — Session, BetterAuthAccount, Verification + User auth fields"
```

---

## Task 2: Create `auth.ts` + API handler + update `app.d.ts`

**Files:**
- Create: `src/lib/server/auth.ts`
- Create: `src/routes/api/auth/[...all]/+server.ts`
- Modify: `src/app.d.ts`

- [ ] **Step 1: Create `src/lib/server/auth.ts`**

```typescript
// src/lib/server/auth.ts
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin as adminPlugin } from 'better-auth/plugins';
import { prisma } from '$lib/server/db';

export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'mysql' }),
  emailAndPassword: { enabled: true },
  plugins: [adminPlugin()],
  session: {
    cookieCache: { enabled: true, maxAge: 60 * 5 }, // 5-min cache
  },
  hooks: {
    after: [
      {
        // After successful registration: create paper portfolio account
        matcher: (ctx) => ctx.path === '/sign-up/email',
        handler: async (ctx) => {
          const userId = (ctx.context as any).newSession?.user?.id;
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
          // If userId is undefined (race condition), the dashboard fallback handles it.
        },
      },
    ],
  },
});

export type AuthSession = typeof auth.$Infer.Session;
```

- [ ] **Step 2: Create `src/routes/api/auth/[...all]/+server.ts`**

First create the directory:
```
mkdir -p src/routes/api/auth
```

Then create the file:

```typescript
// src/routes/api/auth/[...all]/+server.ts
import { auth } from '$lib/server/auth';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = ({ request }) => auth.handler(request);
export const POST: RequestHandler = ({ request }) => auth.handler(request);
```

- [ ] **Step 3: Update `src/app.d.ts`**

Replace the entire file with:

```typescript
import type { User, Session } from 'better-auth';
import type { RecommendedStrategy } from '$lib/services/behavioral-profile.service';

declare global {
  namespace App {
    interface Locals {
      user: User | null;
      session: Session | null;
      recommendedStrategy?: RecommendedStrategy;
    }
  }
}

export {};
```

- [ ] **Step 4: Verify TypeScript compiles**

```
npx tsc --noEmit
```

Ignore pre-existing errors. Only fail if `auth.ts` or `app.d.ts` themselves have errors.

- [ ] **Step 5: Commit**

```
git add src/lib/server/auth.ts src/routes/api/auth/ src/app.d.ts
git commit -m "feat: add Better Auth config, API handler, and Locals types"
```

---

## Task 3: Update `hooks.server.ts`

**Files:**
- Modify: `src/hooks.server.ts`

### Background

Current `hooks.server.ts` only handles `recommendedStrategy` for `/optimization`. Replace with full auth logic: validate session, check banned, guard protected routes, guard admin routes.

Public paths that need NO auth: `/login`, `/register`, `/api/auth`.

- [ ] **Step 1: Replace `src/hooks.server.ts` entirely**

```typescript
// src/hooks.server.ts
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { getRecommendedStrategy } from '$lib/services/behavioral-profile.service';

const PUBLIC_PATHS = ['/login', '/register', '/api/auth'];

export const handle: Handle = async ({ event, resolve }) => {
  // 1. Validate session and set locals
  const session = await auth.api.getSession({ headers: event.request.headers });
  event.locals.user = session?.user ?? null;
  event.locals.session = session?.session ?? null;

  // 2. Kick banned users — revoke their session immediately
  if (event.locals.user?.banned) {
    await auth.api.revokeSession({ headers: event.request.headers }).catch(() => {});
    throw redirect(303, '/login?error=banned');
  }

  // 3. Require auth for all non-public routes
  const isPublic = PUBLIC_PATHS.some((p) => event.url.pathname.startsWith(p));
  if (!event.locals.user && !isPublic) {
    throw redirect(303, '/login');
  }

  // 4. Admin-only guard
  if (event.url.pathname.startsWith('/admin') && event.locals.user?.role !== 'admin') {
    throw redirect(303, '/dashboard');
  }

  // 5. Keep existing recommendedStrategy for /optimization routes
  if (event.request.method === 'GET' && event.url.pathname.startsWith('/optimization') && event.locals.user) {
    event.locals.recommendedStrategy = await getRecommendedStrategy(event.locals.user.id).catch(() => undefined);
  }

  return resolve(event);
};

export const handleError: HandleServerError = ({ error, event }) => {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error ? error.stack : undefined;
  console.error(`[SvelteKit 500] ${event.url.pathname} — ${message}`);
  if (stack) console.error(stack);
  return { message };
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```
git add src/hooks.server.ts
git commit -m "feat: replace hooks.server.ts with Better Auth session validation + banned check + admin guard"
```

---

## Task 4: Update `prisma/seed.ts` — admin user with real password

**Files:**
- Modify: `prisma/seed.ts`

### Background

`getDemoUser()` uses `passwordHash: 'local-demo-only'` which is not a real bcrypt hash. Better Auth stores bcrypt hashes via `BetterAuthAccount`. The seed must create the user through Better Auth's API so the password is properly hashed and a `BetterAuthAccount` row is created.

- [ ] **Step 1: Replace `prisma/seed.ts`**

```typescript
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { admin as adminPlugin } from 'better-auth/plugins';

const prisma = new PrismaClient();

const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'mysql' }),
  emailAndPassword: { enabled: true },
  plugins: [adminPlugin()],
});

async function main() {
  // Check if demo admin already exists
  const existing = await prisma.user.findUnique({
    where: { email: 'demo@portfolio-ai.local' },
  });

  if (!existing) {
    // Create user via Better Auth so password is bcrypt-hashed
    const ctx = await auth.api.signUpEmail({
      body: {
        name: 'Demo Investor',
        email: 'demo@portfolio-ai.local',
        password: 'demo123456',
      },
    });
    const userId = ctx.user?.id;
    if (userId) {
      // Promote to admin
      await prisma.user.update({
        where: { id: userId },
        data: { role: 'admin', emailVerified: true, onboardingCompleted: true },
      });
      // Create paper portfolio account
      const hasAccount = await prisma.account.findFirst({ where: { userId } });
      if (!hasAccount) {
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
      console.log('✅ Demo admin created: demo@portfolio-ai.local / demo123456');
    }
  } else {
    // Ensure existing demo user has admin role
    await prisma.user.update({
      where: { email: 'demo@portfolio-ai.local' },
      data: { role: 'admin', emailVerified: true, onboardingCompleted: true },
    });
    console.log('✅ Demo admin already exists — role updated to admin');
  }
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (error) => {
    console.error(error);
    await prisma.$disconnect();
    process.exit(1);
  });
```

- [ ] **Step 2: Run seed**

```
npx prisma db seed
```

Expected: `✅ Demo admin created` or `✅ Demo admin already exists — role updated to admin`

- [ ] **Step 3: Commit**

```
git add prisma/seed.ts
git commit -m "feat: update seed — create demo admin via Better Auth with bcrypt password"
```

---

## Task 5: Login page — real Better Auth form

**Files:**
- Modify: `src/routes/login/+page.svelte`

- [ ] **Step 1: Replace `src/routes/login/+page.svelte`**

```svelte
<script lang="ts">
  import { BarChart3, Loader2 } from 'lucide-svelte';
  import { createAuthClient } from 'better-auth/svelte';
  import { goto } from '$app/navigation';
  import { page } from '$app/stores';

  const authClient = createAuthClient();

  let email = '';
  let password = '';
  let error = '';
  let loading = false;

  // Show banned message if redirected with ?error=banned
  $: if ($page.url.searchParams.get('error') === 'banned') {
    error = 'Your account has been suspended. Contact support.';
  }

  async function handleLogin() {
    error = '';
    loading = true;
    try {
      const result = await authClient.signIn.email({ email, password });
      if (result.error) {
        error = result.error.message ?? 'Invalid email or password.';
      } else {
        await goto('/dashboard');
      }
    } catch (e) {
      error = 'Login failed. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<main class="grid min-h-screen bg-navy text-slate-100 lg:grid-cols-[0.9fr_1.1fr]">
  <section class="flex items-center justify-center px-4 py-12 sm:px-6">
    <div class="w-full max-w-md">
      <a href="/" class="mb-8 flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-300 text-slate-950">
          <BarChart3 size={20} />
        </div>
        <span class="font-bold text-white">PortfolioAI</span>
      </a>
      <h1 class="text-3xl font-bold text-white">Welcome back</h1>
      <p class="mt-2 text-sm text-slate-400">Sign in to your investing cockpit.</p>

      {#if error}
        <div class="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      {/if}

      <form class="mt-8 space-y-4" on:submit|preventDefault={handleLogin}>
        <input class="field" type="email" placeholder="Email address" bind:value={email} required />
        <input class="field" type="password" placeholder="Password" bind:value={password} required />
        <button class="button w-full" type="submit" disabled={loading}>
          {#if loading}<Loader2 size={16} class="animate-spin inline mr-2" />{/if}
          Login
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-slate-400">
        New here?
        <a href="/register" class="font-semibold text-cyan-200">Create account</a>
      </p>
    </div>
  </section>

  <section class="hidden border-l border-white/10 bg-white/[0.04] p-10 lg:flex lg:items-center">
    <div class="w-full rounded-lg border border-white/10 bg-slate-950/40 p-6 shadow-soft">
      <div class="text-sm text-slate-400">AI Confidence Score</div>
      <div class="mt-2 text-5xl font-bold text-white">91%</div>
      <p class="mt-4 max-w-md text-sm leading-6 text-slate-300">
        Your portfolio is balanced for growth, but AI recommends trimming a single-stock overweight before earnings.
      </p>
      <div class="mt-6 grid gap-3">
        {#each ['Risk score improved by 8 points', 'Dividend income forecast updated', 'Moomoo sync completed 2m ago'] as item}
          <div class="rounded-lg border border-white/10 bg-white/[0.05] p-4 text-sm font-semibold text-slate-200">
            {item}
          </div>
        {/each}
      </div>
    </div>
  </section>
</main>
```

- [ ] **Step 2: Verify dev server starts without errors**

```
npm run dev
```

Visit `http://localhost:5173/login` — form should render. No TypeScript errors in terminal.

- [ ] **Step 3: Commit**

```
git add src/routes/login/+page.svelte
git commit -m "feat: replace login placeholder with real Better Auth form"
```

---

## Task 6: Register page + root layout user exposure

**Files:**
- Modify: `src/routes/register/+page.svelte`
- Modify: `src/routes/+layout.server.ts`

- [ ] **Step 1: Replace `src/routes/register/+page.svelte`**

```svelte
<script lang="ts">
  import { ArrowRight, BarChart3, Loader2 } from 'lucide-svelte';
  import { createAuthClient } from 'better-auth/svelte';
  import { goto } from '$app/navigation';

  const authClient = createAuthClient();

  let name = '';
  let email = '';
  let password = '';
  let error = '';
  let loading = false;

  async function handleRegister() {
    error = '';
    if (password.length < 8) {
      error = 'Password must be at least 8 characters.';
      return;
    }
    loading = true;
    try {
      const result = await authClient.signUp.email({ name, email, password });
      if (result.error) {
        error = result.error.message ?? 'Registration failed.';
      } else {
        await goto('/dashboard');
      }
    } catch (e) {
      error = 'Registration failed. Please try again.';
    } finally {
      loading = false;
    }
  }
</script>

<main class="grid min-h-screen bg-navy text-slate-100 lg:grid-cols-[1fr_1fr]">
  <section class="flex items-center justify-center px-4 py-12 sm:px-6">
    <div class="w-full max-w-md">
      <a href="/" class="mb-8 flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-md bg-cyan-300 text-slate-950">
          <BarChart3 size={20} />
        </div>
        <span class="font-bold text-white">PortfolioAI</span>
      </a>
      <h1 class="text-3xl font-bold text-white">Start building your AI portfolio</h1>
      <p class="mt-3 text-sm leading-6 text-slate-400">Start with a paper account — no broker needed.</p>

      {#if error}
        <div class="mt-4 rounded-md border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {error}
        </div>
      {/if}

      <form class="mt-8 space-y-4" on:submit|preventDefault={handleRegister}>
        <input class="field" placeholder="Full name" bind:value={name} required />
        <input class="field" type="email" placeholder="Email address" bind:value={email} required />
        <input class="field" type="password" placeholder="Password (min 8 chars)" bind:value={password} required />
        <button class="button w-full" type="submit" disabled={loading}>
          {#if loading}<Loader2 size={16} class="animate-spin inline mr-2" />{/if}
          Create account <ArrowRight size={17} />
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-slate-400">
        Already have an account?
        <a href="/login" class="font-semibold text-cyan-200">Login</a>
      </p>
    </div>
  </section>

  <section class="hidden border-l border-white/10 bg-white/[0.04] p-10 lg:block">
    <div class="grid h-full content-center gap-4">
      {#each [
        ['Paper trading', 'Start tracking any portfolio immediately — no broker connection needed.'],
        ['AI analysis', 'Ask what to trim, hold, hedge, or research next.'],
        ['Income planning', 'Project dividends, tax, reinvestment, and options premiums.']
      ] as item}
        <div class="rounded-lg border border-white/10 bg-white/[0.06] p-5">
          <h2 class="font-bold text-white">{item[0]}</h2>
          <p class="mt-2 text-sm leading-6 text-slate-400">{item[1]}</p>
        </div>
      {/each}
    </div>
  </section>
</main>
```

- [ ] **Step 2: Update `src/routes/+layout.server.ts` to use `locals.user`**

Replace the entire file:

```typescript
// src/routes/+layout.server.ts
import { listAccounts } from '$lib/services/account.service';
import { getLatestSnapshot } from '$lib/services/snapshot.service';
import type { LayoutServerLoad } from './$types';
import type { SnapshotHolding } from '$lib/types/portfolio';

export const load: LayoutServerLoad = async ({ locals }) => {
  const user = locals.user;
  if (!user) {
    return { user: null, portfolioSummary: { totalValue: 0, dayPl: 0, dayChangePct: 0, accountName: 'Portfolio' } };
  }

  try {
    const [snapshot, accounts] = await Promise.all([
      getLatestSnapshot(user.id),
      listAccounts(user.id),
    ]);

    let totalValue = 0;
    let dayPl = 0;

    if (snapshot) {
      totalValue = snapshot.totalValue;
      try {
        const rows: SnapshotHolding[] = JSON.parse(snapshot.holdingsJson);
        dayPl = rows.reduce((s, h) => s + (h.todayPl ?? 0), 0);
      } catch { /* ignore */ }
    }

    const accountName = accounts[0]?.name ?? 'Portfolio';
    const yesterdayValue = totalValue - dayPl;
    const dayChangePct = yesterdayValue > 0 ? (dayPl / yesterdayValue) * 100 : 0;

    return {
      user,
      portfolioSummary: { totalValue, dayPl, dayChangePct, accountName },
    };
  } catch {
    return {
      user,
      portfolioSummary: { totalValue: 0, dayPl: 0, dayChangePct: 0, accountName: 'Portfolio' },
    };
  }
};
```

- [ ] **Step 3: Commit**

```
git add src/routes/register/+page.svelte src/routes/+layout.server.ts
git commit -m "feat: real register form + expose locals.user via root layout"
```

---

## Task 7: Migrate `src/lib/server` helper modules

**Files:**
- Modify: `src/lib/server/analytics-api.ts`
- Modify: `src/lib/server/ai-context-api.ts`
- Modify: `src/lib/server/ai-memory-api.ts`
- Modify: `src/lib/server/prompt-builder-api.ts`
- Modify: `src/lib/server/portfolio-metrics-api.ts`
- Modify: `src/lib/server/risk-exposure-api.ts`

### Background

These 6 files call `getDemoUser()` internally. Each exported function gets a new `userId: string` parameter. The `getDemoUser()` import and call are removed. Callers (API `+server.ts` routes) will be updated in Task 8 to pass `event.locals.user!.id`.

- [ ] **Step 1: Migrate `src/lib/server/analytics-api.ts`**

Read the current file first. Then apply these changes:

1. Remove: `import { getDemoUser } from '$lib/server/demo-user';`
2. Change every exported function signature to add `userId: string` as first parameter
3. Remove every `const user = await getDemoUser();` line
4. Replace every `user.id` with `userId`

The key functions to update (add `userId: string` as first param):
- `loadAnalyticsFromUrl(url: URL)` → `loadAnalyticsFromUrl(url: URL, userId: string)`
- `recalculateAnalyticsSnapshot()` → `recalculateAnalyticsSnapshot(userId: string)`

Example — `loadAnalyticsFromUrl` before and after:

```typescript
// BEFORE
export async function loadAnalyticsFromUrl(url: URL) {
  const user = await getDemoUser();
  const period = parsePeriod(url.searchParams.get('period'));
  const benchmark = parseBenchmark(url.searchParams.get('benchmark'));
  const analytics = await getAnalyticsDashboard(user.id, period, benchmark);
  return { user, analytics, period, benchmark };
}

// AFTER
export async function loadAnalyticsFromUrl(url: URL, userId: string) {
  const period = parsePeriod(url.searchParams.get('period'));
  const benchmark = parseBenchmark(url.searchParams.get('benchmark'));
  const analytics = await getAnalyticsDashboard(userId, period, benchmark);
  return { analytics, period, benchmark };
}
```

Note: `user` is removed from the return object. Callers that used `result.user` will need to use `event.locals.user` instead.

- [ ] **Step 2: Migrate `src/lib/server/ai-context-api.ts`**

Same pattern. Read the file, then:
1. Remove `getDemoUser` import
2. Add `userId: string` to each exported function
3. Replace `user.id` with `userId`

- [ ] **Step 3: Migrate `src/lib/server/ai-memory-api.ts`**

Same pattern. This file has ~8 exported functions. Add `userId: string` to each.

- [ ] **Step 4: Migrate `src/lib/server/prompt-builder-api.ts`**

Same pattern.

- [ ] **Step 5: Migrate `src/lib/server/portfolio-metrics-api.ts`**

Same pattern.

- [ ] **Step 6: Migrate `src/lib/server/risk-exposure-api.ts`**

Same pattern.

- [ ] **Step 7: Run TypeScript check — expect errors**

```
npx tsc --noEmit 2>&1 | Select-String "analytics-api|ai-context|ai-memory|prompt-builder|portfolio-metrics|risk-exposure"
```

At this point you'll see errors in the callers (API routes) because they still call these functions without the new `userId` argument. That is expected — those get fixed in Task 8.

- [ ] **Step 8: Commit**

```
git add src/lib/server/analytics-api.ts src/lib/server/ai-context-api.ts src/lib/server/ai-memory-api.ts src/lib/server/prompt-builder-api.ts src/lib/server/portfolio-metrics-api.ts src/lib/server/risk-exposure-api.ts
git commit -m "refactor: add userId param to lib/server helper modules, remove internal getDemoUser()"
```

---

## Task 8: Bulk migrate route files — replace `getDemoUser()`

**Files:**
- Modify: 131 route files in `src/routes/`

### Background

131 route files still call `getDemoUser()`. The migration pattern is:
- Remove `import { getDemoUser } from '$lib/server/demo-user';`
- Replace `const user = await getDemoUser();` with `const user = locals.user!;` (in `+page.server.ts`) or `const user = event.locals.user!;` (in `+server.ts`)
- Add `locals` to destructured parameter if missing (e.g. `async ({ url })` → `async ({ url, locals })`)
- For API routes that called the lib/server helpers: pass `locals.user!.id` as first argument

This task uses a PowerShell script for the mechanical part, then TypeScript to guide manual fixes.

- [ ] **Step 1: Run bulk find-replace script**

Run this in PowerShell from `c:\Ampps\www\portfolio`:

```powershell
# Remove getDemoUser import lines
Get-ChildItem -Path "src/routes" -Recurse -Filter "*.ts" | ForEach-Object {
  $path = $_.FullName
  $content = Get-Content $path -Raw -Encoding UTF8
  if ($content -match 'getDemoUser') {
    # Remove the import line
    $content = $content -replace "import \{ getDemoUser \} from '\`\$lib/server/demo-user';\r?\n", ""
    # Replace getDemoUser() call
    $content = $content -replace "const user = await getDemoUser\(\);", "const user = locals.user!;"
    Set-Content -Path $path -Value $content -NoNewline -Encoding UTF8
    Write-Host "Migrated: $path"
  }
}
```

This handles the most common pattern. Some files will now have `locals` used without being destructured in the function parameter — TypeScript will catch those.

- [ ] **Step 2: Fix API +server.ts files — use `event.locals`**

For `+server.ts` files, `locals` is on `event`, not destructured directly. Run:

```powershell
Get-ChildItem -Path "src/routes/api" -Recurse -Filter "+server.ts" | ForEach-Object {
  $path = $_.FullName
  $content = Get-Content $path -Raw -Encoding UTF8
  if ($content -match 'locals\.user!') {
    # In +server.ts files, locals is accessed via event parameter
    $content = $content -replace "const user = locals\.user!;", "const user = event.locals.user!;"
    Set-Content -Path $path -Value $content -NoNewline -Encoding UTF8
    Write-Host "Fixed API route: $path"
  }
}
```

- [ ] **Step 3: Fix lib/server helper callers — pass userId**

For routes that call `loadAnalyticsFromUrl(url)`, `loadAiContextFromUrl(url)`, etc., these now need `userId` as the second argument. Find them:

```powershell
Select-String -Path "src/routes/**/*.ts" -Pattern "loadAnalyticsFromUrl|loadAiContextFromUrl|loadRiskExposureFromUrl|loadPortfolioMetricsFromUrl|aiMemoryOverviewJson|generatePromptJson" -Recurse
```

For each match, update the call to pass `event.locals.user!.id` or `locals.user!.id`:

```typescript
// BEFORE (in +server.ts)
const { analytics } = await loadAnalyticsFromUrl(url);

// AFTER
const { analytics } = await loadAnalyticsFromUrl(url, event.locals.user!.id);
```

```typescript
// BEFORE (in +page.server.ts)
const data = await loadAiContextFromUrl(url);

// AFTER
const data = await loadAiContextFromUrl(url, locals.user!.id);
```

- [ ] **Step 4: Run TypeScript check to find remaining issues**

```
npx tsc --noEmit 2>&1 | head -50
```

Read the errors. Common patterns to fix:

**Error: "Cannot find name 'locals'"** → The function parameter doesn't destructure `locals`. Fix:
```typescript
// Find: async ({ url }) =>   or   async () =>   or   async ({ request }) =>
// Add locals: async ({ url, locals }) =>
```

**Error: "Expected N arguments, but got N-1"** on helper function calls → Add `locals.user!.id` or `event.locals.user!.id` as first arg.

**Error: "Property 'user' does not exist on type..."** → Caller was using `result.user` from a helper that no longer returns user. Replace with `locals.user` or `event.locals.user`.

Fix each TypeScript error until `npx tsc --noEmit` produces no errors in route files.

- [ ] **Step 5: Verify zero getDemoUser calls remain (except demo-user.ts itself)**

```powershell
Select-String -Path "src" -Pattern "getDemoUser" -Recurse | Where-Object { $_.Path -notmatch "demo-user" }
```

Expected: no output (zero matches outside demo-user.ts).

- [ ] **Step 6: Run full test suite**

```
npx vitest run
```

All existing tests must pass.

- [ ] **Step 7: Commit**

```
git add -A
git commit -m "feat: migrate all route files from getDemoUser() to locals.user — multi-tenant auth complete"
```

---

## Task 9: Delete `demo-user.ts` + paper account fallback in dashboard

**Files:**
- Delete: `src/lib/server/demo-user.ts`
- Modify: `src/routes/dashboard/+page.server.ts`

- [ ] **Step 1: Delete `src/lib/server/demo-user.ts`**

```powershell
Remove-Item "src/lib/server/demo-user.ts"
```

- [ ] **Step 2: Run TypeScript check**

```
npx tsc --noEmit
```

Expected: no errors about `demo-user`. If any remain, those files were missed in Task 8 — fix them now.

- [ ] **Step 3: Add paper account fallback in `src/routes/dashboard/+page.server.ts`**

In the `load` function, after getting `locals.user`, add this safety net before the rest of the load logic:

```typescript
// [Safety net] Ensure user always has at least one portfolio account
// (handles race conditions where the register hook didn't fire)
const existingAccounts = await listAccounts(locals.user!.id);
if (existingAccounts.length === 0) {
  await prisma.account.create({
    data: {
      userId: locals.user!.id,
      name: 'Paper Portfolio',
      brokerName: 'paper',
      accountType: 'paper',
      currency: 'USD',
    },
  });
}
```

- [ ] **Step 4: Commit**

```
git add -A
git commit -m "feat: delete demo-user.ts + add paper account fallback in dashboard load"
```

---

## Task 10: Onboarding checklist component

**Files:**
- Create: `src/lib/components/portfolioai/OnboardingChecklist.svelte`
- Modify: `src/routes/dashboard/+page.server.ts`
- Modify: `src/routes/dashboard/+page.svelte`

### Background

The checklist is shown when `user.onboardingCompleted === false`. It has 5 items computed from portfolio state. A "Dismiss" form action sets `onboardingCompleted = true`.

- [ ] **Step 1: Write a unit test for the checklist logic**

Create `src/lib/components/portfolioai/OnboardingChecklist.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

// Pure function extracted from the component
function computeChecklist(params: {
  hasHoldings: boolean;
  hasCash: boolean;
  hasBroker: boolean;
  onboardingCompleted: boolean;
}) {
  return [
    { id: 'account', label: 'Create account', done: true },
    { id: 'stock', label: 'Add first stock', done: params.hasHoldings },
    { id: 'cash', label: 'Set cash balance', done: params.hasCash },
    { id: 'broker', label: 'Connect broker (optional)', done: params.hasBroker, optional: true },
    { id: 'explore', label: 'Explore dashboard', done: params.onboardingCompleted },
  ];
}

describe('computeChecklist', () => {
  it('first item is always done', () => {
    const items = computeChecklist({ hasHoldings: false, hasCash: false, hasBroker: false, onboardingCompleted: false });
    expect(items[0].done).toBe(true);
  });

  it('stock item done when holdings exist', () => {
    const items = computeChecklist({ hasHoldings: true, hasCash: false, hasBroker: false, onboardingCompleted: false });
    expect(items[1].done).toBe(true);
  });

  it('broker item optional', () => {
    const items = computeChecklist({ hasHoldings: false, hasCash: false, hasBroker: false, onboardingCompleted: false });
    expect(items[3].optional).toBe(true);
  });

  it('all done when all params true', () => {
    const items = computeChecklist({ hasHoldings: true, hasCash: true, hasBroker: true, onboardingCompleted: true });
    expect(items.every(i => i.done)).toBe(true);
  });
});
```

- [ ] **Step 2: Run test — confirm it passes**

```
npx vitest run src/lib/components/portfolioai/OnboardingChecklist.test.ts
```

Expected: 4 tests pass.

- [ ] **Step 3: Create `src/lib/components/portfolioai/OnboardingChecklist.svelte`**

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import { CheckCircle2, Circle } from 'lucide-svelte';

  export let hasHoldings: boolean = false;
  export let hasCash: boolean = false;
  export let hasBroker: boolean = false;
  export let onboardingCompleted: boolean = false;

  $: items = [
    { id: 'account', label: 'Create account', done: true },
    { id: 'stock', label: 'Add first stock', done: hasHoldings },
    { id: 'cash', label: 'Set cash balance', done: hasCash },
    { id: 'broker', label: 'Connect broker', done: hasBroker, optional: true },
    { id: 'explore', label: 'Explore dashboard', done: onboardingCompleted },
  ];

  $: doneCount = items.filter(i => i.done).length;
  $: allDone = doneCount === items.length;
</script>

{#if !allDone}
<div class="rounded-xl border border-[rgba(var(--success-rgb),0.2)] bg-[#0f1a12] p-4">
  <div class="mb-3 flex items-center justify-between">
    <span class="text-xs font-semibold uppercase tracking-wide" style="color:var(--success)">
      Getting Started — {doneCount}/{items.length}
    </span>
    <form method="POST" action="?/dismissOnboarding" use:enhance>
      <button type="submit" class="text-xs" style="color:var(--muted)">Dismiss</button>
    </form>
  </div>

  <div class="space-y-2">
    {#each items as item}
      <div class="flex items-center gap-2 text-sm">
        {#if item.done}
          <CheckCircle2 size={15} style="color:var(--success);flex-shrink:0" />
          <span style="color:var(--muted);text-decoration:line-through">{item.label}</span>
        {:else}
          <Circle size={15} style="color:var(--muted);flex-shrink:0" />
          <span style="color:var(--text)">{item.label}</span>
          {#if item.optional}
            <span class="text-xs" style="color:var(--muted)">(optional)</span>
          {/if}
        {/if}
      </div>
    {/each}
  </div>

  <div class="mt-3 h-1 rounded-full" style="background:var(--border)">
    <div
      class="h-1 rounded-full transition-all"
      style="background:var(--success);width:{(doneCount/items.length)*100}%"
    ></div>
  </div>
</div>
{/if}
```

- [ ] **Step 4: Update `src/routes/dashboard/+page.server.ts`**

In the `load` function, add onboarding data to the return value. Find the section that loads `snapshotRows` and `accounts`, and add:

```typescript
// Onboarding checklist data
const hasHoldings = snapshotRows.filter(h => !isOptionSymbol(h.symbol)).length > 0;
const hasCash = (snapshot?.cashBalance ?? 0) > 0;
const hasBroker = accounts.some(a => a.brokerName !== 'paper');
```

Add to the return object:
```typescript
onboarding: {
  show: !user.onboardingCompleted,
  hasHoldings,
  hasCash,
  hasBroker,
  onboardingCompleted: user.onboardingCompleted,
},
```

Also add the `dismissOnboarding` form action:

```typescript
dismissOnboarding: async ({ locals }) => {
  await prisma.user.update({
    where: { id: locals.user!.id },
    data: { onboardingCompleted: true },
  });
  return { dismissed: true };
},
```

- [ ] **Step 5: Add `<OnboardingChecklist>` to `src/routes/dashboard/+page.svelte`**

Import the component:
```svelte
import OnboardingChecklist from '$lib/components/portfolioai/OnboardingChecklist.svelte';
```

Add it before the stat cards section (after the DailyBriefingCard):
```svelte
{#if data.onboarding?.show}
  <OnboardingChecklist
    hasHoldings={data.onboarding.hasHoldings}
    hasCash={data.onboarding.hasCash}
    hasBroker={data.onboarding.hasBroker}
    onboardingCompleted={data.onboarding.onboardingCompleted}
  />
{/if}
```

- [ ] **Step 6: Run tests**

```
npx vitest run
```

All tests pass.

- [ ] **Step 7: Commit**

```
git add src/lib/components/portfolioai/OnboardingChecklist.svelte src/lib/components/portfolioai/OnboardingChecklist.test.ts src/routes/dashboard/+page.server.ts src/routes/dashboard/+page.svelte
git commit -m "feat: onboarding checklist sidebar — 5-step guide for new users"
```

---

## Task 11: ImpersonationBanner component

**Files:**
- Create: `src/lib/components/portfolioai/ImpersonationBanner.svelte`
- Modify: `src/routes/+layout.svelte`

- [ ] **Step 1: Create `src/lib/components/portfolioai/ImpersonationBanner.svelte`**

```svelte
<script lang="ts">
  import { AlertTriangle } from 'lucide-svelte';

  // Better Auth sets impersonatedBy on the session object when admin impersonates
  export let impersonatedBy: string | null = null;
  export let impersonatedEmail: string = '';
</script>

{#if impersonatedBy}
  <div
    style="
      position:fixed;top:0;left:0;right:0;z-index:9999;
      background:#7c1d1d;border-bottom:1px solid #f85149;
      padding:8px 16px;display:flex;align-items:center;justify-content:space-between;
      font-size:13px;color:#fff;
    "
  >
    <span style="display:flex;align-items:center;gap:8px">
      <AlertTriangle size={15} />
      Viewing as <strong>{impersonatedEmail}</strong> — you are in impersonation mode
    </span>
    <form method="POST" action="/api/auth/admin/stop-impersonating">
      <button
        type="submit"
        style="background:#f85149;border:none;color:#fff;padding:4px 12px;border-radius:4px;cursor:pointer;font-size:12px"
      >
        Stop &amp; Return to Admin
      </button>
    </form>
  </div>
  <!-- Push content down so banner doesn't overlap -->
  <div style="height:41px"></div>
{/if}
```

- [ ] **Step 2: Add to `src/routes/+layout.svelte`**

Read the current `src/routes/+layout.svelte`. Add the import near the top of the `<script>` block:

```svelte
import ImpersonationBanner from '$lib/components/portfolioai/ImpersonationBanner.svelte';
```

Add the component at the very top of the template (before `<AppShell>` or whatever the root element is):

```svelte
<ImpersonationBanner
  impersonatedBy={data.session?.impersonatedBy ?? null}
  impersonatedEmail={data.user?.email ?? ''}
/>
```

Note: `data.session` needs to be passed from layout.server.ts. Add `session: locals.session` to the layout load return:

In `src/routes/+layout.server.ts`, add `session: locals.session` to the return object.

- [ ] **Step 3: Commit**

```
git add src/lib/components/portfolioai/ImpersonationBanner.svelte src/routes/+layout.svelte src/routes/+layout.server.ts
git commit -m "feat: ImpersonationBanner — global banner when admin impersonates a user"
```

---

## Task 12: Admin panel — widget dashboard + user table

**Files:**
- Create: `src/routes/admin/+page.server.ts`
- Create: `src/routes/admin/+page.svelte`
- Create: `src/routes/admin/users/+page.server.ts`
- Create: `src/routes/admin/users/+page.svelte`
- Create: `src/routes/admin/users/[id]/+page.server.ts`
- Create: `src/routes/admin/users/[id]/+page.svelte`

- [ ] **Step 1: Create `src/routes/admin/+page.server.ts`**

```typescript
// src/routes/admin/+page.server.ts
import { prisma } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

  const [totalUsers, activeUsers, bannedUsers, totalAccounts] = await Promise.all([
    prisma.user.count(),
    prisma.session.count({ where: { updatedAt: { gte: sevenDaysAgo } } }),
    prisma.user.count({ where: { banned: true } }),
    prisma.account.count(),
  ]);

  // [Fix #4] AUM via single raw SQL — avoids N+1/RAM spike
  const aumResult = await prisma.$queryRaw<[{ totalAum: number }]>`
    SELECT COALESCE(SUM(ps.totalValue), 0) AS totalAum
    FROM PortfolioSnapshot ps
    INNER JOIN (
      SELECT userId, MAX(createdAt) AS maxCreatedAt
      FROM PortfolioSnapshot
      GROUP BY userId
    ) latest ON ps.userId = latest.userId AND ps.createdAt = latest.maxCreatedAt
  `;
  const totalAum = Number(aumResult[0]?.totalAum ?? 0);

  // Bridge health check (fire-and-forget, don't block)
  let bridgeOnline = false;
  try {
    const res = await fetch('http://localhost:8888/health', { signal: AbortSignal.timeout(2000) });
    bridgeOnline = res.ok;
  } catch { /* offline */ }

  return { totalUsers, activeUsers, bannedUsers, totalAccounts, totalAum, bridgeOnline };
};
```

- [ ] **Step 2: Create `src/routes/admin/+page.svelte`**

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  function fmtCurrency(v: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
  }
</script>

<svelte:head><title>Admin Panel</title></svelte:head>

<div class="p-6 max-w-5xl mx-auto">
  <h1 class="text-2xl font-bold mb-1" style="color:var(--text)">Admin Panel</h1>
  <p class="text-sm mb-6" style="color:var(--muted)">Platform overview and user management</p>

  <div class="grid grid-cols-2 gap-4 md:grid-cols-4 mb-8">
    <!-- Total users -->
    <div class="rounded-xl border p-4" style="border-color:var(--border);background:var(--surface)">
      <div class="text-xs uppercase tracking-wide mb-1" style="color:var(--muted)">Total Users</div>
      <div class="text-3xl font-bold" style="color:var(--text)">{data.totalUsers}</div>
      <div class="text-xs mt-1" style="color:var(--muted)">{data.activeUsers} active (7d)</div>
    </div>
    <!-- Banned -->
    <div class="rounded-xl border p-4" style="border-color:var(--border);background:var(--surface)">
      <div class="text-xs uppercase tracking-wide mb-1" style="color:var(--muted)">Banned</div>
      <div class="text-3xl font-bold" style="color:{data.bannedUsers > 0 ? 'var(--danger)' : 'var(--text)'}">{data.bannedUsers}</div>
      <a href="/admin/users?filter=banned" class="text-xs mt-1" style="color:var(--primary)">Review →</a>
    </div>
    <!-- AUM -->
    <div class="rounded-xl border p-4" style="border-color:var(--border);background:var(--surface)">
      <div class="text-xs uppercase tracking-wide mb-1" style="color:var(--muted)">Total AUM</div>
      <div class="text-2xl font-bold" style="color:var(--text)">{fmtCurrency(data.totalAum)}</div>
      <div class="text-xs mt-1" style="color:var(--muted)">{data.totalAccounts} accounts</div>
    </div>
    <!-- System -->
    <div class="rounded-xl border p-4" style="border-color:var(--border);background:var(--surface)">
      <div class="text-xs uppercase tracking-wide mb-1" style="color:var(--muted)">System</div>
      <div class="text-sm font-semibold" style="color:var(--text)">DB: healthy ✓</div>
      <div class="text-sm" style="color:{data.bridgeOnline ? 'var(--success)' : 'var(--danger)'}">
        Bridge: {data.bridgeOnline ? 'online ✓' : 'offline ✗'}
      </div>
    </div>
  </div>

  <div class="flex gap-4">
    <a href="/admin/users" class="button">Manage Users →</a>
  </div>
</div>
```

- [ ] **Step 3: Create `src/routes/admin/users/+page.server.ts`**

```typescript
// src/routes/admin/users/+page.server.ts
import { prisma } from '$lib/server/db';
import { auth } from '$lib/server/auth';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const filter = url.searchParams.get('filter');
  const search = url.searchParams.get('search') ?? '';

  const where: any = {};
  if (filter === 'banned') where.banned = true;
  if (search) {
    where.OR = [
      { email: { contains: search } },
      { name: { contains: search } },
    ];
  }

  const users = await prisma.user.findMany({
    where,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      banned: true,
      banReason: true,
      createdAt: true,
      updatedAt: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  return { users, filter, search };
};

export const actions: Actions = {
  ban: async ({ request, locals }) => {
    const data = await request.formData();
    const userId = data.get('userId') as string;
    const reason = (data.get('reason') as string) || 'Banned by admin';
    await prisma.user.update({ where: { id: userId }, data: { banned: true, banReason: reason } });
    // Revoke all sessions for that user
    await prisma.session.deleteMany({ where: { userId } });
    return { success: true };
  },

  unban: async ({ request }) => {
    const data = await request.formData();
    const userId = data.get('userId') as string;
    await prisma.user.update({ where: { id: userId }, data: { banned: false, banReason: null } });
    return { success: true };
  },
};
```

- [ ] **Step 4: Create `src/routes/admin/users/+page.svelte`**

```svelte
<script lang="ts">
  import { enhance } from '$app/forms';
  import type { PageData } from './$types';
  export let data: PageData;

  let search = data.search ?? '';
  let banReason = '';
  let banTargetId = '';

  function formatDate(d: Date | string) {
    return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
</script>

<svelte:head><title>Users — Admin</title></svelte:head>

<div class="p-6 max-w-5xl mx-auto">
  <div class="flex items-center gap-4 mb-6">
    <a href="/admin" class="text-sm" style="color:var(--muted)">← Admin</a>
    <h1 class="text-2xl font-bold" style="color:var(--text)">Users</h1>
  </div>

  <!-- Search -->
  <form method="GET" class="mb-4">
    <input
      name="search"
      class="field w-64"
      placeholder="Search email or name..."
      value={search}
    />
    <button class="button ml-2" type="submit">Search</button>
    {#if data.filter === 'banned'}
      <a href="/admin/users" class="ml-3 text-sm" style="color:var(--primary)">Clear filter</a>
    {/if}
  </form>

  <!-- User table -->
  <div class="rounded-xl border overflow-hidden" style="border-color:var(--border)">
    <table class="w-full text-sm">
      <thead style="background:var(--surface-alt)">
        <tr>
          <th class="text-left p-3" style="color:var(--muted)">Name</th>
          <th class="text-left p-3" style="color:var(--muted)">Email</th>
          <th class="text-left p-3" style="color:var(--muted)">Joined</th>
          <th class="text-left p-3" style="color:var(--muted)">Status</th>
          <th class="text-left p-3" style="color:var(--muted)">Actions</th>
        </tr>
      </thead>
      <tbody>
        {#each data.users as user}
          <tr class="border-t" style="border-color:var(--border)">
            <td class="p-3" style="color:var(--text)">{user.name}</td>
            <td class="p-3" style="color:var(--muted)">{user.email}</td>
            <td class="p-3" style="color:var(--muted)">{formatDate(user.createdAt)}</td>
            <td class="p-3">
              {#if user.banned}
                <span class="px-2 py-0.5 rounded text-xs" style="background:var(--danger-bg);color:var(--danger)">Banned</span>
              {:else if user.role === 'admin'}
                <span class="px-2 py-0.5 rounded text-xs" style="background:var(--primary-bg);color:var(--primary)">Admin</span>
              {:else}
                <span class="px-2 py-0.5 rounded text-xs" style="background:var(--surface-alt);color:var(--success)">Active</span>
              {/if}
            </td>
            <td class="p-3">
              <div class="flex gap-2">
                <a href="/admin/users/{user.id}" class="text-xs" style="color:var(--primary)">View</a>
                {#if user.banned}
                  <form method="POST" action="?/unban" use:enhance>
                    <input type="hidden" name="userId" value={user.id} />
                    <button type="submit" class="text-xs" style="color:var(--success)">Unban</button>
                  </form>
                {:else if user.role !== 'admin'}
                  <form method="POST" action="?/ban" use:enhance>
                    <input type="hidden" name="userId" value={user.id} />
                    <input type="hidden" name="reason" value="Banned by admin" />
                    <button type="submit" class="text-xs" style="color:var(--danger)">Ban</button>
                  </form>
                {/if}
              </div>
            </td>
          </tr>
        {/each}
      </tbody>
    </table>
    {#if data.users.length === 0}
      <p class="p-6 text-center text-sm" style="color:var(--muted)">No users found.</p>
    {/if}
  </div>
</div>
```

- [ ] **Step 5: Create `src/routes/admin/users/[id]/+page.server.ts`**

```typescript
// src/routes/admin/users/[id]/+page.server.ts
import { prisma } from '$lib/server/db';
import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const user = await prisma.user.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      banned: true,
      banReason: true,
      emailVerified: true,
      onboardingCompleted: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!user) throw error(404, 'User not found');

  const [accounts, latestSnapshot] = await Promise.all([
    prisma.account.findMany({ where: { userId: params.id } }),
    prisma.portfolioSnapshot.findFirst({
      where: { userId: params.id },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return { targetUser: user, accounts, latestSnapshot };
};
```

- [ ] **Step 6: Create `src/routes/admin/users/[id]/+page.svelte`**

```svelte
<script lang="ts">
  import type { PageData } from './$types';
  export let data: PageData;

  function fmtDate(d: Date | string) {
    return new Date(d).toLocaleDateString('en-US', { dateStyle: 'medium' });
  }

  function fmtCurrency(v: number) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
  }
</script>

<svelte:head><title>{data.targetUser.name} — Admin</title></svelte:head>

<div class="p-6 max-w-3xl mx-auto">
  <div class="flex items-center gap-4 mb-6">
    <a href="/admin/users" class="text-sm" style="color:var(--muted)">← Users</a>
    <h1 class="text-2xl font-bold" style="color:var(--text)">{data.targetUser.name}</h1>
    {#if data.targetUser.banned}
      <span class="px-2 py-0.5 rounded text-xs" style="background:var(--danger-bg);color:var(--danger)">Banned</span>
    {/if}
  </div>

  <div class="rounded-xl border p-5 mb-4" style="border-color:var(--border);background:var(--surface)">
    <h2 class="font-semibold mb-3" style="color:var(--text)">Account Info</h2>
    <dl class="grid grid-cols-2 gap-y-2 text-sm">
      <dt style="color:var(--muted)">Email</dt><dd style="color:var(--text)">{data.targetUser.email}</dd>
      <dt style="color:var(--muted)">Role</dt><dd style="color:var(--text)">{data.targetUser.role ?? 'user'}</dd>
      <dt style="color:var(--muted)">Joined</dt><dd style="color:var(--text)">{fmtDate(data.targetUser.createdAt)}</dd>
      <dt style="color:var(--muted)">Onboarding</dt><dd style="color:var(--text)">{data.targetUser.onboardingCompleted ? 'Complete' : 'In progress'}</dd>
      {#if data.targetUser.banReason}
        <dt style="color:var(--muted)">Ban reason</dt><dd style="color:var(--danger)">{data.targetUser.banReason}</dd>
      {/if}
    </dl>
  </div>

  <div class="rounded-xl border p-5 mb-4" style="border-color:var(--border);background:var(--surface)">
    <h2 class="font-semibold mb-3" style="color:var(--text)">Portfolio</h2>
    {#if data.latestSnapshot}
      <p class="text-sm" style="color:var(--text)">
        Latest value: <strong>{fmtCurrency(data.latestSnapshot.totalValue)}</strong>
        (as of {fmtDate(data.latestSnapshot.createdAt)})
      </p>
    {:else}
      <p class="text-sm" style="color:var(--muted)">No snapshot yet.</p>
    {/if}
    <p class="text-sm mt-2" style="color:var(--muted)">{data.accounts.length} account(s)</p>
  </div>
</div>
```

- [ ] **Step 7: Run full test suite**

```
npx vitest run
```

All tests pass.

- [ ] **Step 8: Commit**

```
git add src/routes/admin/
git commit -m "feat: admin panel — widget dashboard, user table with ban/unban, user detail page"
```

---

## Task 13: Final verification + push

- [ ] **Step 1: Run TypeScript check — zero errors in own files**

```
npx tsc --noEmit 2>&1 | Select-Object -First 30
```

Fix any remaining errors.

- [ ] **Step 2: Run full test suite**

```
npx vitest run
```

All pass.

- [ ] **Step 3: Manual smoke test**

1. `npm run dev`
2. Visit `http://localhost:5173/login` — form renders, no console errors
3. Visit `http://localhost:5173/register` — form renders
4. Run `npx prisma db seed` — admin user created
5. Login as `demo@portfolio-ai.local` / `demo123456`
6. Dashboard loads, onboarding checklist visible (if `onboardingCompleted = false`)
7. Visit `/admin` — widget dashboard with user counts
8. Visit `/admin/users` — user table
9. Try banning a non-admin user, verify they're redirected on next request

- [ ] **Step 4: Final commit + push**

```
git add -A
git commit -m "feat: SaaS auth + admin panel complete — Better Auth, paper accounts, onboarding, admin panel"
git push origin master
```
