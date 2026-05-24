# Approval-Based Trade Execution Design

> **Status:** Approved for implementation — 2026-05-24
> **Scope:** Rebalance page + Options page → user-approved paper trade execution

---

## Goal

Allow users to execute rebalance suggestions and options candidates (covered calls, CSPs) directly from within the optimization pages, with an inline confirmation step before any order is sent to Moomoo paper trading.

## Architecture

Two new artefacts bridge the gap between the optimization domain and the existing trade execution infrastructure:

1. **`execution-bridge.service.ts`** — converts high-level optimization objects (RebalanceSuggestion[], OptionsCandidates) into concrete TradeTickets. Handles quantity calculation and options expiry derivation. The only component that knows about both domains.

2. **`ExecutionConfirmPanel.svelte`** — inline UI panel that expands within the source page after user clicks Execute. Shows trade rows with safety status, a DTE picker for options, estimated totals, PAPER badge, and Confirm / Cancel actions. No page redirect.

All actual order submission goes through the existing `trade-layer.service.ts` → `moomoo-execution.service.ts` pipeline unchanged.

---

## Data Flow

### Rebalance → Paper Trade

```
Rebalance page (suggestions[])
  → user clicks "Execute All"
  → POST ?/queueRebalance
  → execution-bridge: calc qty per suggestion → createTradeTicket() × N
  → returns { tickets[] }
  → ExecutionConfirmPanel renders tickets
  → user clicks "Confirm & Submit to Paper"
  → POST ?/executeAll { ticketIds[] }
  → for each ticket: approveTradeTicket → previewMoomooExecution(mode='paper') → submitMoomooExecution(confirm:true)
  → panel shows per-ticket result (✓ submitted / ⚠ blocked)
```

### Options → Paper Trade

```
Options page (covered call / CSP candidate)
  → user clicks "Execute" on a candidate card
  → POST ?/queueOption { symbol, strike, optionType, contracts }
  → execution-bridge: derive expiry (nearest monthly Friday ≥ selected DTE) → createTradeTicket()
  → returns { ticket }
  → ExecutionConfirmPanel renders 1 ticket with DTE picker (21/30/45/60, default 30)
  → user adjusts DTE if needed (re-POSTs ?/queueOption with new DTE; old pending ticket is cancelled via cancelTradeTicket before creating new one)
  → user clicks "Confirm & Submit to Paper"
  → POST ?/executeOption { ticketId }
  → approveTradeTicket → previewMoomooExecution(mode='paper') → submitMoomooExecution(confirm:true)
  → panel shows result
```

---

## New Service: `execution-bridge.service.ts`

**Location:** `src/lib/services/execution-bridge.service.ts`

### Rebalance quantity calculation

```typescript
// For each RebalanceSuggestion:
// 1. Determine side (buy/sell) from targetAllocation vs currentAllocation
// 2. diff_pct = targetPct - currentPct
// 3. dollar_amount = |diff_pct| / 100 × totalPortfolioValue
// 4. shares = Math.max(1, Math.round(dollar_amount / currentPrice))
// 5. Call getMarketPrice(symbol) from market-price.service.ts
// If price unavailable → skip suggestion, add to skipped[]
```

### Options expiry calculation

```typescript
// nearestMonthlyExpiry(dte: 21 | 30 | 45 | 60): string (YYMMDD)
// 1. targetDate = today + dte days
// 2. Find the third Friday of the same month as targetDate
// 3. If third Friday < targetDate, use third Friday of next month
// 4. Return as 'YYMMDD' string for contract symbol construction
// Fallback: if no Friday found, use targetDate + 0 days exact
```

### Covered call contract symbol

```typescript
// Format: "{UNDERLYING}{YYMMDD}C{STRIKE_×_1000}"
// Observed format from existing positions: PATH260529P9500 (no zero-padding)
// Example: NIO, strike $5.62, expiry Jun 20 2026 → "NIO260620C5620"
// Uses ticketType: 'covered_call', side: 'open', orderType: 'limit'
// limitPrice = candidate.estimated_premium / (contracts × 100)
//   — this is the per-share premium (e.g. $28 / 100 = $0.28/share)
//   — source: CoveredCallCandidate.estimated_premium from options-intelligence.service.ts
// quantity = candidate.possible_contracts (already calculated by options-intelligence)
```

### CSP contract symbol

```typescript
// Format: "{UNDERLYING}{YYMMDD}P{STRIKE_×_1000}"
// ticketType: 'cash_secured_put', side: 'open', orderType: 'limit'
// limitPrice = CSP premium estimate (strike × 0.015 per share as approximation)
// quantity: from getPutExposureAnalysis — use contracts field on existing put exposure,
//   or default to 1 if no prior data
// availableCash: from getHoldings(userId) → find holding where assetType === 'cash'
```

---

## New Component: `ExecutionConfirmPanel.svelte`

**Location:** `src/lib/components/execution/ExecutionConfirmPanel.svelte`

### Props

```typescript
export let tickets: TradeTicket[]       // trades to confirm
export let mode: 'rebalance' | 'option' // controls DTE picker visibility
export let selectedDte: 21|30|45|60 = 30 // options only
export let loading: boolean = false
export let result: ExecutionResult | null = null

// Events
// dispatch('confirm')  — user clicked Confirm
// dispatch('cancel')   — user clicked Cancel
// dispatch('dteChange', dte) — user changed DTE (options only)
```

### Render logic

- **Trade rows:** symbol, SELL/BUY badge (red/green), quantity, order type, estimated value, safety status (✓ pass / ⚠ warning / ✗ blocked)
- **DTE picker:** shown only when `mode === 'option'` — 4 pill buttons (21/30/45/60), selected highlighted blue, computed expiry date shown below
- **Summary bar:** total trades count, estimated total value, PAPER badge
- **Action buttons:** "Confirm & Submit to Paper" (primary) + "Cancel" (secondary)
- **Result state:** after confirm, show per-ticket status. "View in Trades →" link to `/trades`

---

## Rebalance Page Changes

### `+page.server.ts` — new actions

**`queueRebalance`**
```typescript
// 1. Load current suggestions from getRebalanceSuggestionsByMode(userId, portfolioMode)
// 2. Call execution-bridge: rebalanceSuggestionsToTickets(userId, suggestions)
// 3. Returns { tickets, skipped[] }
// Skipped = suggestions where price was unavailable
```

**`executeAll`**
```typescript
// form: ticketIds[] (comma-separated string)
// For each ticketId:
//   approveTradeTicket(userId, ticketId, 'Approved via rebalance execute-all')
//   preview = previewMoomooExecution(userId, { tradeTicketId, mode: 'paper' })
//   if preview.status !== 'blocked': submitMoomooExecution(userId, preview.id, { confirm: true })
// Returns { results: [{ ticketId, status, brokerOrderId?, message }] }
// Never throws — collect errors per ticket, return partial success
```

### `+page.svelte` changes

- Add "Execute All" button below suggestions list (only shown when `data.rebalance.suggestions.length > 0`)
- `panelTickets` reactive state — populated after `?/queueRebalance` succeeds
- `ExecutionConfirmPanel` shown when `panelTickets !== null`
- On `confirm` event: submit `?/executeAll` form with ticketIds
- On `cancel` event: clear `panelTickets`

---

## Options Page Changes

### `+page.server.ts` — new actions

**`queueOption`**
```typescript
// form: { symbol, strike, optionType ('call'|'put'), contracts, dte (21|30|45|60) }
// Call execution-bridge: optionCandidateToTicket(userId, { symbol, strike, optionType, contracts, dte })
// Returns { ticket }
```

**`executeOption`**
```typescript
// form: { ticketId }
// approveTradeTicket → previewMoomooExecution(mode:'paper') → submitMoomooExecution(confirm:true)
// Returns { status, brokerOrderId?, message }
```

### `+page.svelte` changes

- Each covered call candidate card: add "⚡ Execute" button
- Each CSP candidate: add "⚡ Execute" button
- `activePanel: { ticketId, symbol } | null` — tracks which candidate has panel open
- `ExecutionConfirmPanel` shown inline below the active candidate card
- On `dteChange`: re-submit `?/queueOption` with new dte, update panel ticket
- One panel open at a time — opening another closes previous

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Market price unavailable for rebalance symbol | Skip that suggestion; list in `skipped[]`; panel shows "TQQQ — price unavailable, skipped" |
| Guardrail blocks one trade in batch | That row shows red "✗ blocked: [reason]"; other trades proceed |
| All trades blocked | Panel shows error state; no submit |
| Moomoo paper account unreachable | Panel shows "⚠ Moomoo paper account unreachable. Check OpenD." |
| Options expiry no standard Friday found | Fallback to `today + dte` exact date; show actual date in panel |
| submitMoomooExecution throws | Catch per-ticket; show error inline; partial success returned |

---

## Files Summary

| File | Action |
|---|---|
| `src/lib/services/execution-bridge.service.ts` | **CREATE** |
| `src/lib/components/execution/ExecutionConfirmPanel.svelte` | **CREATE** |
| `src/routes/optimization/rebalance/+page.server.ts` | **MODIFY** — add `queueRebalance`, `executeAll` actions |
| `src/routes/optimization/rebalance/+page.svelte` | **MODIFY** — add Execute All button + panel |
| `src/routes/optimization/options/+page.server.ts` | **MODIFY** — add `queueOption`, `executeOption` actions |
| `src/routes/optimization/options/+page.svelte` | **MODIFY** — add Execute buttons + panel per candidate |

**Unchanged:** `trade-layer.service.ts`, `moomoo-execution.service.ts`, `guardrail.service.ts`, `/trades` routes

---

## Out of Scope

- Live execution (paper only for this phase)
- Bulk options execution (one candidate at a time)
- Editing quantities manually (auto-calculated only)
- Push notifications when paper order fills
