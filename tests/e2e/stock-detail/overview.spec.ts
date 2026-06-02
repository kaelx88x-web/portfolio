// tests/e2e/stock-detail/overview.spec.ts
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle, expectNoHorizontalOverflow, VIEWPORTS } from '../ai-ux/helpers';

test('anonymous /stocks/NVDA redirects to login', async ({ page }) => {
  const res = await page.goto('/stocks/NVDA');
  expect(res!.status()).toBeLessThan(500);
  await expect(page).toHaveURL(/\/login/);
});

test.describe('stock detail — authenticated', () => {
  test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
  test.beforeEach(async ({ page }) => signInByApi(page));

  test('overview renders detail header + tabs', async ({ page }) => {
    await gotoAndSettle(page, '/stocks/NVDA');
    if (page.url().match(/onboarding|login/)) test.skip(true, 'redirected');
    // The detail header is the <header> region (distinct from the breadcrumb
    // PageHeader, which also renders an <h1> with the symbol).
    const detailHeader = page.locator('header').filter({ hasText: 'NVDA' });
    await expect(detailHeader.getByRole('heading', { name: 'NVDA' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /overview/i })).toBeVisible();
    await expect(page.getByRole('tab', { name: /options/i })).toBeVisible();
  });

  for (const vp of VIEWPORTS) {
    test(`no overflow at ${vp.name}`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/stocks/NVDA');
      if (page.url().match(/onboarding|login/)) test.skip(true, 'redirected');
      await expectNoHorizontalOverflow(page);
    });
  }
});
