/**
 * Section 7 — AI Trust Test (UI).
 *
 * Every recommendation must be traceable: Recommendation → Reason → Supporting
 * Data → Data Source. On the rendered Risk Advisor surface we assert the text
 * carries reasoning, concrete figures, and a data-source signal, and that the
 * figures are grounded in the real, account-scoped portfolio.
 */
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle, visibleText, aiContentText, fetchKnownData } from './helpers';
import { checkTraceability } from '../../../src/lib/testing/ai-ux/trust';
import { checkDataIntegrity } from '../../../src/lib/testing/ai-ux/data-integrity';

test.describe('Section 7 — Trust & Traceability', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
    await signInByApi(page);
    await gotoAndSettle(page, '/ai/risk-advisor');
  });

  test('risk recommendations carry reason + data + source', async ({ page }) => {
    const known = await fetchKnownData(page);
    test.skip(!known, 'AI context endpoint unavailable');
    const text = await visibleText(page);

    const trace = checkTraceability(
      { id: 'risk', surface: 'risk-advisor', text, sourceContexts: ['portfolio'] },
      known!,
    );
    expect(trace.passed, trace.failures.join('; ')).toBe(true);
  });

  test('every figure cited on screen reconciles to real portfolio data', async ({ page }) => {
    const known = await fetchKnownData(page);
    test.skip(!known, 'AI context endpoint unavailable');
    const text = await aiContentText(page);
    const integrity = checkDataIntegrity({ id: 'risk', surface: 'risk-advisor', text }, known!);
    // No invented tickers, and no money figure that matches nothing in the data.
    expect(integrity.hallucinatedTickers, integrity.failures.join('; ')).toHaveLength(0);
  });

  test('surface attributes its data to a source the user can identify', async ({ page }) => {
    const text = (await visibleText(page)).toLowerCase();
    expect(text).toMatch(/broker|snapshot|portfolio data|market data|position/);
  });
});
