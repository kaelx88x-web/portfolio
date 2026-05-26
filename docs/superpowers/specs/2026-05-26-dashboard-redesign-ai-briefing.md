# Dashboard Redesign + AI Daily Briefing Design

**Date:** 2026-05-26
**Status:** Approved
**Goal:** Redesign `src/routes/dashboard/+page.svelte` with a new layout and replace the minimal `AiBanner` component with a rich `DailyBriefingCard` — a full-width hero at the top of the dashboard that shows computed portfolio data (health score, P&L, theta, alerts, market regime, watchlist mover) plus a short AI-generated headline cached in the database.

---

## Context

The current dashboard has a working foundation but two weaknesses:

1. **AI Banner is too thin** — `AiBanner.svelte` shows a 300-char text snippet from the last `AiInsight` DB record and 3 static suggested questions. It communicates nothing concrete about today's portfolio state.
2. **No at-a-glance briefing** — users must navigate to `/ai/copilot` or `/analytics/*` to understand what's happening in their portfolio right now. The dashboard should tell them immediately.

The redesign keeps all existing sections intact (stat cards, charts, insight cards, holdings, watchlist) but adds a `DailyBriefingCard` hero at the very top that provides instant portfolio situational awareness.

---

## Decisions Made

| Decision | Choice | Reason |
|----------|--------|--------|
| Scope | Full dashboard redesign + AI briefing | User confirmed |
| Layout | Briefing Hero (A) — full-width briefing at top, then stats | User confirmed |
| Generation approach | Hybrid — computed body + AI headline | Speed + intelligence balance |
| Briefing sections | All 6: health, P&L, theta, alerts, market, watchlist | User confirmed |
| Architecture | Replace AiBanner with DailyBriefingCard; new server action | Fits existing patterns |

---

## Layout Structure

Dashboard sections in order (top to bottom):

| # | Section | Change |
|---|---------|--------|
| — | Header (title + refresh button) | Keep, no change |
| ① | **Daily Briefing Card** | **New** — replaces AiBanner |
| ② | Stat Row (4 cards) | Keep, no change |
| ③ | Charts Row (growth + allocation) | Keep, no change |
| ④ | AI Insight Cards (3 cards) | Keep, no change |
| ⑤ | Top Holdings table | Keep, no change |
| ⑥ | Watchlist table | Keep, no change |

The welcome banner (beginner mode) appears above the briefing card, same as today.

---

## DailyBriefingCard Component

### File
`src/lib/components/portfolioai/DailyBriefingCard.svelte`

### Props
```typescript
export let briefing: DailyBriefing;  // see data structure below
export let generating = false;       // true while generateBrief action is running
```

### Visual Structure

```
┌─────────────────────────────────────────────────────────────────────────┐
│  ✦ AI MORNING BRIEFING  [Generated 08:42 AM]                            │
│  "Your portfolio is performing well today, but tech exposure at 41%     │
│   remains above your 30% target. One option expiring in 3 days."       │
├──────────┬──────────┬──────────┬──────────┬──────────┬─────────────────┤
│ HEALTH   │ DAY P&L  │UNREALISED│  THETA   │  MARKET  │    WATCHLIST    │
│ 74/100   │ +$82.40  │  +$3,218 │  +$12.40 │  Neutral │  NVDA −2.1%    │
│ Moderate │ +0.64%   │  +12.4%  │ 3 contracts│ VIX 18.2│  Top mover    │
├─────────────────────────────────────────────────────────────────────────┤
│ Alerts: ⚠ NIO $5.50 CC — expires in 3 days  ✓ RUM put at 78% profit   │
│          ℹ Tech allocation 41% — above 30% target                      │
├─────────────────────────────────────────────────────────────────────────┤
│ Brief generated at 08:42 AM · Based on latest broker snapshot  [↻ Regen]│
└─────────────────────────────────────────────────────────────────────────┘
```

### Zones

**Top zone** — AI headline bar:
- Label: `✦ AI MORNING BRIEFING` + timestamp badge
- Italic AI-generated sentence (1–2 sentences, 100–150 chars). Shows "No brief yet — click Regenerate." when empty.
- Background: `#0f1a12` (near-black green tint), border: `rgba(--success-rgb, 0.25)`

**Data grid** — 6 equal columns:
| Col | Label | Value source | Format |
|-----|-------|-------------|--------|
| 1 | HEALTH | `briefing.healthScore` | `74/100` + `Moderate ⚠` |
| 2 | DAY P&L | `briefing.dayPl` | `+$82.40` + `+0.64%` |
| 3 | UNREALISED | `briefing.unrealisedPnl` | `+$3,218` + `+12.4%` |
| 4 | THETA | `briefing.thetaToday` | `+$12.40` + `3 contracts` |
| 5 | MARKET | `briefing.marketRegime` | `Neutral` + `VIX 18.2` |
| 6 | WATCHLIST | `briefing.topWatchlistMover` | `NVDA −2.1%` + `Top mover` |

Colours: positive numbers → `--success`, negative → `--danger`, neutral → `--text`. Each col separated by subtle border.

**Alerts strip** — below the data grid:
- Shows up to 3 alert chips in one row (wraps on mobile)
- Each chip: coloured dot (warning yellow / ok green / info blue) + short text
- Alert types: option expiring ≤5 days (yellow), position at ≥75% profit (green), concentration/allocation flag (blue)
- Hidden if `briefing.alerts` is empty

**Footer bar**:
- Left: `Brief generated at HH:MM · Based on latest broker snapshot`
- Right: `↻ Regenerate brief` button — triggers `?/generateBrief` form action
- During generation: button shows `Generating…` and is disabled

---

## Data Structure

### `DailyBriefing` type (new, in `src/lib/types/briefing.ts`)

```typescript
export type BriefingAlert = {
  type: 'warning' | 'success' | 'info';
  text: string;
};

export type WatchlistMover = {
  symbol: string;
  changePercent: number;  // e.g. -2.1
};

export type DailyBriefing = {
  // AI-generated (from AiInsight DB, may be null)
  aiHeadline: string | null;
  headlineGeneratedAt: string | null;  // ISO timestamp

  // Computed server-side
  healthScore: number;           // 0–100
  healthLabel: 'Good' | 'Moderate' | 'Weak';

  dayPl: number | null;          // null when no broker snapshot
  dayPlPct: number | null;

  unrealisedPnl: number;
  unrealisedPnlPct: number;

  thetaToday: number;            // 0 when no options data
  optionsCount: number;          // number of open option contracts

  marketRegime: 'Risk-On' | 'Risk-Off' | 'Neutral' | 'Bearish';
  vixLevel: number;              // static value until real API; default 18.2

  topWatchlistMover: WatchlistMover | null;

  alerts: BriefingAlert[];       // up to 3 alerts
};
```

### Health Score Algorithm

Computed in `computeHealthScore()` helper in `+page.server.ts`:

```
Start at 100.

Deduct for concentration:
  top5Pct >= 80 → −25
  top5Pct >= 65 → −15
  top5Pct >= 50 → −8

Deduct for sector concentration:
  topSectorPct >= 50 → −20
  topSectorPct >= 40 → −10
  topSectorPct >= 35 → −5

Deduct for drawdown (totalReturnPct):
  totalReturnPct <= −20 → −20
  totalReturnPct <= −10 → −10
  totalReturnPct <= −5  → −5

Clamp to [0, 100].

Label:
  score >= 70 → 'Good'
  score >= 45 → 'Moderate'
  score < 45  → 'Weak'
```

### Market Regime Logic

Static computed flag based on `vixLevel` (no real API in Phase 1):

```
vix < 15        → 'Risk-On'
vix 15–20       → 'Neutral'
vix 20–25       → 'Risk-Off'
vix > 25        → 'Bearish'
```

`vixLevel` is hardcoded to `18.2` in Phase 1 (placeholder until live market API is added). Market regime will always show `Neutral` in Phase 1.

### Theta / Options

Theta income is computed from existing `options` or `transaction` data in the DB:
- Sum `premium` from open CSP/CC positions where `type = 'OPTION'` and status is open
- Divide by days-to-expiry to get rough daily theta estimate
- If no options data → `thetaToday = 0`, `optionsCount = 0`

### Alerts Logic

Computed alerts (max 3, priority ordered):

1. **Option expiring ≤5 days** (warning/yellow): Check options positions for `daysToExpiry <= 5`. Text: `"{symbol} {strike} {type} — expires in {n} days"`
2. **Position ≥75% profit** (success/green): Open option positions where `(premium − currentPrice) / premium >= 0.75`. Text: `"{symbol} {type} at {pct}% profit — consider closing"`
3. **Tech/sector overweight** (info/blue): `topSectorPct >= 35`. Text: `"{sector} allocation {pct}% — above {target}% target"`

---

## Server-Side Changes

### `+page.server.ts` — additions

**New `load()` return field: `briefing: DailyBriefing`**

The `load` function already fetches all the data needed to compute the briefing. New steps:

1. Fetch latest `AiInsight` with `type = 'brief'` (or fall back to any latest insight) → `aiHeadline`
2. Fetch open options positions from `prisma.transaction` where `assetType = 'OPTION'` and status open
3. Call `computeHealthScore(top5Pct, topSectorPct, totalReturnPct)` → `healthScore`
4. Call `computeAlerts(options, topSectorPct, topSector)` → `alerts[]`
5. Return assembled `DailyBriefing` object

**New form action: `generateBrief`**

```typescript
generateBrief: async () => {
  const user = await getDemoUser();
  // Build AI prompt: portfolio health, top holdings, sector allocation, alerts
  // Call AI orchestration (existing orchestrateAiRequest or direct Claude call)
  // Prompt: "Generate a 1-2 sentence morning briefing for this portfolio. 
  //          Be specific: mention actual numbers, top risk, and one action item.
  //          Keep it under 150 characters."
  // Save result to AiInsight table with type='brief'
  return { briefGenerated: true };
}
```

Uses existing `prisma.aiInsight.upsert` pattern. No new DB schema needed.

---

## File Changes Summary

| File | Change |
|------|--------|
| `src/lib/types/briefing.ts` | **Create** — `DailyBriefing`, `BriefingAlert`, `WatchlistMover` types |
| `src/lib/components/portfolioai/DailyBriefingCard.svelte` | **Create** — full briefing card component |
| `src/lib/components/portfolioai/AiBanner.svelte` | **Delete** — replaced by DailyBriefingCard |
| `src/routes/dashboard/+page.server.ts` | **Modify** — add briefing computation + `generateBrief` action |
| `src/routes/dashboard/+page.svelte` | **Modify** — replace `<AiBanner>` with `<DailyBriefingCard>`, add form enhance |

No new routes. No new DB tables. No new dependencies.

---

## CSS / Styling

`DailyBriefingCard.svelte` uses a scoped `<style>` block with existing CSS variables:

- Background tint: hardcoded `#0f1a12` (intentional dark green — same approach as AI Daily Briefing terminal card on landing page)
- Border: `rgba(var(--success-rgb), 0.25)`
- Grid separator: `rgba(var(--success-rgb), 0.1)`
- Alert dot colours: `var(--warning)` / `var(--success)` / `var(--primary)` for the three alert types
- All other text: `--text`, `--muted`, `--success`, `--danger`

---

## Mobile Responsive Rules

| Section | ≤860px | ≤600px |
|---------|--------|--------|
| Briefing data grid | 3×2 grid | 2×3 grid |
| Briefing alerts strip | wrap to 2 rows | 1 per row |
| Briefing footer | stack (time above regen) | stack |

---

## What This Does NOT Change

- Route structure — `/dashboard` stays
- Auth or server-side session — no change
- Other pages — zero impact outside dashboard
- DB schema — no migrations needed (`AiInsight` table already exists)
- Existing AI tools (`/ai/copilot`, `/ai/risk-advisor`, etc.)
- Stat cards, charts, insight cards, holdings table, watchlist table — kept as-is

---

## Out of Scope

- Real VIX / market regime API integration (Phase 2)
- Scheduled auto-generation of morning brief (Phase 2)
- Options theta computed from live broker data (requires options DB schema, separate feature)
- Push notifications for alerts
- Briefing history / archive page
