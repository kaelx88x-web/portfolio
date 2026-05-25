# Agent Push Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow each customer to run a lightweight local agent on their PC (alongside OpenD + moomoo-service) that pushes broker data to the SaaS server on a schedule — so the web UI reads from the database rather than calling the customer's local service directly.

**Architecture:** The customer installs `portfolio-agent/agent.py` on their PC, configures it with a per-user API key from the Settings page, and runs it. The agent polls the local moomoo-service, then POSTs data to `POST /api/agent/push` on the SaaS server. The server stores it in DB. Paper-trading and broker pages read from the latest DB record when `PUBLIC_APP_MODE=saas`. The agent handles sleep/wake automatically by retrying on failure and pushing immediately when the connection is restored.

**Tech Stack:** Python 3.11+, httpx (async HTTP), moomoo-api, SvelteKit API routes, Prisma/MySQL, existing moomoo-service on customer PC.

---

## File Map

**New files:**
- `portfolio-agent/agent.py` — customer-side agent: polls moomoo-service, pushes to SaaS server
- `portfolio-agent/config.example.json` — config template with comments
- `portfolio-agent/requirements.txt` — httpx, python-dotenv
- `portfolio-agent/README.md` — setup guide for customers
- `src/lib/services/agent.service.ts` — server helpers: generateKey, verifyKey, storeAgentPush, getLatestAgentData
- `src/routes/api/agent/push/+server.ts` — receives POST from agent, validates key, stores data
- `src/routes/api/agent/key/+server.ts` — GET returns current key, POST generates new key
- `src/routes/settings/agent/+page.server.ts` — load agent registration for current user
- `src/routes/settings/agent/+page.svelte` — settings UI: key display, copy, setup guide, status

**Modified files:**
- `prisma/schema.prisma` — add `AgentRegistration` + `AgentPushLog` models + User relations
- `src/routes/paper-trading/+page.server.ts` — in SaaS mode, read from latest AgentPushLog
- `src/routes/broker/+page.server.ts` — expose agent last-push time to UI
- `src/routes/broker/+page.svelte` — show agent sync badge when in SaaS mode
- `src/lib/components/portfolioai/Sidebar.svelte` — add "Agent" link under Settings group

---

## Task 1: Prisma schema — AgentRegistration + AgentPushLog

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add models to schema**

Open `prisma/schema.prisma`. Add at the end, before the last closing line:

```prisma
model AgentRegistration {
  id         String         @id @default(cuid())
  userId     String         @unique @map("user_id")
  user       User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  apiKey     String         @unique @map("api_key") @db.VarChar(64)
  label      String         @default("My PC") @db.VarChar(100)
  lastSeenAt DateTime?      @map("last_seen_at")
  lastPushAt DateTime?      @map("last_push_at")
  status     String         @default("pending") @db.VarChar(30)
  pushLogs   AgentPushLog[]
  createdAt  DateTime       @default(now()) @map("created_at")
  updatedAt  DateTime       @updatedAt @map("updated_at")

  @@map("agent_registrations")
}

model AgentPushLog {
  id          String            @id @default(cuid())
  agentId     String            @map("agent_id")
  agent       AgentRegistration @relation(fields: [agentId], references: [id], onDelete: Cascade)
  userId      String            @map("user_id")
  pushType    String            @default("full") @map("push_type") @db.VarChar(40)
  dataJson    String            @map("data_json") @db.LongText
  recordCount Int               @default(0) @map("record_count")
  agentVersion String           @default("1.0.0") @map("agent_version") @db.VarChar(20)
  createdAt   DateTime          @default(now()) @map("created_at")

  @@index([agentId, createdAt])
  @@index([userId, createdAt])
  @@map("agent_push_logs")
}
```

- [ ] **Step 2: Add relations to User model**

In the `model User { ... }` block, add these two lines after the last relation (e.g., after `optionAlerts OptionAlert[]`):

```prisma
  agentRegistration AgentRegistration?
  agentPushLogs     AgentPushLog[]     @relation("agent_push_logs_user")
```

Wait — `AgentPushLog` uses `userId` but doesn't have a User relation defined yet. Add it:

In `model AgentPushLog`, add after `userId String @map("user_id")`:
```prisma
  user        User              @relation("agent_push_logs_user", fields: [userId], references: [id], onDelete: Cascade)
```

And add to User model:
```prisma
  agentRegistration    AgentRegistration?
  agentPushLogs        AgentPushLog[]
```

- [ ] **Step 3: Run migration**

```bash
cd c:/Ampps/www/portfolio
npx prisma migrate dev --name agent_push_model
```

Expected output: `Your database is now in sync with your schema.`

- [ ] **Step 4: Verify tables exist**

```bash
npx prisma studio
```

Or check via MySQL: `SHOW TABLES LIKE 'agent%';` — should show `agent_registrations` and `agent_push_logs`.

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/
git commit -m "feat: add AgentRegistration and AgentPushLog schema"
```

---

## Task 2: Agent service — key management and data helpers

**Files:**
- Create: `src/lib/services/agent.service.ts`

- [ ] **Step 1: Create the service file**

```typescript
// src/lib/services/agent.service.ts
// Manages agent API keys and push log storage/retrieval.
// All functions are server-only (call prisma directly).

import { randomBytes } from 'node:crypto';
import { prisma } from '$lib/server/db';

/** Generate a cryptographically random agent API key. */
export function generateAgentKey(): string {
  return 'agent_' + randomBytes(24).toString('hex');
}

/**
 * Get or create an AgentRegistration for the user.
 * Returns the existing one if already registered.
 */
export async function getOrCreateAgentRegistration(userId: string) {
  const existing = await prisma.agentRegistration.findUnique({
    where: { userId },
  });
  if (existing) return existing;

  return prisma.agentRegistration.create({
    data: {
      userId,
      apiKey: generateAgentKey(),
      label: 'My PC',
      status: 'pending',
    },
  });
}

/**
 * Rotate the agent API key for a user.
 * Invalidates the old key immediately.
 */
export async function rotateAgentKey(userId: string) {
  return prisma.agentRegistration.upsert({
    where: { userId },
    update: { apiKey: generateAgentKey(), updatedAt: new Date() },
    create: {
      userId,
      apiKey: generateAgentKey(),
      label: 'My PC',
      status: 'pending',
    },
  });
}

/**
 * Verify an API key from the Authorization header.
 * Returns the AgentRegistration or null if invalid.
 */
export async function verifyAgentKey(
  authHeader: string | null
): Promise<{ id: string; userId: string; label: string } | null> {
  if (!authHeader?.startsWith('Bearer ')) return null;
  const key = authHeader.slice(7).trim();
  if (!key.startsWith('agent_')) return null;

  const reg = await prisma.agentRegistration.findUnique({
    where: { apiKey: key },
    select: { id: true, userId: true, label: true },
  });
  return reg ?? null;
}

export type AgentPushPayload = {
  push_type: string;           // 'broker_status' | 'paper_dashboard' | 'full'
  agent_version?: string;
  status?: Record<string, unknown> | null;
  account?: Record<string, unknown> | null;
  account_info?: Record<string, unknown> | null;
  positions?: unknown[];
  orders?: unknown[];
  deals?: unknown[];
  synced_at?: string;
};

/**
 * Store an agent push and update last_push_at / last_seen_at.
 */
export async function storeAgentPush(
  agentId: string,
  userId: string,
  payload: AgentPushPayload
): Promise<void> {
  const recordCount =
    (payload.positions?.length ?? 0) +
    (payload.orders?.length ?? 0) +
    (payload.deals?.length ?? 0);

  await prisma.$transaction([
    prisma.agentPushLog.create({
      data: {
        agentId,
        userId,
        pushType: payload.push_type ?? 'full',
        dataJson: JSON.stringify(payload),
        recordCount,
        agentVersion: payload.agent_version ?? '1.0.0',
      },
    }),
    prisma.agentRegistration.update({
      where: { id: agentId },
      data: {
        lastPushAt: new Date(),
        lastSeenAt: new Date(),
        status: 'active',
      },
    }),
  ]);
}

/**
 * Get the most recent agent push for a user.
 * Returns null if no push exists yet.
 */
export async function getLatestAgentPush(
  userId: string
): Promise<AgentPushPayload & { pushedAt: Date } | null> {
  const log = await prisma.agentPushLog.findFirst({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
  if (!log) return null;

  try {
    return { ...JSON.parse(log.dataJson), pushedAt: log.createdAt };
  } catch {
    return null;
  }
}

/**
 * Get agent registration status for a user (no key in result).
 */
export async function getAgentStatus(userId: string) {
  const reg = await prisma.agentRegistration.findUnique({
    where: { userId },
    select: {
      id: true,
      label: true,
      status: true,
      lastSeenAt: true,
      lastPushAt: true,
      createdAt: true,
    },
  });
  return reg;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd c:/Ampps/www/portfolio
npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors for this file (other pre-existing errors are OK).

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/agent.service.ts
git commit -m "feat: add agent.service.ts — key management and push log helpers"
```

---

## Task 3: Push endpoint — POST /api/agent/push

**Files:**
- Create: `src/routes/api/agent/push/+server.ts`

- [ ] **Step 1: Create endpoint**

```typescript
// src/routes/api/agent/push/+server.ts
// Receives data pushed by the customer's local agent.
// Authenticated via Bearer token (agent API key).

import { json } from '@sveltejs/kit';
import { verifyAgentKey, storeAgentPush, type AgentPushPayload } from '$lib/services/agent.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  // 1. Authenticate
  const auth = request.headers.get('Authorization');
  const agent = await verifyAgentKey(auth);
  if (!agent) {
    return json({ error: 'Unauthorized' }, { status: 401 });
  }

  // 2. Parse body
  let payload: AgentPushPayload;
  try {
    payload = await request.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // 3. Basic validation
  if (!payload.push_type) {
    return json({ error: 'push_type is required' }, { status: 400 });
  }

  // 4. Store
  try {
    await storeAgentPush(agent.id, agent.userId, payload);
    return json({
      ok: true,
      agent: agent.label,
      push_type: payload.push_type,
      received_at: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Storage error';
    return json({ error: message }, { status: 500 });
  }
};
```

- [ ] **Step 2: Test the endpoint manually**

Start the dev server, then in a terminal:

```bash
curl -X POST http://127.0.0.1:5173/api/agent/push \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer INVALID_KEY" \
  -d '{"push_type":"test"}'
```

Expected: `{"error":"Unauthorized"}` with status 401.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/agent/push/+server.ts
git commit -m "feat: add POST /api/agent/push endpoint"
```

---

## Task 4: API key endpoint — GET/POST /api/agent/key

**Files:**
- Create: `src/routes/api/agent/key/+server.ts`

- [ ] **Step 1: Create endpoint**

```typescript
// src/routes/api/agent/key/+server.ts
// GET  → return current agent registration (key included)
// POST → rotate/create a new API key

import { json } from '@sveltejs/kit';
import { getOrCreateAgentRegistration, rotateAgentKey } from '$lib/services/agent.service';
import { getDemoUser } from '$lib/server/demo-user';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const user = await getDemoUser();
  const reg = await getOrCreateAgentRegistration(user.id);
  return json({
    api_key: reg.apiKey,
    label: reg.label,
    status: reg.status,
    last_seen_at: reg.lastSeenAt,
    last_push_at: reg.lastPushAt,
    created_at: reg.createdAt,
  });
};

export const POST: RequestHandler = async () => {
  const user = await getDemoUser();
  const reg = await rotateAgentKey(user.id);
  return json({
    api_key: reg.apiKey,
    label: reg.label,
    status: reg.status,
    last_seen_at: reg.lastSeenAt,
    last_push_at: reg.lastPushAt,
    rotated_at: new Date().toISOString(),
  });
};
```

- [ ] **Step 2: Test GET**

```bash
curl http://127.0.0.1:5173/api/agent/key
```

Expected: JSON with `api_key` starting with `agent_`, `status: "pending"`.

- [ ] **Step 3: Commit**

```bash
git add src/routes/api/agent/key/+server.ts
git commit -m "feat: add GET/POST /api/agent/key endpoint"
```

---

## Task 5: Settings — Agent page

**Files:**
- Create: `src/routes/settings/agent/+page.server.ts`
- Create: `src/routes/settings/agent/+page.svelte`
- Modify: `src/lib/components/portfolioai/Sidebar.svelte` — add link

- [ ] **Step 1: Create page server**

```typescript
// src/routes/settings/agent/+page.server.ts
import { getOrCreateAgentRegistration, getAgentStatus } from '$lib/services/agent.service';
import { getDemoUser } from '$lib/server/demo-user';
import type { Actions, PageServerLoad } from './$types';
import { json } from '@sveltejs/kit';

export const load: PageServerLoad = async () => {
  const user = await getDemoUser();
  const reg = await getOrCreateAgentRegistration(user.id);
  return {
    apiKey: reg.apiKey,
    label: reg.label,
    status: reg.status,
    lastSeenAt: reg.lastSeenAt?.toISOString() ?? null,
    lastPushAt: reg.lastPushAt?.toISOString() ?? null,
    createdAt: reg.createdAt.toISOString(),
  };
};

export const actions: Actions = {
  rotate: async () => {
    const user = await getDemoUser();
    const { rotateAgentKey } = await import('$lib/services/agent.service');
    await rotateAgentKey(user.id);
    return { rotated: true };
  },
};
```

- [ ] **Step 2: Create page Svelte component**

```svelte
<!-- src/routes/settings/agent/+page.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import { Copy, Check, RefreshCw, Radio, Clock, Terminal, Download } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import type { PageData, ActionData } from './$types';

  export let data: PageData;
  export let form: ActionData = null;

  $: apiKey = data.apiKey;
  let copied = false;
  let rotating = false;

  async function copyKey() {
    await navigator.clipboard.writeText(apiKey);
    copied = true;
    setTimeout(() => { copied = false; }, 2000);
  }

  function relTime(iso: string | null): string {
    if (!iso) return 'Never';
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  const AGENT_VERSION = '1.0.0';
  $: serverUrl = typeof window !== 'undefined' ? window.location.origin : '';
</script>

<PageHeader
  title="Local Agent"
  subtitle="Connect your PC's Moomoo OpenD to this account."
  breadcrumb={[{ label: 'Settings', href: '/settings' }, { label: 'Agent' }]}
/>

<!-- Status bar -->
<div class="status-bar">
  <span class="dot" class:dot-active={data.status === 'active'} class:dot-pending={data.status !== 'active'}></span>
  <span class="status-text">{data.status === 'active' ? 'Agent active' : 'Waiting for first push'}</span>
  {#if data.lastPushAt}
    <span class="meta"><Clock size={11} /> Last push {relTime(data.lastPushAt)}</span>
  {/if}
  {#if data.lastSeenAt}
    <span class="meta"><Radio size={11} /> Last seen {relTime(data.lastSeenAt)}</span>
  {/if}
</div>

<!-- API Key card -->
<div class="card key-card">
  <div class="card-title">API Key</div>
  <p class="card-desc">This key authenticates your local agent. Keep it secret — it has access to your portfolio data.</p>

  <div class="key-row">
    <code class="key-value">{apiKey}</code>
    <button class="btn-icon" on:click={copyKey} title="Copy">
      {#if copied}<Check size={14} />{:else}<Copy size={14} />{/if}
    </button>
  </div>

  {#if form?.rotated}
    <div class="rotate-notice">✓ New key generated — update your agent config and restart the agent.</div>
  {/if}

  <form method="POST" action="?/rotate" use:enhance={() => {
    rotating = true;
    return async ({ update }) => { await update(); rotating = false; };
  }}>
    <button class="btn-rotate" type="submit" disabled={rotating}>
      <RefreshCw size={12} class={rotating ? 'spin' : ''} />
      {rotating ? 'Rotating…' : 'Rotate Key'}
    </button>
  </form>
</div>

<!-- Setup guide -->
<div class="card setup-card">
  <div class="card-title">Setup Guide</div>
  <p class="card-desc">Run these steps once on the PC where Moomoo OpenD is installed.</p>

  <ol class="setup-steps">
    <li>
      <strong>Download the agent</strong>
      <span>Copy the <code>portfolio-agent/</code> folder from the project to your PC.</span>
    </li>
    <li>
      <strong>Install dependencies</strong>
      <pre class="cmd">cd portfolio-agent
pip install -r requirements.txt</pre>
    </li>
    <li>
      <strong>Create config file</strong>
      <span>Copy <code>config.example.json</code> → <code>config.json</code> and fill in your values:</span>
      <pre class="cmd">{JSON.stringify({
  server_url: serverUrl || 'https://your-saas-server.com',
  api_key: apiKey,
  moomoo_service_url: 'http://localhost:8001',
  push_interval_seconds: 300
}, null, 2)}</pre>
    </li>
    <li>
      <strong>Start OpenD + moomoo-service</strong>
      <span>Make sure Moomoo OpenD is running, then:</span>
      <pre class="cmd">cd moomoo-service
python main.py</pre>
    </li>
    <li>
      <strong>Run the agent</strong>
      <pre class="cmd">cd portfolio-agent
python agent.py</pre>
      <span>You should see <em>"Push successful"</em> within a few seconds. This page will show "Agent active".</span>
    </li>
    <li>
      <strong>Keep it running</strong>
      <span>The agent must be running whenever OpenD is on. You can set it to start with Windows via Task Scheduler.</span>
    </li>
  </ol>
</div>

<style>
  .status-bar {
    display: flex; align-items: center; gap: 10px; flex-wrap: wrap;
    margin-bottom: 16px; padding: 8px 14px; border-radius: 8px;
    border: 1px solid var(--border); background: var(--card);
    font-size: 0.74rem; color: var(--muted);
  }
  .dot { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .dot-active  { background: var(--success); box-shadow: 0 0 0 3px rgba(var(--success-rgb),.2); }
  .dot-pending { background: var(--muted); }
  .status-text { font-weight: 600; color: var(--text); }
  .meta { display: flex; align-items: center; gap: 4px; }

  .card { padding: 18px 20px; border: 1px solid var(--border); background: var(--card); border-radius: 12px; margin-bottom: 16px; }
  .card-title { font-size: 0.82rem; font-weight: 700; color: var(--text); margin-bottom: 6px; }
  .card-desc  { font-size: 0.74rem; color: var(--muted); margin: 0 0 14px; }

  .key-row {
    display: flex; align-items: center; gap: 8px;
    background: var(--surface-1); border: 1px solid var(--border);
    border-radius: 8px; padding: 8px 12px; margin-bottom: 10px;
  }
  .key-value {
    flex: 1; font-family: monospace; font-size: 0.78rem;
    color: var(--text); word-break: break-all;
  }
  .btn-icon {
    display: flex; align-items: center; justify-content: center;
    width: 28px; height: 28px; border-radius: 6px; flex-shrink: 0;
    border: 1px solid var(--border); background: var(--card);
    color: var(--muted); cursor: pointer;
  }
  .btn-icon:hover { color: var(--primary); border-color: var(--primary); }

  .rotate-notice {
    font-size: 0.72rem; color: var(--success);
    margin-bottom: 10px;
  }
  .btn-rotate {
    display: inline-flex; align-items: center; gap: 6px;
    padding: 6px 14px; border-radius: 7px;
    border: 1px solid rgba(var(--danger-rgb),.3);
    background: transparent; color: var(--danger);
    font-size: 0.74rem; font-weight: 600; cursor: pointer;
  }
  .btn-rotate:hover:not(:disabled) { background: rgba(var(--danger-rgb),.06); }
  .btn-rotate:disabled { opacity: 0.5; cursor: not-allowed; }
  :global(.spin) { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  .setup-steps {
    list-style: none; margin: 0; padding: 0;
    display: flex; flex-direction: column; gap: 14px;
    counter-reset: step;
  }
  .setup-steps li {
    display: flex; flex-direction: column; gap: 4px;
    font-size: 0.76rem; color: var(--text);
    padding-left: 28px; position: relative;
  }
  .setup-steps li::before {
    content: counter(step);
    counter-increment: step;
    position: absolute; left: 0; top: 0;
    width: 20px; height: 20px; border-radius: 50%;
    background: rgba(var(--primary-rgb),.12); color: var(--primary);
    font-size: 0.65rem; font-weight: 700;
    display: flex; align-items: center; justify-content: center;
  }
  .setup-steps li strong { font-weight: 600; }
  .setup-steps li span  { color: var(--muted); }
  .cmd {
    display: block; margin: 5px 0;
    background: var(--surface-1); border: 1px solid var(--border);
    border-radius: 6px; padding: 8px 12px;
    font-size: 0.7rem; font-family: monospace; color: var(--text);
    white-space: pre; overflow-x: auto;
  }
</style>
```

- [ ] **Step 3: Add Agent link to Sidebar**

In `src/lib/components/portfolioai/Sidebar.svelte`, find the Settings navigation group. It will contain items like `{ label: 'Settings', href: '/settings' }`. Add the agent link after it:

```typescript
{ label: 'Agent', href: '/settings/agent' },
```

The exact location depends on how groups are structured. Search for `/settings` in the sidebar and add the Agent link in the same group.

- [ ] **Step 4: Test the page loads**

Navigate to `http://127.0.0.1:5173/settings/agent`. Should show the API key, setup guide, and status bar.

- [ ] **Step 5: Commit**

```bash
git add src/routes/settings/agent/ src/lib/components/portfolioai/Sidebar.svelte
git commit -m "feat: add Settings > Agent page with API key and setup guide"
```

---

## Task 6: Python agent — poll + push + auto-reconnect

**Files:**
- Create: `portfolio-agent/agent.py`
- Create: `portfolio-agent/config.example.json`
- Create: `portfolio-agent/requirements.txt`
- Create: `portfolio-agent/README.md`

- [ ] **Step 1: Create requirements.txt**

```
httpx==0.27.2
```

(No other deps needed — agent calls local moomoo-service via HTTP, not moomoo-api directly.)

- [ ] **Step 2: Create config.example.json**

```json
{
  "_comment": "Copy this file to config.json and fill in your values.",
  "server_url": "https://your-portfolioai-server.com",
  "api_key": "agent_YOUR_KEY_HERE",
  "moomoo_service_url": "http://localhost:8001",
  "push_interval_seconds": 300,
  "retry_interval_seconds": 30,
  "log_level": "INFO"
}
```

- [ ] **Step 3: Create agent.py**

```python
#!/usr/bin/env python3
"""
PortfolioAI Local Agent v1.0.0
Polls local moomoo-service and pushes data to the SaaS server.

Usage:
    python agent.py [--config path/to/config.json]
"""

import argparse
import json
import logging
import sys
import time
from pathlib import Path

import httpx

AGENT_VERSION = "1.0.0"
DEFAULT_CONFIG = Path(__file__).parent / "config.json"


def load_config(path: Path) -> dict:
    if not path.exists():
        print(f"ERROR: Config file not found: {path}")
        print(f"Copy config.example.json to config.json and fill in your values.")
        sys.exit(1)
    with open(path) as f:
        cfg = json.load(f)
    required = ["server_url", "api_key", "moomoo_service_url"]
    for key in required:
        if not cfg.get(key):
            print(f"ERROR: Missing required config key: {key}")
            sys.exit(1)
    return cfg


def setup_logging(level: str) -> logging.Logger:
    logging.basicConfig(
        format="%(asctime)s [%(levelname)s] %(message)s",
        datefmt="%H:%M:%S",
        level=getattr(logging, level.upper(), logging.INFO),
    )
    return logging.getLogger("portfolio-agent")


def fetch_local(client: httpx.Client, base: str, path: str) -> dict | None:
    """Fetch from local moomoo-service. Returns None on any error."""
    try:
        r = client.get(f"{base.rstrip('/')}{path}", timeout=8)
        r.raise_for_status()
        return r.json()
    except Exception:
        return None


def build_payload(local_base: str) -> dict | None:
    """
    Collect all data from local moomoo-service into one push payload.
    Returns None if the service is unreachable.
    """
    with httpx.Client() as client:
        status = fetch_local(client, local_base, "/status")
        if status is None:
            return None  # service is down

        paper = fetch_local(client, local_base, "/paper/dashboard")

    payload = {
        "push_type": "full",
        "agent_version": AGENT_VERSION,
        "status": status,
        "synced_at": __import__("datetime").datetime.utcnow().isoformat() + "Z",
    }

    if paper and not paper.get("error"):
        payload.update({
            "account":      paper.get("account"),
            "account_info": paper.get("account_info"),
            "positions":    paper.get("positions", []),
            "orders":       paper.get("orders", []),
            "deals":        paper.get("deals", []),
        })

    return payload


def push_to_server(
    payload: dict, server_url: str, api_key: str, log: logging.Logger
) -> bool:
    """Push payload to SaaS server. Returns True on success."""
    url = f"{server_url.rstrip('/')}/api/agent/push"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    try:
        with httpx.Client(timeout=15) as client:
            r = client.post(url, json=payload, headers=headers)
        if r.status_code == 401:
            log.error("Push failed: Invalid API key. Check config.json.")
            return False
        if not r.is_success:
            log.warning(f"Push failed: server returned {r.status_code} — {r.text[:200]}")
            return False
        data = r.json()
        log.info(f"Push successful ({payload.get('push_type')}) — server acknowledged: {data.get('received_at', 'ok')}")
        return True
    except httpx.ConnectError:
        log.warning(f"Cannot reach server at {server_url}. Will retry.")
        return False
    except Exception as exc:
        log.warning(f"Push error: {exc}")
        return False


def run(cfg: dict, log: logging.Logger) -> None:
    push_interval = int(cfg.get("push_interval_seconds", 300))
    retry_interval = int(cfg.get("retry_interval_seconds", 30))
    local_base = cfg["moomoo_service_url"]
    server_url = cfg["server_url"]
    api_key = cfg["api_key"]

    log.info(f"PortfolioAI Agent v{AGENT_VERSION} started.")
    log.info(f"Local service: {local_base}")
    log.info(f"Server:        {server_url}")
    log.info(f"Push interval: {push_interval}s  |  Retry interval: {retry_interval}s")

    last_push_success = False

    while True:
        try:
            log.debug("Collecting data from moomoo-service…")
            payload = build_payload(local_base)

            if payload is None:
                if last_push_success:
                    log.warning("moomoo-service unreachable (PC may have slept). Retrying…")
                    last_push_success = False
                else:
                    log.debug("moomoo-service still unreachable. Waiting…")
                time.sleep(retry_interval)
                continue

            success = push_to_server(payload, server_url, api_key, log)
            last_push_success = success

            if success:
                # Sleep full interval after a successful push
                log.debug(f"Sleeping {push_interval}s until next push…")
                time.sleep(push_interval)
            else:
                # Short retry on push failure
                time.sleep(retry_interval)

        except KeyboardInterrupt:
            log.info("Agent stopped by user.")
            break
        except Exception as exc:
            log.error(f"Unexpected error: {exc}. Retrying in {retry_interval}s.")
            time.sleep(retry_interval)


def main() -> None:
    parser = argparse.ArgumentParser(description="PortfolioAI Local Agent")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG, help="Path to config.json")
    args = parser.parse_args()

    cfg = load_config(args.config)
    log = setup_logging(cfg.get("log_level", "INFO"))
    run(cfg, log)


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: Create README.md**

```markdown
# PortfolioAI Local Agent

Runs on your PC alongside Moomoo OpenD. Pushes broker data to your PortfolioAI SaaS account every 5 minutes.

## Requirements

- Python 3.9+
- Moomoo OpenD running on your PC
- `moomoo-service` running (`python main.py` in the `moomoo-service/` folder)

## Setup

1. Install dependencies:
   ```
   pip install -r requirements.txt
   ```

2. Copy the config template:
   ```
   cp config.example.json config.json
   ```

3. Edit `config.json`:
   - `server_url` — your PortfolioAI server URL
   - `api_key` — from Settings > Agent in the web app
   - `moomoo_service_url` — keep as `http://localhost:8001` unless you changed it

4. Run the agent:
   ```
   python agent.py
   ```

## Auto-start on Windows

To run the agent automatically when Windows starts:

1. Open **Task Scheduler**
2. Create Basic Task → "PortfolioAI Agent"
3. Trigger: **At log on**
4. Action: Start a program
   - Program: `python`
   - Arguments: `C:\path\to\portfolio-agent\agent.py`
   - Start in: `C:\path\to\portfolio-agent\`

## Behaviour after sleep/wake

The agent detects when moomoo-service is unreachable (e.g. PC just woke up, OpenD not reconnected yet) and retries every 30 seconds. As soon as OpenD reconnects, the agent pushes data automatically — no manual action needed.
```

- [ ] **Step 5: Test agent locally**

With moomoo-service running locally:

```bash
cd portfolio-agent
pip install -r requirements.txt
# Create a test config pointing to local dev server
echo '{"server_url":"http://127.0.0.1:5173","api_key":"REPLACE_WITH_KEY_FROM_SETTINGS","moomoo_service_url":"http://localhost:8001","push_interval_seconds":60}' > config.json
python agent.py
```

Expected output:
```
HH:MM:SS [INFO] PortfolioAI Agent v1.0.0 started.
HH:MM:SS [INFO] Push successful (full) — server acknowledged: 2026-05-25T...
```

- [ ] **Step 6: Commit**

```bash
git add portfolio-agent/
git commit -m "feat: add portfolio-agent — local push agent with sleep/wake reconnect"
```

---

## Task 7: Update paper-trading page to read from DB in SaaS mode

**Files:**
- Modify: `src/routes/paper-trading/+page.server.ts`

- [ ] **Step 1: Read current file**

```typescript
// Current content of src/routes/paper-trading/+page.server.ts
import { getMoomooPaperDashboard } from '$lib/services/moomoo-paper.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const data = await getMoomooPaperDashboard();
  return { paper: data };
};
```

- [ ] **Step 2: Update to use agent data in SaaS mode**

```typescript
// src/routes/paper-trading/+page.server.ts
import { getMoomooPaperDashboard } from '$lib/services/moomoo-paper.service';
import { getLatestAgentPush } from '$lib/services/agent.service';
import { getDemoUser } from '$lib/server/demo-user';
import type { PageServerLoad } from './$types';

const IS_SAAS = process.env.PUBLIC_APP_MODE === 'saas';

export const load: PageServerLoad = async () => {
  // In SaaS mode, read from the latest agent push stored in DB.
  // The customer's local agent is responsible for keeping it fresh.
  if (IS_SAAS) {
    const user = await getDemoUser();
    const push = await getLatestAgentPush(user.id);

    if (push) {
      return {
        paper: {
          account:      push.account      ?? { account_label: 'Moomoo Simulate', broker_account_id: '', trade_environment: 'SIMULATE', trdmarket_auth: [] },
          account_info: push.account_info ?? { total_assets: 0, securities_assets: 0, cash: 0, market_val: 0, unrealized_pl: 0, realized_pl: 0, power: 0, avl_withdrawal_cash: 0 },
          positions:    push.positions    ?? [],
          orders:       push.orders       ?? [],
          deals:        push.deals        ?? [],
          synced_at:    push.synced_at    ?? push.pushedAt.toISOString(),
          error:        null,
          from_agent:   true,
          agent_pushed_at: push.pushedAt.toISOString(),
        },
      };
    }

    // No agent data yet — return empty state with a clear message
    return {
      paper: {
        account:      { account_label: 'Moomoo Simulate', broker_account_id: '', trade_environment: 'SIMULATE', trdmarket_auth: [] },
        account_info: { total_assets: 0, securities_assets: 0, cash: 0, market_val: 0, unrealized_pl: 0, realized_pl: 0, power: 0, avl_withdrawal_cash: 0 },
        positions:    [],
        orders:       [],
        deals:        [],
        synced_at:    new Date().toISOString(),
        error:        'No agent data yet. Set up the local agent on your PC — see Settings > Agent.',
        from_agent:   false,
        agent_pushed_at: null,
      },
    };
  }

  // Self-hosted mode: call moomoo-service directly as before
  const data = await getMoomooPaperDashboard();
  return { paper: { ...data, from_agent: false, agent_pushed_at: null } };
};
```

- [ ] **Step 3: Update +page.svelte to show agent freshness badge**

In `src/routes/paper-trading/+page.svelte`, in the `<script>` section, after `$: deals = paper.deals ?? [];` add:

```svelte
  $: fromAgent = paper.from_agent ?? false;
  $: agentPushedAt = paper.agent_pushed_at ?? null;
```

And in the template, after the `<PageHeader>` tag add:

```svelte
{#if fromAgent && agentPushedAt}
  <div class="agent-badge">
    <Radio size={11} />
    Agent data — pushed {formatDate(agentPushedAt)}
  </div>
{/if}
```

Add style:
```css
  .agent-badge {
    display: inline-flex; align-items: center; gap: 5px;
    font-size: 0.68rem; color: var(--muted);
    margin-bottom: 12px;
  }
```

- [ ] **Step 4: Commit**

```bash
git add src/routes/paper-trading/
git commit -m "feat: paper-trading reads from agent DB push in SaaS mode"
```

---

## Task 8: Show agent status on broker sync page

**Files:**
- Modify: `src/routes/broker/+page.server.ts`
- Modify: `src/routes/broker/+page.svelte`

- [ ] **Step 1: Update broker page server to expose agent status**

In `src/routes/broker/+page.server.ts`, add to the `load` function:

```typescript
import { getAgentStatus } from '$lib/services/agent.service';
// Inside load:
const [status, syncLogs, agentStatus] = await Promise.all([
  getMoomooStatus().catch(() => null),
  prisma.brokerSyncLog.findMany({ ... }).catch(() => []),
  getAgentStatus(user.id).catch(() => null),
]);
return { status, syncLogs, agentStatus };
```

Full updated load function:

```typescript
export const load: PageServerLoad = async () => {
  const user = await getDemoUser();
  const [status, syncLogs, agentStatus] = await Promise.all([
    getMoomooStatus().catch(() => null),
    prisma.brokerSyncLog.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }).catch(() => []),
    import('$lib/services/agent.service')
      .then(m => m.getAgentStatus(user.id))
      .catch(() => null),
  ]);
  return { status, syncLogs, agentStatus };
};
```

- [ ] **Step 2: Add agent status card to broker page svelte**

In `src/routes/broker/+page.svelte`, after `$: accountInfo = form?.account_info ?? null;` add:

```svelte
  $: agentStatus = data.agentStatus;
```

In the status grid section (after the 4 existing stat cards), add a new card:

```svelte
  {#if agentStatus}
    <div class="card stat-card">
      <div class="stat-label">Local Agent</div>
      <div class="stat-row-inner">
        <span class="dot" class:dot-ok={agentStatus.status === 'active'} class:dot-warn={agentStatus.status !== 'active'}></span>
        <span class="stat-val">{agentStatus.status === 'active' ? 'Active' : 'Pending'}</span>
      </div>
      <p class="stat-sub">
        {agentStatus.lastPushAt
          ? 'Last push ' + relativeTime(agentStatus.lastPushAt.toString())
          : 'No push yet — see Settings > Agent'}
      </p>
    </div>
  {/if}
```

- [ ] **Step 3: Commit**

```bash
git add src/routes/broker/
git commit -m "feat: show local agent status card on broker sync page"
```

---

## Self-Review

**Spec coverage:**
- ✅ Customer PC agent that polls moomoo-service and pushes to server
- ✅ Per-user API key (AgentRegistration model)
- ✅ Push endpoint with Bearer auth
- ✅ Key rotation
- ✅ Settings page with setup guide
- ✅ Sleep/wake reconnect (retry loop in agent.py)
- ✅ Paper-trading reads from DB in SaaS mode
- ✅ Agent status visible on broker page
- ✅ Python agent with README

**Placeholder scan:** None found — all code is complete.

**Type consistency:**
- `AgentPushPayload` defined in `agent.service.ts` and used in push endpoint ✅
- `getLatestAgentPush` returns `AgentPushPayload & { pushedAt: Date }` — paper-trading reads `push.pushedAt` ✅
- `from_agent` and `agent_pushed_at` added to both server load and svelte component ✅
