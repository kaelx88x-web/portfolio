# Phase 6F — Moomoo Execution Layer

> Portfolio AI SaaS
> Explicit user-approved Moomoo order submission

---

# Purpose

Phase 6F sends approved trade tickets to Moomoo after broker validation and explicit user confirmation.

---

# Core Scope

- Convert approved trade tickets into Moomoo order requests
- Validate account, symbol, market status, order type, price, quantity, and buying power
- Support dry-run mode
- Support paper mode where available
- Support live mode only when explicitly enabled
- Store broker order id and submission response

---

# Required Tables

```text
broker_execution_requests
broker_order_submissions
execution_safety_checks
```

---

# Required API

```text
POST /api/execution/moomoo/preview
POST /api/execution/moomoo/submit
GET  /api/execution/moomoo/status/:id
POST /api/execution/moomoo/cancel/:id
```

---

# Safety Rules

- Live execution must be disabled by default.
- User must approve every execution request.
- Guardrails must pass or require explicit override.
- The system must never auto-submit orders from AI suggestions.

---

# Environment Variables

```env
TRADE_EXECUTION_ENABLED=false
MOOMOO_LIVE_EXECUTION_ENABLED=false
MOOMOO_DRY_RUN_EXECUTION=true
```

---

# Implementation Status

```text
Status: Implemented
Version: phase-6F
Default mode: dry-run
Live execution: disabled by default
```

Implemented surfaces:

- Prisma models and database tables for execution requests, order submissions, and safety checks
- Moomoo execution service for preview, submit, status, cancel, safety checks, and dry-run simulation
- SvelteKit API:

```text
POST /api/execution/moomoo/preview
POST /api/execution/moomoo/submit
GET  /api/execution/moomoo/status/:id
POST /api/execution/moomoo/cancel/:id
```

- UI pages:

```text
/execution/moomoo
/execution/moomoo/requests/[id]
```

- Moomoo bridge endpoints guarded by `MOOMOO_READ_ONLY`, `TRADE_EXECUTION_ENABLED`, and `MOOMOO_LIVE_EXECUTION_ENABLED`
- Sidebar navigation under Execution with SANDBOX badge
- Dry-run submission stores a simulated broker order id and never contacts Moomoo order placement

Verification:

```text
npm.cmd run check
npm.cmd run db:push
npm.cmd run build
HTTP smoke tests for /execution/moomoo, preview, submit dry-run, status, detail page, cancel
```

---

# Next Phase

```text
Phase 6G — Order Tracking System
```
