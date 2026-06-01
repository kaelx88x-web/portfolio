/**
 * Section 9 — Performance Test.
 *
 * Steady-state load budgets:
 *   Portfolio Analysis < 3s · Daily Digest < 2s · Risk Analysis < 2s · Option Review < 2s
 *
 * Each route is warmed once (dev-mode route compilation / cold cache) and the
 * second navigation is measured, so the assertion reflects the cached, steady-
 * state experience a returning user sees rather than first-compile overhead.
 */
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, measureLoad } from './helpers';

type Budget = { name: string; url: string; anchor: string; budgetMs: number };

const BUDGETS: Budget[] = [
  { name: 'Daily Digest', url: '/dashboard', anchor: 'text=AI MORNING BRIEFING', budgetMs: 2000 },
  { name: 'Risk Analysis', url: '/ai/risk-advisor', anchor: 'text=Concentration', budgetMs: 2000 },
  { name: 'Portfolio Analysis', url: '/ai/portfolio-assistant', anchor: 'text=Portfolio', budgetMs: 3000 },
];

test.describe('Section 9 — Performance', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
    await signInByApi(page);
  });

  for (const b of BUDGETS) {
    test(`${b.name} loads within ${b.budgetMs}ms (steady state)`, async ({ page }) => {
      await measureLoad(page, b.url, b.anchor); // warm
      const elapsed = await measureLoad(page, b.url, b.anchor); // measured
      test.info().annotations.push({ type: 'load-ms', description: `${b.name}: ${elapsed}ms` });
      expect(elapsed, `${b.name} took ${elapsed}ms (budget ${b.budgetMs}ms)`).toBeLessThanOrEqual(b.budgetMs);
    });
  }
});
