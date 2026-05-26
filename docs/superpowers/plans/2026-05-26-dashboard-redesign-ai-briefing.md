# Dashboard Redesign + AI Daily Briefing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a full-width `DailyBriefingCard` hero at the top of `/dashboard`, showing 6 computed data cells (health score, day P&L, unrealised P&L, theta, market regime, top mover) plus a short AI-generated headline cached in the `ai_insights` DB table, regeneratable on demand via a form action.

**Architecture:** A new `briefing.service.ts` computes all briefing data server-side from data already present in the dashboard load; `+page.server.ts` assembles the briefing and adds a `generateBrief` form action that calls Claude Haiku (falling back gracefully to a rule-based sentence when no API key is set); `DailyBriefingCard.svelte` renders the card and manages the regenerate form internally. `AiBanner.svelte` is deleted — it is fully replaced.

**Tech Stack:** SvelteKit, TypeScript, Prisma (`$executeRaw` pattern), Anthropic Claude Haiku API (optional, graceful fallback), existing CSS variables.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/types/briefing.ts` | **Create** | `DailyBriefing`, `BriefingAlert`, `ParsedBriefingOption`, `PortfolioMover` types |
| `src/lib/services/briefing.service.ts` | **Create** | Health score, market regime, option parsing, alert logic, theta, top mover, `assembleBriefing`, `generateBriefHeadline` |
| `src/routes/dashboard/+page.server.ts` | **Modify** | Add `briefing` to load return; add `generateBrief` action; query briefing headline from DB |
| `src/lib/components/portfolioai/DailyBriefingCard.svelte` | **Create** | Full briefing card — 4 zones: headline, data grid, alerts strip, footer |
| `src/routes/dashboard/+page.svelte` | **Modify** | Replace `<AiBanner>` with `<DailyBriefingCard briefing={data.briefing} />`; update imports |
| `src/lib/components/portfolioai/AiBanner.svelte` | **Delete** | No longer needed |

---

## Task 1: Create `DailyBriefing` types

**Files:**
- Create: `src/lib/types/briefing.ts`

- [ ] **Step 1: Create the types file**

```typescript
// src/lib/types/briefing.ts

export type BriefingAlertType = 'warning' | 'success' | 'info';

export type BriefingAlert = {
  type: BriefingAlertType;
  text: string;
};

export type PortfolioMover = {
  symbol: string;
  changePercent: number; // e.g. -2.1 means -2.1%
};

export type ParsedBriefingOption = {
  symbol: string;
  underlying: string;
  optionType: 'call' | 'put';
  strike: number;
  expiration: string;   // YYYY-MM-DD
  dte: number;          // days to expiration
  premium: number;      // abs(marketValue)
  marketValue: number;
  unrealizedPnl: number;
  quantity: number;
};

export type DailyBriefing = {
  // AI-generated headline (null = not yet generated)
  aiHeadline: string | null;
  headlineGeneratedAt: string | null; // ISO timestamp

  // Computed server-side
  healthScore: number;                        // 0–100
  healthLabel: 'Good' | 'Moderate' | 'Weak';

  dayPl: number | null;     // null when no broker snapshot
  dayPlPct: number | null;

  unrealisedPnl: number;
  unrealisedPnlPct: number;

  thetaToday: number;    // 0 when no options
  optionsCount: number;

  marketRegime: 'Risk-On' | 'Neutral' | 'Risk-Off' | 'Bearish';
  vixLevel: number;

  topMover: PortfolioMover | null;

  alerts: BriefingAlert[]; // max 3
};
```

- [ ] **Step 2: Verify TypeScript sees the file**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep "briefing.ts"` from `c:/Ampps/www/portfolio`.
Expected: no output (no errors for the new file).

- [ ] **Step 3: Commit**

```bash
git add src/lib/types/briefing.ts
git commit -m "feat(briefing): add DailyBriefing types"
```

---

## Task 2: Create `briefing.service.ts`

**Files:**
- Create: `src/lib/services/briefing.service.ts`

**Context:** This service has no imports from `$env` — it receives env values as parameters so it can be unit-tested independently. All functions are pure except `generateBriefHeadline` which calls fetch.

- [ ] **Step 1: Create the service file**

```typescript
// src/lib/services/briefing.service.ts

import type { AllocationSlice, SnapshotHolding } from '$lib/types/portfolio';
import type {
  BriefingAlert,
  DailyBriefing,
  ParsedBriefingOption,
  PortfolioMover,
} from '$lib/types/briefing';

// ─── Health Score ─────────────────────────────────────────────────────────────

export function computeHealthScore(params: {
  top5Pct: number;
  topSectorPct: number;
  totalReturnPct: number;
}): { score: number; label: 'Good' | 'Moderate' | 'Weak' } {
  let score = 100;

  // Concentration penalty
  if (params.top5Pct >= 80) score -= 25;
  else if (params.top5Pct >= 65) score -= 15;
  else if (params.top5Pct >= 50) score -= 8;

  // Sector concentration penalty
  if (params.topSectorPct >= 50) score -= 20;
  else if (params.topSectorPct >= 40) score -= 10;
  else if (params.topSectorPct >= 35) score -= 5;

  // Drawdown penalty
  if (params.totalReturnPct <= -20) score -= 20;
  else if (params.totalReturnPct <= -10) score -= 10;
  else if (params.totalReturnPct <= -5) score -= 5;

  score = Math.max(0, Math.min(100, score));

  const label: 'Good' | 'Moderate' | 'Weak' =
    score >= 70 ? 'Good' : score >= 45 ? 'Moderate' : 'Weak';

  return { score, label };
}

// ─── Market Regime ────────────────────────────────────────────────────────────

export function computeMarketRegime(
  vix: number,
): 'Risk-On' | 'Neutral' | 'Risk-Off' | 'Bearish' {
  if (vix < 15) return 'Risk-On';
  if (vix < 20) return 'Neutral';
  if (vix <= 25) return 'Risk-Off';
  return 'Bearish';
}

// ─── Option Symbol Parsing ────────────────────────────────────────────────────

function normalizeStrike(raw: string): number {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  if (value >= 1000) return value / 1000;
  return value;
}

export function parseOptionsFromSnapshot(
  snapshotRows: SnapshotHolding[],
): ParsedBriefingOption[] {
  return snapshotRows
    .map((h) => {
      // Strip market suffix (e.g. "NIO260530C00005500.US" → "NIO260530C00005500")
      const local = (h.symbol.split('.').at(-1) ?? h.symbol).toUpperCase();
      const match = local.match(/^([A-Z]+)(\d{6})([CP])(\d+)$/);
      if (!match) return null;
      const [, underlying, rawDate, cp, rawStrike] = match;
      const year = 2000 + Number(rawDate.slice(0, 2));
      const month = Number(rawDate.slice(2, 4));
      const day = Number(rawDate.slice(4, 6));
      const expiration = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dte = Math.max(
        0,
        Math.ceil((new Date(expiration).getTime() - Date.now()) / 86_400_000),
      );
      return {
        symbol: h.symbol,
        underlying,
        optionType: cp === 'C' ? ('call' as const) : ('put' as const),
        strike: normalizeStrike(rawStrike),
        expiration,
        dte,
        premium: Math.abs(h.marketValue),
        marketValue: h.marketValue,
        unrealizedPnl: h.unrealizedPnl,
        quantity: h.quantity,
      };
    })
    .filter((p): p is ParsedBriefingOption => p !== null);
}

// ─── Options Data (theta + alerts) ───────────────────────────────────────────

export function computeOptionsData(options: ParsedBriefingOption[]): {
  thetaToday: number;
  optionsCount: number;
  alerts: BriefingAlert[];
} {
  const alerts: BriefingAlert[] = [];
  let thetaToday = 0;

  for (const opt of options) {
    // Rough daily theta estimate: premium / DTE (for short options, premium decays)
    if (opt.dte > 0) {
      thetaToday += Math.abs(opt.premium) / opt.dte;
    }

    // Alert: expiring in ≤5 days
    if (opt.dte <= 5 && alerts.filter((a) => a.type === 'warning').length < 2) {
      const typeLabel = opt.optionType === 'call' ? 'CC' : 'CSP';
      alerts.push({
        type: 'warning',
        text: `${opt.underlying} $${opt.strike} ${typeLabel} — expires in ${opt.dte} day${opt.dte !== 1 ? 's' : ''}`,
      });
    }

    // Alert: position at ≥75% profit
    // costBasis = marketValue − unrealizedPnl; profitPct = unrealizedPnl / |costBasis|
    const costBasis = opt.marketValue - opt.unrealizedPnl;
    if (costBasis !== 0 && opt.unrealizedPnl > 0) {
      const profitPct = Math.abs(opt.unrealizedPnl / costBasis);
      if (profitPct >= 0.75 && alerts.filter((a) => a.type === 'success').length < 1) {
        alerts.push({
          type: 'success',
          text: `${opt.underlying} ${opt.optionType} at ${(profitPct * 100).toFixed(0)}% profit — consider closing`,
        });
      }
    }
  }

  return { thetaToday, optionsCount: options.length, alerts };
}

// ─── Sector Alert ─────────────────────────────────────────────────────────────

export function computeSectorAlert(
  topSector: AllocationSlice | undefined,
): BriefingAlert | null {
  if (!topSector || topSector.percentage < 35) return null;
  return {
    type: 'info',
    text: `${topSector.label} allocation ${topSector.percentage.toFixed(0)}% — above 30% target`,
  };
}

// ─── Top Mover ────────────────────────────────────────────────────────────────

export function computeTopMover(snapshotRows: SnapshotHolding[]): PortfolioMover | null {
  // Filter out option positions (OCC symbol pattern)
  const stockRows = snapshotRows.filter((h) => {
    const local = (h.symbol.split('.').at(-1) ?? h.symbol).toUpperCase();
    return !local.match(/^[A-Z]+\d{6}[CP]\d+$/);
  });

  if (stockRows.length === 0) return null;

  const withPct = stockRows.map((h) => {
    const prevValue = h.marketValue - h.todayPl;
    const changePercent = prevValue !== 0 ? (h.todayPl / prevValue) * 100 : 0;
    return { symbol: h.symbol, changePercent };
  });

  withPct.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));
  return withPct[0] ?? null;
}

// ─── Assemble Briefing ────────────────────────────────────────────────────────

export function assembleBriefing(params: {
  snapshotRows: SnapshotHolding[];
  totalValue: number;
  totalReturnPct: number;
  dayPl: number | null;
  allocations: AllocationSlice[];
  aiHeadline: string | null;
  headlineGeneratedAt: string | null;
}): DailyBriefing {
  const { snapshotRows, totalValue, totalReturnPct, dayPl, allocations, aiHeadline, headlineGeneratedAt } = params;

  // top5Pct — top 5 non-option holdings as % of total value
  const stockRows = snapshotRows.filter((h) => {
    const local = (h.symbol.split('.').at(-1) ?? h.symbol).toUpperCase();
    return !local.match(/^[A-Z]+\d{6}[CP]\d+$/);
  });
  const top5Value = [...stockRows]
    .sort((a, b) => b.marketValue - a.marketValue)
    .slice(0, 5)
    .reduce((s, h) => s + h.marketValue, 0);
  const top5Pct = totalValue > 0 ? (top5Value / totalValue) * 100 : 0;

  const topSector = allocations[0];
  const topSectorPct = topSector?.percentage ?? 0;

  const { score: healthScore, label: healthLabel } = computeHealthScore({
    top5Pct,
    topSectorPct,
    totalReturnPct,
  });

  const options = parseOptionsFromSnapshot(snapshotRows);
  const { thetaToday, optionsCount, alerts: optionAlerts } = computeOptionsData(options);

  const sectorAlert = computeSectorAlert(topSector);
  const alerts = [...optionAlerts, ...(sectorAlert ? [sectorAlert] : [])].slice(0, 3);

  const topMover = computeTopMover(snapshotRows);

  const dayPlPct =
    dayPl !== null && totalValue - dayPl !== 0
      ? (dayPl / (totalValue - dayPl)) * 100
      : null;

  const unrealisedPnl = snapshotRows.reduce((s, h) => s + h.unrealizedPnl, 0);
  const costBasisTotal = snapshotRows.reduce(
    (s, h) => s + (h.marketValue - h.unrealizedPnl),
    0,
  );
  const unrealisedPnlPct = costBasisTotal > 0 ? (unrealisedPnl / costBasisTotal) * 100 : 0;

  const VIX = 18.2; // Phase 1: static placeholder

  return {
    aiHeadline,
    headlineGeneratedAt,
    healthScore,
    healthLabel,
    dayPl,
    dayPlPct,
    unrealisedPnl,
    unrealisedPnlPct,
    thetaToday,
    optionsCount,
    marketRegime: computeMarketRegime(VIX),
    vixLevel: VIX,
    topMover,
    alerts,
  };
}

// ─── AI Headline Generation ───────────────────────────────────────────────────

export async function generateBriefHeadline(
  params: {
    totalValue: number;
    healthScore: number;
    healthLabel: string;
    dayPl: number | null;
    topSectorLabel: string;
    topSectorPct: number;
    alerts: BriefingAlert[];
  },
  anthropicApiKey: string | undefined,
  claudeEnabled: boolean,
): Promise<string> {
  if (anthropicApiKey && claudeEnabled) {
    try {
      const dayPlStr =
        params.dayPl !== null
          ? `${params.dayPl >= 0 ? '+' : ''}$${Math.abs(params.dayPl).toFixed(2)}`
          : 'unknown';
      const alertSummary =
        params.alerts.map((a) => a.text).join('; ') || 'none';

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 80,
          messages: [
            {
              role: 'user',
              content: `Write a 1-2 sentence morning portfolio briefing. Be specific with numbers. Max 150 characters total. No greeting. No prefix.

Portfolio: value $${params.totalValue.toFixed(0)}, health ${params.healthScore}/100 (${params.healthLabel}), day P&L ${dayPlStr}, ${params.topSectorLabel} sector ${params.topSectorPct.toFixed(0)}%, alerts: ${alertSummary}.`,
            },
          ],
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          content?: { type: string; text: string }[];
        };
        const text = (data.content?.[0]?.text ?? '').trim();
        if (text.length > 0) return text.slice(0, 200);
      }
    } catch {
      // fall through to rule-based headline
    }
  }

  // Rule-based fallback
  const parts: string[] = [
    `Portfolio health is ${params.healthLabel.toLowerCase()} at ${params.healthScore}/100.`,
  ];
  if (params.alerts.length > 0) {
    parts.push(params.alerts[0].text + '.');
  }
  return parts.join(' ');
}
```

- [ ] **Step 2: Verify TypeScript sees no errors in the new service**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep "briefing.service"` from `c:/Ampps/www/portfolio`.
Expected: no output (no errors).

- [ ] **Step 3: Commit**

```bash
git add src/lib/services/briefing.service.ts
git commit -m "feat(briefing): add briefing.service — health score, options, alerts, assembly, headline"
```

---

## Task 3: Add briefing data to dashboard `load()`

**Files:**
- Modify: `src/routes/dashboard/+page.server.ts`

**Context:** The load function already computes `snapshotRows`, `totalValue`, `totalReturnPct`, `dayPl`, `allocations`. This task adds 3 new imports and one DB query + one `assembleBriefing` call at the end of `load()`. Nothing else changes.

- [ ] **Step 1: Add imports at the top of `+page.server.ts`**

Add these 4 lines after the existing imports (after the `import type { Actions }` line):

```typescript
import { randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { assembleBriefing, generateBriefHeadline } from '$lib/services/briefing.service';
import type { DailyBriefing } from '$lib/types/briefing';
```

- [ ] **Step 2: Add the brief headline DB query inside `load()`**

Inside `load()`, after the `const snapshots = await prisma.portfolioSnapshot...` block and before the `return {` statement, add:

```typescript
  // Brief headline — latest AI-generated brief (stored with title = 'Daily Brief')
  const briefInsight = await prisma.aiInsight
    .findFirst({
      where: { userId: user.id, title: 'Daily Brief' },
      orderBy: { createdAt: 'desc' },
      select: { summary: true, createdAt: true },
    })
    .catch(() => null);

  const briefing = assembleBriefing({
    snapshotRows,
    totalValue,
    totalReturnPct,
    dayPl,
    allocations,
    aiHeadline: briefInsight?.summary ?? null,
    headlineGeneratedAt: briefInsight?.createdAt?.toISOString() ?? null,
  });
```

- [ ] **Step 3: Add `briefing` to the return object**

In the `return {` block at the end of `load()`, add `briefing,` alongside the existing fields:

```typescript
  return {
    totalValue,
    totalPnl,
    totalReturn,
    totalReturnPct,
    costBasisTotal,
    realizedPnl,
    dividends,
    netInvested,
    dayPl,
    accounts,
    allocations,
    holdingAllocations,
    topHoldings,
    growthData,
    aiBrief,       // kept for now — removed in Task 7
    watchlistItems,
    snapshot,
    dataSource,
    snapshotDate,
    briefing,      // ← add this line
  };
```

- [ ] **Step 4: Verify no TypeScript errors**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "error|Error"` from `c:/Ampps/www/portfolio`.
Expected: 0 new errors in the dashboard files (pre-existing errors in other files are acceptable).

- [ ] **Step 5: Commit**

```bash
git add src/routes/dashboard/+page.server.ts
git commit -m "feat(briefing): add briefing computation to dashboard load()"
```

---

## Task 4: Add `generateBrief` form action

**Files:**
- Modify: `src/routes/dashboard/+page.server.ts`

**Context:** The existing `actions` object already has `refresh`. This task adds a `generateBrief` action alongside it. The action re-fetches the snapshot, assembles the briefing context, calls `generateBriefHeadline`, and saves the result to `ai_insights` with `title = 'Daily Brief'`. SvelteKit re-runs `load()` after the action, which picks up the new headline automatically.

- [ ] **Step 1: Add the `generateBrief` action to the `actions` object**

The existing `actions` object looks like:
```typescript
export const actions: Actions = {
  refresh: async () => { ... }
};
```

Add `generateBrief` alongside `refresh`:

```typescript
export const actions: Actions = {
  refresh: async () => {
    // ... existing refresh code unchanged ...
  },

  generateBrief: async () => {
    const user = await getDemoUser();

    // Re-fetch snapshot for latest data
    const snapshot = await getLatestSnapshot(user.id).catch(() => null);
    let snapshotRows: import('$lib/types/portfolio').SnapshotHolding[] = [];
    let totalValue = 0;
    if (snapshot) {
      try { snapshotRows = JSON.parse(snapshot.holdingsJson); } catch { snapshotRows = []; }
      totalValue = snapshot.totalValue;
    }

    // Minimal allocation map for headline context
    const sectorMap = new Map<string, number>();
    for (const h of snapshotRows) {
      const sector = (h as { sector?: string | null }).sector ?? 'Other';
      sectorMap.set(sector, (sectorMap.get(sector) ?? 0) + Math.abs(h.marketValue));
    }
    const allocationBase = [...sectorMap.values()].reduce((s, v) => s + v, 0);
    const allocations = [...sectorMap.entries()]
      .map(([label, value]) => ({
        label,
        value,
        percentage: allocationBase > 0 ? (value / allocationBase) * 100 : 0,
      }))
      .sort((a, b) => b.value - a.value);

    // Day P&L from snapshot rows
    const dayPl = snapshotRows.length > 0
      ? snapshotRows.reduce((s, h) => s + (h.todayPl ?? 0), 0)
      : null;

    // Compute total return for health score
    const unrealisedPnl = snapshotRows.reduce((s, h) => s + h.unrealizedPnl, 0);
    const costBasisTotal = snapshotRows.reduce((s, h) => s + (h.marketValue - h.unrealizedPnl), 0);
    const totalReturnPct = costBasisTotal > 0 ? (unrealisedPnl / costBasisTotal) * 100 : 0;

    const briefing = assembleBriefing({
      snapshotRows,
      totalValue,
      totalReturnPct,
      dayPl,
      allocations,
      aiHeadline: null,         // not needed — we're generating it
      headlineGeneratedAt: null,
    });

    const headline = await generateBriefHeadline(
      {
        totalValue,
        healthScore: briefing.healthScore,
        healthLabel: briefing.healthLabel,
        dayPl: briefing.dayPl,
        topSectorLabel: allocations[0]?.label ?? 'Portfolio',
        topSectorPct: allocations[0]?.percentage ?? 0,
        alerts: briefing.alerts,
      },
      env.ANTHROPIC_API_KEY,
      env.AI_PROVIDER_CLAUDE_ENABLED === 'true',
    );

    // Save to ai_insights table (upsert-style: insert fresh row)
    const id = randomUUID();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60_000); // 24 hours

    await prisma.$executeRaw`
      INSERT INTO ai_insights
        (id, userId, insightType, title, summary, riskLevel, contentJson, expiresAt, metadataJson, createdAt, updatedAt)
      VALUES (
        ${id}, ${user.id}, ${'portfolio_health'}, ${'Daily Brief'},
        ${headline}, ${'moderate'},
        ${JSON.stringify({ brief: headline })},
        ${expiresAt},
        ${JSON.stringify({ version: '1.0', type: 'daily_brief' })},
        ${now}, ${now}
      )
    `;

    return { briefGenerated: true };
  },
};
```

- [ ] **Step 2: Verify no TypeScript errors**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "(dashboard.*error|error.*dashboard)"` from `c:/Ampps/www/portfolio`.
Expected: 0 errors in dashboard files.

- [ ] **Step 3: Commit**

```bash
git add src/routes/dashboard/+page.server.ts
git commit -m "feat(briefing): add generateBrief form action to dashboard"
```

---

## Task 5: Create `DailyBriefingCard.svelte`

**Files:**
- Create: `src/lib/components/portfolioai/DailyBriefingCard.svelte`

**Context:** The component receives a `DailyBriefing` prop and manages its own `generating` boolean. It renders 4 zones: AI headline bar, 6-cell data grid, alerts strip, and footer with regenerate form. Uses `use:enhance` from `$app/forms` so the regenerate button shows a loading state without a full page reload.

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/components/portfolioai/DailyBriefingCard.svelte -->
<script lang="ts">
  import { enhance } from '$app/forms';
  import type { DailyBriefing } from '$lib/types/briefing';

  export let briefing: DailyBriefing;

  let generating = false;

  function money(n: number): string {
    return Math.abs(n).toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function signedMoney(n: number): string {
    return (n >= 0 ? '+' : '−') + money(n);
  }

  function pct(n: number, decimals = 2): string {
    return (n >= 0 ? '+' : '') + n.toFixed(decimals) + '%';
  }

  function fmtTime(iso: string): string {
    return new Date(iso).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  $: healthColor =
    briefing.healthScore >= 70
      ? 'var(--success)'
      : briefing.healthScore >= 45
        ? 'var(--warning)'
        : 'var(--danger)';

  $: healthIcon =
    briefing.healthScore >= 70 ? '✓' : briefing.healthScore >= 45 ? '⚠' : '⛔';

  $: dayPlColor =
    briefing.dayPl === null
      ? 'var(--muted)'
      : briefing.dayPl >= 0
        ? 'var(--success)'
        : 'var(--danger)';

  $: unrealisedColor =
    briefing.unrealisedPnl >= 0 ? 'var(--success)' : 'var(--danger)';

  $: thetaColor = briefing.thetaToday > 0 ? 'var(--success)' : 'var(--muted)';

  $: regimeColor =
    briefing.marketRegime === 'Risk-On'
      ? 'var(--success)'
      : briefing.marketRegime === 'Bearish' || briefing.marketRegime === 'Risk-Off'
        ? 'var(--danger)'
        : 'var(--text)';

  $: moverColor =
    briefing.topMover === null
      ? 'var(--muted)'
      : briefing.topMover.changePercent >= 0
        ? 'var(--success)'
        : 'var(--danger)';

  const dotColor = {
    warning: 'var(--warning)',
    success: 'var(--success)',
    info: 'var(--primary)',
  } as const;
</script>

<div class="card">

  <!-- ① AI HEADLINE BAR -->
  <div class="top">
    <div class="label-row">
      <span class="label-text">✦ AI MORNING BRIEFING</span>
      {#if briefing.headlineGeneratedAt}
        <span class="label-time">Generated {fmtTime(briefing.headlineGeneratedAt)}</span>
      {/if}
    </div>
    {#if briefing.aiHeadline}
      <p class="headline"><em>{briefing.aiHeadline}</em></p>
    {:else}
      <p class="headline-empty">No brief yet — click <strong>Regenerate brief</strong> below to generate your first morning briefing.</p>
    {/if}
  </div>

  <!-- ② DATA GRID — 6 cells -->
  <div class="grid">

    <!-- Health -->
    <div class="cell">
      <div class="cell-label">HEALTH</div>
      <div class="cell-val" style="color:{healthColor}">
        {briefing.healthScore}<span class="cell-denom">/100</span>
      </div>
      <div class="cell-sub">{briefing.healthLabel} {healthIcon}</div>
    </div>

    <!-- Day P&L -->
    <div class="cell">
      <div class="cell-label">DAY P&amp;L</div>
      <div class="cell-val" style="color:{dayPlColor}">
        {briefing.dayPl !== null ? signedMoney(briefing.dayPl) : '—'}
      </div>
      <div class="cell-sub">
        {briefing.dayPlPct !== null ? pct(briefing.dayPlPct) : 'No broker sync'}
      </div>
    </div>

    <!-- Unrealised -->
    <div class="cell">
      <div class="cell-label">UNREALISED</div>
      <div class="cell-val" style="color:{unrealisedColor}">{signedMoney(briefing.unrealisedPnl)}</div>
      <div class="cell-sub">{pct(briefing.unrealisedPnlPct)} total</div>
    </div>

    <!-- Theta -->
    <div class="cell">
      <div class="cell-label">THETA TODAY</div>
      <div class="cell-val" style="color:{thetaColor}">
        {briefing.thetaToday > 0 ? '+' + money(briefing.thetaToday) : '—'}
      </div>
      <div class="cell-sub">
        {briefing.optionsCount > 0
          ? briefing.optionsCount + ' contract' + (briefing.optionsCount !== 1 ? 's' : '')
          : 'No options'}
      </div>
    </div>

    <!-- Market Regime -->
    <div class="cell">
      <div class="cell-label">MARKET</div>
      <div class="cell-val cell-regime" style="color:{regimeColor}">{briefing.marketRegime}</div>
      <div class="cell-sub">VIX {briefing.vixLevel}</div>
    </div>

    <!-- Top Mover -->
    <div class="cell">
      <div class="cell-label">TOP MOVER</div>
      {#if briefing.topMover}
        <div class="cell-val cell-mover" style="color:{moverColor}">
          {briefing.topMover.symbol} {pct(briefing.topMover.changePercent, 1)}
        </div>
        <div class="cell-sub">Today</div>
      {:else}
        <div class="cell-val" style="color:var(--muted)">—</div>
        <div class="cell-sub">No snapshot</div>
      {/if}
    </div>

  </div>

  <!-- ③ ALERTS STRIP -->
  {#if briefing.alerts.length > 0}
    <div class="alerts">
      <span class="alerts-hdr">Alerts:</span>
      {#each briefing.alerts as alert}
        <div class="chip">
          <div class="dot" style="background:{dotColor[alert.type]}"></div>
          <span>{alert.text}</span>
        </div>
      {/each}
    </div>
  {/if}

  <!-- ④ FOOTER -->
  <div class="footer">
    <span class="footer-time">
      {#if briefing.headlineGeneratedAt}
        Brief at {fmtTime(briefing.headlineGeneratedAt)} · Based on latest snapshot
      {:else}
        Based on latest broker snapshot
      {/if}
    </span>
    <form
      method="POST"
      action="?/generateBrief"
      use:enhance={() => {
        generating = true;
        return async ({ update }) => {
          await update();
          generating = false;
        };
      }}
    >
      <button type="submit" class="regen-btn" disabled={generating}>
        {generating ? 'Generating…' : '↻ Regenerate brief'}
      </button>
    </form>
  </div>

</div>

<style>
  .card {
    background: #0f1a12;
    border: 1px solid rgba(var(--success-rgb), 0.25);
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 14px;
  }

  /* ① Headline bar */
  .top {
    padding: 14px 18px 12px;
    border-bottom: 1px solid rgba(var(--success-rgb), 0.12);
  }
  .label-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 7px;
  }
  .label-text {
    font-size: 0.6rem;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--success);
  }
  .label-time {
    font-size: 0.6rem;
    color: var(--muted);
    background: rgba(var(--success-rgb), 0.1);
    padding: 1px 7px;
    border-radius: 10px;
  }
  .headline {
    font-size: 0.82rem;
    color: var(--text);
    line-height: 1.5;
    margin: 0;
  }
  .headline-empty {
    font-size: 0.78rem;
    color: var(--muted);
    margin: 0;
  }

  /* ② Data grid */
  .grid {
    display: grid;
    grid-template-columns: repeat(6, 1fr);
    border-top: 1px solid rgba(var(--success-rgb), 0.1);
  }
  .cell {
    padding: 10px 14px;
    border-right: 1px solid rgba(var(--success-rgb), 0.1);
  }
  .cell:last-child { border-right: none; }
  .cell-label {
    font-size: 0.55rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--muted);
    margin-bottom: 4px;
  }
  .cell-val {
    font-size: 0.88rem;
    font-weight: 700;
    line-height: 1.2;
  }
  .cell-regime { font-size: 0.76rem; }
  .cell-mover  { font-size: 0.76rem; }
  .cell-denom  { font-size: 0.62rem; font-weight: 400; color: var(--muted); }
  .cell-sub {
    font-size: 0.6rem;
    color: var(--muted);
    margin-top: 3px;
  }

  /* ③ Alerts strip */
  .alerts {
    padding: 8px 18px;
    border-top: 1px solid rgba(var(--success-rgb), 0.1);
    display: flex;
    align-items: center;
    gap: 14px;
    flex-wrap: wrap;
    background: rgba(0, 0, 0, 0.15);
  }
  .alerts-hdr {
    font-size: 0.58rem;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.07em;
    color: var(--muted);
    flex-shrink: 0;
  }
  .chip {
    display: flex;
    align-items: center;
    gap: 5px;
    font-size: 0.65rem;
    color: var(--text);
  }
  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }

  /* ④ Footer */
  .footer {
    padding: 7px 18px;
    border-top: 1px solid rgba(var(--success-rgb), 0.1);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }
  .footer-time {
    font-size: 0.6rem;
    color: var(--muted);
  }
  .regen-btn {
    background: none;
    border: none;
    font-size: 0.65rem;
    color: var(--success);
    cursor: pointer;
    padding: 0;
    font-weight: 600;
    transition: opacity 0.15s;
  }
  .regen-btn:hover:not(:disabled) { opacity: 0.75; }
  .regen-btn:disabled { opacity: 0.45; cursor: not-allowed; }

  /* Responsive */
  @media (max-width: 860px) {
    .grid { grid-template-columns: repeat(3, 1fr); }
    .cell { border-bottom: 1px solid rgba(var(--success-rgb), 0.1); }
    .cell:nth-child(3) { border-right: none; }
    .cell:nth-child(4) { border-bottom: none; }
    .cell:nth-child(5) { border-bottom: none; }
    .cell:nth-child(6) { border-right: none; border-bottom: none; }
  }
  @media (max-width: 600px) {
    .grid { grid-template-columns: repeat(2, 1fr); }
    .cell:nth-child(2n) { border-right: none; }
    .cell:nth-child(3) { border-right: 1px solid rgba(var(--success-rgb), 0.1); border-bottom: 1px solid rgba(var(--success-rgb), 0.1); }
    .cell:nth-child(5) { border-right: 1px solid rgba(var(--success-rgb), 0.1); border-bottom: none; }
    .cell:nth-child(6) { border-bottom: none; }
    .alerts { gap: 8px; }
    .chip { font-size: 0.6rem; }
    .footer { flex-direction: column; align-items: flex-start; gap: 6px; }
  }
</style>
```

- [ ] **Step 2: Verify no TypeScript/Svelte errors in the new component**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep "DailyBriefingCard"` from `c:/Ampps/www/portfolio`.
Expected: no output (no errors for the new file).

- [ ] **Step 3: Commit**

```bash
git add src/lib/components/portfolioai/DailyBriefingCard.svelte
git commit -m "feat(briefing): add DailyBriefingCard component"
```

---

## Task 6: Update `+page.svelte` — replace AiBanner

**Files:**
- Modify: `src/routes/dashboard/+page.svelte`

**Context:** Two changes: (1) replace the `AiBanner` import with `DailyBriefingCard`, (2) replace the `<AiBanner>` usage with `<DailyBriefingCard>`. Nothing else changes — stat row, charts, insight cards, holdings, watchlist all stay untouched.

- [ ] **Step 1: Replace the AiBanner import**

Find this line near the top of `+page.svelte`:
```typescript
import AiBanner from '$lib/components/portfolioai/AiBanner.svelte';
```

Replace it with:
```typescript
import DailyBriefingCard from '$lib/components/portfolioai/DailyBriefingCard.svelte';
```

- [ ] **Step 2: Replace the `<AiBanner>` usage**

Find this line in the template:
```svelte
<AiBanner brief={data.aiBrief} />
```

Replace it with:
```svelte
<DailyBriefingCard briefing={data.briefing} />
```

- [ ] **Step 3: Verify no TypeScript/Svelte errors**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "(dashboard|DailyBrief|AiBanner)"` from `c:/Ampps/www/portfolio`.
Expected: no output (no errors for dashboard files, no stray AiBanner references).

- [ ] **Step 4: Manual smoke test**

Start the dev server: `npm run dev` from `c:/Ampps/www/portfolio`.
Open `http://localhost:5173/dashboard` in a browser.
Verify:
- `DailyBriefingCard` appears at the top, above the stat cards.
- 6 data cells are visible (Health, Day P&L, Unrealised, Theta, Market, Top Mover).
- "Regenerate brief" button is present in the footer.
- Clicking "Regenerate brief" shows "Generating…" state and then refreshes the headline.
- Stat cards, charts, insight cards, holdings, and watchlist are all still present below.

- [ ] **Step 5: Commit**

```bash
git add src/routes/dashboard/+page.svelte
git commit -m "feat(briefing): replace AiBanner with DailyBriefingCard in dashboard"
```

---

## Task 7: Cleanup — delete AiBanner, remove `aiBrief`

**Files:**
- Delete: `src/lib/components/portfolioai/AiBanner.svelte`
- Modify: `src/routes/dashboard/+page.server.ts` (remove `aiBrief` query and return field)

**Context:** `AiBanner` is only used in `+page.svelte` (confirmed — `grep -r "AiBanner" src/` returns only one file, now replaced in Task 6). The `aiBrief` field in the server load is also no longer needed.

- [ ] **Step 1: Delete `AiBanner.svelte`**

```bash
git rm src/lib/components/portfolioai/AiBanner.svelte
```

- [ ] **Step 2: Remove `aiBrief` from `+page.server.ts`**

Find and remove these lines in the `load()` function of `+page.server.ts`:

```typescript
  // Latest AI brief — use `summary` field from AiInsight
  const latestInsight = await prisma.aiInsight.findFirst({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    select: { summary: true },
  }).catch(() => null);

  const aiBrief = latestInsight?.summary?.slice(0, 300) ?? '';
```

Also remove `aiBrief,` from the `return { ... }` block.

- [ ] **Step 3: Verify no TypeScript/Svelte errors**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -E "(AiBanner|aiBrief)"` from `c:/Ampps/www/portfolio`.
Expected: no output (no remaining references to either).

- [ ] **Step 4: Final verification**

Run: `npx svelte-check --tsconfig tsconfig.json 2>&1 | grep -c "error"` from `c:/Ampps/www/portfolio`.
Expected: same count as before (0 new errors introduced by this feature).

Confirm `http://localhost:5173/dashboard` still loads correctly with the briefing card visible.

- [ ] **Step 5: Commit**

```bash
git add src/routes/dashboard/+page.server.ts
git commit -m "feat(briefing): remove AiBanner and aiBrief — replaced by DailyBriefingCard"
```

---

## Self-Review Checklist (for implementer)

Before calling this done, verify:

- [ ] `DailyBriefingCard` appears **above** the 4 stat cards on `/dashboard`
- [ ] All 6 cells render correctly: Health shows score/100, Day P&L shows `—` when no snapshot, Theta shows `—` when no options
- [ ] "Regenerate brief" button triggers `?/generateBrief` action and shows loading state
- [ ] After clicking Regenerate, the headline updates (from DB or fallback rule-based)
- [ ] Alerts strip is **hidden** when `briefing.alerts` is empty (no empty row)
- [ ] Mobile at 375px: grid shows 2 columns, chips wrap cleanly
- [ ] No console errors on page load
- [ ] `AiBanner.svelte` is fully gone — `git status` shows it as deleted
- [ ] `aiBrief` is fully removed from server load
