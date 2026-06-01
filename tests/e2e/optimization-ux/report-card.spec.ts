/**
 * Optimization UX — Test 12: Optimization Report Card (orchestrator).
 * Drives the live engine, derives the five pillars from real rendered copy,
 * prints the scorecard, and asserts a ship verdict.
 */
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle, aiContentText } from '../ai-ux/helpers';
import {
  checkUnderstandability,
  checkBeforeAfter,
  checkConfidence,
  checkDecisionSimulation,
} from '../../../src/lib/testing/optimization-ux/text-checks';
import { analyzeReadability } from '../../../src/lib/testing/ai-ux/readability';
import { computeOptimizationReportCard, formatOptimizationReportCard } from '../../../src/lib/testing/optimization-ux/report-card';

test.describe('Optimization UX — Report Card (T12)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
    await signInByApi(page);
  });

  test('Optimization Engine scores at least Needs Improvement', async ({ page }) => {
    await gotoAndSettle(page, '/optimization');
    const hub = await aiContentText(page);
    await gotoAndSettle(page, '/optimization/scenarios');
    const scenarios = await aiContentText(page);
    await gotoAndSettle(page, '/optimization/rebalance');
    const rebalance = await aiContentText(page);

    const readability = Math.round((analyzeReadability(hub).clarity + analyzeReadability(scenarios).clarity) / 2);
    const explainability = checkUnderstandability(rebalance).score;
    const decisionClarity = checkDecisionSimulation(scenarios).score;
    const beforeAfter = checkBeforeAfter(scenarios);
    const actionability = beforeAfter.score;
    // Trust proxy: confidence shown + figures + reasoning present in rebalance copy.
    const hasFigures = /\d/.test(rebalance);
    const hasReason = /because|within|limit|range|risk|since/i.test(rebalance);
    const hasOutcome = /lower|stabil|improve|income|protect|comfort|safe/i.test(rebalance);
    const trust =
      (checkConfidence(rebalance).passed ? 40 : 0) + (hasFigures ? 20 : 0) + (hasReason ? 20 : 0) + (hasOutcome ? 20 : 0);

    const card = computeOptimizationReportCard({ readability, explainability, trust, actionability, decisionClarity });
    const out = formatOptimizationReportCard(card);
    console.log('\n' + out + '\n');
    test.info().annotations.push({ type: 'report-card', description: out.replace(/\n/g, ' | ') });

    expect(card.overall, `verdict: ${card.verdict}`).toBeGreaterThanOrEqual(60);
  });
});
