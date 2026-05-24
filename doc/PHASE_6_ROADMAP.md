# Phase 6 Roadmap — Optimization to Execution

> Portfolio AI SaaS
> Canonical Phase 6 stage map
> Advisory-first, execution-gated architecture

---

# Canonical Stage List

## Phase 6A — Portfolio Mode Engine

- Persistent portfolio mode selection
- Stock, hybrid, and options modes
- Mode-aware optimization behavior
- User planning mode without trade execution

Status:

- Implemented as part of `PHASE_6A_SMART_ALLOCATION_INTELLIGENCE.md`
- Backed by saved `User.portfolioMode`

---

## Phase 6B — Guardrail Engine

- Single-stock concentration checks
- Sector concentration checks
- Cash minimum checks
- Options allocation checks
- Collateral reserve checks
- Constraint conflict checks

Status:

- Implemented as part of `PHASE_6B_OPTIONS_INTELLIGENCE_ENGINE.md`
- Service: `src/lib/services/guardrail.service.ts`
- API: `/api/optimization/validate-guardrails`

---

## Phase 6C — Options Discovery Engine

- Discover covered call candidates
- Discover cash-secured put candidates
- Pull options expiry data
- Pull options chain data
- Rank candidates by premium yield and risk filters

Status:

- Implemented as part of `PHASE_6C_AI_REBALANCE_SCENARIO_SIMULATION.md`
- Moomoo endpoints: `/options/expiry`, `/options/chain`, `/options/candidates`
- SvelteKit APIs: `/api/options/expiry`, `/api/options/chain`, `/api/options/candidates`

---

## Phase 6D — AI Suggestion Engine

- Convert analytics, guardrails, options discovery, scenario simulation, and strategy context into clear AI suggestions
- Rank suggestions by priority, risk, and objective fit
- Explain tradeoffs in plain English
- Keep all suggestions advisory-only

Status:

- Implemented through the Phase 6D Strategy Orchestrator foundation
- Main doc: `PHASE_6D_AI_PORTFOLIO_STRATEGY_ORCHESTRATOR.md`
- Service: `src/lib/services/strategy-orchestrator.service.ts`
- APIs: `/api/strategy/profile`, `/api/strategy/recommendations`, `/api/strategy/conflicts`, `/api/strategy/modes`

Required guardrail:

```text
AI suggestions must never create, queue, or execute broker orders by themselves.
```

---

## Phase 6E — Trade Layer

- Convert approved suggestions into internal trade tickets
- Keep trade tickets separate from broker execution
- Support preview, validation, approval, rejection, and cancellation states
- Store full audit metadata

Core flow:

```text
Suggestion -> Trade Ticket -> User Approval -> Execution Request
```

This phase does not place live broker orders. It creates an internal trade-intent layer only.

---

## Phase 6F — Moomoo Execution Layer

- Send approved execution requests to Moomoo
- Support dry-run or paper mode before live execution
- Validate buying power, market status, order type, price limits, and guardrails
- Require explicit execution confirmation

Core flow:

```text
Approved Trade Ticket -> Broker Validation -> Moomoo Order Submit
```

This phase must be locked behind execution permissions and broker safety checks.

---

## Phase 6G — Order Tracking System

- Track order lifecycle
- Sync order status from broker
- Record fills, partial fills, cancels, rejects, and errors
- Reconcile executed orders back into portfolio data
- Preserve audit logs for every order state transition

Core flow:

```text
Submitted Order -> Broker Status Sync -> Fills/Rejections -> Portfolio Reconciliation
```

---

# Safety Boundary

Phase 6A to 6D are advisory intelligence.

Phase 6E to 6G are execution-adjacent and must enforce:

- explicit user approval
- no hidden auto-trading
- broker account permission checks
- guardrail validation
- order audit trails
- dry-run or paper mode before live mode
- clear failure and rollback handling

---

# Updated Architecture

```text
Optimization Engine
        ->
6A Portfolio Mode Engine
        ->
6B Guardrail Engine
        ->
6C Options Discovery Engine
        ->
6D AI Suggestion Engine
        ->
6E Trade Layer
        ->
6F Moomoo Execution Layer
        ->
6G Order Tracking System
        ->
Phase 7 Multi-Agent Finance AI
```

