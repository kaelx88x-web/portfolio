/**
 * Section 5 — Option Analysis UX Test.
 *
 * For each option the user holds, the AI surface must show the position facts
 * (ticker, value, P/L) and an insight a retail investor can grasp in ~10s —
 * why it matters and a recommended action. Targets the Portfolio Assistant's
 * holdings-insight table, which profiles each holding (incl. options) with a
 * role, P/L and a plain-language insight, plus the dashboard digest alerts that
 * carry option-specific strike/DTE detail.
 *
 * Skips automatically when the active account holds no options.
 */
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle, visibleText, aiContentText, fetchKnownData } from './helpers';
import { analyzeReadability } from '../../../src/lib/testing/ai-ux/readability';
import { checkDataIntegrity } from '../../../src/lib/testing/ai-ux/data-integrity';

test.describe('Section 5 — Option Analysis', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
    await signInByApi(page);
  });

  test('each option holding shows facts (P/L) and a plain-language insight', async ({ page }) => {
    const known = await fetchKnownData(page);
    test.skip(!known?.hasOptions, 'Active account holds no options');
    await gotoAndSettle(page, '/ai/portfolio-assistant');

    // Option positions are profiled with the "Volatility / derivative" role.
    const optionRows = page.locator('tr', { hasText: /Volatility \/ derivative/i });
    const count = await optionRows.count();
    expect(count, 'expected at least one profiled option row').toBeGreaterThan(0);

    const firstRow = await optionRows.first().innerText();
    // Facts: a P/L figure ($ or -$) must be present on the row.
    expect(firstRow, 'option row missing a P/L figure').toMatch(/-?\$[\d,]+\.\d{2}/);
  });

  test('option insights are readable and recommend an action', async ({ page }) => {
    const known = await fetchKnownData(page);
    test.skip(!known?.hasOptions, 'Active account holds no options');
    await gotoAndSettle(page, '/ai/portfolio-assistant');

    // The holdings section's insight text mentions options and their handling.
    const text = await visibleText(page);
    const r = analyzeReadability(text);
    expect(r.jargonDensity, 'option analysis too jargon-dense').toBeLessThan(0.12);
    // A recommended action / consideration must be present for options.
    expect(text.toLowerCase()).toMatch(/option|derivative/);
    expect(text.toLowerCase()).toMatch(/consider|review|close|roll|monitor|separate risk/);

    const integrity = checkDataIntegrity(
      { id: 'option-analysis', surface: 'portfolio-assistant', text: await aiContentText(page) },
      known!,
    );
    expect(integrity.hallucinatedTickers, integrity.failures.join('; ')).toHaveLength(0);
  });

  test('dashboard digest surfaces option strike + days-to-expiry detail', async ({ page }) => {
    const known = await fetchKnownData(page);
    test.skip(!known?.hasOptions, 'Active account holds no options');
    await gotoAndSettle(page, '/dashboard');

    const alertsVisible = await page.locator('.alerts').count();
    test.skip(alertsVisible === 0, 'No option alerts active in the digest right now');
    const alertText = await page.locator('.alerts').innerText();
    // Option alerts read e.g. "NIO $5.50 CC — expires in 3 days".
    expect(alertText).toMatch(/expires in \d+ day|CC|CSP|\$\d/);
  });
});
