# Phase 5C — Risk Advisor AI

> Portfolio AI SaaS  
> AI Copilot Module  
> AI Risk Intelligence & Portfolio Warning System

---

# Objective

Phase 5C introduces:

```text
Risk Advisor AI
```

This module transforms portfolio analytics and exposure data into:

- AI-powered risk explanation
- portfolio warning intelligence
- concentration alerts
- volatility interpretation
- downside awareness
- educational risk guidance

The goal is NOT to create:

- panic-driven trading
- auto portfolio liquidation
- financial guarantees
- autonomous execution

The goal is:

```text
AI-powered portfolio risk understanding
```

---

# Architecture Position

```text
Portfolio Core
        ↓
Analytics Engine
        ↓
Risk & Exposure Engine
        ↓
AI Context Builder
        ↓
AI Copilot
        ↓
Risk Advisor AI
```

---

# Main Purpose

Risk Advisor AI acts like:

```text
AI portfolio risk analyst
+ AI volatility explainer
+ AI concentration detector
+ AI downside awareness system
```

It should help users answer:

```text
Why is my portfolio risky?
What causes most volatility?
Am I too concentrated?
How exposed am I to one sector?
What happens if tech drops?
Why did my drawdown increase?
```

---

# Main Features

## 1. Portfolio Risk Explanation

AI explains:

- overall risk level
- volatility profile
- drawdown exposure
- concentration risk
- diversification quality
- liquidity exposure

Example:

```text
Your portfolio currently has elevated volatility because most holdings are concentrated in high-growth technology stocks.
```

---

## 2. Concentration Risk Analysis

AI explains:

- single stock concentration
- sector concentration
- country concentration
- broker concentration
- correlated exposure

Example:

```text
The top 3 holdings represent 61% of total portfolio value, which increases downside concentration risk.
```

---

## 3. Volatility Intelligence

AI explains:

- portfolio volatility
- volatility trends
- unstable holdings
- high beta exposure
- benchmark-relative volatility

Example:

```text
Your portfolio volatility is currently higher than SPY due to aggressive growth positioning.
```

---

## 4. Drawdown & Downside Analysis

AI explains:

- recent drawdown
- historical weakness
- downside exposure
- recovery profile
- stress scenarios

Example:

```text
Most recent drawdown came from semiconductor and leveraged growth exposure.
```

---

## 5. Exposure Intelligence

AI explains:

- sector exposure
- country exposure
- currency exposure
- asset class exposure
- growth vs defensive exposure

Example:

```text
Technology and Nasdaq-related holdings dominate portfolio exposure, increasing sensitivity to growth market pullbacks.
```

---

# Required Backend Module

```text
backend/
└── modules/
    └── ai-copilot/
        └── risk-advisor/
            ├── Controllers/
            │   └── RiskAdvisorController.php
            ├── Services/
            │   ├── RiskAdvisorService.php
            │   ├── PortfolioRiskExplanationService.php
            │   ├── ConcentrationRiskService.php
            │   ├── VolatilityNarrativeService.php
            │   ├── DrawdownNarrativeService.php
            │   ├── ExposureNarrativeService.php
            │   ├── RiskAlertService.php
            │   └── PortfolioStressNarrativeService.php
            ├── DTOs/
            │   ├── RiskInsightDTO.php
            │   ├── ExposureInsightDTO.php
            │   ├── VolatilityInsightDTO.php
            │   └── DrawdownInsightDTO.php
            ├── Prompts/
            │   ├── explain-risk.md
            │   ├── explain-volatility.md
            │   ├── explain-concentration.md
            │   ├── explain-drawdown.md
            │   ├── explain-exposure.md
            │   └── explain-portfolio-risk.md
            ├── Jobs/
            │   ├── GenerateRiskNarrativeJob.php
            │   ├── GenerateRiskAlertsJob.php
            │   ├── GenerateExposureNarrativeJob.php
            │   └── RefreshRiskAdvisorCacheJob.php
            ├── Routes/
            │   └── api.php
            └── Providers/
                └── RiskAdvisorServiceProvider.php
```

---

# Required Services

## RiskAdvisorService

Main orchestration service.

Responsibilities:

- load risk analytics
- generate risk explanations
- create AI risk narratives
- aggregate warnings
- build educational responses

---

## PortfolioRiskExplanationService

Explains:

- overall portfolio risk
- risk classification
- risk drivers
- downside exposure

---

## ConcentrationRiskService

Explains:

- single-stock concentration
- sector concentration
- correlated holdings
- diversification weakness

---

## VolatilityNarrativeService

Explains:

- volatility changes
- aggressive exposure
- unstable holdings
- benchmark-relative volatility

---

## DrawdownNarrativeService

Explains:

- historical drawdowns
- downside behavior
- portfolio weakness
- recovery patterns

---

## ExposureNarrativeService

Explains:

- country exposure
- currency exposure
- sector exposure
- broker exposure
- asset-type exposure

---

## RiskAlertService

Generates:

```text
AI risk warning cards
```

Examples:

```text
High concentration risk detected
Technology exposure exceeds 45%
Cash reserve below 3%
Portfolio volatility increasing
```

---

## PortfolioStressNarrativeService

Explains:

- hypothetical downside scenarios
- sector pullback effects
- correlation shocks
- growth market stress

Example:

```text
A large Nasdaq correction would likely impact portfolio performance significantly due to concentrated growth exposure.
```

---

# Required Prompt Templates

Create:

```text
explain-risk.md
explain-volatility.md
explain-concentration.md
explain-drawdown.md
explain-exposure.md
explain-portfolio-risk.md
```

---

# Example Prompt Structure

```text
System:
You are Risk Advisor AI.

Explain portfolio risks clearly and safely.
Do not create fear-based urgency.
Do not guarantee outcomes.
Do not tell the user to buy or sell directly.

Context:
{risk_context}

User Question:
{question}

Return:
1. Risk summary
2. Main risk drivers
3. Portfolio exposure analysis
4. Important warnings
5. Educational explanation
6. Safer considerations
```

---

# Required API Endpoints

```text
GET  /api/ai/risk-advisor/summary
GET  /api/ai/risk-advisor/volatility
GET  /api/ai/risk-advisor/concentration
GET  /api/ai/risk-advisor/drawdown
GET  /api/ai/risk-advisor/exposure
GET  /api/ai/risk-advisor/alerts
GET  /api/ai/risk-advisor/stress-analysis

POST /api/ai/risk-advisor/explain
POST /api/ai/risk-advisor/refresh
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
  "risk_level": "moderate_high",
  "summary": "Your portfolio currently has elevated concentration risk due to large exposure to growth technology holdings.",
  "main_risk_drivers": [
    "Top 3 holdings exceed 60% allocation",
    "Technology exposure dominates portfolio",
    "Portfolio volatility exceeds benchmark"
  ],
  "warnings": [
    "Large Nasdaq pullbacks may significantly affect portfolio value",
    "Low cash reserves reduce defensive flexibility"
  ],
  "educational_note": "Diversification across sectors and asset classes may help reduce concentration-related volatility over time."
}
```

---

# Required Database Tables

## ai_risk_narratives

```text
id
user_id
portfolio_snapshot_id nullable
active_account_id nullable
risk_level
summary
narrative
warnings_json
metadata
created_at
updated_at
```

---

## ai_risk_alerts

```text
id
user_id
alert_type
severity
message
status
expires_at nullable
metadata
created_at
updated_at
```

Alert types:

```text
concentration
volatility
drawdown
sector_exposure
country_exposure
currency_exposure
liquidity_warning
```

---

## ai_risk_explanations

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
risk
volatility
concentration
drawdown
exposure
stress_analysis
```

---

# Frontend Pages

Create:

```text
/ai/risk-advisor
/ai/risk-advisor/volatility
/ai/risk-advisor/concentration
/ai/risk-advisor/drawdown
/ai/risk-advisor/exposure
/ai/risk-advisor/stress-analysis
```

---

# Frontend Components

Create reusable components:

```text
RiskAdvisorPanel
RiskNarrativeCard
RiskAlertCard
VolatilityInsightCard
DrawdownInsightCard
ConcentrationRiskTable
ExposureBreakdownChart
RiskHeatmap
PortfolioStressPanel
AiRiskWarningBanner
```

---

# Dashboard Widgets

Add:

```text
AI Risk Summary
AI Concentration Warnings
AI Volatility Commentary
AI Drawdown Insight
AI Exposure Intelligence
AI Stress Analysis
```

---

# Suggested User Questions

```text
Why is my portfolio risky?
What causes most volatility?
What happens if tech drops?
Am I too concentrated?
Why did my drawdown increase?
How exposed am I to one sector?
```

---

# UI Requirements

The UI should feel:

```text
Professional
Institutional
AI-native
Trustworthy
Calm
Modern finance dashboard
```

Inspired by:

- Ghostfolio
- OpenBB
- Portfolio Visualizer
- Bloomberg Terminal concepts
- FinceptTerminal

---

# AI Safety Rules

## Must Do

- Explain uncertainty
- Explain downside risk clearly
- Use calm educational wording
- Avoid fear-based messaging
- Mention missing data if needed
- Explain concentration carefully
- Explain volatility objectively

---

## Must Not

- Cause panic
- Promise protection from losses
- Guarantee returns
- Say “sell now”
- Execute trades
- Override user decisions
- Auto liquidate positions

---

# Account Mode Awareness

## Real Account

```text
READ-ONLY ANALYTICS MODE
```

AI may:

- explain risk
- explain volatility
- explain exposure
- generate educational warnings

AI may NOT:

- place trades
- liquidate positions
- auto rebalance

---

## Paper Account

```text
SANDBOX SIMULATION MODE
```

AI may:

- analyze simulated risk
- compare simulated volatility
- explain paper drawdowns

AI may NOT:

- imply guaranteed future results
- execute real trades

---

# Queue Jobs

Create:

```text
GenerateRiskNarrativeJob
GenerateRiskAlertsJob
GenerateVolatilityInsightJob
GenerateExposureNarrativeJob
GenerateStressScenarioNarrativeJob
RefreshRiskAdvisorCacheJob
```

---

# Caching Strategy

Use:

```text
Redis cache
risk insight cache
volatility cache
AI warning cache
```

Example:

```text
ai:risk-advisor:{user_id}:summary
ai:risk-advisor:{user_id}:alerts
ai:risk-advisor:{user_id}:volatility
```

---

# Testing Requirements

Create tests for:

- risk narrative generation
- volatility explanation
- concentration analysis
- drawdown explanation
- exposure analysis
- risk alert generation
- missing data handling
- ownership validation
- account mode awareness
- cache refresh

---

# Acceptance Criteria

Phase 5C complete when:

- User can open Risk Advisor page
- AI can explain portfolio risk
- AI can explain volatility
- AI can explain concentration risk
- AI can explain drawdowns
- AI risk alerts are generated
- AI warnings are cached
- Exposure intelligence works
- Account mode awareness works
- Real accounts remain read-only
- Paper accounts remain sandbox-only
- No trade execution exists

---

# What Not To Build Yet

Do not add:

- autonomous risk management
- auto liquidation
- AI order execution
- auto hedging
- autonomous rebalancing
- RL trading systems
- quant execution engines

Those belong to later phases.

---

# Codex Implementation Instruction

```md
# TASK: Build Phase 5C — Risk Advisor AI

You are the Code agent for Portfolio AI.

Build Phase 5C: Risk Advisor AI.

## Context
Previous phases already exist:

- Phase 1 → Portfolio Insight
- Phase 2 → Broker Sync
- Phase 2A → Moomoo Sync
- Phase 2B → Paper Trading Sandbox
- Phase 3 → Analytics Engine
- Phase 3B → Risk & Exposure Analysis
- Phase 4 → AI Context Builder
- Phase 5A → AI Chat Engine
- Phase 5B → Portfolio Assistant AI

This phase adds:

- AI risk explanation
- AI concentration warnings
- AI volatility intelligence
- AI downside analysis
- AI stress narratives
- AI exposure intelligence

## Goals
Create a safe AI-powered portfolio risk advisor.

The assistant should:

- explain portfolio risk
- explain volatility
- explain concentration exposure
- explain drawdowns
- explain downside scenarios
- generate educational warnings

Do NOT create:

- panic-based AI
- auto liquidation
- AI order execution
- autonomous portfolio management

## Backend Requirements

Create:

- RiskAdvisorService
- PortfolioRiskExplanationService
- ConcentrationRiskService
- VolatilityNarrativeService
- DrawdownNarrativeService
- ExposureNarrativeService
- RiskAlertService
- PortfolioStressNarrativeService

Create:

- AI risk endpoints
- AI risk narrative generation
- AI warning system
- risk insight caching
- ownership validation
- account mode awareness

Use:

- Laravel API
- Redis cache
- auth:sanctum
- queue jobs

## Frontend Requirements

Create pages:

- /ai/risk-advisor
- /ai/risk-advisor/volatility
- /ai/risk-advisor/concentration
- /ai/risk-advisor/drawdown
- /ai/risk-advisor/exposure
- /ai/risk-advisor/stress-analysis

Create components:

- RiskAdvisorPanel
- RiskNarrativeCard
- RiskAlertCard
- VolatilityInsightCard
- DrawdownInsightCard
- ExposureBreakdownChart
- RiskHeatmap
- PortfolioStressPanel

## AI Rules

The AI:

- must explain uncertainty
- must explain downside risk calmly
- must avoid fear-based language
- must never execute trades
- must remain educational
- must support paper account mode
- must support real account read-only mode

## Safety

Never:

- place trades
- liquidate positions
- create panic messaging
- guarantee protection from losses
- auto hedge portfolios

## Deliverables

- Backend AI risk advisor module
- AI risk explanation services
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
Risk & Exposure Engine
        ↓
AI Context Builder
        ↓
Risk Advisor AI
        ↓
Portfolio Health AI
        ↓
Optimization Engine
```

Phase 5C should make users feel:

```text
“I understand the risks in my portfolio clearly.”
```

