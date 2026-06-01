/**
 * Section 10 — Production Readiness Score (end-to-end orchestrator).
 *
 * Drives the live AI Suite, derives the five pillar scores from real responses,
 * prints the scorecard, and asserts an overall verdict. This is the single
 * "is the AI shippable?" gate that composes Sections 1–9.
 */
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle, measureLoad, aiContentText, fetchKnownData } from './helpers';
import { checkDataIntegrity } from '../../../src/lib/testing/ai-ux/data-integrity';
import { analyzeReadability } from '../../../src/lib/testing/ai-ux/readability';
import { checkTraceability } from '../../../src/lib/testing/ai-ux/trust';
import { scoreResponse } from '../../../src/lib/testing/ai-ux/scoring';
import { computeReadiness, formatReadinessReport } from '../../../src/lib/testing/ai-ux/readiness';
import type { AiResponseUnderTest } from '../../../src/lib/testing/ai-ux/types';

test.describe('Section 10 — Production Readiness', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
    await signInByApi(page);
  });

  test('AI Suite scores at least Beta Ready', async ({ page }) => {
    const known = await fetchKnownData(page);
    test.skip(!known, 'AI context endpoint unavailable');

    // ── Gather live AI text from the two analytic surfaces ──
    await gotoAndSettle(page, '/ai/risk-advisor');
    const riskText = await aiContentText(page);
    await gotoAndSettle(page, '/ai/portfolio-assistant');
    const assistantText = await aiContentText(page);

    const riskResponse: AiResponseUnderTest = {
      id: 'risk',
      surface: 'risk-advisor',
      text: riskText,
      sourceContexts: ['portfolio'], // risk advisor exposes source_contexts server-side
      hasDisclaimer: /read-only|will not place trades/i.test(riskText),
    };
    const assistantResponse: AiResponseUnderTest = {
      id: 'assistant',
      surface: 'portfolio-assistant',
      text: assistantText,
    };

    // ── Pillar 1: Data Integrity (no invented tickers across surfaces) ──
    const riskIntegrity = checkDataIntegrity(riskResponse, known!);
    const assistantIntegrity = checkDataIntegrity(assistantResponse, known!);
    const dataIntegrity = Math.round((riskIntegrity.score + assistantIntegrity.score) / 2);

    // ── Pillar 2: AI Accuracy (response quality) ──
    const aiAccuracy = scoreResponse(assistantResponse, known!).overall;

    // ── Pillar 3: UX Readability ──
    const uxReadability = Math.round(
      (analyzeReadability(riskText).clarity + analyzeReadability(assistantText).clarity) / 2,
    );

    // ── Pillar 4: Trustworthiness (traceability + disclaimer) ──
    const trace = checkTraceability(riskResponse, known!);
    const trustworthiness = Math.min(100, trace.score + (riskResponse.hasDisclaimer ? 15 : 0));

    // ── Pillar 5: Performance (steady-state load budgets) ──
    await measureLoad(page, '/ai/risk-advisor', 'text=Concentration'); // warm
    const riskMs = await measureLoad(page, '/ai/risk-advisor', 'text=Concentration');
    const performance = Math.max(0, Math.min(100, Math.round(100 - Math.max(0, riskMs - 2000) / 30)));

    const report = computeReadiness({ dataIntegrity, aiAccuracy, uxReadability, trustworthiness, performance });

    const card = formatReadinessReport(report);
    console.log('\n' + card + '\n');
    test.info().annotations.push({ type: 'readiness', description: card.replace(/\n/g, ' | ') });

    // Data integrity is the hard gate — fabricated data is never shippable.
    expect(dataIntegrity, 'data integrity below acceptable floor').toBeGreaterThanOrEqual(80);
    // Overall must clear at least the Beta bar.
    expect(report.overall, `verdict: ${report.verdict}`).toBeGreaterThanOrEqual(60);
  });
});
