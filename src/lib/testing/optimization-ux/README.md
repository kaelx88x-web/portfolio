# Optimization UX Testing Framework

Ensures the **Optimization Engine**'s recommendations are Understandable,
Explainable, Trustworthy, and Actionable. Deterministic validators (pure TS,
Vitest-tested) reused by Playwright specs that feed them the live rendered copy.
Retail readability reuses `$lib/testing/ai-ux`.

## Test → file map

| Test | What | File(s) |
|----:|------|---------|
| 1 Understandability | 5-stage chain: current → problems → opportunity → changes → improvement (not a black box) | `text-checks.ts` `checkUnderstandability`; `tests/e2e/optimization-ux/optimization-ux.spec.ts` |
| 2 Before/After | before + after states + improvement deltas | `checkBeforeAfter`; same spec |
| 3 Explainability | every rec has What / Why / Expected Outcome | `checkExplainability`; spec (text proxy) |
| 4 Confidence | High/Medium/Low (or %) visible | `checkConfidence`; spec |
| 5 Retail readability | jargon density / reading ease | `ai-ux/readability`; spec |
| 6 Hybrid cap | options exposure ≤ configured cap | `guardrails.ts` `checkOptionsCap`; `hybrid-cap.spec.ts` |
| 7 Options optimizer | premium / assignment / PoP / capital / expected return | `checkOptionsExplanation`; spec |
| 8 Trade planner | Today / This Week / Next Expiry | `checkTradePlanner`; `trade-planner.spec.ts` |
| 9 Trust | Recommendation → Reason → Data → Expected Outcome | `trust.ts` `checkOptimizationTrust`; spec |
| 10 Decision simulation | comparable choices (Conservative/Moderate/Aggressive) | `checkDecisionSimulation`; spec |
| 11 Mobile | 320/375/390/768, no overflow | `mobile.spec.ts` |
| 12 Report card | Readability/Explainability/Trust/Actionability/Decision Clarity → verdict | `report-card.ts`; `report-card.spec.ts` |

## Running

```bash
npm run test:opt-ux                 # unit (deterministic validators)
# live UX specs (needs dev server :5173 + creds; skips without creds):
#   PowerShell: $env:E2E_EMAIL='…'; $env:E2E_PASSWORD='…'; npx playwright test tests/e2e/optimization-ux
```

## Notes
- Verdict bands: < 60 Confusing · 60–79 Needs Improvement · ≥ 80 Production Ready.
  Trust + Explainability are weighted highest.
- Test 8 (trade planner) skips with a note if no Today/This-Week/Next-Expiry
  surface exists — surfacing the gap rather than failing falsely.
- Audit findings (2026-06-01) the framework guards against: `/optimization/projection`
  over-optimistic 49.6%/yr from naive premium annualization; `/optimization/options`
  summary tiles ($0/0%) contradicting the put-exposure detail.
