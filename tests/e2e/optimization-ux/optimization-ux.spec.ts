/**
 * Optimization UX — live validation of Tests 1–5, 7, 9, 10 against the running
 * Optimization Engine. Reuses the ai-ux Playwright helpers for auth/skip.
 */
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle, aiContentText } from '../ai-ux/helpers';
import {
  checkUnderstandability,
  checkBeforeAfter,
  checkConfidence,
  checkOptionsExplanation,
  checkDecisionSimulation,
} from '../../../src/lib/testing/optimization-ux/text-checks';
import { analyzeReadability } from '../../../src/lib/testing/ai-ux/readability';

test.describe('Optimization UX', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
    await signInByApi(page);
  });

  // ── Test 1 — Understandability ──
  test('T1: the engine is not a black box (5-stage chain)', async ({ page }) => {
    await gotoAndSettle(page, '/optimization');
    const r = checkUnderstandability(await aiContentText(page));
    expect(r.blackBox, r.failures.join('; ')).toBe(false);
    expect(r.score).toBeGreaterThanOrEqual(60);
  });

  // ── Test 2 — Before / After ──
  test('T2: scenarios show before→after with improvement metrics', async ({ page }) => {
    await gotoAndSettle(page, '/optimization/scenarios');
    const r = checkBeforeAfter(await aiContentText(page));
    expect(r.failures.join('; ')).toBe('');
    expect(r.passed).toBe(true);
  });

  // ── Test 3 — Explainability (text-level proxy of what/why/outcome) ──
  test('T3: rebalance explains what + why + expected outcome', async ({ page }) => {
    await gotoAndSettle(page, '/optimization/rebalance');
    const t = (await aiContentText(page)).toLowerCase();
    expect(/reduce|increase|trim|add|buy|sell|rebalance|target/.test(t), 'no action (what)').toBe(true);
    expect(/because|within|limit|too high|range|reason|since|so /.test(t), 'no reason (why)').toBe(true);
    expect(/lower|reduce risk|stabil|improve|premium income|protect|comfort/.test(t), 'no expected outcome').toBe(true);
  });

  // ── Test 4 — Confidence display ──
  test('T4: a confidence level is visible', async ({ page }) => {
    await gotoAndSettle(page, '/optimization/rebalance');
    const r = checkConfidence(await aiContentText(page));
    expect(r.passed, r.failures.join('; ')).toBe(true);
  });

  // ── Test 5 — Retail readability ──
  test('T5: optimization copy stays within retail jargon limits', async ({ page }) => {
    for (const url of ['/optimization', '/optimization/scenarios']) {
      await gotoAndSettle(page, url);
      const r = analyzeReadability(await aiContentText(page));
      expect(r.jargonDensity, `${url} jargon: ${r.jargonTerms.join(', ')}`).toBeLessThan(0.15);
    }
  });

  // ── Test 7 — Options optimizer explanation ──
  test('T7: options optimizer explains premium / assignment / capital / return', async ({ page }) => {
    await gotoAndSettle(page, '/optimization/options');
    const r = checkOptionsExplanation(await aiContentText(page));
    // Must be more than a bare "sell put": at least premium + assignment + one
    // of capital/return covered.
    expect(r.covered.premiumPotential && r.covered.assignmentRisk, r.failures.join('; ')).toBe(true);
    expect(r.score).toBeGreaterThanOrEqual(60);
  });

  // ── Test 9 — Trust (text-level: reason + figures + outcome) ──
  test('T9: recommendations carry reason, supporting figures and an outcome', async ({ page }) => {
    await gotoAndSettle(page, '/optimization/rebalance');
    const text = await aiContentText(page);
    expect(/\d/.test(text), 'no supporting figures').toBe(true);
    expect(/because|within|limit|range|since|so |risk/i.test(text), 'no reason').toBe(true);
    expect(/lower|stabil|improve|income|protect|comfort|safe/i.test(text), 'no expected outcome').toBe(true);
  });

  // ── Test 10 — Decision simulation ──
  test('T10: comparable strategy choices are presented', async ({ page }) => {
    await gotoAndSettle(page, '/optimization/scenarios');
    const r = checkDecisionSimulation(await aiContentText(page));
    expect(r.optionsFound.length, r.failures.join('; ')).toBeGreaterThanOrEqual(2);
    expect(r.comparable).toBe(true);
  });
});
