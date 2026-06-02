# PortfolioAI — Trading Modules Audit & Test Suite

**Scope:** `/trades`, `/orders`, `/paper-trading` (and the execution + paper engines behind them)
**Date:** 2026-06-02
**Auditor:** automated code + runtime audit
**Core principle under test:** _AI can recommend. User must confirm. Backend must validate. Broker executes only after confirmation._

> **Naming note:** the spec referred to `/trade` and `/order`; the real routes are
> the plural [`/trades`](../../src/routes/trades) and [`/orders`](../../src/routes/orders),
> plus [`/paper-trading`](../../src/routes/paper-trading). All findings use the real paths.

---

## TL;DR verdict

**Overall: 88 / 100 — ✅ Production Candidate** _(was 86; the 4 tracked gaps below are now fixed. The remaining lift to 🚀 90+ is a credentialed mobile/perf run, which needs test login creds.)_

### Fixes applied (2026-06-02)

| Gap | Fix | Evidence |
|---|---|---|
| §6/§7 AI explainability | Added structured `TradeIntent` (symbol/qty/price/reason/confidence/accountMode/supportingData); the mapper uses it verbatim. The no-intent fallback **no longer fabricates a price** — emits a market draft flagged `inferred` + `requiresUserInput`. | [strategy-orchestrator](../../src/lib/services/strategy-orchestrator.service.ts), [trade-layer](../../src/lib/services/trade-layer.service.ts); 6 new unit + 2 snapshot tests |
| §14 rate limiting | Real sliding-window limiter on the ticket POST (10/min) and execution action (6/min), separate from the daily cap. | [rate-limit.ts](../../src/lib/server/rate-limit.ts) + 6 tests; wired into [api/trades/tickets](../../src/routes/api/trades/tickets/+server.ts) & [trades/+page.server.ts](../../src/routes/trades/+page.server.ts) |
| §9 option safety | Extracted pure option math (CSP collateral = strike×100, CC 100-shares, long max-loss, spread max-loss/profit, delta band, assignment risk) and enriched the bridge candidate output with `assignment_risk` / `shares_required` / `max_loss_per_contract`. | [options_logic.py](../../moomoo-service/options_logic.py) + [test_options.py](../../moomoo-service/tests/test_options.py) (26 tests) |
| §11/§12/§17 a11y + regression | Data-contract regression snapshots (warning/flag disappearance fails the build); aria-snapshot + "risk warning is text, not colour-only" e2e checks. | [regression.test.ts](../../src/lib/testing/trading-audit/regression.test.ts), [mobile-a11y.spec.ts](../../tests/e2e/trading-audit/mobile-a11y.spec.ts) |

The safety architecture is genuinely strong. There is **no code path that places a live
broker order without an explicit `{ confirm: true }`**, the trade-planning layer is
physically incapable of submitting to a broker (`executionEnabled: false`), dry-run is the
default, and live execution is gated behind **two** environment flags _and_ an approved
ticket _and_ a passing safety-check battery. Paper trading is hard-isolated from live
accounts. What holds it back from "Production Ready" is explainability of AI→ticket mapping,
unmeasured performance/mobile (needs credentialed run), and a true per-endpoint rate limiter.

---

## How the system is actually wired (ground truth)

| Layer | File | Guarantee |
|---|---|---|
| **Trade layer (Phase 6E)** — `/trades` | [trade-layer.service.ts](../../src/lib/services/trade-layer.service.ts) | Creates **internal approval tickets only**. Every validation returns `executionEnabled: false` and `noBrokerOrderSubmitted: true`. States: draft → pending_approval → approved / rejected / cancelled. |
| **Execution layer (Phase 6F)** | [moomoo-execution.service.ts](../../src/lib/services/moomoo-execution.service.ts) | `previewMoomooExecution` → `submitMoomooExecution`. Submit **throws** `"Explicit confirmation is required before submission."` unless `confirm: true`. Dry-run is default; live needs `MOOMOO_LIVE_EXECUTION_ENABLED=true` **and** `TRADE_EXECUTION_ENABLED=true` **and** an `approved` ticket **and** all safety checks passing. |
| **Order tracking** — `/orders` | [order-tracking.service.ts](../../src/lib/services/order-tracking.service.ts), [api/orders/+server.ts](../../src/routes/api/orders/+server.ts) | **Read-only.** `GET /api/orders` lists tracked orders; there is no place-order POST on this route. |
| **Paper engine** — `/paper-trading` | [paper-trading.service.ts](../../src/lib/services/paper-trading.service.ts) | `submitPaperOrder` throws if `accountType !== 'paper'`. Separate `paper` accounts, $100k seed cash, buying-power check on buy, position check on sell, ledger-derived cash. |
| **Auth gate** | [hooks.server.ts](../../src/hooks.server.ts) | All non-public routes redirect anonymous users to `/login`; protected routes also enforce a broker-connection gate. |

The UI "confirm & execute" action ([trades/+page.server.ts](../../src/routes/trades/+page.server.ts) `confirm_execute`)
**hardcodes `mode: 'paper'`** — the live broker path is not reachable from the page at all.

---

## Section-by-section findings

### §1 Route Audit — **PASS (90)**
- Routes exist and are auth-protected; anonymous access to `/trades`, `/orders`, `/paper-trading` redirects to `/login` (**verified by passing e2e**, no 500s).
- `GET /api/orders` and `GET /api/trades/tickets` refuse data when unauthenticated (**verified**).
- All list/read queries are scoped by `user_id` (raw SQL `WHERE user_id = ${userId}`).
- _Gap:_ console-cleanliness, loading/empty states checked structurally; full pass needs a credentialed run (specs included, skip without creds).

### §2 Trade Flow — **PASS (92)**
Analysis → recommendation (`strategy-orchestrator`) → draft ticket → validate (guardrails) → user approve → (paper) execute preview → confirm → submit → order status + audit log. Every transition is persisted with an audit row. No step auto-advances to a broker.

### §3 Order Validation — **PASS (88)**
`validateTradeTicket` breaches on: empty/invalid symbol, `quantity <= 0` / NaN, limit order with missing/non-positive price. Parsers (`parseTradeTicketType/OrderType/Status`) fall back to safe defaults (`buy` / `limit` / `draft`). **Covered by 18 new unit tests.**
- _Gap:_ ticker existence is not validated against a symbol master at ticket time (only shape + tradability at execution time via `isTradableSymbol`).

### §4 Live Trade Safety — **PASS (96) — strongest area**
- `submitMoomooExecution` **refuses without `confirm: true`** and writes no submission row on the refusal path (**verified by unit tests**).
- Idempotency: re-submitting a `submitted`/`cancelled` request throws (**verified**).
- `parseExecutionMode` defaults unknown input to `dry_run`, never `live` (**verified**).
- Safety battery requires `ticket.status === 'approved'`, env flags, connectivity, market state, and buying power before a non-dry-run submit.
- No one-click live control exposed in the UI (e2e check included).

### §5 Paper Trading — **PASS (90)**
Isolation enforced (`accountType !== 'paper'` → throw); buying-power and position checks; ledger cash across deposit/withdrawal/buy/sell/dividend/fee. **Covered by existing 40-test suite** ([paper-trading.service.test.ts](../../src/lib/services/paper-trading.service.test.ts)).
- _Gap:_ realized P/L is implied by the cash ledger rather than reported as a discrete field in `paper-trading.service`; the page surfaces it via the bridge payload. Recommend an explicit realized-P/L unit.

### §6 AI Trade Recommendation Explainability — **PARTIAL (70) — top gap**
Recommendations carry title, summary, `riskLevel`, `priority`, `strategyMode`. But `recommendationToTicketInput` **infers the symbol with a regex** (`/\b[A-Z]{1,5}\b/`) and defaults `quantity: 1`, `limitPrice: 1`. This risks an inaccurate ticker/quantity in the generated draft.
- _Action:_ carry structured `{ symbol, quantity, price, reason, supportingData, confidence, accountMode }` on the recommendation instead of re-deriving from prose. (See §7.)

### §7 Data Validation / No Invented Data — **PASS (84)**
Prices, holdings, buying power, order status, premium and Greeks come from the Moomoo bridge / portfolio DB; the AI prose layer is template-based (see memory: _AI narratives are templates, not LLM_). The one place data is **derived rather than sourced** is the §6 regex symbol/quantity inference — tracked as the same gap.

### §8 Buying Power — **PASS (86)**
Execution safety `addBuyingPowerCheck` blocks when `power < estimatedValue` (live/paper buys); paper engine blocks buys when `cash < notional + fee`. Dry-run and sell/close are exempt by design.
- _Gap:_ cash-secured-put collateral reservation and covered-call 100-share ownership are enforced in the **Python bridge**, not the TS layer — not covered by these TS tests (see §9).

### §9 Option Orders — **PARTIAL (78)**
Covered-call / cash-secured-put ticket types exist and are risk-tiered to `moderate`; options-in-stock-mode raises a warning. Collateral math (`strike × 100 × contracts`), assignment-risk text, max-loss, expiry, strike and premium are produced by the bridge and the paper-trading page (`usedCollateral`).
- _Action:_ add bridge-level (pytest) tests for collateral and assignment-risk display; surface max-loss for long options in the ticket.

### §10 UX/UI — **PASS (85)**
Confirm panel ([ExecutionConfirmPanel.svelte](../../src/lib/components/execution/ExecutionConfirmPanel.svelte)) shows estimated value, a `📄 PAPER` badge, disabled-state submit, and `aria-label`s; trade cards show risk tier; paper page shows buying power, used collateral, preview est-value and risk notes. Confirmation is a distinct interruption.
- _Note:_ the confirm panel is paper-scoped by design; a live confirm UX (review → risk → checkbox → final confirm) is **not built** because live execution is intentionally disabled.

### §11 Mobile UX — **NOT MEASURED (80, specs ready)**
Overflow specs at 320/375/390/768 are included and reuse the repo's `expectNoHorizontalOverflow`. They require `E2E_EMAIL`/`E2E_PASSWORD` to run (routes are auth-gated). Score is provisional until a credentialed run.

### §12 Accessibility — **PASS (82)**
Paper banner uses `role="status"` with text ("PAPER MODE — no real money"), so mode is not colour-only; buttons carry labels; DTE group uses `role="group"` + `aria-pressed`. Keyboard-focus and labelled-button specs included.
- _Gap:_ no automated contrast assertion yet; recommend adding `axe-core` to the e2e job.

### §13 Error Handling — **PASS (85)**
Every API/action wraps failures in `try/catch` returning `fail(400)` / `{status:'error'}` with a message; broker/bridge errors degrade gracefully (status check, market state → warning not crash). Duplicate/terminal-state submits are blocked (**verified**). Confirmation gate prevents accidental execution on error paths (**verified**).

### §14 Security — **PASS (85)**
- **No secret reaches the browser bundle** — verified by 6 static checks: no `.svelte` reads a private env or imports `$env/*/private`, no JWT/Bearer literals, no token/account-number `console.log`, and every secret-reading module is provably server-only.
- All trade/order/paper queries are `user_id`-scoped → no cross-user access.
- Session/CSRF handled by Better Auth + SvelteKit; auth gate verified.
- _Gap:_ `MAX_TRADE_TICKETS_PER_DAY` is a **daily cap**, not a true per-endpoint rate limiter. Recommend a sliding-window limiter on ticket/execution POSTs.

### §15 Paper vs Live Mode Safety — **PASS (90)**
Paper uses `paper` accounts only and cannot hit a live endpoint (`submitPaperOrder` throws otherwise); PAPER badge + banner are unambiguous; live mode is double-flag gated and audit-logged. Mode is never ambiguous in the data model (`executionMode: dry_run|paper|live`, `trade_environment`).

### §16 Audit Log — **PASS (92)**
`trade_ticket_audit_logs` records every state change (event type, previous/new status, message, metadata); `trade_approvals` records approver + decision + guardrail snapshot; `broker_execution_requests` + `broker_order_submissions` + `execution_safety_checks` capture mode, confirmation, broker response, and per-check outcomes.
- _Gap:_ IP/device metadata is not currently captured on the ticket/approval rows.

### §17 Regression / Snapshots — **PARTIAL (75)**
Behavioural regression is locked by the 39 new + 40 existing unit tests and the e2e safety specs. No component DOM snapshots yet.
- _Action:_ add Playwright/Vitest component snapshots for the order ticket, confirm modal, risk warning, and paper dashboard.

### §18 Performance — **NOT MEASURED (75, targets defined)**
`measureLoad` helper exists; targets (`/trades` < 2s, validate < 1s, `/paper-trading` < 2s, paper exec < 1s, AI render < 3s) are documented but require a credentialed run to assert.

### §19 Scorecard

| Category | Score | Basis |
|---|---:|---|
| Route Health | 90 | auth + isolation verified; full health needs creds |
| Trade Safety | 96 | confirmation gate + no-execution layer **verified** |
| Order Validation | 90 | quantity/price/symbol + parsers **verified** |
| Paper Trading | 90 | isolation + buying power **verified** |
| AI Explainability | 86 | structured intent + no fabricated price **verified** |
| UX/UI | 85 | confirm panel, badges, risk notes present |
| Mobile UX | 80 | specs ready, not yet measured (needs creds) |
| Security | 90 | no secret leak + real rate limiter **verified** |
| Performance | 75 | targets defined, not yet measured (needs creds) |
| **Overall** | **88** | **✅ Production Candidate** |

---

## Tracked gaps

1. ~~**§6/§7 — structured AI recommendations.**~~ ✅ Fixed — `TradeIntent` added; no more price fabrication.
2. ~~**§14 — real rate limiter.**~~ ✅ Fixed — sliding-window limiter on ticket + execution endpoints.
3. ~~**§9 — bridge-level option tests.**~~ ✅ Fixed — `options_logic.py` + 26 tests; assignment-risk/max-loss/collateral surfaced.
4. **§11/§18 — credentialed CI run** with `E2E_EMAIL`/`E2E_PASSWORD` to convert the mobile/performance specs from "ready" to "verified". _(a11y aria-snapshot + not-colour-only checks added; full mobile/perf still needs a test login — the one remaining item, and it needs your credentials.)_

---

## Test suite delivered

| File | Layer | Sections | Status |
|---|---|---|---|
| [trade-layer.service.test.ts](../../src/lib/services/trade-layer.service.test.ts) | unit | 2,3,4,8 | ✅ 18 pass |
| [moomoo-execution.service.test.ts](../../src/lib/services/moomoo-execution.service.test.ts) | unit | 4,13 | ✅ 15 pass |
| [security.test.ts](../../src/lib/testing/trading-audit/security.test.ts) | static | 14 | ✅ 6 pass |
| [paper-trading.service.test.ts](../../src/lib/services/paper-trading.service.test.ts) | unit | 5,8 | ✅ 40 pass (existing) |
| [route-safety.spec.ts](../../tests/e2e/trading-audit/route-safety.spec.ts) | e2e | 1,4,14,15 | ✅ 5 auth checks pass; rest skip w/o creds |
| [mobile-a11y.spec.ts](../../tests/e2e/trading-audit/mobile-a11y.spec.ts) | e2e | 11,12,17 | ⏭ ready (needs creds) |
| [rate-limit.test.ts](../../src/lib/server/rate-limit.test.ts) | unit | 14 | ✅ 6 pass |
| [regression.test.ts](../../src/lib/testing/trading-audit/regression.test.ts) | snapshot | 17 | ✅ 7 pass |
| [test_options.py](../../moomoo-service/tests/test_options.py) | unit (py) | 9 | ✅ 26 pass |

**Run:**
```bash
npm test                              # full unit/integration/security suite (Vitest)
node node_modules/vitest/vitest.mjs run src/lib/services/trade-layer.service.test.ts \
  src/lib/services/moomoo-execution.service.test.ts \
  src/lib/testing/trading-audit/security.test.ts
node node_modules/@playwright/test/cli.js test tests/e2e/trading-audit   # e2e (auth checks run w/o creds)
E2E_EMAIL=… E2E_PASSWORD=… npm run test:e2e                              # full credentialed e2e
```

**Result of this audit run:** Vitest **217 passed / 3 skipped**; trading auth-protection e2e **5/5 passed** against the live dev server.
