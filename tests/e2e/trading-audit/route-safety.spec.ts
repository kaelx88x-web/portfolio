/**
 * Trading Audit — Section 1 (Route Audit) + Section 14 (Security)
 *
 * The auth-protection block needs NO credentials and is the deterministic core
 * of the audit: every trading surface must redirect an anonymous visitor to
 * /login and must never serve a 500. The signed-in block (skipped without
 * E2E_EMAIL/E2E_PASSWORD) checks page health, console cleanliness, and that no
 * one-click LIVE execution control is exposed.
 */
import { expect, test, type Page } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle } from '../ai-ux/helpers';

const TRADING_ROUTES = ['/trades', '/orders', '/paper-trading'] as const;
const TRADING_APIS = ['/api/orders', '/api/trades/tickets'] as const;

// ─── Section 1 + 14: auth is mandatory (no credentials required) ──────────────

test.describe('Trading routes require authentication', () => {
  for (const route of TRADING_ROUTES) {
    test(`anonymous GET ${route} → redirected to /login (no 500)`, async ({ page }) => {
      const res = await page.goto(route);
      // SvelteKit follows the 303 to /login; the final response must be healthy.
      expect(res, `no response for ${route}`).not.toBeNull();
      expect(res!.status(), `server error on ${route}`).toBeLessThan(500);
      await expect(page, `un-authed ${route} did not land on /login`).toHaveURL(/\/login/);
    });
  }

  for (const api of TRADING_APIS) {
    test(`anonymous GET ${api} is not served trading data`, async ({ request }) => {
      const res = await request.get(api, { maxRedirects: 0 });
      // Either a redirect to login (3xx) or an auth error (401/403) — never 200 + data.
      expect([301, 302, 303, 307, 308, 401, 403]).toContain(res.status());
    });
  }
});

// ─── Section 1: signed-in route health ────────────────────────────────────────

test.describe('Trading routes load cleanly when authenticated', () => {
  test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD to run authenticated audit');

  test.beforeEach(async ({ page }) => {
    await signInByApi(page);
  });

  for (const route of TRADING_ROUTES) {
    test(`${route} loads without server error or console errors`, async ({ page }) => {
      const consoleErrors: string[] = [];
      page.on('console', (msg) => {
        // favicon 404s are environmental noise, not app errors.
        if (msg.type() === 'error' && !msg.text().includes('favicon')) consoleErrors.push(msg.text());
      });

      const res = await page.goto(route);
      // A protected route may bounce to broker onboarding — that is still a
      // healthy, intentional redirect, not a 500.
      expect(res!.status(), `server error on ${route}`).toBeLessThan(500);
      await page.waitForLoadState('networkidle');
      expect(page.url(), `un-authed bounce on ${route}`).not.toMatch(/\/login/);
      expect(consoleErrors, `console errors on ${route}: ${consoleErrors.join(' | ')}`).toHaveLength(0);
    });
  }

  test('/paper-trading shows an unambiguous PAPER badge (Section 15)', async ({ page }) => {
    await gotoAndSettle(page, '/paper-trading');
    if (page.url().match(/onboarding|login/)) test.skip(true, 'redirected to onboarding');
    await expect(page.getByText(/PAPER MODE/i).first()).toBeVisible();
    await expect(page.getByText(/no real money/i).first()).toBeVisible();
  });

  test('no trading surface exposes a one-click LIVE execution control (Section 4)', async ({ page }) => {
    for (const route of TRADING_ROUTES) {
      await gotoAndSettle(page, route);
      if (page.url().match(/onboarding|login/)) continue;
      await expectNoLiveOneClick(page);
    }
  });
});

/**
 * Section 4 invariant — there must be no actionable control that submits a LIVE
 * broker order in a single click. We allow text that *labels* mode or *warns*
 * about live trading; we forbid an enabled button/link whose accessible name
 * says it places/sends/submits a live order.
 */
async function expectNoLiveOneClick(page: Page): Promise<void> {
  const liveActionPattern = /(place|send|submit|execute|buy|sell).*(live|real)\b|\blive\b.*(order|trade)/i;
  const candidates = page.getByRole('button').or(page.getByRole('link'));
  const count = await candidates.count();
  for (let i = 0; i < count; i++) {
    const el = candidates.nth(i);
    const name = ((await el.getAttribute('aria-label')) ?? (await el.innerText().catch(() => ''))) || '';
    if (liveActionPattern.test(name)) {
      const enabled = await el.isEnabled().catch(() => false);
      expect(enabled, `one-click live execution control exposed: "${name.trim()}" on ${page.url()}`).toBe(false);
    }
  }
}
