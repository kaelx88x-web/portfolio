# Phase 4C — AI Memory Layer

> Portfolio AI SaaS  
> AI Infrastructure Layer  
> AI Memory, Compression & Historical Intelligence System

---

# Objective

Phase 4C membina:

```text
AI Memory Layer
+ Historical AI Context
+ Context Compression
+ AI Cache Intelligence
```

Phase ini menyambung selepas:

```text
Phase 4A — AI Context Builder
Phase 4B — Prompt Builder System
```

4C bertanggungjawab untuk menyimpan:

- AI context snapshots
- compressed portfolio memory
- reusable AI history
- AI cache intelligence
- historical AI summaries

---

# Core Vision

AI tidak sepatutnya:

```text
Lupa semua context setiap request
```

Sebaliknya:

```text
Portfolio Context
    ↓
Memory Layer
    ↓
Compressed AI Memory
    ↓
Prompt Builder
    ↓
AI Copilot
```

---

# Architecture Position

```text
Portfolio Core
    ↓
Analytics Engine
    ↓
AI Context Builder
    ↓
Prompt Builder
    ↓
AI Memory Layer
    ↓
AI Copilot
```

---

# Main Goals

- Build AI memory snapshots
- Build compressed AI memory
- Reduce repeated token usage
- Store historical AI insights
- Build reusable AI context history
- Improve AI continuity
- Support future multi-agent memory

---

# What This Phase Builds

## Main Features

- AI memory snapshots
- Context history
- AI summary history
- Context compression
- AI memory cache
- AI historical insights
- AI context timeline
- Memory retrieval layer

---

# What This Phase Does NOT Build Yet

Jangan buat lagi:

- Multi-agent orchestration
- Autonomous AI reasoning
- AI self-learning
- Auto trading
- Reinforcement learning

Semua itu masuk:

```text
Phase 4D
Phase 5+
```

---

# Backend Module

```text
backend/
└── modules/
    └── ai-memory/
        ├── Controllers/
        │   └── AiMemoryController.php
        ├── Services/
        │   ├── AiMemoryService.php
        │   ├── ContextHistoryService.php
        │   ├── MemoryCompressionService.php
        │   ├── MemoryRetrievalService.php
        │   ├── MemoryCacheService.php
        │   └── HistoricalInsightService.php
        ├── DTOs/
        │   ├── MemorySnapshotDTO.php
        │   ├── ContextHistoryDTO.php
        │   └── HistoricalInsightDTO.php
        ├── Jobs/
        │   ├── GenerateMemorySnapshotJob.php
        │   ├── CompressMemoryJob.php
        │   ├── RefreshMemoryCacheJob.php
        │   └── CleanupExpiredMemoryJob.php
        ├── Routes/
        │   └── api.php
        └── Providers/
            └── AiMemoryServiceProvider.php
```

---

# AI Memory Flow

```text
Portfolio Context
    ↓
Compression Layer
    ↓
AI Memory Snapshot
    ↓
Memory Cache
    ↓
Historical Retrieval
    ↓
Prompt Builder
```

---

# Required Database Tables

## ai_memory_snapshots

```text
id
user_id
snapshot_type
snapshot_version
context_json
compressed_context_json
summary
metadata
created_at
updated_at
```

---

## ai_memory_timelines

```text
id
user_id
memory_snapshot_id
timeline_type
timeline_key
timeline_value
metadata
created_at
updated_at
```

---

## ai_historical_insights

```text
id
user_id
insight_type
title
summary
context_reference
metadata
created_at
updated_at
```

---

# Required API Endpoints

```text
GET  /api/ai/memory
GET  /api/ai/memory/latest
GET  /api/ai/memory/history
GET  /api/ai/memory/timeline
POST /api/ai/memory/refresh
POST /api/ai/memory/compress
```

---

# Example Memory Snapshot

```json
{
  "snapshot_date": "2026-05-14",
  "portfolio_value": 152400,
  "risk_level": "moderate",
  "main_risk": "technology concentration",
  "top_holdings": [
    "NVDA",
    "AAPL",
    "TSLA"
  ],
  "benchmark": "SPY"
}
```

---

# Compression Strategy

Before saving:

```text
Raw Context
    ↓
Normalize
    ↓
Remove duplicated data
    ↓
Compress
    ↓
Store AI Memory
```

Benefits:

- lower storage usage
- faster retrieval
- lower token usage
- reusable AI summaries

---

# AI Memory Categories

Support:

```text
Portfolio Summary
Risk Snapshot
Allocation Snapshot
Benchmark Snapshot
Performance Snapshot
Market Commentary Snapshot
```

---

# Memory Timeline Features

Track:

```text
Portfolio growth trend
Risk trend
Allocation trend
Benchmark trend
Volatility trend
```

---

# Queue Jobs

```text
GenerateMemorySnapshotJob
CompressMemoryJob
RefreshMemoryCacheJob
CleanupExpiredMemoryJob
```

---

# Redis Cache

```text
memory:{user_id}:latest
memory:{user_id}:compressed
memory:{user_id}:timeline
```

---

# Frontend Pages

```text
/ai/memory
/ai/memory/history
/ai/memory/timeline
```

---

# Frontend Components

```text
AiMemoryCard
AiMemoryTimeline
AiSnapshotViewer
AiHistoricalInsightCard
AiMemoryCompressionBadge
```

---

# Environment Variables

```env
AI_MEMORY_ENABLED=true
AI_MEMORY_CACHE_ENABLED=true
AI_MEMORY_COMPRESSION=true
AI_MEMORY_RETENTION_DAYS=365
```

---

# Engineering Rules

## Do

- Compress memory before storage
- Cache latest memory snapshot
- Support historical retrieval
- Keep memory modular
- Support future multi-agent memory

## Do Not

- Store unnecessary raw prompts
- Store sensitive broker credentials
- Build AI self-learning yet
- Build auto trading logic

---

# Testing Requirements

Create tests for:

```text
Memory snapshot generation
Memory compression
Historical retrieval
Memory cache refresh
Timeline generation
Expired memory cleanup
```

---

# Acceptance Criteria

Phase 4C complete when:

- AI memory snapshots work
- Historical memory retrieval works
- Memory compression works
- Redis memory cache works
- AI timeline works
- Historical AI insights work

---

# Next Phase

```text
Phase 4D — Multi-Agent Shared Context
```

4D akan tambah:

- shared AI memory
- multi-agent orchestration
- agent routing
- shared financial intelligence
- collaborative AI context

---

# Final Reminder

```text
Phase 4A = AI Context Foundation
Phase 4B = Prompt Engineering
Phase 4C = AI Memory Intelligence
Phase 5 = AI Copilot Experience
```
