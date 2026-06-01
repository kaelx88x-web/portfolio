# AI UX Testing Framework

Verifies that PortfolioAI's AI responses are **Accurate, Explainable, Trustworthy,
easy for retail investors to understand, and grounded ONLY in real portfolio
data.**

The framework has two layers:

1. **Deterministic scoring core** (`src/lib/testing/ai-ux/*.ts`) — pure TypeScript,
   no I/O. Extracts tickers/figures from AI text, detects hallucination, scores
   readability/quality/trust, and aggregates a production-readiness verdict. Fully
   unit-tested with Vitest.
2. **Live verification** — a gated Vitest **integration** test that runs the real
   AI services, and **Playwright** UX specs that drive the live AI Suite in a
   browser and score what actually renders.

The core libs are dependency-free (only relative imports), so the Playwright
specs import them directly to score live page text.

## Section → file map

| Section | What it checks | File(s) |
|--------:|----------------|---------|
| **1. Data Integrity** | No invented tickers / prices / values; data loaded | `data-integrity.ts` + `*.test.ts`; `integration/ai-responses.integration.test.ts` |
| **2. AI Response Quality** | Accuracy / Explainability / Clarity / Trust / Actionability, 0–100, pass ≥ 80 | `scoring.ts` + `scoring.test.ts` |
| **3. Retail UX Readability** | Jargon density, reading ease, reasoning, clear action | `readability.ts`; `tests/e2e/ai-ux/retail-readability.spec.ts` |
| **4. Daily Digest** | All sections present once, no dupes, consistent, mobile | `tests/e2e/ai-ux/daily-digest.spec.ts` |
| **5. Option Analysis** | Per-option facts + plain-language insight + action | `tests/e2e/ai-ux/option-analysis.spec.ts` |
| **6. Risk Advisor** | Concentration/cash/assignment/allocation warnings; what→why→next | `tests/e2e/ai-ux/risk-advisor.spec.ts` |
| **7. AI Trust** | Recommendation → Reason → Data → Source traceability | `trust.ts` + `trust.test.ts`; `tests/e2e/ai-ux/trust-traceability.spec.ts` |
| **8. Mobile UX** | 320 / 375 / 390 / 768 px, no overflow, readable | `tests/e2e/ai-ux/mobile.spec.ts` |
| **9. Performance** | Steady-state load budgets per surface | `tests/e2e/ai-ux/performance.spec.ts` |
| **10. Production Readiness** | Weighted 5-pillar score + verdict | `readiness.ts` + `readiness.test.ts`; `tests/e2e/ai-ux/production-readiness.spec.ts` |

## Running

```bash
# Unit tests — deterministic core (fast, no DB, runs in CI)
npm run test:ai-ux

# Integration test — runs the REAL AI services against a dev DB + user.
#   PowerShell:  $env:AI_UX_INTEGRATION=1; npx vitest run src/lib/testing/ai-ux/integration
#   bash:        AI_UX_INTEGRATION=1 npx vitest run src/lib/testing/ai-ux/integration
#   Optional:    AI_UX_USER_EMAIL=kaelx88x@gmail.com  (defaults to that)

# Playwright UX specs — drive the live AI Suite. Needs a running dev server on
# :5173 and login creds; specs skip automatically when creds are absent.
#   PowerShell:  $env:E2E_EMAIL='you@example.com'; $env:E2E_PASSWORD='…'; npm run test:e2e:ai-ux
#   bash:        E2E_EMAIL=you@example.com E2E_PASSWORD=… npm run test:e2e:ai-ux
```

## How grounding works (the anti-hallucination check)

`fromAiContext()` turns the live `/api/v1/ai/context` payload into a
`KnownPortfolioData` set: the allowed tickers (holdings + benchmark + currency)
and every legitimate number (prices, values, P&L, cash). `checkDataIntegrity()`
then extracts every ticker and money figure from an AI response and:

- **Hard-fails** any ticker not in the allowed set (an invented symbol).
- **Docks the score** for any money figure that reconciles to no known number
  (a possible invented price/premium/P&L), with a rounding tolerance.

Because the context is **account-scoped**, this also catches cross-account
currency mixing — the bug class that previously produced fabricated metrics
like "-99.84% drawdown".

## Current live baseline (kaelx88x, Live account)

Last full run — unit `31/31`, e2e `40/40` green:

```
Data Integrity:   100/100   ← no invented tickers/prices (account-scoping holds)
AI Accuracy:       45/100
UX Readability:    32/100
Trustworthiness:  100/100
Performance:      100/100
Overall:           79/100  →  ⚠️ Beta Ready
```

> The orchestrator scores the **whole rendered page text** (labels + metric
> names like "volatility/Sharpe/Sortino" included), so Accuracy/Readability read
> lower than a single AI sentence would. Treat those two as the headroom to
> close before Production Ready; Data Integrity / Trust / Performance are the
> hard gates and are green.

## Extending

- Add jargon terms to `JARGON_TERMS` in `readability.ts`.
- Tune pillar weights / thresholds in `readiness.ts` and `PASS_THRESHOLD` in
  `types.ts`.
- New AI surface? Add it to the `SURFACES` / `PAGES` arrays in the relevant spec
  and reuse `fetchKnownData()` from `tests/e2e/ai-ux/helpers.ts`.
