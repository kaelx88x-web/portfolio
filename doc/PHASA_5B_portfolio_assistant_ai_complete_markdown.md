# Phase 5B — Portfolio Assistant AI

> Portfolio AI SaaS  
> AI Copilot Module  
> Portfolio Explanation & Insight Assistant

---

# Objective

Phase 5B introduces the:

```text
Portfolio Assistant AI
```

This module helps users understand:

- portfolio structure
- allocation
- holdings
- diversification
- performance
- portfolio behavior

using:

```text
plain-language AI explanations
```

The goal is NOT to create:

- auto trading
- guaranteed recommendation
- autonomous investing

The goal is:

```text
AI-powered portfolio understanding
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
AI Copilot
        ↓
Portfolio Assistant AI
```

---

# Main Purpose

Portfolio Assistant AI acts like:

```text
AI portfolio explainer
+ portfolio interpreter
+ allocation assistant
+ investment education layer
```

It should help users answer:

```text
What do I own?
Why is my portfolio risky?
Where is my biggest exposure?
How diversified am I?
Why did my portfolio move today?
```

---

# Main Features

## 1. Portfolio Overview Explanation

AI explains:

- total portfolio value
- top holdings
- allocation
- account distribution
- diversification quality
- growth trend

Example:

```text
Your portfolio is mainly concentrated in US technology and growth ETFs. The largest holding is SCHG at 28% of total allocation.
```

---

## 2. Allocation Explanation

AI explains:

- sector allocation
- country allocation
- asset class allocation
- cash allocation
- overweight positions
- concentration risk

Example:

```text
Technology exposure is currently 46%, which may increase volatility during tech sector pullbacks.
```

---

## 3. Holdings Intelligence

AI explains:

- top contributors
- largest positions
- portfolio drivers
- high volatility holdings
- income holdings
- defensive holdings

Example:

```text
JEPQ contributes most of your dividend income, while SCHG contributes most of your growth exposure.
```

---

## 4. Diversification Analysis

AI explains:

- diversification quality
- hidden correlation
- overlapping exposure
- concentration clusters

Example:

```text
Although you hold multiple ETFs, several are heavily weighted toward large-cap US technology companies.
```

---

## 5. Performance Explanation

AI explains:

- gain/loss drivers
- portfolio trend
- benchmark comparison
- drawdown explanation
- volatility explanation

Example:

```text
Recent weakness mainly comes from semiconductor holdings and Nasdaq-related exposure.
```

---

# Required Backend Module

```text
backend/
└── modules/
    └── ai-copilot/
        └── portfolio-assistant/
            ├── Controllers/
            │   └── PortfolioAssistantController.php
            ├── Services/
            │   ├── PortfolioAssistantService.php
            │   ├── PortfolioExplanationService.php
            │   ├── AllocationExplanationService.php
            │   ├── DiversificationInsightService.php
            │   ├── HoldingsInsightService.php
            │   └── PortfolioNarrativeService.php
            ├── DTOs/
            │   ├── PortfolioAssistantDTO.php
            │   ├── AllocationInsightDTO.php
            │   └── DiversificationInsightDTO.php
            ├── Prompts/
            │   ├── explain-portfolio.md
            │   ├── explain-allocation.md
            │   ├── explain-diversification.md
            │   ├── explain-performance.md
            │   └── explain-holdings.md
            ├── Jobs/
            │   ├── GeneratePortfolioAssistantInsightJob.php
            │   └── RefreshPortfolioNarrativeJob.php
            ├── Routes/
            │   └── api.php
            └── Providers/
                └── PortfolioAssistantServiceProvider.php
```

---

# Required Services

## PortfolioAssistantService

Main orchestration service.

Responsibilities:

- load AI context
- generate portfolio explanations
- build assistant insights
- generate structured responses

---

## PortfolioExplanationService

Explains:

- total portfolio
- account structure
- overall exposure
- allocation summary

---

## AllocationExplanationService

Explains:

- sector exposure
- country exposure
- asset class balance
- cash allocation
- overweight positions

---

## DiversificationInsightService

Explains:

- diversification quality
- overlap risk
- concentration clusters
- hidden correlation

---

## HoldingsInsightService

Explains:

- top holdings
- volatility contributors
- income contributors
- growth contributors

---

## PortfolioNarrativeService

Creates:

```text
human-readable portfolio story
```

Example:

```text
Your portfolio currently leans toward long-term US growth exposure with moderate income generation from covered call ETFs.
```

---

# Required Prompt Templates

Create:

```text
explain-portfolio.md
explain-allocation.md
explain-diversification.md
explain-performance.md
explain-holdings.md
```

---

# Example Prompt Structure

```text
System:
You are Portfolio Assistant AI.

Explain portfolio data clearly and safely.
Do not provide guaranteed investment outcomes.
Do not tell the user to buy or sell directly.

Context:
{portfolio_context}

User Question:
{question}

Return:
1. Summary
2. What the data suggests
3. Key observations
4. Risk considerations
5. Educational explanation
```

---

# Required API Endpoints

```text
GET  /api/ai/portfolio-assistant/summary
GET  /api/ai/portfolio-assistant/allocation
GET  /api/ai/portfolio-assistant/diversification
GET  /api/ai/portfolio-assistant/holdings
GET  /api/ai/portfolio-assistant/performance

POST /api/ai/portfolio-assistant/explain
POST /api/ai/portfolio-assistant/refresh
```

All endpoints require:

```text
auth:sanctum
ownership validation
rate limiting
```

---

# Example AI Response

```json
{
  "summary": "Your portfolio is moderately growth-oriented with strong exposure to US technology and ETF holdings.",
  "key_observations": [
    "Top 3 positions represent 58% of total portfolio value",
    "Technology exposure is above market average",
    "Cash allocation remains relatively low"
  ],
  "risk_considerations": [
    "Portfolio volatility may increase during Nasdaq pullbacks",
    "Sector concentration risk is elevated"
  ],
  "educational_note": "Diversification across sectors and asset classes may help reduce concentration risk over time."
}
```

---

# Required Database Tables

## ai_portfolio_narratives

```text
id
user_id
portfolio_snapshot_id nullable
active_account_id nullable
title
summary
narrative
risk_level
metadata
created_at
updated_at
```

---

## ai_portfolio_explanations

```text
id
user_id
explanation_type
question
response
context_hash
metadata
created_at
updated_at
```

Explanation types:

```text
portfolio
allocation
diversification
performance
holdings
```

---

# Frontend Pages

Create:

```text
/ai/portfolio-assistant
/ai/portfolio-assistant/allocation
/ai/portfolio-assistant/diversification
/ai/portfolio-assistant/performance
```

---

# Frontend Components

Create reusable components:

```text
PortfolioAssistantPanel
PortfolioNarrativeCard
AllocationInsightCard
DiversificationInsightCard
HoldingsInsightTable
PortfolioStoryTimeline
AiObservationCard
AiRiskNotice
AiEducationalTip
```

---

# Dashboard Widgets

Add:

```text
AI Portfolio Summary
AI Diversification Insight
AI Allocation Commentary
AI Holdings Commentary
AI Portfolio Story
```

---

# Suggested User Questions

```text
Explain my portfolio in simple terms
What is my biggest exposure?
Am I diversified enough?
Why is my portfolio volatile?
Which holdings drive most of my performance?
How balanced is my allocation?
```

---

# UI Requirements

The UI should feel:

```text
Professional
AI-native
Clean finance dashboard
Educational
Trustworthy
Modern SaaS
```

Inspired by:

- Ghostfolio
- OpenBB
- Portfolio Visualizer
- FinceptTerminal

---

# AI Safety Rules

## Must Do

- Explain uncertainty
- Explain risk clearly
- Use educational wording
- Use portfolio context only
- Mention missing data if needed
- Explain concentration carefully

---

## Must Not

- Promise returns
- Say “guaranteed”
- Say “buy now”
- Execute trades
- Override user decisions
- Hide downside risk

---

# Account Mode Awareness

## Real Account

```text
READ-ONLY ANALYTICS MODE
```

AI may:

- explain portfolio
- explain risk
- explain allocation

AI may NOT:

- execute trades
- rebalance automatically
- place orders

---

## Paper Account

```text
SANDBOX SIMULATION MODE
```

AI may:

- explain simulated results
- analyze sandbox performance
- compare simulated allocation

AI may NOT:

- imply guaranteed future results
- execute real trades

---

# Queue Jobs

Create:

```text
GeneratePortfolioNarrativeJob
GenerateAllocationInsightJob
GenerateDiversificationInsightJob
GeneratePerformanceNarrativeJob
RefreshPortfolioAssistantCacheJob
```

---

# Caching Strategy

Use:

```text
Redis cache
AI narrative cache
allocation insight cache
```

Example:

```text
ai:portfolio-assistant:{user_id}:summary
ai:portfolio-assistant:{user_id}:allocation
```

---

# Testing Requirements

Create tests for:

- explanation generation
- ownership validation
- prompt builder formatting
- allocation insight logic
- diversification explanation
- missing data handling
- account mode awareness
- cache refresh

---

# Acceptance Criteria

Phase 5B complete when:

- User can open Portfolio Assistant page
- AI can explain portfolio structure
- AI can explain allocation
- AI can explain diversification
- AI can explain performance
- AI narratives are generated
- AI explanations are cached
- Account mode awareness works
- Real accounts remain read-only
- Paper accounts remain sandbox-only
- No trade execution exists

---

# What Not To Build Yet

Do not add:

- autonomous AI investing
- AI order execution
- auto rebalancing
- multi-agent orchestration
- RL strategy generation
- quant backtesting
- FinRL integration

Those belong to later phases.

---

# Codex Implementation Instruction

```md
# TASK: Build Phase 5B — Portfolio Assistant AI

You are the Code agent for Portfolio AI.

Build Phase 5B: Portfolio Assistant AI.

## Context
Previous phases already exist:

- Phase 1 → Portfolio Insight
- Phase 2 → Broker Sync
- Phase 2A → Moomoo Sync
- Phase 2B → Paper Trading Sandbox
- Phase 3 → Analytics Engine
- Phase 4 → AI Context Builder
- Phase 5A → AI Chat Engine

This phase adds:

- AI portfolio explanation
- AI allocation explanation
- AI diversification insight
- AI portfolio narrative generation
- AI holdings intelligence

## Goals
Create a safe AI-powered portfolio assistant.

The assistant should:

- explain portfolio structure
- explain allocation
- explain diversification
- explain performance
- explain concentration risk
- explain holdings

Do NOT create:

- auto trading
- buy/sell execution
- guaranteed investment advice
- autonomous portfolio management

## Backend Requirements

Create:

- PortfolioAssistantService
- PortfolioExplanationService
- AllocationExplanationService
- DiversificationInsightService
- HoldingsInsightService
- PortfolioNarrativeService

Create:

- AI explanation endpoints
- AI narrative generation
- explanation caching
- account mode awareness
- ownership validation

Use:

- Laravel API
- Redis cache
- auth:sanctum
- queue jobs

## Frontend Requirements

Create pages:

- /ai/portfolio-assistant
- /ai/portfolio-assistant/allocation
- /ai/portfolio-assistant/diversification
- /ai/portfolio-assistant/performance

Create components:

- PortfolioAssistantPanel
- PortfolioNarrativeCard
- AllocationInsightCard
- DiversificationInsightCard
- HoldingsInsightTable
- AiObservationCard
- AiRiskNotice
- AiEducationalTip

## AI Rules

The AI:

- must explain uncertainty
- must explain risk clearly
- must avoid guaranteed wording
- must never execute trades
- must remain educational
- must support paper account mode
- must support real account read-only mode

## Safety

Never:

- place trades
- generate guaranteed returns
- override user decisions
- auto rebalance portfolios

## Deliverables

- Backend AI assistant module
- AI explanation services
- Prompt templates
- API endpoints
- Database migrations
- Frontend pages
- Dashboard widgets
- Queue jobs
- Cache layer
- Tests
```

---

# Final Architecture Reminder

```text
Analytics Engine
        ↓
AI Context Builder
        ↓
Portfolio Assistant AI
        ↓
Risk Advisor AI
        ↓
Portfolio Health AI
```

Phase 5B should make users feel:

```text
“My portfolio finally makes sense.”
```

