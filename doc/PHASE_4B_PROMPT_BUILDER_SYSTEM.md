# Phase 4B — Prompt Builder System

> Portfolio AI SaaS  
> AI Infrastructure Layer  
> AI Prompt Engineering & Orchestration System

---

# Objective

Phase 4B membina:

```text
Prompt Builder System
+ Prompt Orchestration
+ Prompt Compression
+ AI Provider-ready Prompt Layer
```

Phase ini menyambung selepas:

```text
Phase 4A — AI Context Builder
```

4B bertanggungjawab untuk menukar:

```text
AI Context JSON
```

menjadi:

```text
LLM-ready prompts
```

untuk:

- Gemini
- OpenAI
- Claude
- Ollama
- Future Multi-Agent AI

---

# Core Vision

Portfolio AI tidak boleh:

```text
Hardcode prompt dalam controller
```

Sebaliknya:

```text
AI Context
    ↓
Prompt Builder
    ↓
Prompt Templates
    ↓
Provider Formatter
    ↓
LLM Request
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
Prompt Builder System
    ↓
LLM Provider Layer
    ↓
AI Copilot
```

---

# Main Goals

- Build reusable prompt system
- Build provider-ready prompts
- Reduce token usage
- Build prompt compression layer
- Separate prompt logic from AI chat
- Support multiple AI providers
- Support future multi-agent prompts

---

# What This Phase Builds

## Main Features

- Prompt template system
- System prompt manager
- Prompt orchestration
- Prompt compression
- AI provider formatting
- Context injection
- Prompt versioning
- Prompt safety layer
- Prompt cache layer

---

# What This Phase Does NOT Build Yet

Jangan buat lagi:

- AI chat UI
- AI conversation history
- AI memory persistence
- Multi-agent orchestration
- Auto trading logic
- Autonomous AI reasoning

Semua itu masuk:

```text
Phase 4C
Phase 4D
Phase 5
```

---

# Backend Module

```text
backend/
└── modules/
    └── prompt-builder/
        ├── Controllers/
        │   └── PromptBuilderController.php
        ├── Services/
        │   ├── PromptBuilderService.php
        │   ├── PromptTemplateService.php
        │   ├── PromptCompressionService.php
        │   ├── PromptSafetyService.php
        │   ├── PromptCacheService.php
        │   └── ProviderFormattingService.php
        ├── Templates/
        │   ├── portfolio-health.md
        │   ├── risk-analysis.md
        │   ├── allocation-review.md
        │   ├── benchmark-summary.md
        │   ├── performance-summary.md
        │   └── market-commentary.md
        ├── DTOs/
        │   ├── PromptRequestDTO.php
        │   ├── PromptResponseDTO.php
        │   └── PromptContextDTO.php
        ├── Jobs/
        │   ├── GeneratePromptJob.php
        │   ├── CompressPromptJob.php
        │   └── CachePromptJob.php
        ├── Routes/
        │   └── api.php
        └── Providers/
            └── PromptBuilderServiceProvider.php
```

---

# Prompt Flow

```text
AI Context JSON
    ↓
Prompt Template
    ↓
Context Injection
    ↓
Prompt Compression
    ↓
Provider Formatting
    ↓
LLM-ready Prompt
```

---

# Required Prompt Types

Support:

```text
portfolio_health
risk_analysis
allocation_review
benchmark_summary
performance_summary
market_commentary
```

---

# Example Prompt Template

## risk-analysis.md

```text
You are Portfolio AI Copilot.

Explain portfolio risk clearly.

Do not give guaranteed financial advice.

Portfolio Context:
{{portfolio_context}}

User Question:
{{question}}

Return:
- Risk summary
- Main concentration risk
- Important observations
- Safer considerations
```

---

# Prompt Compression

Before sending to AI:

```text
Raw Context
    ↓
Normalize
    ↓
Remove unnecessary fields
    ↓
Compress
    ↓
Prompt Ready
```

Benefits:

- lower token cost
- faster response
- cheaper AI calls
- cleaner reasoning

---

# Required Database Tables

## ai_prompt_templates

```text
id
name
slug
version
system_prompt
user_prompt_template
is_active
metadata
created_at
updated_at
```

---

## ai_prompt_logs

```text
id
user_id
prompt_type
provider
model
prompt_tokens
compressed_tokens
status
metadata
created_at
updated_at
```

---

# API Endpoints

```text
GET  /api/prompts
GET  /api/prompts/{slug}
POST /api/prompts/generate
POST /api/prompts/compress
POST /api/prompts/cache-refresh
```

---

# Example Prompt Response

```json
{
  "provider": "gemini",
  "model": "gemini-2.5-pro",
  "prompt_type": "risk_analysis",
  "prompt": "You are Portfolio AI Copilot..."
}
```

---

# Provider Formatting

Support:

```text
OpenAI
Gemini
Claude
Ollama
```

Each provider may require:

- different message format
- different token structure
- different system prompt format

---

# Example Provider Structure

## OpenAI

```json
{
  "messages": [
    {
      "role": "system",
      "content": "..."
    }
  ]
}
```

## Gemini

```json
{
  "contents": [
    {
      "parts": [
        {
          "text": "..."
        }
      ]
    }
  ]
}
```

---

# Prompt Safety Rules

## Must Do

- Explain uncertainty
- Avoid guaranteed returns
- Avoid direct buy/sell commands
- Keep language neutral
- Explain risk

## Must Not

- Promise profits
- Execute trades
- Hide risk
- Use manipulative language

---

# Queue Jobs

```text
GeneratePromptJob
CompressPromptJob
CachePromptJob
RefreshPromptTemplatesJob
```

---

# Redis Cache

```text
prompt:{type}:{provider}
prompt:compressed:{user_id}
prompt:template:{slug}
```

---

# Frontend Pages

```text
/ai/prompts
/ai/prompts/templates
/ai/prompts/viewer
```

---

# Frontend Components

```text
PromptTemplateCard
PromptViewer
PromptCompressionBadge
PromptProviderBadge
PromptGenerationPanel
```

---

# Environment Variables

```env
PROMPT_BUILDER_ENABLED=true
PROMPT_CACHE_ENABLED=true
PROMPT_COMPRESSION_ENABLED=true
PROMPT_DEFAULT_PROVIDER=gemini
PROMPT_DEFAULT_MODEL=gemini-2.5-pro
```

---

# Engineering Rules

## Do

- Separate prompts from controllers
- Use reusable templates
- Compress prompts
- Cache prompts
- Support provider abstraction
- Support future multi-agent prompts

## Do Not

- Hardcode prompts in chat service
- Duplicate prompts
- Store unnecessary raw prompts
- Build chat UI in this phase

---

# Testing Requirements

Create tests for:

```text
Prompt generation
Prompt compression
Provider formatting
Template loading
Prompt caching
Prompt safety filtering
```

---

# Acceptance Criteria

Phase 4B complete when:

- Prompt templates work
- Prompt generation works
- Prompt compression works
- Provider formatting works
- Prompt cache works
- Prompt API works
- Multiple provider support works

---

# Next Phase

```text
Phase 4C — AI Memory Layer
```

4C akan tambah:

- AI memory snapshots
- conversation memory
- compressed memory
- reusable AI history
- AI cache intelligence

---

# Final Reminder

```text
Phase 4A = Structured AI Context
Phase 4B = Prompt Engineering Layer
Phase 5 = AI Copilot Experience
```
