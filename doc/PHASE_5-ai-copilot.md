# Phase 5 — AI Copilot

> Portfolio AI SaaS  
> AI Portfolio Copilot Layer  
> Mode: Insight, Explanation & Decision Support Only

---

# Purpose

Phase 5 introduces the **AI Copilot** layer for Portfolio AI.

This phase connects the structured portfolio context from Phase 4 into an AI assistant that can explain portfolio health, risk, allocation, performance, and market context in a simple user-facing chat experience.

The goal is not to build an auto-trading bot. The goal is to create an intelligent assistant that helps users understand their portfolio.

---

# Important Rule

Phase 5 is **ADVISORY ONLY**.

Do not build:

- Auto trading
- AI order execution
- Real buy / sell placement
- Autonomous portfolio management
- Guaranteed investment recommendation
- Financial advice wording that sounds final or certain

The AI Copilot must always explain risk and uncertainty.

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
[AI Context Builder]
        ↓
[AI Copilot Layer]
        ↓
[User Insight Dashboard]
```

---

# Main Data Flow

```text
Portfolio Snapshot
    ↓
Analytics Metrics
    ↓
AI Context JSON
    ↓
Prompt Builder
    ↓
LLM Provider
    ↓
AI Copilot Response
    ↓
Insight Cards + Chat UI
```

---

# Phase 5 Goals

## Main Goals

- Build AI Copilot chat interface
- Connect Copilot to `/api/portfolio/context`
- Generate portfolio health explanation
- Generate risk explanation
- Generate allocation commentary
- Generate benchmark comparison summary
- Generate market commentary based on portfolio holdings
- Store AI conversations
- Store AI insight history
- Add safety guardrails
- Add prompt templates
- Add response formatting

---

# Core Copilot Features

## 1. Portfolio Health Summary

The Copilot should explain:

- Overall portfolio condition
- Risk level
- Concentration risk
- Cash position
- Diversification quality
- Performance trend

Example:

```text
Your portfolio looks moderately risky because 62% of the value is concentrated in 3 technology stocks.
```

---

## 2. Risk Analysis

The Copilot should explain:

- Volatility
- Drawdown
- Sector concentration
- Single stock exposure
- Currency exposure
- Correlation risk

Example questions:

```text
Why is my portfolio risky?
What position is increasing my volatility?
What happens if tech stocks drop?
```

---

## 3. Allocation Assistant

The Copilot should help users understand:

- Asset allocation
- Sector allocation
- Country exposure
- Cash ratio
- ETF vs stock balance
- Overweight / underweight areas

Example questions:

```text
Am I too concentrated in one sector?
How balanced is my portfolio?
What is my largest exposure?
```

---

## 4. Performance Explanation

The Copilot should explain:

- Portfolio return
- Unrealized gain / loss
- Realized gain / loss
- Benchmark comparison
- Best and worst contributors

Example questions:

```text
Why did my portfolio go down?
Which holding contributed most to my gains?
How does my portfolio compare to SPY?
```

---

## 5. Market Commentary

The Copilot may explain market context based on:

- Holdings
- Sectors
- Watchlist
- Macro summary
- News summary later

In Phase 5, keep market commentary simple and optional.

---

# Required Backend Module

Create this structure:

```text
backend/
└── modules/
    └── ai-copilot/
        ├── Controllers/
        │   └── AiCopilotController.php
        ├── Services/
        │   ├── AiCopilotService.php
        │   ├── AiPromptBuilderService.php
        │   ├── AiContextResolverService.php
        │   ├── AiInsightService.php
        │   ├── AiConversationService.php
        │   └── AiGuardrailService.php
        ├── DTOs/
        │   ├── AiMessageDTO.php
        │   ├── AiContextDTO.php
        │   └── AiInsightDTO.php
        ├── Prompts/
        │   ├── portfolio-health.md
        │   ├── risk-analysis.md
        │   ├── allocation-review.md
        │   ├── performance-summary.md
        │   └── market-commentary.md
        ├── Jobs/
        │   ├── GeneratePortfolioInsightJob.php
        │   └── SummarizeAiConversationJob.php
        ├── Enums/
        │   ├── AiInsightType.php
        │   └── AiRiskLevel.php
        ├── Routes/
        │   └── api.php
        └── Providers/
            └── AiCopilotServiceProvider.php
```

---

# Required Database Tables

Create migrations for:

```text
ai_conversations
ai_messages
ai_insights
ai_prompt_templates
ai_usage_logs
```

---

# Database Design

## ai_conversations

```text
id
user_id
portfolio_id nullable
active_account_id nullable
title
status
metadata
created_at
updated_at
```

---

## ai_messages

```text
id
ai_conversation_id
user_id
role
content
context_snapshot_id nullable
metadata
created_at
updated_at
```

Role values:

```text
user
assistant
system
tool
```

---

## ai_insights

```text
id
user_id
portfolio_snapshot_id nullable
active_account_id nullable
insight_type
title
summary
risk_level
content_json
expires_at nullable
metadata
created_at
updated_at
```

Insight types:

```text
portfolio_health
risk_analysis
allocation_review
performance_summary
market_commentary
```

---

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

## ai_usage_logs

```text
id
user_id
provider
model
prompt_tokens
completion_tokens
total_tokens
cost_estimate
request_type
metadata
created_at
updated_at
```

---

# Required API Endpoints

```text
GET    /api/ai/copilot/conversations
POST   /api/ai/copilot/conversations
GET    /api/ai/copilot/conversations/{id}
POST   /api/ai/copilot/chat

GET    /api/ai/insights
POST   /api/ai/insights/generate
GET    /api/ai/insights/{id}

GET    /api/ai/prompts
POST   /api/ai/prompts/reload
GET    /api/ai/usage
```

All endpoints must use:

```text
auth:sanctum
ownership check
rate limit
```

---

# AI Copilot Request Flow

```text
User asks question
    ↓
AiCopilotController
    ↓
Validate user + active account
    ↓
AiContextResolverService
    ↓
Load portfolio context from Phase 4
    ↓
AiPromptBuilderService
    ↓
Build prompt with guardrails
    ↓
AiCopilotService
    ↓
Call LLM provider
    ↓
AiGuardrailService
    ↓
Format safe response
    ↓
Save ai_messages
    ↓
Return response to frontend
```

---

# LLM Provider Design

Use provider abstraction.

```text
backend/
└── modules/
    └── ai-copilot/
        └── Providers/
            ├── LlmProviderInterface.php
            ├── OpenAiProvider.php
            ├── ClaudeProvider.php
            └── LocalModelProvider.php
```

Interface:

```php
interface LlmProviderInterface
{
    public function chat(array $messages, array $options = []): array;
}
```

This makes the system ready for:

```text
OpenAI
Claude
Gemini
Ollama
FinGPT later
FinRobot later
```

---

# Prompt Builder Requirements

Every AI prompt must include:

- User question
- Portfolio context JSON
- Risk metrics
- Allocation summary
- Performance summary
- Active account mode
- Safety instruction
- No trade execution rule
- Uncertainty disclaimer

Example prompt structure:

```text
System:
You are Portfolio AI Copilot. Explain portfolio data clearly. Do not promise returns. Do not execute trades.

Context:
{portfolio_context_json}

User Question:
{user_question}

Return:
- Summary
- Key risks
- Important observations
- Safer next steps
```

---

# Required Prompt Templates

Create these prompt files:

```text
portfolio-health.md
risk-analysis.md
allocation-review.md
performance-summary.md
market-commentary.md
```

---

# Frontend Pages

Create SvelteKit pages:

```text
/ai
/ai/copilot
/ai/insights
/ai/conversations
```

---

# Frontend Components

Create reusable components:

```text
AiCopilotChat
AiMessageBubble
AiInsightCard
AiRiskBadge
AiPortfolioSummaryCard
AiSuggestionChips
AiInsightHistory
AiUsageMeter
AiDisclaimerBox
```

---

# Copilot UI Requirements

The UI should feel:

```text
Modern SaaS
AI-native
Clean finance dashboard
Professional
Calm and trustworthy
```

The Copilot page should show:

- Chat panel
- Suggested questions
- Portfolio context status
- Active account badge
- Risk insight cards
- Recent AI insights
- Disclaimer box

---

# Suggested Questions

Add quick chips:

```text
Why is my portfolio risky?
What is my biggest exposure?
How can I reduce concentration risk?
Which holdings affect my performance most?
How does my portfolio compare to SPY?
Explain my portfolio in simple words.
```

---

# AI Response Format

The response should be structured as:

```text
1. Short summary
2. What the data shows
3. Main risks
4. Possible actions to consider
5. Uncertainty note
```

Do not return long essay by default.

---

# Guardrail Rules

## Must Do

- Explain uncertainty
- Use portfolio data only when available
- Say when data is missing
- Avoid overconfident prediction
- Avoid guaranteed return wording
- Keep real accounts read-only
- Keep paper accounts simulated only

## Must Not Do

- Execute trades
- Say “buy this now”
- Say “guaranteed profit”
- Create fear-based pressure
- Hide risk
- Ignore user account mode
- Use outdated context without warning

---

# Account Mode Awareness

The AI must know active account mode.

## Real Account

```text
Mode: Read-only analytics
```

AI can:

- Explain portfolio
- Explain risk
- Suggest areas to review

AI cannot:

- Place orders
- Auto rebalance
- Execute trades

## Paper Account

```text
Mode: Sandbox simulation
```

AI can:

- Analyze simulated trades
- Explain paper PnL
- Suggest test scenarios

AI cannot:

- Treat paper result as real guarantee
- Execute real trades

---

# Queue Jobs

Create:

```text
GeneratePortfolioInsightJob
SummarizeAiConversationJob
RefreshAiInsightCacheJob
LogAiUsageJob
```

Use Redis queues:

```text
ai-insights
ai-chat
ai-usage
```

---

# Caching Rules

Cache repeated insights for:

```text
5 to 15 minutes
```

Cache key example:

```text
ai:portfolio:{user_id}:{snapshot_id}:{insight_type}
```

Do not cache sensitive raw prompts longer than needed.

---

# Security Requirements

- Never expose API keys to frontend
- Store provider keys only in backend `.env`
- Log usage, not full sensitive portfolio content by default
- Rate limit AI chat
- Validate ownership of conversations
- Validate ownership of portfolio context
- Mask sensitive account identifiers

---

# Environment Variables

```env
AI_COPILOT_ENABLED=true
AI_PROVIDER=openai
AI_MODEL=gpt-4o-mini
AI_MAX_TOKENS=1200
AI_TEMPERATURE=0.2
AI_CHAT_RATE_LIMIT_PER_MINUTE=10
AI_STORE_FULL_PROMPTS=false
```

Optional:

```env
OPENAI_API_KEY=
ANTHROPIC_API_KEY=
GEMINI_API_KEY=
OLLAMA_BASE_URL=http://localhost:11434
```

---

# Example AI Insight JSON

```json
{
  "type": "risk_analysis",
  "title": "Portfolio Risk Review",
  "summary": "Your portfolio has moderate concentration risk due to high exposure to technology stocks.",
  "risk_level": "moderate",
  "observations": [
    "Top 3 holdings represent 62% of portfolio value",
    "Cash ratio is 8%",
    "Portfolio volatility is above benchmark"
  ],
  "considerations": [
    "Review single-stock exposure",
    "Compare allocation against target weights",
    "Consider whether cash reserve is sufficient"
  ]
}
```

---

# Testing Requirements

Add tests for:

- Prompt builder output
- Guardrail filtering
- Conversation creation
- AI message saving
- Insight generation
- Ownership authorization
- Rate limit handling
- Missing context handling
- Active account mode handling

---

# Deliverables Checklist

- [ ] AI Copilot backend module
- [ ] LLM provider abstraction
- [ ] OpenAI provider implementation
- [ ] Prompt builder service
- [ ] Context resolver service
- [ ] Guardrail service
- [ ] AI conversations table
- [ ] AI messages table
- [ ] AI insights table
- [ ] AI usage logs table
- [ ] Chat API endpoint
- [ ] Generate insight endpoint
- [ ] SvelteKit AI Copilot page
- [ ] AI chat component
- [ ] Insight cards
- [ ] Suggested question chips
- [ ] AI disclaimer box
- [ ] Rate limiting
- [ ] Usage logging
- [ ] Tests

---

# Acceptance Criteria

Phase 5 is complete when:

- User can open AI Copilot page
- User can ask portfolio questions
- Copilot can access Phase 4 portfolio context
- Copilot can explain portfolio health
- Copilot can explain risk
- Copilot can explain allocation
- Copilot can explain performance
- AI conversations are saved
- AI insights are saved
- Rate limit works
- AI usage is logged
- Real accounts remain read-only
- Paper accounts remain sandbox only
- No trade execution exists

---

# What Not To Build Yet

Do not add:

- Multi-agent system
- News agent
- Macro agent
- FinGPT fine-tuning
- FinRobot orchestration
- Auto rebalancing
- Real order execution
- LEAN backtesting
- FinRL reinforcement learning

Those belong to later phases.

---

# Next Phase Preview

> **Phase 6 — Optimization Engine**  
> Riskfolio-Lib integration, efficient frontier, risk parity, max Sharpe, min volatility, and AI rebalance suggestions.

---

# Final Architecture Reminder

```text
Phase 4 AI Context Builder
        ↓
Phase 5 AI Copilot
        ↓
Phase 6 Optimization Engine
        ↓
Phase 7 Multi-Agent Layer
```

Phase 5 should make the system feel intelligent, helpful, and safe — without turning it into an auto-trading system.
