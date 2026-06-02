/**
 * Layer 3 — AI eval for /cashflow: NOT APPLICABLE (documented).
 *
 * Recon finding: there is no cash-flow-specific AI surface. The global "Ask AI"
 * (Topbar.svelte:191) opens the Copilot, whose context is built by
 * buildAiPortfolioContext (holdings / analytics / risk) — it does NOT include
 * cash-flow rows. So the Layer-3 checks in the brief (grounding on cash-flow
 * fixtures, "what's my total dividend?", currency, prompt-injection via a
 * cash-flow memo, etc.) target an endpoint that does not exist.
 *
 * Consequence (reported, not fixed): asking the Copilot a cash-flow question
 * cannot be answered accurately from cash-flow data, because that data is never
 * passed to the model — a grounding gap, not a hallucination guardrail to test.
 *
 * These are recorded as skips so they appear in the run output as explicit N/A
 * rather than being silently absent. If a cash-flow AI endpoint is added later,
 * replace these with real grounding/no-hallucination/currency/disclaimer/
 * prompt-injection/scope/timeout assertions.
 */
import { test } from '@playwright/test';

const REASON =
  'N/A — no cash-flow AI endpoint; global Copilot context excludes cash-flow data (see recon).';

test.describe('Layer 3 — Cash-flow AI eval (N/A)', () => {
  test.skip('grounding — answer uses only real cash-flow data', () => {});
  test.skip('numeric accuracy — "total dividend?" matches computed total', () => {});
  test.skip('no hallucination — no invented transactions/amounts', () => {});
  test.skip('currency — states MYR/USD correctly, no mixing', () => {});
  test.skip('disclaimer — "Untuk tujuan pendidikan sahaja — bukan nasihat kewangan"', () => {});
  test.skip('prompt injection — cash-flow memo cannot override instructions', () => {});
  test.skip('scope — refuses specific buy/sell advice safely', () => {});
  test.skip('error/timeout — LLM failure shows error, no hang', () => {});

  test('Layer 3 applicability', () => {
    test.info().annotations.push({ type: 'layer-3', description: REASON });
    test.skip(true, REASON);
  });
});
