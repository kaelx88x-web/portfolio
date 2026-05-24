# Phase 6E — Trade Layer

> Portfolio AI SaaS
> Internal trade ticket and approval layer

---

# Purpose

Phase 6E adds a trade layer that converts approved AI suggestions into internal trade tickets.

This phase does not send orders to Moomoo or any broker.

---

# Core Scope

- Trade ticket creation from AI suggestions
- Manual trade ticket creation
- Buy, sell, covered call, and cash-secured put ticket types
- Guardrail validation before ticket approval
- Approval, rejection, cancellation, and expiration states
- Full audit metadata

---

# Required Tables

```text
trade_tickets
trade_ticket_audit_logs
trade_approvals
```

---

# Required API

```text
GET  /api/trades/tickets
GET  /api/trades/tickets/:id
POST /api/trades/tickets
POST /api/trades/tickets/:id/approve
POST /api/trades/tickets/:id/reject
POST /api/trades/tickets/:id/cancel
POST /api/trades/validate
```

---

# Required Pages

```text
/trades
/trades/tickets
/trades/tickets/[id]
/trades/approvals
```

---

# Safety Rules

- No broker order is submitted in Phase 6E.
- Every ticket must show source suggestion, estimated risk, and guardrail result.
- User approval is required before any future execution request.

---

# Implementation Status

```text
Status: Implemented
Version: phase-6E
Execution: disabled / internal approval only
```

Implemented surfaces:

- Prisma models and database tables for trade tickets, audit logs, and approvals
- Trade layer service for create, validate, approve, reject, cancel, dashboard, and AI draft starters
- API routes for ticket lifecycle and validation
- Svelte pages for trade dashboard, ticket list, ticket detail, and approval history
- Sidebar navigation under Trade Layer with SANDBOX badge
- Environment flags:

```text
TRADE_LAYER_ENABLED=true
TRADE_EXECUTION_ENABLED=false
MAX_TRADE_TICKETS_PER_DAY=20
```

Verification:

```text
npm.cmd run check
npm.cmd run db:push
npm.cmd run build
HTTP smoke tests for /trades, /trades/tickets, /trades/approvals, validate, create, approve
```

---

# Next Phase

```text
Phase 6F — Moomoo Execution Layer
```
