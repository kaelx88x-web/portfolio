# Daily Portfolio Briefing AI — Design Spec (v2)

**Date:** 2026-05-23  
**Feature:** Daily Portfolio Briefing AI — Phase 1: Stock Portfolio Focus  
**Route:** `/ai/daily-briefing`  
**Status:** Approved for implementation

---

## Overview

A daily human-readable portfolio briefing for stock holdings, styled as a mobile-first morning report from an AI financial coach. Markov chains classify portfolio health state and market regime. Claude receives the computed states and writes the narrative, recommendations, and final decision.

Phase 1 scope: **stock positions only** (NIO, SCHG, SPYT, etc.).  
Options Screener, Wheel Tracker, and Portfolio Health dashboard are out of scope for Phase 1.

This is a read-only advisory feature. No trades are placed automatically.

---

## Architecture & Data Flow

```
moomoo broker service
  → live stock holdings (symbol, quantity, avg cost, market price, unrealized P&L, today P&L)

MarkovRegimeEngine
  → inputs: mock VIX delta, breadth signal, price momentum
  → output: regime state vector + current regime label
  → states: Bullish | Neutral | Bearish | HighVolatility | RiskOff

MarkovHealthEngine
  → inputs: unrealized P&L %, cash buffer %, concentration (top holding %), today P&L %
  → output: health state probability vector + current health label
  → states: Excellent | Good | Moderate | Risky | Critical

            ↓
daily-briefing.service.ts
  → assembles: holdings + regime state + health state
  → sends to Claude: computed states + raw holdings data
  → Claude writes: greeting, position summaries, market pulse narrative, final decision text
  → returns typed BriefingResult

+page.server.ts  → load() calls service, returns BriefingResult (cached 10 min)
+page.svelte     → renders mobile-first layout (matching screenshot design)
```

---

## Markov Chain Design

### MarkovRegimeEngine

**States (5):** `Bullish`, `Neutral`, `Bearish`, `HighVolatility`, `RiskOff`

**Observations (inputs):**
- `vixDelta`: change in VIX today (mock phase 1)
- `breadth`: -1 (negative) | 0 (neutral) | 1 (positive)  (mock phase 1)
- `momentum`: portfolio weighted price momentum over 5 days

**Transition matrix:** Preset probabilities encoding regime stickiness (e.g. Bearish has 60% chance of staying Bearish, 25% Neutral, 15% HighVolatility). Observations shift the probability vector via Bayes update.

**Output:** `{ state: 'Bearish', confidence: 0.74, vector: [0.04, 0.12, 0.74, 0.08, 0.02] }`

---

### MarkovHealthEngine

**States (5):** `Excellent`, `Good`, `Moderate`, `Risky`, `Critical`

**Observations (inputs from live holdings):**
- `unrealizedPnlPct`: total unrealized P&L as % of portfolio value
- `cashBufferPct`: cash as % of total assets
- `concentrationPct`: largest single holding as % of portfolio
- `todayPlPct`: today's P&L as % of portfolio value

**Scoring rules (map observations → state):**
| Condition | Score toward state |
|---|---|
| unrealizedPnl > +5% | Excellent |
| unrealizedPnl 0% to +5% | Good |
| unrealizedPnl -5% to 0% | Moderate |
| unrealizedPnl -5% to -15% | Risky |
| unrealizedPnl < -15% | Critical |
| concentration > 50% | adds Risky pressure |
| cashBuffer < 5% | adds Risky pressure |
| cashBuffer > 20% | adds Good pressure |

**Transition matrix:** Health state is sticky (70% self-transition). Observations update the probability vector. Final state = argmax of posterior.

**Output:** `{ state: 'Moderate', confidence: 0.68, score: 62, vector: [0.03, 0.18, 0.68, 0.09, 0.02] }`

---

## Types

```ts
type RegimeState = 'Bullish' | 'Neutral' | 'Bearish' | 'HighVolatility' | 'RiskOff';
type HealthState = 'Excellent' | 'Good' | 'Moderate' | 'Risky' | 'Critical';

type MarkovResult<T extends string> = {
  state: T;
  confidence: number;      // 0–1
  score: number;           // 0–100 numeric score
  vector: number[];        // probability over all states
};

type PositionSummary = {
  symbol: string;
  name: string;
  quantity: number;
  marketValue: number;
  unrealizedPnl: number;
  todayPl: number;
  note: string;            // Claude-generated one-liner e.g. "long term hold"
};

type BriefingResult = {
  greeting: string;
  generatedAt: string;
  health: MarkovResult<HealthState>;
  regime: MarkovResult<RegimeState>;
  netUnrealizedPnl: number;
  thetaEstimate: number;       // 0 for stock-only phase; shows "--" in UI
  premiumCollected: number;    // 0 for stock-only phase; shows "--" in UI
  positions: PositionSummary[];
  marketPulse: string;         // Claude-generated narrative paragraph
  finalDecision: {
    action: string;            // short label e.g. "Manage existing positions only"
    reasoning: string;         // plain-language explanation
    allowNewPositions: boolean;
  };
};
```

---

## New Files

### `src/lib/services/markov-regime.service.ts`
Implements `MarkovRegimeEngine`. Exports `getMarketRegime(): MarkovResult<RegimeState>`.  
Phase 1: uses mock VIX (22.4) and mock breadth (-1). Transition matrix hardcoded.  
`// TODO: replace mock inputs with real market data API`

### `src/lib/services/markov-health.service.ts`
Implements `MarkovHealthEngine`. Exports `getPortfolioHealth(holdings, accountInfo): MarkovResult<HealthState>`.  
Computes observations from live moomoo holdings, applies transition matrix, returns state + score.

### `src/lib/services/daily-briefing.service.ts`
Main orchestrator:
1. Fetches live holdings from moomoo broker service
2. Calls `getPortfolioHealth()` → health state
3. Calls `getMarketRegime()` → regime state
4. Builds Claude prompt with: computed states + raw holdings JSON
5. Claude returns `BriefingResult` fields (greeting, position notes, marketPulse, finalDecision)
6. Merges Claude output with computed Markov fields
7. Returns complete `BriefingResult`

**Cache:** In-memory map keyed by `userId + date string`, TTL 10 minutes.

### `src/routes/ai/daily-briefing/+page.server.ts`
- `load()` → calls `getDailyBriefing(userId)`, returns `BriefingResult`
- `actions: { refresh }` → clears cache entry and redirects

### `src/routes/ai/daily-briefing/+page.svelte`
Mobile-first layout matching the screenshot design:

```
┌─────────────────────────────────┐
│ Good morning, Azhar             │
│ [Bearish regime badge]          │
│ Portfolio health: Moderate ●    │
├─────────────────────────────────┤
│ Net P&L   │ Theta   │ Premium   │
│ -$31.82   │ +$4.20  │ $18.50    │
├─────────────────────────────────┤
│ POSITIONS                       │
│ NIO  100 shares   -$105  unreal │
│ NIO CC  CC $5.50  +$8.50/day   │
│ SCHG  ETF Growth  -$1.10 LT    │
│ SPYT  ETF Income  -$0.35       │
├─────────────────────────────────┤
│ MARKET PULSE                    │
│ [VIX bar + narrative text]      │
│ VIX 22.4                        │
├─────────────────────────────────┤
│ [ ○ Ask portfolio anything ↑ ]  │
└─────────────────────────────────┘
```

**Styling:** Dark background `#111318`, card sections with subtle borders, green for gains, red for losses, amber for caution. Status dot for health. Bottom sticky "Ask portfolio" bar linking to AI Copilot.

### `src/lib/components/ai/DailyBriefingMiniCard.svelte`
Purely presentational compact card for the dashboard. Props: `briefing: BriefingResult | null`. Shows health badge, net P&L, regime label, and link to `/ai/daily-briefing`.

---

## Modified Files

### `src/routes/ai/+page.svelte`
Add Daily Briefing button to the `.page-actions` row.

### `src/routes/dashboard/+page.svelte` + `+page.server.ts`
Dashboard `load()` calls `getDailyBriefing(userId)` (cached). Passes result to `DailyBriefingMiniCard`.

---

## Error Handling

- **Moomoo not connected** → shows warning state, disables Markov health engine, shows "Connect broker to generate briefing"
- **Claude API fails** → error state with Retry button
- **Claude returns malformed JSON** → service catches, returns safe fallback with Markov-computed fields intact and `finalDecision.reasoning: "Unable to generate narrative. Markov analysis still available."`

---

## Out of Scope — Phase 1

- Options alerts (covered call / short put tracking)
- Options Screener
- Wheel Strategy Tracker
- Portfolio Health dashboard (separate page)
- Real-time market data API (VIX, breadth)
- Persistent briefing history
- Push notifications / scheduled generation
- Auto-trading or order placement
