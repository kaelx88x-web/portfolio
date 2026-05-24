# Phase 6D — AI Suggestion Engine

> Portfolio AI SaaS
> Suggestion ranking and explanation layer

---

# Purpose

Phase 6D turns portfolio context, guardrail results, options discovery, scenario simulation, and strategy orchestration into clear AI suggestions.

This is the final advisory stage before any trade-ticket layer exists.

---

# Relationship To Current Implementation

The current implementation lives in:

- `PHASE_6D_AI_PORTFOLIO_STRATEGY_ORCHESTRATOR.md`
- `src/lib/services/strategy-orchestrator.service.ts`
- `/strategy`
- `/api/strategy/*`

The Strategy Orchestrator is the first implementation of the AI Suggestion Engine. It classifies portfolio strategy, detects conflicts, ranks recommendations, and explains tradeoffs.

---

# Safety Rule

```text
AI suggestions are advisory only.
They must not create, queue, submit, cancel, or modify broker orders.
```

---

# Next Phase

```text
Phase 6E — Trade Layer
```

