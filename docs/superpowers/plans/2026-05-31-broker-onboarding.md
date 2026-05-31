# Broker Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Force broker connection as a mandatory onboarding step before any protected route is accessible; remove all internal paper account auto-creation.

**Architecture:** Extract gate logic into a testable helper (`broker-gate.ts`), wire it into `hooks.server.ts`, add two health-check API routes, build a 3-step onboarding wizard at `/onboarding/connect-broker`, then remove paper account auto-creation from `auth.ts` and `dashboard/+page.server.ts`.

**Tech Stack:** SvelteKit, Prisma (MySQL), Vitest, Lucide Svelte, Better Auth, existing Moomoo bridge at `MOOMOO_SERVICE_URL` (default `http://127.0.0.1:8001`).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/lib/server/broker-gate.ts` | Create | Pure functions for gate path logic — testable without SvelteKit |
| `src/lib/server/broker-gate.test.ts` | Create | Unit tests for gate helper |
| `src/hooks.server.ts` | Modify | Wire broker gate after auth check |
| `src/routes/api/broker/health/service/+server.ts` | Create | Proxy health check to moomoo-service |
| `src/routes/api/broker/health/opend/+server.ts` | Create | Proxy OpenD status check via moomoo-service |
| `src/routes/onboarding/connect-broker/+page.server.ts` | Create | Load guard — redirect if already connected, pass isReconnect flag |
| `src/routes/onboarding/connect-broker/+page.svelte` | Create | 3-step wizard: choose broker → connection check → select account |
| `src/lib/server/auth.ts` | Modify | Remove `databaseHooks.user.create.after` paper account block |
| `src/routes/dashboard/+page.server.ts` | Modify | Remove `existingAccounts.length === 0` paper account safety net |
| `src/lib/components/portfolioai/Topbar.svelte` | Modify | Replace "Paper Trading" link with "Manage Broker Connection" |

---

## Task 1: Broker gate helper + tests

**Files:**
- Create: `src/lib/server/broker-gate.ts`
- Create: `src/lib/server/broker-gate.test.ts`

- [ ] **Step 1.1: Write the failing tests**

```typescript
// src/lib/server/broker-gate.test.ts
import { describe, it, expect } from 'vitest';
import { requiresBrokerGate, BROKER_ONBOARDING_PATHS } from './broker-gate';

const PUBLIC = ['/login', '/register', '/api/auth'];

describe('requiresBrokerGate', () => {
  it('returns false for public paths', () => {
    expect(requiresBrokerGate('/login', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(false);
    expect(requiresBrokerGate('/register', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(false);
    expect(requiresBrokerGate('/api/auth/session', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(false);
  });

  it('returns false for broker onboarding paths', () => {
    expect(requiresBrokerGate('/onboarding/connect-broker', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(false);
    expect(requiresBrokerGate('/onboarding', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(false);
    expect(requiresBrokerGate('/api/broker/health/service', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(false);
    expect(requiresBrokerGate('/api/broker/health/opend', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(false);
    expect(requiresBrokerGate('/api/broker/accounts', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(false);
    expect(requiresBrokerGate('/api/broker/accounts/select', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(false);
  });

  it('returns true for protected routes', () => {
    expect(requiresBrokerGate('/dashboard', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(true);
    expect(requiresBrokerGate('/paper-trading', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(true);
    expect(requiresBrokerGate('/analytics', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(true);
    expect(requiresBrokerGate('/holdings', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(true);
    expect(requiresBrokerGate('/api/ai/copilot', PUBLIC, BROKER_ONBOARDING_PATHS)).toBe(true);
  });
});
```

- [ ] **Step 1.2: Run tests to confirm they fail**

```bash
npx vitest run src/lib/server/broker-gate.test.ts
```

Expected: `Error: Failed to resolve import "./broker-gate"`

- [ ] **Step 1.3: Implement the helper**

```typescript
// src/lib/server/broker-gate.ts

export const BROKER_ONBOARDING_PATHS = [
  '/onboarding',
  '/api/broker/health',
  '/api/broker/accounts',
];

/**
 * Returns true if the request requires a connected broker to proceed.
 * Exempt: public auth paths and all broker-onboarding API paths so the
 * wizard can call health checks and account selection before setup is done.
 */
export function requiresBrokerGate(
  pathname: string,
  publicPaths: string[],
  onboardingPaths: string[],
): boolean {
  if (publicPaths.some((p) => pathname.startsWith(p))) return false;
  if (onboardingPaths.some((p) => pathname.startsWith(p))) return false;
  return true;
}
```

- [ ] **Step 1.4: Run tests to confirm they pass**

```bash
npx vitest run src/lib/server/broker-gate.test.ts
```

Expected: `Tests 3 passed (3)`

- [ ] **Step 1.5: Commit**

```bash
git add src/lib/server/broker-gate.ts src/lib/server/broker-gate.test.ts
git commit -m "feat(onboarding): add broker gate helper with path exemptions"
```

---

## Task 2: Wire gate into hooks.server.ts

**Files:**
- Modify: `src/hooks.server.ts`

- [ ] **Step 2.1: Add import and gate block**

Replace the existing `src/hooks.server.ts` content with:

```typescript
// src/hooks.server.ts
import type { Handle, HandleServerError } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';
import { auth } from '$lib/server/auth';
import { prisma } from '$lib/server/db';
import { getRecommendedStrategy } from '$lib/services/behavioral-profile.service';
import { requiresBrokerGate, BROKER_ONBOARDING_PATHS } from '$lib/server/broker-gate';

const PUBLIC_PATHS = ['/login', '/register', '/api/auth'];

export const handle: Handle = async ({ event, resolve }) => {
  // 1. Validate session and set locals
  const session = await auth.api.getSession({ headers: event.request.headers });
  event.locals.user = session?.user ?? null;
  event.locals.session = session?.session ?? null;

  // 2. Kick banned users
  if (event.locals.user?.banned) {
    await prisma.session.deleteMany({ where: { userId: event.locals.user.id } }).catch(() => {});
    throw redirect(303, '/login?error=banned');
  }

  // 3. Require auth for all non-public routes
  const isPublic = PUBLIC_PATHS.some((p) => event.url.pathname.startsWith(p));
  if (!event.locals.user && !isPublic) {
    throw redirect(303, '/login');
  }

  // 4. Require broker connection for all protected routes
  if (event.locals.user && requiresBrokerGate(event.url.pathname, PUBLIC_PATHS, BROKER_ONBOARDING_PATHS)) {
    const dbUser = await prisma.user.findUnique({
      where: { id: event.locals.user.id },
      select: { activeBrokerAccId: true },
    });
    if (!dbUser?.activeBrokerAccId) {
      throw redirect(303, '/onboarding/connect-broker');
    }
  }

  // 5. Admin-only guard
  if (event.url.pathname.startsWith('/admin') && event.locals.user?.role !== 'admin') {
    throw redirect(303, '/dashboard');
  }

  // 6. Keep existing recommendedStrategy for /optimization routes
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

- [ ] **Step 2.2: Commit**

```bash
git add src/hooks.server.ts
git commit -m "feat(onboarding): add broker gate to hooks.server.ts"
```

---

## Task 3: Health check API endpoints

**Files:**
- Create: `src/routes/api/broker/health/service/+server.ts`
- Create: `src/routes/api/broker/health/opend/+server.ts`

- [ ] **Step 3.1: Create moomoo-service health endpoint**

```typescript
// src/routes/api/broker/health/service/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const BRIDGE = process.env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';

export const GET: RequestHandler = async () => {
  try {
    const res = await fetch(`${BRIDGE}/health`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      return json({ ok: false, error: `moomoo-service returned ${res.status}` }, { status: 503 });
    }
    return json({ ok: true });
  } catch {
    return json(
      { ok: false, error: 'moomoo-service is not running on port 8001' },
      { status: 503 },
    );
  }
};
```

- [ ] **Step 3.2: Create OpenD health endpoint**

```typescript
// src/routes/api/broker/health/opend/+server.ts
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const BRIDGE = process.env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';

export const GET: RequestHandler = async () => {
  try {
    const res = await fetch(`${BRIDGE}/health/opend`, {
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { detail?: string };
      return json(
        { ok: false, error: body.detail ?? 'OpenD is not connected' },
        { status: 503 },
      );
    }
    return json({ ok: true });
  } catch {
    return json(
      { ok: false, error: 'moomoo-service is not running — cannot check OpenD' },
      { status: 503 },
    );
  }
};
```

- [ ] **Step 3.3: Verify endpoints are reachable (manual smoke test)**

With moomoo-service running:
```bash
curl http://127.0.0.1:5173/api/broker/health/service
# Expected: {"ok":true}

curl http://127.0.0.1:5173/api/broker/health/opend
# Expected: {"ok":true} or {"ok":false,"error":"..."}
```

With moomoo-service stopped, both should return `{"ok":false,"error":"..."}` with status 503.

- [ ] **Step 3.4: Commit**

```bash
git add src/routes/api/broker/health/
git commit -m "feat(onboarding): add broker health check API endpoints"
```

---

## Task 4: Onboarding page server (load guard)

**Files:**
- Create: `src/routes/onboarding/connect-broker/+page.server.ts`

- [ ] **Step 4.1: Create the load guard**

```typescript
// src/routes/onboarding/connect-broker/+page.server.ts
import { redirect } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
  const isReconnect = url.searchParams.get('reconnect') === '1';

  // If already connected and not a reconnect flow, go straight to dashboard
  if (!isReconnect) {
    const dbUser = await prisma.user.findUnique({
      where: { id: locals.user!.id },
      select: { activeBrokerAccId: true },
    });
    if (dbUser?.activeBrokerAccId) {
      throw redirect(303, '/dashboard');
    }
  }

  return { isReconnect };
};
```

- [ ] **Step 4.2: Commit**

```bash
git add src/routes/onboarding/connect-broker/+page.server.ts
git commit -m "feat(onboarding): add onboarding page server load guard"
```

---

## Task 5: Onboarding wizard UI

**Files:**
- Create: `src/routes/onboarding/connect-broker/+page.svelte`

- [ ] **Step 5.1: Create the wizard page**

```svelte
<!-- src/routes/onboarding/connect-broker/+page.svelte -->
<script lang="ts">
  import { goto } from '$app/navigation';
  import { CheckCircle2, XCircle, Loader2, FlaskConical, Wifi, MonitorCheck, Terminal } from 'lucide-svelte';
  import type { PageData } from './$types';

  export let data: PageData;

  type Step = 1 | 2 | 3;
  let step: Step = data.isReconnect ? 2 : 1;

  type CheckStatus = 'idle' | 'checking' | 'ok' | 'error';
  interface Check { label: string; status: CheckStatus; error: string; }

  let checks: Check[] = [
    { label: 'moomoo-service running', status: 'idle', error: '' },
    { label: 'OpenD connected', status: 'idle', error: '' },
    { label: 'Fetching accounts', status: 'idle', error: '' },
  ];

  type BrokerAccount = { acc_id: string; trd_env: 'REAL' | 'SIMULATE'; is_real: boolean; name: string };
  let accounts: BrokerAccount[] = [];
  let showDevDetails = false;

  let selectedAccId = '';
  let submitting = false;
  let submitError = '';

  function resetChecks() {
    checks = checks.map(c => ({ ...c, status: 'idle' as CheckStatus, error: '' }));
    accounts = [];
    showDevDetails = false;
    submitError = '';
  }

  async function runChecks() {
    resetChecks();

    // Check 1: moomoo-service
    checks[0] = { ...checks[0], status: 'checking' };
    try {
      const r = await fetch('/api/broker/health/service');
      const d = await r.json() as { ok: boolean; error?: string };
      if (!r.ok || !d.ok) {
        checks[0] = { ...checks[0], status: 'error', error: d.error ?? 'Service unreachable' };
        return;
      }
      checks[0] = { ...checks[0], status: 'ok' };
    } catch {
      checks[0] = { ...checks[0], status: 'error', error: 'moomoo-service not running on port 8001' };
      return;
    }

    // Check 2: OpenD
    checks[1] = { ...checks[1], status: 'checking' };
    try {
      const r = await fetch('/api/broker/health/opend');
      const d = await r.json() as { ok: boolean; error?: string };
      if (!r.ok || !d.ok) {
        checks[1] = { ...checks[1], status: 'error', error: d.error ?? 'OpenD not connected' };
        return;
      }
      checks[1] = { ...checks[1], status: 'ok' };
    } catch {
      checks[1] = { ...checks[1], status: 'error', error: 'Cannot reach OpenD — bridge offline' };
      return;
    }

    // Check 3: accounts
    checks[2] = { ...checks[2], status: 'checking' };
    try {
      const r = await fetch('/api/broker/accounts');
      const d = await r.json() as BrokerAccount[] | { error: string };
      if (!r.ok || 'error' in d) {
        checks[2] = { ...checks[2], status: 'error', error: ('error' in d ? d.error : null) ?? 'Failed to load accounts' };
        return;
      }
      accounts = d;
      if (accounts.length === 0) {
        checks[2] = { ...checks[2], status: 'error', error: 'No accounts found — check OpenD login' };
        return;
      }
      checks[2] = { ...checks[2], status: 'ok' };
      setTimeout(() => { step = 3; }, 500);
    } catch {
      checks[2] = { ...checks[2], status: 'error', error: 'Failed to fetch accounts' };
    }
  }

  async function selectAccount() {
    if (!selectedAccId || submitting) return;
    submitting = true;
    submitError = '';
    const acc = accounts.find(a => a.acc_id === selectedAccId)!;
    try {
      const res = await fetch('/api/broker/accounts/select', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acc_id: acc.acc_id, trd_env: acc.trd_env, name: acc.name }),
      });
      if (!res.ok) { submitError = 'Failed to save account — try again.'; return; }
      goto('/dashboard');
    } catch {
      submitError = 'Network error — try again.';
    } finally {
      submitting = false;
    }
  }

  $: anyError = checks.some(c => c.status === 'error');
  $: firstError = checks.find(c => c.status === 'error');
  $: allChecking = checks.some(c => c.status === 'checking');
</script>

<div class="ob-root">
  <div class="ob-card">

    <!-- Header -->
    <div class="ob-header">
      <FlaskConical size={24} class="ob-icon" />
      <h1 class="ob-title">Connect a Broker</h1>
      <p class="ob-sub">Paper and live trading are powered by your broker account. No internal simulated account is created.</p>
    </div>

    <!-- Step indicator -->
    <div class="ob-steps">
      {#each ['Choose Broker', 'Connection', 'Select Account'] as label, i}
        <div class="ob-step-item" class:active={step === i + 1} class:done={step > i + 1}>
          <span class="ob-step-num">{step > i + 1 ? '✓' : i + 1}</span>
          <span class="ob-step-label">{label}</span>
        </div>
        {#if i < 2}<div class="ob-step-line" class:done={step > i + 1}></div>{/if}
      {/each}
    </div>

    <!-- ── Step 1: Choose Broker ── -->
    {#if step === 1}
      <div class="ob-section">
        <p class="ob-section-label">Select your broker</p>
        <div class="broker-grid">
          <button class="broker-tile" on:click={() => { step = 2; runChecks(); }}>
            <span class="broker-name">Moomoo</span>
            <span class="broker-avail">Available</span>
          </button>
          <div class="broker-tile disabled">
            <span class="broker-name">Webull</span>
            <span class="broker-soon">Coming Soon</span>
          </div>
          <div class="broker-tile disabled">
            <span class="broker-name">Others</span>
            <span class="broker-soon">Coming Soon</span>
          </div>
        </div>
      </div>
    {/if}

    <!-- ── Step 2: Connection Check ── -->
    {#if step === 2}
      <div class="ob-section">
        <p class="ob-section-label">Checking Moomoo connection</p>

        <div class="check-list">
          {#each checks as check, i}
            <div class="check-row">
              <span class="check-icon-wrap">
                {#if check.status === 'idle'}
                  <span class="check-idle-dot"></span>
                {:else if check.status === 'checking'}
                  <Loader2 size={15} class="spin muted" />
                {:else if check.status === 'ok'}
                  <CheckCircle2 size={15} class="ok" />
                {:else}
                  <XCircle size={15} class="err" />
                {/if}
              </span>
              <span class="check-label" class:muted-text={check.status === 'idle'}>
                {check.label}
              </span>
            </div>
          {/each}
        </div>

        {#if anyError && firstError}
          <div class="ob-error-msg">{firstError.error}</div>

          <button class="btn-primary" on:click={runChecks} disabled={allChecking}>
            Retry Connection
          </button>

          <details class="dev-details">
            <summary>Developer details</summary>
            <div class="dev-body">
              <p class="dev-hint">Start moomoo-service:</p>
              <pre>cd moomoo-service
python main.py</pre>
              <p class="dev-hint">Confirm OpenD shows "Connected" before retrying.</p>
            </div>
          </details>
        {/if}

        {#if !anyError && checks[0].status === 'idle'}
          <button class="btn-primary" on:click={runChecks}>Start Check</button>
        {/if}
      </div>
    {/if}

    <!-- ── Step 3: Select Account ── -->
    {#if step === 3}
      <div class="ob-section">
        <p class="ob-section-label">Choose your trading account</p>

        <div class="account-list">
          {#each accounts as acc}
            <!-- svelte-ignore a11y-click-events-have-key-events a11y-no-noninteractive-element-interactions -->
            <label class="account-row" class:selected={selectedAccId === acc.acc_id} on:click={() => selectedAccId = acc.acc_id}>
              <input type="radio" bind:group={selectedAccId} value={acc.acc_id} class="sr-only" />
              <span class="acc-dot" class:live={acc.is_real} class:paper={!acc.is_real}></span>
              <span class="acc-name">{acc.name}</span>
              <span class="acc-type-badge" class:live={acc.is_real} class:paper={!acc.is_real}>
                {acc.is_real ? 'LIVE' : 'PAPER'}
              </span>
              <span class="acc-id-chip">···{acc.acc_id.slice(-6)}</span>
            </label>
          {/each}
        </div>

        {#if submitError}
          <div class="ob-error-msg">{submitError}</div>
        {/if}

        <button class="btn-primary" disabled={!selectedAccId || submitting} on:click={selectAccount}>
          {submitting ? 'Connecting…' : 'Start Trading →'}
        </button>
      </div>
    {/if}

  </div>
</div>

<style>
  .ob-root {
    min-height: 100vh; display: flex; align-items: center; justify-content: center;
    padding: 24px; background: var(--bg);
  }
  .ob-card {
    width: 100%; max-width: 480px;
    background: var(--card); border: 1px solid var(--border);
    border-radius: 16px; padding: 32px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.15);
  }

  /* Header */
  .ob-header { text-align: center; margin-bottom: 28px; }
  :global(.ob-icon) { color: var(--primary); margin-bottom: 10px; }
  .ob-title { font-size: 1.2rem; font-weight: 700; color: var(--text); margin: 0 0 8px; }
  .ob-sub { font-size: 0.78rem; color: var(--muted); line-height: 1.5; margin: 0; }

  /* Step indicator */
  .ob-steps {
    display: flex; align-items: center; margin-bottom: 28px;
  }
  .ob-step-item {
    display: flex; flex-direction: column; align-items: center; gap: 4px;
    flex: 0 0 auto;
  }
  .ob-step-num {
    width: 26px; height: 26px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    font-size: 0.68rem; font-weight: 700;
    background: var(--surface-1); border: 1px solid var(--border);
    color: var(--muted);
  }
  .ob-step-item.active .ob-step-num {
    background: rgba(var(--primary-rgb),0.15);
    border-color: rgba(var(--primary-rgb),0.5);
    color: var(--primary);
  }
  .ob-step-item.done .ob-step-num {
    background: rgba(var(--success-rgb),0.12);
    border-color: rgba(var(--success-rgb),0.4);
    color: var(--success);
  }
  .ob-step-label {
    font-size: 0.58rem; font-weight: 600; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.05em; white-space: nowrap;
  }
  .ob-step-item.active .ob-step-label { color: var(--primary); }
  .ob-step-item.done .ob-step-label { color: var(--success); }
  .ob-step-line {
    flex: 1; height: 1px; background: var(--border); margin: 0 8px; margin-bottom: 18px;
  }
  .ob-step-line.done { background: rgba(var(--success-rgb),0.4); }

  /* Section */
  .ob-section { display: flex; flex-direction: column; gap: 12px; }
  .ob-section-label {
    font-size: 0.7rem; font-weight: 700; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;
  }

  /* Broker grid */
  .broker-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 8px; }
  .broker-tile {
    display: flex; flex-direction: column; align-items: center; gap: 6px;
    padding: 16px 8px; border-radius: 10px;
    background: var(--surface-1); border: 1.5px solid var(--border);
    cursor: pointer; transition: border-color 0.15s, background 0.15s;
  }
  .broker-tile:not(.disabled):hover {
    border-color: rgba(var(--primary-rgb),0.5);
    background: rgba(var(--primary-rgb),0.06);
  }
  .broker-tile.disabled { opacity: 0.45; cursor: not-allowed; }
  .broker-name { font-size: 0.8rem; font-weight: 700; color: var(--text); }
  .broker-avail {
    font-size: 0.58rem; font-weight: 700; padding: 2px 6px; border-radius: 10px;
    background: rgba(var(--success-rgb),0.12); color: var(--success);
  }
  .broker-soon {
    font-size: 0.58rem; font-weight: 600; padding: 2px 6px; border-radius: 10px;
    background: var(--surface-1); color: var(--muted); border: 1px solid var(--border);
  }

  /* Check list */
  .check-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 4px; }
  .check-row { display: flex; align-items: center; gap: 10px; font-size: 0.78rem; }
  .check-icon-wrap { width: 18px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
  .check-idle-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--border); }
  .check-label { color: var(--text); }
  .muted-text { color: var(--muted); }
  :global(.ok) { color: var(--success); }
  :global(.err) { color: var(--danger); }
  :global(.muted) { color: var(--muted); }
  :global(.spin) { animation: spin 0.8s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Error message */
  .ob-error-msg {
    padding: 8px 12px; border-radius: 7px; font-size: 0.74rem;
    background: rgba(var(--danger-rgb),0.08); border: 1px solid rgba(var(--danger-rgb),0.25);
    color: var(--danger);
  }

  /* Dev details */
  .dev-details { border-top: 1px solid var(--border); padding-top: 10px; }
  .dev-details summary {
    font-size: 0.7rem; color: var(--muted); cursor: pointer;
    font-weight: 600; user-select: none;
  }
  .dev-details summary:hover { color: var(--text); }
  .dev-body { margin-top: 10px; display: flex; flex-direction: column; gap: 6px; }
  .dev-hint { font-size: 0.7rem; color: var(--muted); margin: 0; }
  pre {
    background: var(--surface-1); border: 1px solid var(--border);
    border-radius: 6px; padding: 8px 10px;
    font-size: 0.7rem; font-family: monospace; color: var(--text);
    white-space: pre; overflow-x: auto; margin: 0;
  }

  /* Account list */
  .account-list { display: flex; flex-direction: column; gap: 8px; }
  .account-row {
    display: flex; align-items: center; gap: 10px;
    padding: 12px 14px; border-radius: 9px; cursor: pointer;
    border: 1.5px solid var(--border); background: var(--surface-1);
    transition: border-color 0.15s, background 0.15s;
  }
  .account-row:hover { border-color: rgba(var(--primary-rgb),0.4); }
  .account-row.selected {
    border-color: rgba(var(--primary-rgb),0.6);
    background: rgba(var(--primary-rgb),0.07);
  }
  .sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }
  .acc-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
  .acc-dot.live { background: var(--success); }
  .acc-dot.paper { background: #a5b4fc; }
  .acc-name { flex: 1; font-size: 0.8rem; font-weight: 600; color: var(--text); }
  .acc-type-badge {
    font-size: 0.58rem; font-weight: 700; padding: 2px 6px;
    border-radius: 10px; letter-spacing: 0.05em;
  }
  .acc-type-badge.live { background: rgba(var(--success-rgb),0.12); color: var(--success); }
  .acc-type-badge.paper { background: rgba(99,102,241,0.15); color: #a5b4fc; }
  .acc-id-chip {
    font-size: 0.62rem; font-family: monospace; color: var(--muted);
    background: var(--surface-1); border-radius: 4px; padding: 1px 5px;
    border: 1px solid var(--border);
  }

  /* Primary button */
  .btn-primary {
    width: 100%; padding: 10px; border-radius: 8px;
    background: var(--primary); border: none; color: #fff;
    font-size: 0.8rem; font-weight: 700; cursor: pointer;
    transition: opacity 0.15s;
  }
  .btn-primary:hover:not(:disabled) { opacity: 0.88; }
  .btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
</style>
```

- [ ] **Step 5.2: Verify wizard works in browser**

With moomoo-service running:
1. Log out or use a fresh account where `activeBrokerAccId` is null
2. Navigate to `http://127.0.0.1:5173/dashboard` — should redirect to `/onboarding/connect-broker`
3. Step 1: click Moomoo → proceeds to Step 2
4. Step 2: checks run sequentially, all green → auto-advance to Step 3
5. Step 3: select an account → click "Start Trading →" → lands on `/dashboard`
6. Refresh dashboard — stays on dashboard (no redirect)

With moomoo-service stopped:
- Step 2 check 1 fails, shows error message + Retry button + Developer details expandable

- [ ] **Step 5.3: Commit**

```bash
git add src/routes/onboarding/
git commit -m "feat(onboarding): add 3-step broker connection wizard"
```

---

## Task 6: Remove internal paper account auto-creation

**Files:**
- Modify: `src/lib/server/auth.ts`
- Modify: `src/routes/dashboard/+page.server.ts`

- [ ] **Step 6.1: Remove paper account hook from auth.ts**

In `src/lib/server/auth.ts`, delete the entire `databaseHooks` block (lines ~28–50):

```typescript
// DELETE this entire block:
databaseHooks: {
  user: {
    create: {
      after: async (user) => {
        try {
          await prisma.account.create({
            data: {
              userId: user.id,
              name: 'Paper Portfolio',
              brokerName: 'paper',
              accountType: 'paper',
              currency: 'USD',
            },
          });
        } catch (err) {
          console.error('[auth] Failed to create paper account for user', user.id, err);
        }
      },
    },
  },
},
```

The file after deletion should end with:

```typescript
export const auth = betterAuth({
  database: prismaAdapter(prisma, { provider: 'mysql' }),
  secret: process.env.BETTER_AUTH_SECRET,
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:5173',
  trustedOrigins: [
    'http://localhost:5173',
    'http://localhost:4173',
    'http://localhost:3000',
    'http://127.0.0.1:5173',
    ...(process.env.BETTER_AUTH_URL ? [process.env.BETTER_AUTH_URL] : []),
  ],
  emailAndPassword: { enabled: true },
  account: {
    modelName: 'betterAuthAccount',
  },
  plugins: [adminPlugin()],
  session: {
    cookieCache: { enabled: true, maxAge: 60 * 5 },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
```

- [ ] **Step 6.2: Remove paper account safety net from dashboard/+page.server.ts**

In `src/routes/dashboard/+page.server.ts`, delete the safety-net block (~lines 157–167):

```typescript
// DELETE this entire block:
const existingAccounts = await listAccounts(user.id);
if (existingAccounts.length === 0) {
  await prisma.account.create({
    data: {
      userId: user.id,
      name: 'Paper Portfolio',
      brokerName: 'paper',
      accountType: 'paper',
      currency: 'USD',
    },
  });
}
```

The `listAccounts` call remains because it's used further down for the `accounts` variable. Only delete the `if (existingAccounts.length === 0)` block. The line that calls `listAccounts` as part of the `Promise.all` on line ~170 is the one to keep.

> **Careful:** There are two `listAccounts` calls in this file — one standalone at line ~157 (safety net, DELETE) and one inside `Promise.all` (~line 170, KEEP).

- [ ] **Step 6.3: Commit**

```bash
git add src/lib/server/auth.ts src/routes/dashboard/+page.server.ts
git commit -m "feat(onboarding): remove internal paper account auto-creation"
```

---

## Task 7: Topbar — replace "Paper Trading" with "Manage Broker Connection"

**Files:**
- Modify: `src/lib/components/portfolioai/Topbar.svelte`

- [ ] **Step 7.1: Replace the menu item**

Find this block in `src/lib/components/portfolioai/Topbar.svelte`:

```svelte
<div class="tb-acc-divider"></div>
<button class="tb-acc-option" on:click={switchToPaper}>
  <span class="tb-acc-symbol">⚗</span>
  <span class="tb-acc-opt-label">Paper Trading</span>
</button>
```

Replace with:

```svelte
<div class="tb-acc-divider"></div>
<button class="tb-acc-option" on:click={manageConnection}>
  <span class="tb-acc-symbol">⚙</span>
  <span class="tb-acc-opt-label">Manage Broker Connection</span>
</button>
```

- [ ] **Step 7.2: Replace the `switchToPaper` function**

Find and replace:

```typescript
// DELETE:
function switchToPaper() {
  showAccountMenu = false;
  goto('/paper-trading');
}
```

```typescript
// ADD:
function manageConnection() {
  showAccountMenu = false;
  goto('/onboarding/connect-broker?reconnect=1');
}
```

- [ ] **Step 7.3: Verify in browser**

1. Open any page with the topbar
2. Click the account switcher
3. Confirm bottom item shows "⚙ Manage Broker Connection"
4. Click it — should navigate to `/onboarding/connect-broker?reconnect=1`
5. Step 1 is skipped — wizard starts at Step 2 (connection check)

- [ ] **Step 7.4: Commit**

```bash
git add src/lib/components/portfolioai/Topbar.svelte
git commit -m "feat(onboarding): replace Paper Trading topbar link with Manage Broker Connection"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Covered by |
|---|---|
| Route guard with DB fetch (not locals) | Task 2 |
| Exempt: `/onboarding`, `/api/broker/health`, `/api/broker/accounts`, `/api/broker/accounts/select` | Task 1 `BROKER_ONBOARDING_PATHS` + Task 2 |
| Onboarding skipped when `activeBrokerAccId` set | Task 4 `+page.server.ts` load guard |
| `?reconnect=1` skips load guard redirect | Task 4 |
| Step 1: Choose broker (Moomoo active, others disabled) | Task 5 |
| Step 2: 3 sequential checks with live status | Task 5 |
| Step 2: Retry button + Developer details expandable | Task 5 |
| Step 3: Account list with PAPER/LIVE badge | Task 5 |
| Step 3: POST to existing `/api/broker/accounts/select` | Task 5 |
| `/api/broker/health/service` endpoint | Task 3 |
| `/api/broker/health/opend` endpoint | Task 3 |
| Remove `auth.ts` paper account hook | Task 6 |
| Remove `dashboard/+page.server.ts` safety net | Task 6 |
| Topbar "Manage Broker Connection" → `?reconnect=1` | Task 7 |

All spec requirements covered. No placeholders. Types consistent across all tasks.
