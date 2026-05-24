# Behavioral Investor Profile Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/optimization/behavioral` dashboard that analyses past optimization runs and transaction history to derive the user's actual risk profile vs stated preference, showing 4 dimension scores, data evidence bullets, and recommended scenario weights for the optimizer.

**Architecture:** A pure TypeScript service (`behavioral-profile.service.ts`) reads `optimization_runs`, `transactions`, and `portfolio_snapshots` via Prisma `$queryRaw`, computes 4 behavioural dimension scores, derives an actual risk profile, and returns typed data to the SvelteKit page server. Four focused Svelte components render each panel from the mockup using existing CSS variable patterns (`var(--card)`, `var(--danger)`, etc.). A hub card is added to `/optimization` for discovery.

**Tech Stack:** SvelteKit, TypeScript, Prisma `$queryRaw` (MySQL), CSS variables (existing dark-mode theme), `lucide-svelte` icons

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/lib/services/behavioral-profile.service.ts` | Create | All analysis logic — score computation, evidence, weights |
| `src/routes/optimization/behavioral/+page.server.ts` | Create | SvelteKit `load` function — calls service, returns typed data |
| `src/routes/optimization/behavioral/+page.svelte` | Create | Main page — assembles 4 components + PageHeader |
| `src/lib/components/optimization/BehavioralSummaryStrip.svelte` | Create | 4 top stat cards (stated profile, actual profile, confidence, data points) |
| `src/lib/components/optimization/BehavioralDimensionScores.svelte` | Create | Left panel — 4 labelled progress bars with % |
| `src/lib/components/optimization/BehavioralEvidence.svelte` | Create | Right panel — bullet list with bold highlights |
| `src/lib/components/optimization/BehavioralScenarioWeights.svelte` | Create | Bottom panel — 3 weight cards + 3 parameter cards |
| `src/routes/optimization/+page.svelte` | Modify | Add "Behavioural Profile" hub card to the grid |

---

## Task 1: Behavioral Profile Service

**Files:**
- Create: `src/lib/services/behavioral-profile.service.ts`

- [ ] **Step 1: Create the service file with all types and the main export**

```typescript
// src/lib/services/behavioral-profile.service.ts
import { prisma } from '$lib/server/db';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DimensionColor = 'red' | 'amber' | 'green';

export type BehavioralDimension = {
  label: string;
  score: number;       // 0–100
  color: DimensionColor;
};

export type BehavioralEvidenceLine = {
  text: string;
  boldPart?: string;   // portion rendered in bold
};

export type ScenarioWeights = {
  aggressive: number;
  balanced: number;
  conservative: number;
  cashFloorPct: number;
  goalDefault: string;
  rebalanceTrigger: string;
};

export type BehavioralProfile = {
  statedProfile: string;   // most recent manual riskProfile selection
  actualProfile: string;   // derived from behaviour
  confidencePct: number;   // 0–100, based on data volume
  dataPoints: number;      // runs + transactions count
  dimensions: BehavioralDimension[];
  evidence: BehavioralEvidenceLine[];
  weights: ScenarioWeights;
};

// ─── Internal row types ───────────────────────────────────────────────────────

type RunRow = {
  portfolioMode: string;
  optimizationGoal: string;
  riskProfile: string;
  createdAt: Date;
};

type TxRow = {
  type: string;
  tradeDate: Date;
};

type SnapRow = {
  totalValue: number;
  cashBalance: number;
};

// ─── Main export ──────────────────────────────────────────────────────────────

export async function getBehavioralProfile(userId: string): Promise<BehavioralProfile> {
  const [runs, txRows, snaps, userRows] = await Promise.all([
    prisma.$queryRaw<RunRow[]>`
      SELECT portfolio_mode  AS portfolioMode,
             optimization_goal AS optimizationGoal,
             risk_profile    AS riskProfile,
             created_at      AS createdAt
      FROM   optimization_runs
      WHERE  user_id = ${userId}
      ORDER  BY created_at DESC
      LIMIT  50
    `,
    prisma.$queryRaw<TxRow[]>`
      SELECT type, trade_date AS tradeDate
      FROM   transactions
      WHERE  user_id = ${userId}
      ORDER  BY trade_date DESC
      LIMIT  200
    `,
    prisma.$queryRaw<SnapRow[]>`
      SELECT total_value   AS totalValue,
             cash_balance  AS cashBalance
      FROM   portfolio_snapshots
      WHERE  user_id = ${userId}
      ORDER  BY snapshot_date DESC
      LIMIT  30
    `,
    prisma.$queryRaw<Array<{ portfolioMode: string }>>`
      SELECT portfolioMode FROM \`user\` WHERE id = ${userId} LIMIT 1
    `,
  ]);

  const aggScore          = computeAggressiveness(runs);
  const fomoScore         = computeFomo(txRows);
  const shortTermScore    = computeShortTerm(txRows);
  const fullyInvestedScore = computeFullyInvested(snaps);

  const dimensions: BehavioralDimension[] = [
    { label: 'Aggressiveness',    score: aggScore,           color: dimColor(aggScore) },
    { label: 'FOMO buy pattern',  score: fomoScore,          color: dimColor(fomoScore) },
    { label: 'Short-term trading', score: shortTermScore,    color: dimColor(shortTermScore) },
    { label: 'Fully invested',    score: fullyInvestedScore, color: dimColor(fullyInvestedScore) },
  ];

  const weighted = aggScore * 0.4 + fomoScore * 0.2 + shortTermScore * 0.2 + fullyInvestedScore * 0.2;
  const actualProfile  = weighted >= 65 ? 'aggressive' : weighted >= 38 ? 'balanced' : 'conservative';
  const statedProfile  = deriveStated(runs, userRows[0]?.portfolioMode ?? 'stock');
  const dataPoints     = runs.length + txRows.length;
  const confidencePct  = Math.min(100, Math.round((dataPoints / 50) * 100));

  return {
    statedProfile,
    actualProfile,
    confidencePct,
    dataPoints,
    dimensions,
    evidence: buildEvidence(runs, txRows, snaps),
    weights:  buildWeights(actualProfile, runs),
  };
}

// ─── Score computers ──────────────────────────────────────────────────────────

function computeAggressiveness(runs: RunRow[]): number {
  if (runs.length === 0) return 0;
  const n = runs.filter(r => r.riskProfile === 'aggressive' || r.portfolioMode === 'options').length;
  return Math.round((n / runs.length) * 100);
}

function computeFomo(txs: TxRow[]): number {
  const buys = txs
    .filter(t => t.type === 'buy')
    .map(t => new Date(t.tradeDate).getTime())
    .sort((a, b) => a - b);
  if (buys.length < 2) return 0;
  let bursts = 0;
  for (let i = 1; i < buys.length; i++) {
    if ((buys[i] - buys[i - 1]) / 86_400_000 <= 3) bursts++;
  }
  return Math.min(100, Math.round((bursts / buys.length) * 100));
}

function computeShortTerm(txs: TxRow[]): number {
  if (txs.length === 0) return 0;
  const dates = txs.map(t => new Date(t.tradeDate).getTime()).sort((a, b) => a - b);
  const rangeDays    = Math.max(1, (dates[dates.length - 1] - dates[0]) / 86_400_000);
  const monthsActive = Math.max(1, rangeDays / 30);
  const tpm          = txs.length / monthsActive;   // trades per month
  return Math.min(100, Math.round((tpm / 10) * 100));
}

function computeFullyInvested(snaps: SnapRow[]): number {
  if (snaps.length === 0) return 50;
  const avgCashPct = snaps.reduce(
    (sum, s) => sum + (Number(s.totalValue) > 0 ? (Number(s.cashBalance) / Number(s.totalValue)) * 100 : 0),
    0
  ) / snaps.length;
  return Math.max(0, Math.min(100, Math.round(100 - avgCashPct)));
}

function dimColor(score: number): DimensionColor {
  return score >= 70 ? 'red' : score >= 45 ? 'amber' : 'green';
}

// ─── Stated profile ───────────────────────────────────────────────────────────

function deriveStated(runs: RunRow[], portfolioMode: string): string {
  if (runs.length > 0) return runs[0].riskProfile;
  if (portfolioMode === 'options') return 'aggressive';
  return 'balanced';
}

// ─── Evidence builder ─────────────────────────────────────────────────────────

function buildEvidence(runs: RunRow[], txs: TxRow[], snaps: SnapRow[]): BehavioralEvidenceLine[] {
  const lines: BehavioralEvidenceLine[] = [];

  // 1. Most frequent risk profile in runs
  if (runs.length > 0) {
    const counts = tally(runs.map(r => r.riskProfile));
    const [topMode, topCount] = topEntry(counts);
    lines.push({ text: `${topCount}/${runs.length} optimization runs guna mod `, boldPart: topMode });
  }

  // 2. Average interval between transactions
  if (txs.length >= 2) {
    const dates = txs.map(t => new Date(t.tradeDate).getTime()).sort((a, b) => a - b);
    const rangeDays    = Math.max(1, (dates[dates.length - 1] - dates[0]) / 86_400_000);
    const avgInterval  = Math.round(rangeDays / (txs.length - 1));
    const label = avgInterval <= 14 ? 'short-term trader' : avgInterval <= 60 ? 'medium-term trader' : 'long-term holder';
    lines.push({ text: 'Purata holding period: ', boldPart: `${avgInterval} hari (${label})` });
  }

  // 3. Cash ratio trend
  if (snaps.length > 0) {
    const avgCashPct = snaps.reduce(
      (sum, s) => sum + (Number(s.totalValue) > 0 ? (Number(s.cashBalance) / Number(s.totalValue)) * 100 : 0),
      0
    ) / snaps.length;
    const label = avgCashPct < 5 ? 'suka fully invested' : avgCashPct < 15 ? 'ada cash buffer' : 'suka pegang cash';
    lines.push({ text: 'Cash ratio trend: ', boldPart: `${avgCashPct.toFixed(1)}% — ${label}` });
  }

  // 4. FOMO burst pattern
  const buys = txs.filter(t => t.type === 'buy').map(t => new Date(t.tradeDate).getTime()).sort((a, b) => a - b);
  if (buys.length >= 2) {
    let bursts = 0;
    for (let i = 1; i < buys.length; i++) {
      if ((buys[i] - buys[i - 1]) / 86_400_000 <= 3) bursts++;
    }
    const pct = Math.round((bursts / buys.length) * 100);
    if (pct >= 20) {
      lines.push({ text: `${pct}% trades beli dalam kluster 3 hari — `, boldPart: 'momentum buyer' });
    }
  }

  // 5. Most frequent optimization goal
  if (runs.length > 0) {
    const [topGoal] = topEntry(tally(runs.map(r => r.optimizationGoal)));
    lines.push({ text: 'Goal paling kerap: ', boldPart: topGoal });
  }

  return lines;
}

// ─── Weights builder ──────────────────────────────────────────────────────────

function buildWeights(actualProfile: string, runs: RunRow[]): ScenarioWeights {
  const wMap: Record<string, { aggressive: number; balanced: number; conservative: number }> = {
    aggressive:   { aggressive: 60, balanced: 30, conservative: 10 },
    balanced:     { aggressive: 33, balanced: 34, conservative: 33 },
    conservative: { aggressive: 10, balanced: 30, conservative: 60 },
  };
  const w = wMap[actualProfile] ?? wMap.balanced;

  const cashMap:    Record<string, number> = { aggressive: 3, balanced: 5, conservative: 10 };
  const triggerMap: Record<string, string> = {
    aggressive:   'Momentum + threshold',
    balanced:     'Threshold rebalance',
    conservative: 'Calendar rebalance',
  };

  const topGoal = runs.length > 0
    ? topEntry(tally(runs.map(r => r.optimizationGoal)))[0]
    : 'maximum_sharpe';

  return {
    ...w,
    cashFloorPct:      cashMap[actualProfile] ?? 5,
    goalDefault:       topGoal,
    rebalanceTrigger:  triggerMap[actualProfile] ?? 'Threshold rebalance',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tally(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, v) => {
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});
}

function topEntry(counts: Record<string, number>): [string, number] {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? ['unknown', 0];
}
```

- [ ] **Step 2: Verify TypeScript compiles — no errors expected**

```powershell
cd c:\Ampps\www\portfolio
npx tsc --noEmit 2>&1 | Select-String "behavioral"
```
Expected: no output (no errors in this file).

- [ ] **Step 3: Commit**

```powershell
git add src/lib/services/behavioral-profile.service.ts
git commit -m "feat: add behavioral profile analysis service"
```

---

## Task 2: Page Server

**Files:**
- Create: `src/routes/optimization/behavioral/+page.server.ts`

- [ ] **Step 1: Create the directory and server file**

```typescript
// src/routes/optimization/behavioral/+page.server.ts
import { getDemoUser } from '$lib/server/demo-user';
import { getBehavioralProfile } from '$lib/services/behavioral-profile.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const user    = await getDemoUser();
  const profile = await getBehavioralProfile(user.id);
  return { profile };
};
```

- [ ] **Step 2: Verify type generation works**

```powershell
npx tsc --noEmit 2>&1 | Select-String "behavioral"
```
Expected: no output.

- [ ] **Step 3: Commit**

```powershell
git add src/routes/optimization/behavioral/+page.server.ts
git commit -m "feat: add behavioral profile page server"
```

---

## Task 3: BehavioralSummaryStrip Component

**Files:**
- Create: `src/lib/components/optimization/BehavioralSummaryStrip.svelte`

This renders the 4 top stat cards: **Profil dinyatakan**, **Profil sebenar**, **Confidence %** (with progress bar), **Data points**.

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/components/optimization/BehavioralSummaryStrip.svelte -->
<script lang="ts">
  export let statedProfile: string;   // e.g. 'balanced'
  export let actualProfile: string;   // e.g. 'aggressive'
  export let confidencePct: number;   // 0–100
  export let dataPoints: number;

  const profileColor: Record<string, string> = {
    aggressive:   'danger',
    balanced:     'primary',
    conservative: 'success',
  };

  $: statedColor  = profileColor[statedProfile]  ?? 'primary';
  $: actualColor  = profileColor[actualProfile]  ?? 'primary';
  $: mismatch     = statedProfile !== actualProfile;
</script>

<div class="strip">
  <!-- Stated profile -->
  <div class="card">
    <span class="label">Profil dinyatakan</span>
    <span class="chip {statedColor}">{statedProfile}</span>
    <span class="sub">Manual selection</span>
  </div>

  <!-- Actual profile -->
  <div class="card" class:alert={mismatch}>
    <span class="label">Profil sebenar</span>
    <span class="chip {actualColor}">{actualProfile}</span>
    <span class="sub">{mismatch ? 'Berbeza dari stated' : 'Sama dengan stated'}</span>
  </div>

  <!-- Confidence -->
  <div class="card">
    <span class="label">Confidence</span>
    <strong class="value">{confidencePct}%</strong>
    <div class="bar-wrap">
      <div class="bar-fill" style="width: {confidencePct}%"></div>
    </div>
  </div>

  <!-- Data points -->
  <div class="card">
    <span class="label">Data points</span>
    <strong class="value">{dataPoints}</strong>
    <span class="sub">runs + transaksi</span>
  </div>
</div>

<style>
  .strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 10px;
    margin-bottom: 16px;
  }
  .card {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--card);
    padding: 14px 16px;
    display: grid;
    gap: 5px;
  }
  .card.alert { border-color: rgba(var(--warning-rgb), 0.4); }
  .label { color: var(--muted); font-size: 0.62rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em; }
  .value { color: var(--text); font-size: 1.3rem; font-weight: 800; }
  .sub   { color: var(--muted); font-size: 0.65rem; }

  .chip {
    display: inline-block;
    align-self: start;
    font-size: 0.72rem;
    font-weight: 700;
    text-transform: capitalize;
    padding: 3px 10px;
    border-radius: 999px;
  }
  .chip.danger  { background: rgba(var(--danger-rgb),  0.15); color: var(--danger);  border: 1px solid rgba(var(--danger-rgb),  0.3); }
  .chip.primary { background: rgba(var(--primary-rgb), 0.12); color: var(--primary); border: 1px solid rgba(var(--primary-rgb), 0.3); }
  .chip.success { background: rgba(var(--success-rgb), 0.12); color: var(--success); border: 1px solid rgba(var(--success-rgb), 0.3); }

  .bar-wrap { height: 6px; background: var(--border); border-radius: 999px; overflow: hidden; }
  .bar-fill { height: 100%; background: var(--success); border-radius: 999px; transition: width 0.4s ease; }
</style>
```

- [ ] **Step 2: Commit**

```powershell
git add src/lib/components/optimization/BehavioralSummaryStrip.svelte
git commit -m "feat: add BehavioralSummaryStrip component"
```

---

## Task 4: BehavioralDimensionScores + BehavioralEvidence Components

**Files:**
- Create: `src/lib/components/optimization/BehavioralDimensionScores.svelte`
- Create: `src/lib/components/optimization/BehavioralEvidence.svelte`

- [ ] **Step 1: Create BehavioralDimensionScores**

```svelte
<!-- src/lib/components/optimization/BehavioralDimensionScores.svelte -->
<script lang="ts">
  import type { BehavioralDimension } from '$lib/services/behavioral-profile.service';
  export let dimensions: BehavioralDimension[];
</script>

<div class="panel">
  <div class="panel-head">Skor Dimensi</div>
  <div class="rows">
    {#each dimensions as dim}
      <div class="row">
        <span class="dim-label">{dim.label}</span>
        <div class="bar-wrap">
          <div
            class="bar-fill {dim.color}"
            style="width: {dim.score}%"
          ></div>
        </div>
        <span class="pct {dim.color}">{dim.score}%</span>
      </div>
    {/each}
  </div>
</div>

<style>
  .panel {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--card);
    padding: 16px;
    display: grid;
    gap: 14px;
  }
  .panel-head {
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }
  .rows   { display: grid; gap: 12px; }
  .row    { display: grid; grid-template-columns: 1fr 1fr auto; align-items: center; gap: 10px; }
  .dim-label { color: var(--text); font-size: 0.74rem; font-weight: 600; }
  .bar-wrap  { height: 8px; background: var(--border); border-radius: 999px; overflow: hidden; }
  .bar-fill  { height: 100%; border-radius: 999px; transition: width 0.5s ease; }
  .bar-fill.red   { background: var(--danger); }
  .bar-fill.amber { background: var(--warning); }
  .bar-fill.green { background: var(--success); }
  .pct { font-size: 0.74rem; font-weight: 800; text-align: right; }
  .pct.red   { color: var(--danger); }
  .pct.amber { color: var(--warning); }
  .pct.green { color: var(--success); }
</style>
```

- [ ] **Step 2: Create BehavioralEvidence**

```svelte
<!-- src/lib/components/optimization/BehavioralEvidence.svelte -->
<script lang="ts">
  import type { BehavioralEvidenceLine } from '$lib/services/behavioral-profile.service';
  export let evidence: BehavioralEvidenceLine[];
</script>

<div class="panel">
  <div class="panel-head">Bukti dari Data</div>
  {#if evidence.length === 0}
    <p class="empty">Run optimization dan tambah transaksi untuk jana analisis.</p>
  {:else}
    <ul class="list">
      {#each evidence as line}
        <li>
          {line.text}{#if line.boldPart}<strong>{line.boldPart}</strong>{/if}
        </li>
      {/each}
    </ul>
  {/if}
</div>

<style>
  .panel {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--card);
    padding: 16px;
    display: grid;
    gap: 14px;
  }
  .panel-head {
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }
  .list {
    margin: 0;
    padding: 0;
    list-style: none;
    display: grid;
    gap: 10px;
  }
  li {
    display: flex;
    gap: 8px;
    color: var(--muted);
    font-size: 0.74rem;
    line-height: 1.5;
  }
  li::before {
    content: '●';
    color: var(--primary);
    flex-shrink: 0;
    margin-top: 1px;
  }
  strong { color: var(--text); font-weight: 700; }
  .empty { margin: 0; color: var(--muted); font-size: 0.74rem; }
</style>
```

- [ ] **Step 3: Commit**

```powershell
git add src/lib/components/optimization/BehavioralDimensionScores.svelte
git add src/lib/components/optimization/BehavioralEvidence.svelte
git commit -m "feat: add BehavioralDimensionScores and BehavioralEvidence components"
```

---

## Task 5: BehavioralScenarioWeights Component

**Files:**
- Create: `src/lib/components/optimization/BehavioralScenarioWeights.svelte`

This renders the bottom panel with 3 scenario weight cards (Aggressive %, Balanced %, Conservative %) and 3 parameter cards (Cash floor, Goal default, Rebalance trigger).

- [ ] **Step 1: Create the component**

```svelte
<!-- src/lib/components/optimization/BehavioralScenarioWeights.svelte -->
<script lang="ts">
  import type { ScenarioWeights } from '$lib/services/behavioral-profile.service';
  export let weights: ScenarioWeights;
</script>

<div class="panel">
  <div class="panel-head">Pemberat Scenario Optimizer (Dicadangkan)</div>

  <div class="weights-grid">
    <div class="weight-card danger">
      <span class="wlabel">Aggressive</span>
      <strong class="wpct">{weights.aggressive}%</strong>
    </div>
    <div class="weight-card primary">
      <span class="wlabel">Balanced</span>
      <strong class="wpct">{weights.balanced}%</strong>
    </div>
    <div class="weight-card success">
      <span class="wlabel">Conservative</span>
      <strong class="wpct">{weights.conservative}%</strong>
    </div>
  </div>

  <div class="params-grid">
    <div class="param-card">
      <span class="plabel">Cash floor minimum</span>
      <strong class="pval">{weights.cashFloorPct}% <span class="note">(bukan {weights.cashFloorPct === 3 ? 5 : weights.cashFloorPct === 10 ? 5 : 3}%)</span></strong>
    </div>
    <div class="param-card">
      <span class="plabel">Goal default</span>
      <strong class="pval">{weights.goalDefault}</strong>
    </div>
    <div class="param-card">
      <span class="plabel">Rebalance trigger</span>
      <strong class="pval">{weights.rebalanceTrigger}</strong>
    </div>
  </div>

  <small class="guardrail">Cadangan sahaja — tidak mengubah optimization constraints secara automatik.</small>
</div>

<style>
  .panel {
    border: 1px solid var(--border);
    border-radius: 10px;
    background: var(--card);
    padding: 16px;
    display: grid;
    gap: 14px;
  }
  .panel-head {
    font-size: 0.62rem;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--muted);
  }

  /* Weight cards */
  .weights-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .weight-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    padding: 12px 14px;
    display: grid;
    gap: 4px;
    text-align: center;
  }
  .wlabel { color: var(--muted); font-size: 0.66rem; font-weight: 700; text-transform: uppercase; }
  .wpct   { font-size: 1.25rem; font-weight: 800; }
  .weight-card.danger  .wpct { color: var(--danger); }
  .weight-card.primary .wpct { color: var(--primary); }
  .weight-card.success .wpct { color: var(--success); }

  /* Parameter cards */
  .params-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
  .param-card {
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--bg);
    padding: 12px 14px;
    display: grid;
    gap: 4px;
  }
  .plabel { color: var(--muted); font-size: 0.62rem; font-weight: 700; text-transform: uppercase; }
  .pval   { color: var(--text); font-size: 0.78rem; font-weight: 700; }
  .note   { color: var(--muted); font-size: 0.65rem; font-weight: 400; }

  small.guardrail { color: var(--warning); font-size: 0.65rem; }
</style>
```

- [ ] **Step 2: Commit**

```powershell
git add src/lib/components/optimization/BehavioralScenarioWeights.svelte
git commit -m "feat: add BehavioralScenarioWeights component"
```

---

## Task 6: Main Page Assembly

**Files:**
- Create: `src/routes/optimization/behavioral/+page.svelte`

- [ ] **Step 1: Create the main page**

```svelte
<!-- src/routes/optimization/behavioral/+page.svelte -->
<script lang="ts">
  import { ArrowLeft } from 'lucide-svelte';
  import PageHeader from '$lib/components/portfolioai/PageHeader.svelte';
  import BehavioralSummaryStrip from '$lib/components/optimization/BehavioralSummaryStrip.svelte';
  import BehavioralDimensionScores from '$lib/components/optimization/BehavioralDimensionScores.svelte';
  import BehavioralEvidence from '$lib/components/optimization/BehavioralEvidence.svelte';
  import BehavioralScenarioWeights from '$lib/components/optimization/BehavioralScenarioWeights.svelte';
  import type { PageData } from './$types';

  export let data: PageData;
</script>

<PageHeader
  title="Behavioral Investor Profile"
  subtitle="Ringkasan Behavioral — analisis gaya pelaburan sebenar kamu dari data."
  breadcrumb={[
    { label: 'Optimization', href: '/optimization' },
    { label: 'Behavioral Profile' }
  ]}
/>

<div class="actions-bar">
  <a class="tab-btn" href="/optimization">
    <ArrowLeft size={13} /> Back to Engine
  </a>
</div>

<BehavioralSummaryStrip
  statedProfile={data.profile.statedProfile}
  actualProfile={data.profile.actualProfile}
  confidencePct={data.profile.confidencePct}
  dataPoints={data.profile.dataPoints}
/>

<div class="two-col">
  <BehavioralDimensionScores dimensions={data.profile.dimensions} />
  <BehavioralEvidence evidence={data.profile.evidence} />
</div>

<BehavioralScenarioWeights weights={data.profile.weights} />

<style>
  .actions-bar {
    display: flex;
    gap: 8px;
    margin-bottom: 16px;
  }
  .tab-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 6px;
    font-size: 0.72rem;
    font-weight: 700;
    color: var(--muted);
    background: var(--surface-1);
    border: 1px solid var(--border);
    text-decoration: none;
    transition: all 0.12s;
  }
  .tab-btn:hover { color: var(--text); border-color: var(--primary); }

  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-bottom: 12px;
  }

  @media (max-width: 640px) {
    .two-col { grid-template-columns: 1fr; }
  }
</style>
```

- [ ] **Step 2: Verify the page loads — navigate to `http://localhost:5175/optimization/behavioral`**

Expected: Page renders with 4 stat cards at top, two panels side by side (Skor Dimensi + Bukti dari Data), weights panel at bottom. If no data yet, scores will be 0 and evidence will show the empty message.

- [ ] **Step 3: Commit**

```powershell
git add src/routes/optimization/behavioral/+page.svelte
git commit -m "feat: add behavioral profile main page"
```

---

## Task 7: Add Hub Card to Optimization Index

**Files:**
- Modify: `src/routes/optimization/+page.svelte` (line ~185, after the last `OptimizationHubCard`)

- [ ] **Step 1: Add the hub card — insert after the Run History card (line ~184)**

Find this block in `src/routes/optimization/+page.svelte`:
```svelte
  <OptimizationHubCard
    icon="📋"
    name="Run History"
    description="Previous optimization runs and how your allocation targets have evolved over time."
    badge={historyBadge}
    badgeColor="blue"
    href="/optimization/history"
  />
</div>
```

Replace with:
```svelte
  <OptimizationHubCard
    icon="📋"
    name="Run History"
    description="Previous optimization runs and how your allocation targets have evolved over time."
    badge={historyBadge}
    badgeColor="blue"
    href="/optimization/history"
  />
  <OptimizationHubCard
    icon="🧠"
    name="Behavioral Profile"
    description="Discover your actual investor profile — derived from your optimization history and transaction patterns, not just what you say."
    badge="New"
    badgeColor="amber"
    href="/optimization/behavioral"
  />
</div>
```

- [ ] **Step 2: Verify — navigate to `http://localhost:5175/optimization`**

Expected: A new "🧠 Behavioral Profile" card appears in the hub grid with an amber "New" badge.

- [ ] **Step 3: Full end-to-end manual test**

1. Go to `http://localhost:5175/optimization`
2. Click **Behavioral Profile** card → lands on `/optimization/behavioral`
3. Check 4 stat cards render (even with 0 values if no data)
4. Check dimension bars show with correct colors (red ≥70, amber ≥45, green <45)
5. Check evidence bullets show (or empty message if no transactions)
6. Check weights panel shows 3 weight cards + 3 param cards

- [ ] **Step 4: Commit**

```powershell
git add src/routes/optimization/+page.svelte
git commit -m "feat: add Behavioral Profile hub card to optimization index"
```

---

## Self-Review

### 1. Spec Coverage (from mockup)
| Mockup element | Task |
|---------------|------|
| Header "Behavioral investor profile dashboard" + "RINGKASAN BEHAVIORAL" | Task 6 (PageHeader) |
| Profil dinyatakan chip | Task 3 (BehavioralSummaryStrip) |
| Profil sebenar chip | Task 3 (BehavioralSummaryStrip) |
| Confidence % + bar | Task 3 (BehavioralSummaryStrip) |
| Data points count | Task 3 (BehavioralSummaryStrip) |
| SKOR DIMENSI — 4 progress bars | Task 4 (BehavioralDimensionScores) |
| BUKTI DARI DATA — bullet list with bold | Task 4 (BehavioralEvidence) |
| PEMBERAT SCENARIO OPTIMIZER — 3 weight cards | Task 5 (BehavioralScenarioWeights) |
| Cash floor / Goal default / Rebalance trigger | Task 5 (BehavioralScenarioWeights) |
| Back to Engine nav link | Task 6 |
| Hub card entry point | Task 7 |

All spec elements covered. ✅

### 2. Placeholder Scan
No TBD, TODO, or vague steps found. All code is complete. ✅

### 3. Type Consistency
- `BehavioralDimension`, `BehavioralEvidenceLine`, `ScenarioWeights`, `BehavioralProfile` defined in Task 1 and used by name in Tasks 3–6. ✅
- `data.profile.statedProfile` etc. match the `BehavioralProfile` type fields exactly. ✅
- `dimColor()` returns `DimensionColor` which is `'red' | 'amber' | 'green'` — matches the CSS class names in both `BehavioralDimensionScores` (`.bar-fill.red`) and the `chip` color prop system. ✅
