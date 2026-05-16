# Phase 5A — AI Copilot Orchestration Engine

> Portfolio AI SaaS  
> AI Prompt Orchestration & Reasoning Pipeline  
> Structured AI Execution Layer

---

# Purpose

Phase 5A introduces:

```text
AI Orchestration Engine
+ Prompt Pipeline
+ AI Routing Layer
+ Structured Reasoning Flow
+ Tool Calling Foundation
```

Phase 5 built:

- AI chat UI
- AI Copilot responses
- AI insight generation
- portfolio explanation

Phase 5A upgrades the system into:

```text
Institutional AI Reasoning Architecture
```

This phase makes AI Copilot:

- modular
- scalable
- multi-model ready
- future multi-agent ready
- tool-calling ready
- memory-aware
- benchmark-aware

---

# Core Vision

Instead of:

```text
User Question
    ↓
Single Prompt
    ↓
LLM
```

Portfolio AI should use:

```text
User Question
    ↓
Intent Detection
    ↓
Context Resolver
    ↓
Prompt Orchestrator
    ↓
Tool Routing
    ↓
LLM Provider Router
    ↓
Response Validator
    ↓
Guardrail Layer
    ↓
Structured AI Response
```

---

# Architecture Position

```text
[SvelteKit Frontend]
        ↓
[Laravel API Gateway]
        ↓
[AI Context Layer]
        ↓
[AI Orchestration Engine]
        ↓
[LLM Providers]
        ↓
[AI Copilot]
        ↓
[Future Multi-Agent Layer]
```

---

# Main Objectives

## Goals

- Build AI orchestration pipeline
- Separate prompt stages
- Add AI intent classification
- Add context routing
- Add provider routing
- Add tool execution layer
- Add structured AI response schema
- Add AI memory awareness
- Add AI fallback handling
- Add AI response validation

---

# Main Data Flow

```text
User Question
    ↓
Intent Detection
    ↓
Portfolio Context Resolver
    ↓
Prompt Assembly
    ↓
Tool Selection
    ↓
Provider Selection
    ↓
LLM Execution
    ↓
Response Validation
    ↓
Guardrail Filtering
    ↓
Frontend Response
```

---

# Required Backend Module

```text
backend/
└── modules/
    └── ai-orchestration/
        ├── Controllers/
        │   └── AiOrchestratorController.php
        ├── Services/
        │   ├── AiOrchestratorService.php
        │   ├── AiIntentService.php
        │   ├── AiContextRoutingService.php
        │   ├── AiPromptAssemblyService.php
        │   ├── AiProviderRoutingService.php
        │   ├── AiToolExecutionService.php
        │   ├── AiResponseValidationService.php
        │   ├── AiFallbackService.php
        │   ├── AiMemoryInjectionService.php
        │   └── AiConversationCompressionService.php
        ├── Providers/
        │   ├── OpenAiProvider.php
        │   ├── ClaudeProvider.php
        │   ├── GeminiProvider.php
        │   ├── OllamaProvider.php
        │   └── ProviderRegistry.php
        ├── Tools/
        │   ├── PortfolioTool.php
        │   ├── RiskAnalysisTool.php
        │   ├── AllocationTool.php
        │   ├── BenchmarkTool.php
        │   ├── HoldingsTool.php
        │   └── SnapshotTool.php
        ├── DTOs/
        │   ├── AiIntentDTO.php
        │   ├── AiExecutionDTO.php
        │   ├── AiResponseDTO.php
        │   └── AiToolCallDTO.php
        ├── Jobs/
        │   ├── GenerateAiResponseJob.php
        │   ├── CompressConversationMemoryJob.php
        │   ├── RefreshAiRoutingCacheJob.php
        │   └── ValidateAiInsightJob.php
        ├── Enums/
        │   ├── AiIntentType.php
        │   ├── AiProviderType.php
        │   └── AiToolType.php
        ├── Routes/
        │   └── api.php
        └── Providers/
            └── AiOrchestrationServiceProvider.php
```

---

# Main AI Pipeline

## Step 1 — Intent Detection

The system must classify:

```text
risk_question
allocation_question
performance_question
benchmark_question
portfolio_health_question
market_commentary_question
general_question
```

Example:

```text
"What is my biggest risk?"
→ risk_question
```

---

## Step 2 — Context Routing

Different questions require different context.

Example:

```text
Risk Question
    ↓
Risk metrics
Sector exposure
Volatility
Drawdown

Allocation Question
    ↓
Allocation context
Holdings
Cash ratio
Diversification
```

---

## Step 3 — Prompt Assembly

Prompt builder combines:

```text
System Prompt
Safety Rules
Portfolio Context
Analytics Context
Conversation Memory
User Question
Tool Output
```

---

## Step 4 — Tool Execution

AI should NOT depend only on LLM memory.

Use internal tools.

---

# Tool Calling Foundation

## Required Tools

### PortfolioTool

Returns:

```text
portfolio value
holdings
PnL
allocation
```

---

### RiskAnalysisTool

Returns:

```text
volatility
drawdown
concentration
risk score
```

---

### AllocationTool

Returns:

```text
sector exposure
country exposure
cash ratio
diversification
```

---

### BenchmarkTool

Returns:

```text
SPY comparison
alpha
beta
benchmark return
```

---

### HoldingsTool

Returns:

```text
top holdings
largest positions
losers/gainers
```

---

# Example Tool Flow

```text
User:
"What is increasing my volatility?"

↓

Intent:
risk_question

↓

Tool:
RiskAnalysisTool

↓

Context:
volatility + concentration

↓

Prompt:
Generated with risk template

↓

LLM:
Explains findings
```

---

# AI Provider Routing

Different models may handle different tasks.

---

## Example Routing

| Task | Provider |
|---|---|
| Fast chat | OpenAI GPT-4o-mini |
| Deep reasoning | Claude |
| Local privacy mode | Ollama |
| Long report | Gemini |

---

# Provider Router Logic

```text
if request_type == fast_chat
    use OpenAI

if request_type == deep_analysis
    use Claude

if local_mode == enabled
    use Ollama
```

---

# Structured AI Response Schema

Every response should return:

```json
{
  "summary": "",
  "key_observations": [],
  "risk_flags": [],
  "considerations": [],
  "confidence": "medium",
  "source_contexts": [],
  "tool_calls": []
}
```

---

# AI Memory Injection

Phase 5A introduces lightweight memory.

The AI should remember:

- active account
- previous portfolio questions
- recent insight topics
- user risk preference later
- recent AI analysis

---

# Conversation Compression

Large conversation history must be compressed.

Instead of:

```text
200 messages
```

Convert into:

```text
compressed memory summary
```

Example:

```text
User frequently asks about technology exposure and downside protection.
```

---

# Required Database Tables

## ai_orchestration_logs

```text
id
user_id
conversation_id
intent_type
provider
model
tool_calls_json
response_time_ms
status
metadata
created_at
updated_at
```

---

## ai_tool_execution_logs

```text
id
user_id
tool_name
execution_status
execution_time_ms
input_json
output_json
metadata
created_at
updated_at
```

---

## ai_memory_blocks

```text
id
user_id
conversation_id
memory_type
summary
importance_score
metadata
created_at
updated_at
```

---

## ai_provider_routes

```text
id
provider
model
supported_features
priority
is_active
metadata
created_at
updated_at
```

---

# Required API Endpoints

```text
POST /api/ai/orchestrator/chat
POST /api/ai/orchestrator/analyze

GET  /api/ai/orchestrator/intents
GET  /api/ai/orchestrator/providers
GET  /api/ai/orchestrator/tools

POST /api/ai/orchestrator/rebuild-memory
POST /api/ai/orchestrator/refresh-routes
```

---

# AI Prompt Rules

All prompts must include:

```text
Portfolio mode awareness
No trade execution rule
Risk disclaimer
Context freshness warning
Uncertainty handling
```

---

# Required Guardrails

## AI Must Never

- execute trades
- promise profits
- guarantee returns
- create panic wording
- bypass read-only mode
- pretend outdated data is live
- hallucinate holdings

---

# AI Confidence System

Responses should include:

```text
low
medium
high
```

based on:

- context completeness
- freshness
- analytics quality
- missing data

---

# Frontend Pages

Create:

```text
/ai/orchestrator
/ai/memory
/ai/providers
/ai/tools
```

---

# Frontend Components

Create reusable components:

```text
AiProviderBadge
AiIntentBadge
AiToolExecutionCard
AiMemoryCard
AiConfidenceBadge
AiPipelineViewer
AiReasoningTrace
AiContextStatus
```

---

# Orchestration UI

The UI should visualize:

```text
Question
    ↓
Intent
    ↓
Context
    ↓
Tools Used
    ↓
Provider Used
    ↓
Final AI Response
```

Like:

```text
AI reasoning pipeline visualization
```

---

# Dashboard Widgets

Add:

```text
AI Intent Type
AI Confidence
Provider Used
Context Freshness
Recent Tool Calls
AI Memory Summary
```

---

# Queue Jobs

Create:

```text
GenerateAiResponseJob
CompressConversationMemoryJob
RefreshProviderRoutingJob
GenerateAiReasoningTraceJob
ValidateAiResponseJob
```

Use Redis queues:

```text
ai-orchestration
ai-memory
ai-validation
```

---

# Environment Variables

```env
AI_ORCHESTRATION_ENABLED=true

AI_PROVIDER_OPENAI_ENABLED=true
AI_PROVIDER_CLAUDE_ENABLED=true
AI_PROVIDER_GEMINI_ENABLED=false
AI_PROVIDER_OLLAMA_ENABLED=true

AI_ENABLE_TOOL_CALLING=true
AI_ENABLE_MEMORY=true
AI_ENABLE_PROVIDER_ROUTING=true

AI_MAX_CONTEXT_TOKENS=12000
AI_MEMORY_COMPRESSION_ENABLED=true
```

---

# Caching Strategy

Cache:

```text
context payloads
tool outputs
provider routing
prompt blocks
memory summaries
```

Example keys:

```text
ai:context:{user_id}
ai:memory:{conversation_id}
ai:tool:risk:{snapshot_id}
```

---

# Engineering Rules

## Do

- Keep orchestration modular
- Separate providers cleanly
- Keep tool execution isolated
- Log AI execution pipeline
- Keep prompts reusable
- Support future multi-agent system
- Support local LLM later

---

## Do Not

- Hardcode provider logic everywhere
- Mix orchestration with frontend
- Depend on one AI model only
- Add autonomous execution
- Add portfolio optimization yet

---

# Testing Requirements

Create tests for:

- intent detection
- provider routing
- tool execution
- prompt assembly
- memory compression
- response validation
- confidence scoring
- fallback provider handling

---

# Acceptance Criteria

Phase 5A complete when:

- AI orchestration pipeline works
- Intent classification works
- Context routing works
- Prompt assembly works
- Tool execution works
- Provider routing works
- AI memory works
- Structured AI responses work
- AI confidence scoring works
- Orchestration logs visible
- No trade execution exists

---

# What Not To Build Yet

Do not add:

- Multi-agent collaboration
- Autonomous portfolio optimization
- Auto-rebalancing
- Trade execution
- AI autonomous trading
- FinRL integration
- LEAN backtesting
- Quant strategy generation

Those belong to later phases.

---

# Next Phase Preview

```text
Phase 5B — Portfolio Reasoning Engine
```

Phase 5B akan tambah:

- deeper portfolio reasoning
- causal portfolio explanation
- scenario simulation
- downside reasoning
- portfolio behavior modeling
- explanation chains

---

# Final Architecture Reminder

```text
Phase 4 → AI Context Builder
        ↓
Phase 5 → AI Copilot
        ↓
Phase 5A → AI Orchestration Engine
        ↓
Phase 5B → Portfolio Reasoning Engine
        ↓
Phase 6 → Optimization Engine
```

Phase 5A transforms AI Copilot into a scalable institutional AI reasoning architecture.

