/**
 * Optimization UX — Test 11: Mobile UX.
 * 320 / 375 / 390 / 768 px: no horizontal overflow, optimization summary visible.
 */
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle, expectNoHorizontalOverflow, VIEWPORTS } from '../ai-ux/helpers';

const PAGES = [
  { name: 'Engine', url: '/optimization', anchor: 'Optimization Engine' },
  { name: 'Scenarios', url: '/optimization/scenarios', anchor: 'Scenarios' },
  { name: 'Rebalance', url: '/optimization/rebalance', anchor: 'Rebalance' },
  { name: 'Options', url: '/optimization/options', anchor: 'Options' },
];

test.describe('Optimization UX — Mobile (T11)', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
    await signInByApi(page);
  });

  for (const vp of VIEWPORTS) {
    for (const target of PAGES) {
      test(`${target.name} @ ${vp.name}: no overflow, summary visible`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await gotoAndSettle(page, target.url);
        await expect(page.locator('main').first()).toContainText(target.anchor, { timeout: 10_000 });
        await expectNoHorizontalOverflow(page);
      });
    }
  }
});
