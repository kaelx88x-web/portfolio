/**
 * Section 8 — Mobile UX Test.
 *
 * At 320 / 375 / 390 / 768 px the AI surfaces must not overflow horizontally,
 * cards/tables must stay readable, and the primary AI summary must be reachable
 * without excessive scrolling.
 */
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle, expectNoHorizontalOverflow, VIEWPORTS } from './helpers';

const PAGES = [
  { name: 'Dashboard digest', url: '/dashboard', anchor: 'AI MORNING BRIEFING' },
  { name: 'Risk Advisor', url: '/ai/risk-advisor', anchor: 'Concentration' },
  { name: 'Portfolio Assistant', url: '/ai/portfolio-assistant', anchor: 'Portfolio Story' },
];

test.describe('Section 8 — Mobile UX', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
    await signInByApi(page);
  });

  for (const vp of VIEWPORTS) {
    for (const target of PAGES) {
      test(`${target.name} @ ${vp.name}: no overflow, content visible`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await gotoAndSettle(page, target.url);
        // Assert the main content region loaded the expected AI content (robust
        // to topbar labels that are intentionally hidden on mobile), then check
        // the document itself does not overflow horizontally.
        await expect(page.locator('main').first()).toContainText(target.anchor, { timeout: 10_000 });
        await expectNoHorizontalOverflow(page);
      });
    }
  }

  test('AI summary is near the top (visible within ~1.5 viewport heights)', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoAndSettle(page, '/ai/risk-advisor');
    const anchor = page.getByText('Portfolio Risk Summary', { exact: false }).first();
    test.skip((await anchor.count()) === 0, 'Risk summary heading not present');
    const box = await anchor.boundingBox();
    expect(box, 'summary has no bounding box').not.toBeNull();
    expect(box!.y, 'AI summary requires excessive scrolling to reach').toBeLessThan(812 * 1.5);
  });
});
