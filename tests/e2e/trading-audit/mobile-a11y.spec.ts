/**
 * Trading Audit — Section 11 (Mobile UX) + Section 12 (Accessibility)
 *
 * Runs only with E2E credentials (the trading routes are auth-gated). Verifies
 * no horizontal overflow across the required device widths and that the
 * paper-trading safety banner is exposed to assistive tech via a live region
 * (not colour alone).
 */
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle, expectNoHorizontalOverflow, VIEWPORTS } from '../ai-ux/helpers';

const TRADING_ROUTES = ['/trades', '/orders', '/paper-trading'] as const;

test.describe('Trading routes — mobile responsiveness', () => {
  test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');

  test.beforeEach(async ({ page }) => {
    await signInByApi(page);
  });

  for (const vp of VIEWPORTS) {
    for (const route of TRADING_ROUTES) {
      test(`${route} has no horizontal overflow at ${vp.name}`, async ({ page }) => {
        await page.setViewportSize({ width: vp.width, height: vp.height });
        await gotoAndSettle(page, route);
        if (page.url().match(/onboarding|login/)) test.skip(true, 'redirected away from route');
        await expectNoHorizontalOverflow(page);
      });
    }
  }
});

test.describe('Trading routes — accessibility', () => {
  test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');

  test.beforeEach(async ({ page }) => {
    await signInByApi(page);
  });

  test('paper-mode banner is a live region, not colour-only (Section 12/15)', async ({ page }) => {
    await gotoAndSettle(page, '/paper-trading');
    if (page.url().match(/onboarding|login/)) test.skip(true, 'redirected away');
    const banner = page.locator('[role="status"]').filter({ hasText: /paper|no real money/i }).first();
    await expect(banner).toBeVisible();
    // The mode must be conveyed in text, readable by a screen reader.
    await expect(banner).toContainText(/paper/i);
  });

  test('primary actions are reachable and labelled (Section 12)', async ({ page }) => {
    await gotoAndSettle(page, '/paper-trading');
    if (page.url().match(/onboarding|login/)) test.skip(true, 'redirected away');
    // Every button must have a non-empty accessible name (label or text).
    const buttons = page.getByRole('button');
    const count = await buttons.count();
    for (let i = 0; i < count; i++) {
      const el = buttons.nth(i);
      if (!(await el.isVisible().catch(() => false))) continue;
      // Accessible name per the AccName spec: aria-label, then text, then title.
      const name =
        ((await el.getAttribute('aria-label')) ??
          (await el.innerText().catch(() => '')) ??
          (await el.getAttribute('title'))) || (await el.getAttribute('title')) || '';
      const html = await el.evaluate((n) => (n as HTMLElement).outerHTML.slice(0, 120));
      expect(name.trim().length, `unlabelled button: ${html}`).toBeGreaterThan(0);
    }
  });

  test('keyboard focus reaches an interactive control (Section 12)', async ({ page }) => {
    await gotoAndSettle(page, '/paper-trading');
    if (page.url().match(/onboarding|login/)) test.skip(true, 'redirected away');
    await page.keyboard.press('Tab');
    const active = await page.evaluate(() => {
      const el = document.activeElement;
      return el ? { tag: el.tagName, role: el.getAttribute('role') } : null;
    });
    expect(active, 'Tab did not move focus to any element').not.toBeNull();
    expect(['A', 'BUTTON', 'INPUT', 'SELECT', 'TEXTAREA'].includes(active!.tag) || active!.role !== null).toBe(true);
  });

  test('paper-mode banner matches its accessibility structure (Section 12/17)', async ({ page }) => {
    await gotoAndSettle(page, '/paper-trading');
    if (page.url().match(/onboarding|login/)) test.skip(true, 'redirected away');
    const banner = page.locator('[role="status"]').filter({ hasText: /paper/i }).first();
    await expect(banner).toMatchAriaSnapshot(`- status`);
  });
});

test.describe('Trading routes — risk warnings are not colour-only (Section 12)', () => {
  test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');

  test.beforeEach(async ({ page }) => {
    await signInByApi(page);
  });

  test('paper-mode safety is conveyed in text, independent of colour', async ({ page }) => {
    await gotoAndSettle(page, '/paper-trading');
    if (page.url().match(/onboarding|login/)) test.skip(true, 'redirected away');
    // §12 — the meaning ("paper", "no real money") must be in the text node,
    // so a colour-blind / screen-reader user gets the same signal.
    const bannerText = await page.locator('[role="status"]').filter({ hasText: /paper/i }).first().innerText();
    expect(bannerText).toMatch(/paper/i);
    expect(bannerText.replace(/\s+/g, ' ')).toMatch(/no real money|virtual funds/i);
  });
});
