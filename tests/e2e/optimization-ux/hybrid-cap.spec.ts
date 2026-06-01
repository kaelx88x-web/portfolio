/**
 * Optimization UX — Test 6: Hybrid portfolio cap.
 * The engine must never present options exposure above the configured cap/limit.
 */
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle, aiContentText } from '../ai-ux/helpers';
import { checkOptionsCap } from '../../../src/lib/testing/optimization-ux/guardrails';

test.describe('Optimization UX — Hybrid cap (T6)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
    await signInByApi(page);
  });

  test('options exposure stays within the configured limit', async ({ page }) => {
    await gotoAndSettle(page, '/optimization/rebalance');
    const text = await aiContentText(page);
    // e.g. "Options positions are 9.6% of your portfolio (limit: 80%)."
    const m = text.match(/options?\s+(?:positions?\s+are\s+)?(\d+(?:\.\d+)?)\s*%[^.]*?\(?\s*limit[:\s]*(\d+(?:\.\d+)?)\s*%/i);
    test.skip(!m, 'No options exposure/limit statement found on the page');
    const exposure = parseFloat(m![1]);
    const limit = parseFloat(m![2]);
    const r = checkOptionsCap(exposure, limit);
    expect(r.passed, r.failures.join('; ')).toBe(true);
  });
});
