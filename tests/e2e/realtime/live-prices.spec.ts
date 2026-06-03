// tests/e2e/realtime/live-prices.spec.ts
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle } from '../ai-ux/helpers';

test.describe('realtime live prices', () => {
  test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
  test.beforeEach(async ({ page }) => signInByApi(page));

  test('Live toggle renders and persists', async ({ page }) => {
    await gotoAndSettle(page, '/dashboard');
    const toggle = page.locator('.live-toggle');
    await expect(toggle).toBeVisible();
    // Record the initial state and flip it
    const wasPressedBefore = await toggle.getAttribute('aria-pressed');
    await toggle.click();
    const pressedAfterClick = await toggle.getAttribute('aria-pressed');
    // The toggle must have flipped
    expect(pressedAfterClick).not.toBe(wasPressedBefore);
    // Reload and confirm it persisted (localStorage-backed store)
    await page.reload();
    await page.waitForLoadState('networkidle');
    const pressedAfterReload = await page.locator('.live-toggle').getAttribute('aria-pressed');
    expect(pressedAfterReload).toBe(pressedAfterClick);
  });

  test('Stock detail header renders without crashing; LiveDot visible when price is available', async ({ page }) => {
    await gotoAndSettle(page, '/stocks/NVDA');
    if (page.url().match(/onboarding|login/)) test.skip(true, 'redirected');

    // Start listening for console errors before we wait
    const errors: string[] = [];
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

    // The detail header must render (symbol heading is always present)
    await expect(page.locator('header.dh h1')).toBeVisible();

    // Either: price is available and LiveDot renders, or price is unavailable
    // and the "Price Not Available" message shows. Both are valid degraded states.
    const livedot = page.locator('.livedot').first();
    const priceUnavailable = page.getByText('Price Not Available');

    const livedotVisible = await livedot.isVisible().catch(() => false);
    const unavailableVisible = await priceUnavailable.isVisible().catch(() => false);

    expect(
      livedotVisible || unavailableVisible,
      'Expected either a LiveDot indicator or a "Price Not Available" message — header must render one of them',
    ).toBe(true);

    // Wait a moment to catch any deferred JS errors (e.g. bad store subscriptions)
    await page.waitForTimeout(1500);
    expect(errors, `Unexpected console errors: ${errors.join(' | ')}`).toEqual([]);
  });

  test('mobile: stock detail does not overflow at 320px', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 720 });
    await gotoAndSettle(page, '/stocks/NVDA');
    if (page.url().match(/onboarding|login/)) test.skip(true, 'redirected');

    // Allow 1px rounding tolerance (same as helpers.ts expectNoHorizontalOverflow)
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `Horizontal overflow of ${overflow}px at 320px viewport`).toBeLessThanOrEqual(1);
  });
});
