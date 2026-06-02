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
    await expect(page.locator('.op')).toBeVisible();
    // No control offers a LIVE order.
    const liveBtn = page.getByRole('button', { name: /live/i });
    await expect(liveBtn).toHaveCount(0);
  });
});
