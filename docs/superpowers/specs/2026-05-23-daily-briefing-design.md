# Daily Portfolio Briefing AI — Design Spec (v3)

**Date:** 2026-05-23  
**Feature:** Daily Portfolio Briefing AI — Phase 1: Stock Portfolio Focus  
**Route:** `/ai/daily-briefing`  
**Status:** Approved for implementation

---

## Overview

A daily human-readable portfolio briefing for stock holdings. Markov chains (3-state transition model + stationary distribution) drive market regime classification and position sizing signals. Claude receives the computed Markov output and writes the human-friendly narrative and recommendations.

Phase 1: **stock positions only** (NIO, SCHG, SPYT, etc.).  
Options Screener, Wheel Tracker, Portfolio Health dashboard → Phase 2+.  
This is read-only and advisory. No trades execute automatically.

---

## Markov Chain — Market Regime Engine

### States

```
Bull      — uptrend, high confidence, full position sizing
Sideways  — consolidation, uncertain, reduced sizing
Bear      — downtrend, defensive, minimal or no new positions
```

### Transition Matrix (historically calibrated)

Rows = current state. Columns = tomorrow's state.

```
          Bull    Side    Bear
Bull      0.82    0.15    0.03
Sideways  0.40    0.35    0.25
Bear      0.05    0.20    0.75
```

Properties:
- **Stickiness**: Bull stays Bull 82% of the time. Bear stays Bear 75%. Markets trend.
- **Asymmetry**: Recovery (Bear→Bull) is slow (5%). Crashes (Bull→Bear) are rare but fast (3%).
- **Sideways as buffer**: Acts as an intermediate transition zone.

### Signal Generation Formula

```
signal = P(Bull_t+1) − P(Bear_t+1)
```

Where `[P(Bull), P(Side), P(Bear)]_t+1 = state_vector_t × transition_matrix`

| Signal range | Interpretation | Position recommendation |
|---|---|---|
| > +0.50 | Strong Bull | Full position / aggressive |
| +0.20 to +0.50 | Mild Bull | Normal position |
| 0 to +0.20 | Uncertain | Reduced position — watch |
| < 0 | Bear / Risk-Off | No new positions — manage existing |

**Example — Scenario A (Sticky Bull):**
```
state_vector = [0.80, 0.15, 0.05]  (80% bull confidence today)
tomorrow     = [0.80, 0.15, 0.05] × matrix
             ≈ [0.68, 0.17, 0.05]  (loosely)
signal       = 0.80 − 0.05 = +0.75  → STRONG BUY signal
position_pct = 75% of available capital
```

**Example — Scenario B (Regime Shift):**
```
state_vector = [0.30, 0.25, 0.45]  (uncertainty detected)
signal       = 0.30 − 0.45 = −0.15 → DEFENSIVE
position_pct = 15% — cut exposure, no new entries
```

### Stationary Distribution (Long-term DCA view)

Compute `M^n` as `n → ∞` (matrix exponentiation, typically converges by n=50).

```
stationary ≈ [0.41, 0.22, 0.37]
```

Interpretation: Over the long run, markets are Bull ~41% of the time, Sideways ~22%, Bear ~37%.  
Used in briefing to show: *"Historically, you are in the [Bear] phase (~37% of time). DCA into dips is statistically sound."*

### Regime Detection from Observables (HMM-lite)

Observable signals update the current state belief vector:

| Observable | Effect |
|---|---|
| VIX > 25 | shifts probability toward Bear |
| VIX 15–25 | neutral |
| VIX < 15 | shifts toward Bull |
| Breadth negative | shifts toward Bear |
| Breadth positive | shifts toward Bull |
| Portfolio today P&L < -2% | shifts toward Bear |
| Portfolio today P&L > +1% | shifts toward Bull |

Update formula: `posterior = prior × likelihood / normalise`  
This is a simplified Bayesian observation update (HMM emission step).

---

## Markov Chain — Portfolio Health Engine

### States

```
Healthy   — portfolio performing, adequate cash, low concentration risk
Moderate  — some stress indicators, manageable
Stressed  — multiple risk factors present, action required
```

### Transition Matrix

```
              Healthy   Moderate   Stressed
Healthy       0.80      0.18       0.02
Moderate      0.30      0.55       0.15
Stressed      0.10      0.30       0.60
```

### Observations (from live moomoo holdings)

| Metric | Pushes toward |
|---|---|
| unrealizedPnl > +3% | Healthy |
| unrealizedPnl 0% to +3% | Moderate |
| unrealizedPnl < -5% | Stressed |
| cashBuffer > 15% | Healthy |
| cashBuffer < 5% | Stressed |
| topHolding > 50% of portfolio | Stressed (concentration) |
| topHolding < 30% | Healthy |

**Health score (0–100):**
```
score = P(Healthy) × 100 + P(Moderate) × 55 + P(Stressed) × 10
```

**Health label mapping:**
| Score | Label |
|---|---|
| 80–100 | Excellent |
| 65–79 | Good |
| 45–64 | Moderate |
| 25–44 | Risky |
| 0–24 | Critical |

---

## Architecture & Data Flow

```
moomoo broker service
  → live stock holdings (symbol, qty, avg cost, market price, unrealizedPnl, todayPl)
  → account info (cash, total assets)

markov-regime.service.ts
  → initialises state vector from mock observables (VIX 22.4, breadth: negative)
  → applies HMM observation update
  → multiplies by transition matrix → tomorrow's probabilities
  → computes signal = P(Bull) - P(Bear)
  → computes stationary distribution (M^50)
  → returns: { state, signal, confidence, vector, stationary, positionPct }

markov-health.service.ts
  → computes observations from live holdings
  → initialises state vector from observations
  → applies transition matrix
  → computes health score
  → returns: { state, score, healthLabel, vector }

daily-briefing.service.ts
  → collects: holdings + regime result + health result
  → passes to Claude:
      - current regime state + signal strength
      - health state + score
      - position list with P&L
      - stationary distribution insight
      - DCA opportunity flag (bear phase + stationary says ~37% of time)
  → Claude returns: greeting, position notes, marketPulse narrative, finalDecision text
  → merges and returns BriefingResult (cached 10 min)

+page.server.ts  → load() → BriefingResult
+page.svelte     → mobile-first layout
```

---

## Types

```ts
type RegimeState  = 'Bull' | 'Sideways' | 'Bear';
type HealthState  = 'Healthy' | 'Moderate' | 'Stressed';
type HealthLabel  = 'Excellent' | 'Good' | 'Moderate' | 'Risky' | 'Critical';

type MarkovRegimeResult = {
  state: RegimeState;
  signal: number;          // P(Bull) - P(Bear), range -1 to +1
  confidence: number;      // 0–1
  vector: [number, number, number];       // [Bull, Sideways, Bear]
  stationary: [number, number, number];  // long-run distribution
  positionPct: number;     // recommended position sizing %
  positionLabel: string;   // "Full position" | "Reduced" | "Defensive"
};

type MarkovHealthResult = {
  state: HealthState;
  label: HealthLabel;
  score: number;           // 0–100
  vector: [number, number, number];  // [Healthy, Moderate, Stressed]
};

type PositionSummary = {
  symbol: string;
  name: string;
  quantity: number;
  marketValue: number;
  unrealizedPnl: number;
  todayPl: number;
  note: string;            // Claude-written one-liner
};

export type BriefingResult = {
  greeting: string;
  generatedAt: string;
  regime: MarkovRegimeResult;
  health: MarkovHealthResult;
  netUnrealizedPnl: number;
  thetaEstimate: number;       // 0 in phase 1 (shows "--")
  premiumCollected: number;    // 0 in phase 1 (shows "--")
  positions: PositionSummary[];
  marketPulse: string;         // Claude-written narrative
  dcaInsight: string;          // Claude-written stationary distribution insight
  finalDecision: {
    action: string;
    reasoning: string;
    signal: number;            // raw Markov signal for display
    allowNewPositions: boolean;
  };
};
```

---

## New Files

| File | Purpose |
|---|---|
| `src/lib/services/markov-regime.service.ts` | 3-state transition matrix, signal formula, stationary distribution, HMM-lite observation update |
| `src/lib/services/markov-health.service.ts` | 3-state portfolio health, score formula, label mapping |
| `src/lib/services/daily-briefing.service.ts` | Orchestrator: fetches holdings, runs Markov engines, calls Claude, caches result |
| `src/routes/ai/daily-briefing/+page.server.ts` | `load()` + `refresh` action |
| `src/routes/ai/daily-briefing/+page.svelte` | Mobile-first briefing UI |
| `src/lib/components/ai/DailyBriefingMiniCard.svelte` | Compact dashboard card |

---

## UI Layout (Mobile-first, matching screenshot)

```
┌─────────────────────────────────────┐
│ Good morning, Azhar                 │
│                      [Bearish 📉]   │
│ Portfolio health: ● Moderate        │
│ needs attention                     │
├─────────────────────────────────────┤
│  Net P&L   │  Theta   │  Premium    │
│  -$31.82   │  --      │  --         │
│  (red)     │  (grey)  │  (grey)     │
├─────────────────────────────────────┤
│ MARKOV SIGNAL ━━━━━━━━━━━━━━━━━━━   │
│ Bull 30%  │ Side 25% │ Bear 45%     │
│ Signal: -0.15  → Defensive          │
│ ████░░░░░░░░░ (signal bar)          │
├─────────────────────────────────────┤
│ POSITIONS                           │
│ NIO    100 shares   -$105   unreal  │
│ SCHG   ETF Growth   -$1.10  LT hold │
│ SPYT   ETF Income   -$0.35  div 12% │
├─────────────────────────────────────┤
│ MARKET PULSE                        │
│ VIX elevated at 22.4.               │
│ Market breadth negative.            │
│ Avoid opening new positions today.  │
│ [████████████░░] VIX 22.4           │
├─────────────────────────────────────┤
│ DCA INSIGHT                         │
│ Historically Bear ~37% of time.     │
│ Accumulating at dips is sound.      │
├─────────────────────────────────────┤
│ [ ○ Ask portfolio anything ↑ ]      │
└─────────────────────────────────────┘
```

**Styling:** `#111318` background, card sections with `#1c2030` bg + `#252d40` borders.  
Green `#4ade80`, Red `#f87171`, Amber `#fbbf24`, Muted `#4b5a72`.  
Signal bar: filled green (bull) → grey (side) → filled red (bear).  
Mobile first, stacks cleanly at 375px width.

---

## Modified Files

- `src/routes/ai/+page.svelte` — add Daily Briefing button to actions row
- `src/routes/dashboard/+page.svelte` + `+page.server.ts` — add `DailyBriefingMiniCard`

---

## Error Handling

- Moomoo disconnected → show warning, prompt to connect broker
- Claude API fails → show error state with Retry button; Markov results still displayed
- Claude malformed JSON → fallback: show Markov data, suppress narrative fields

---

## Out of Scope — Phase 1

- Options alerts, covered call / short put tracking
- Options Screener
- Wheel Strategy Tracker
- Separate Portfolio Health dashboard page
- Real-time VIX / breadth API (mock values in phase 1)
- Persistent briefing history / log
- Automated DCA execution
- Push notifications
