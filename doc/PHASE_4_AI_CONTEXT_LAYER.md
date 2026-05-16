# Phase 4 — AI Context Layer

> Portfolio AI SaaS  
> AI Portfolio Intelligence Engine  
> Structured Financial Context System

---

# Purpose

Phase 4 introduces:

```text
AI Context Builder
+ AI Memory Layer
+ Structured Financial Intelligence
+ AI Prompt Infrastructure
```

This phase transforms:

```text
raw portfolio data
+ analytics output
+ benchmark analysis
+ risk metrics
```

into:

```text
AI-ready structured context
```

for:

- AI Copilot
- Multi-Agent Finance AI
- AI Portfolio Advisor
- Risk Analysis
- Allocation Analysis
- Future Quant AI

---

# Core Vision

Portfolio AI should not send raw database rows directly into LLMs.

Instead:

```text
Portfolio Data
    ↓
Analytics Engine
    ↓
AI Context Builder
    ↓
Structured AI Context
    ↓
Prompt Builder
    ↓
AI Copilot / AI Agents
```

This creates:

- lower token usage
- faster AI responses
- reusable prompts
- consistent reasoning
- multi-agent compatibility
- explainable AI outputs

---

# Architecture Position

```text
[SvelteKit Frontend]
        ↓
[Laravel API Gateway]
        ↓
[Portfolio Core Engine]
        ↓
[Analytics Engine]
        ↓
[AI Context Layer]
        ↓
[Prompt Builder]
        ↓
[AI Copilot]
        ↓
[Multi-Agent System]
```

---

# Main Data Flow

```text
Broker Sync
    ↓
Transactions
    ↓
Holdings
    ↓
Portfolio Snapshots
    ↓
Analytics Engine
    ↓
AI Context Builder
    ↓
Structured AI Payload
    ↓
Prompt Builder
    ↓
AI Copilot
```

---

# Main Objectives

## Goals

- Build structured AI portfolio context
- Build AI-ready JSON payloads
- Create reusable AI memory
- Create prompt generation system
- Support AI agents
- Improve AI reasoning quality
- Reduce token cost
- Build AI cache layer

---

# Required Backend Module

```text
backend/
└── modules/
    └── ai-context/
        ├── Controllers/
        │   ├── AiContextController.php
        │   ├── AiPromptController.php
        │   └── AiMemoryController.php
        ├── Services/
        │   ├── PortfolioContextService.php
        │   ├── RiskContextService.php
        │   ├── AllocationContextService.php
        │   ├── BenchmarkContextService.php
        │   ├── PromptBuilderService.php
        │   ├── AiMemoryService.php
        │   ├── ContextCompressionService.php
        │   └── AiCacheService.php
        ├── Builders/
        │   ├── PortfolioContextBuilder.php
        │   ├── RiskContextBuilder.php
        │   ├── AllocationContextBuilder.php
        │   ├── BenchmarkContextBuilder.php
        │   ├── PromptContextBuilder.php
        │   └── MarketContextBuilder.php
        ├── DTOs/
        │   ├── PortfolioContextDTO.php
        │   ├── RiskContextDTO.php
        │   ├── AllocationContextDTO.php
        │   ├── BenchmarkContextDTO.php
        │   └── PromptContextDTO.php
        ├── Jobs/
        │   ├── GeneratePortfolioContextJob.php
        │   ├── RefreshAiMemoryJob.php
        │   ├── CachePortfolioContextJob.php
        │   └── GeneratePromptBlockJob.php
        ├── Enums/
        ├── Exceptions/
        ├── Routes/
        └── Providers/
```
