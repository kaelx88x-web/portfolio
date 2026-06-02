/**
 * Trading Audit — Section 18 (Performance)
 *
 * Targets: /trades < 2s, /paper-trading < 2s, /orders < 2s, ticket validation
 * < 1s. Each route is WARMED once before timing so we measure runtime load, not
 * Vite's first-hit on-demand compilation (dev mode). For production-grade
 * numbers, run against `vite preview` with PLAYWRIGHT_BASE_URL set.
 */
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle, measureLoad } from '../ai-ux/helpers';

const ROUTE_TARGET_MS = 2_000;
const VALIDATE_TARGET_MS = 1_000;

test.describe('Trading routes — performance', () => {
  test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');

  test.beforeEach(async ({ page }) => {
    await signInByApi(page);
  });

  for (const route of ['/trades', '/orders', '/paper-trading'] as const) {
    test(`${route} warm load is under ${ROUTE_TARGET_MS}ms`, async ({ page }) => {
      // Warm-up pass (compiles the route in dev mode); discard its timing.
      await gotoAndSettle(page, route);
      if (page.url().match(/onboarding|login/)) test.skip(true, 'redirected away from route');

      const ms = await measureLoad(page, route, 'main');
      console.log(`[perf] ${route} warm load: ${ms}ms`);
      expect(ms, `${route} warm load ${ms}ms exceeded ${ROUTE_TARGET_MS}ms`).toBeLessThan(ROUTE_TARGET_MS);
    });
  }

  test(`ticket validation responds under ${VALIDATE_TARGET_MS}ms`, async ({ page }) => {
    // (already signed in via beforeEach) — warm the endpoint once, then time it.
    const body = { ticketType: 'buy', symbol: 'AAPL', side: 'buy', quantity: 10, orderType: 'limit', limitPrice: 150 };
    await page.request.post('/api/trades/validate', { data: body });

    const start = Date.now();
    const res = await page.request.post('/api/trades/validate', { data: body });
    const ms = Date.now() - start;
    console.log(`[perf] POST /api/trades/validate: ${ms}ms (status ${res.status()})`);
    expect(res.ok()).toBe(true);
    expect(ms, `validation ${ms}ms exceeded ${VALIDATE_TARGET_MS}ms`).toBeLessThan(VALIDATE_TARGET_MS);
  });
});
