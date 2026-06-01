/**
 * Section 6 — Risk Advisor UX Test.
 *
 * The Risk Advisor must surface the key risk warnings (concentration, cash,
 * assignment, allocation) and, for each, explain what happened, why it matters,
 * and what to do next — using only real, account-scoped data.
 */
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle, visibleText, aiContentText, fetchKnownData } from './helpers';
import { checkDataIntegrity } from '../../../src/lib/testing/ai-ux/data-integrity';
import { analyzeReadability } from '../../../src/lib/testing/ai-ux/readability';

test.describe('Section 6 — Risk Advisor', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
    await signInByApi(page);
    await gotoAndSettle(page, '/ai/risk-advisor');
  });

  test('renders the core risk dimensions', async ({ page }) => {
    const text = await visibleText(page);
    for (const dim of ['Concentration', 'Volatility', 'Drawdown']) {
      expect(text, `missing risk dimension: ${dim}`).toContain(dim);
    }
  });

  test('shows a concentration warning with a what / why / what-next shape', async ({ page }) => {
    const text = (await visibleText(page)).toLowerCase();
    // What happened + why it matters: a concentration figure tied to a holding.
    expect(text).toMatch(/concentration (risk )?is \d/);
    // What to do next: at least one safer-consideration / recommended action.
    expect(text).toMatch(/consider|review|separate|reduce|diversif|monitor/);
  });

  test('AI risk text contains no invented tickers (account-scoped grounding)', async ({ page }) => {
    const known = await fetchKnownData(page);
    test.skip(!known, 'AI context endpoint unavailable');
    const text = await aiContentText(page);
    const integrity = checkDataIntegrity({ id: 'risk-advisor', surface: 'risk-advisor', text }, known!);
    expect(integrity.hallucinatedTickers, integrity.failures.join('; ')).toHaveLength(0);
  });

  test('risk narrative is readable for a retail investor', async ({ page }) => {
    const narrative = await page.locator('text=/your portfolio risk profile is currently/i').first();
    test.skip((await narrative.count()) === 0, 'Risk narrative not present');
    const text = await narrative.innerText();
    const r = analyzeReadability(text);
    expect(r.jargonDensity, `jargon too dense: ${r.jargonTerms.join(', ')}`).toBeLessThan(0.12);
  });

  test('is read-only — states it will not place trades', async ({ page }) => {
    const text = (await visibleText(page)).toLowerCase();
    expect(text).toMatch(/read-only|will not place trades|does not execute/);
  });
});
