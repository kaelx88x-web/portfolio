# Phase 4A — AI Context Builder

> Portfolio AI SaaS  
> AI Infrastructure Layer  
> Structured Portfolio Intelligence Foundation

---

# Objective

Phase 4A membina **AI Context Builder**.

Tujuan utama ialah menukar data portfolio, analytics, risk, allocation dan benchmark kepada **structured AI JSON** yang boleh digunakan oleh Prompt Builder dan AI Copilot.

---

# Architecture

```text
Portfolio Core
    ↓
Portfolio Snapshots
    ↓
Analytics Engine
    ↓
AI Context Builder
    ↓
Structured AI Context JSON
    ↓
Prompt Builder
    ↓
AI Copilot
```

---

# Scope

## Build

- Portfolio Context
- Risk Context
- Allocation Context
- Performance Context
- Benchmark Context
- AI Summary Context
- Context compression
- Context cache

## Not Yet

Jangan buat lagi:

- AI Chat UI
- AI Copilot conversation
- AI Memory
- Multi-Agent
- Auto trading
- Buy/Sell recommendation

---

# Backend Module

```text
backend/
└── modules/
    └── ai-context/
        ├── Controllers/
        │   └── AiContextController.php
        ├── Services/
        │   ├── PortfolioContextService.php
        │   ├── RiskContextService.php
        │   ├── AllocationContextService.php
        │   ├── PerformanceContextService.php
        │   ├── BenchmarkContextService.php
        │   └── ContextCompressionService.php
```

---

# API Endpoints

```text
GET  /api/ai/context
GET  /api/ai/context/latest
GET  /api/ai/context/risk
GET  /api/ai/context/allocation
GET  /api/ai/context/performance
GET  /api/ai/context/benchmark
POST /api/ai/context/refresh
```

---

# Standard AI Context JSON

```json
{
  "portfolio": {
    "total_value": 152400,
    "cash_ratio": 12.5,
    "holdings_count": 18,
    "currency": "USD"
  },
  "risk": {
    "risk_level": "moderate",
    "volatility": 0.24
  }
}
```

---

# Redis Cache

```text
ai:{user_id}:context:latest
ai:{user_id}:risk:latest
```

---

# Environment Variables

```env
AI_CONTEXT_ENABLED=true
AI_CONTEXT_CACHE_ENABLED=true
AI_CONTEXT_CACHE_TTL=300
```

---

# Acceptance Criteria

- AI context JSON generated
- Risk context works
- Allocation context works
- Redis cache works
- `/api/ai/context` works

---

# Next Phase

```text
Phase 4B — Prompt Builder System
```
