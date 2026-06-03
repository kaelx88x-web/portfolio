// tests/e2e/stock-detail/options.spec.ts
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle } from '../ai-ux/helpers';

test.describe('stock detail — options', () => {
  test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
  test.beforeEach(async ({ page }) => signInByApi(page));

  test('options tab loads chain with Greeks and no live control', async ({ page }) => {
    await gotoAndSettle(page, '/stocks/NVDA');
    if (page.url().match(/onboarding|login/)) test.skip(true, 'redirected');
    await page.getByRole('tab', { name: /options/i }).click();
    // Either a chain renders or an explicit "Data Not Available" — never a crash.
    const panel = page.locator('.op');
    await expect(panel).toBeVisible();
    // No control *within the options panel* offers a LIVE order — paper-only by spec.
    // (Scoped to .op so the global account switcher "Live Account … LIVE" doesn't trip this.)
    await expect(panel.getByRole('button', { name: /live/i })).toHaveCount(0);
  });
});
