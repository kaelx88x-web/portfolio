# Phase 6G — Order Tracking System

> Portfolio AI SaaS
> Broker order lifecycle and reconciliation layer

---

# Purpose

Phase 6G tracks orders after submission and reconciles order status, fills, rejects, cancels, and errors back into PortfolioAI.

---

# Core Scope

- Order lifecycle tracking
- Broker status sync
- Fill and partial fill tracking
- Cancel and reject handling
- Execution audit logs
- Portfolio reconciliation hooks
- User-facing order timeline

---

# Required Tables

```text
broker_orders
broker_order_events
broker_order_fills
order_reconciliation_logs
```

---

# Required API

```text
GET  /api/orders
GET  /api/orders/:id
GET  /api/orders/:id/events
POST /api/orders/sync
POST /api/orders/:id/reconcile
```

---

# Required Pages

```text
/orders
/orders/[id]
/orders/activity
```

---

# Safety Rules

- Order tracking must be append-only for audit events.
- Reconciliation must not silently rewrite portfolio history.
- Any mismatch between broker and local records must be visible to the user.

---

# Implementation Status

```text
Status: Implemented
Version: phase-6G
Tracking mode: append-only events and visible reconciliation logs
```

Implemented surfaces:

- Prisma models for `broker_orders`, `broker_order_events`, `broker_order_fills`, and `order_reconciliation_logs`.
- Order tracking service that syncs Phase 6F broker submissions, imports Moomoo order/deal snapshots, records fills, and appends audit events.
- Reconciliation flow that records matched/mismatched state without rewriting portfolio history.
- API routes for order list, order detail, order events, sync, and reconcile.
- UI pages for `/orders`, `/orders/[id]`, and `/orders/activity`.
- Sidebar links for Order Tracking and Order Activity.

Verification:

```text
npm.cmd run check
npm.cmd run db:push
npm.cmd run build
HTTP smoke: /orders, /orders/activity, /api/orders, /api/orders/sync,
            /api/orders/:id, /api/orders/:id/events, /api/orders/:id/reconcile
```

---

# Next Phase

```text
Phase 7 — Multi-Agent Finance AI
```
