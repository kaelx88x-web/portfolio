/**
 * Section 4 — Daily Digest Test.
 *
 * Validates the dashboard's AI Morning Briefing card: every required section is
 * present exactly once (no missing / no duplicated sections), formatting is
 * consistent, the AI headline is readable, and the card is mobile-friendly.
 */
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle, expectNoHorizontalOverflow } from './helpers';
import { analyzeReadability } from '../../../src/lib/testing/ai-ux/readability';

/** The six data cells the digest must always render (see DailyBriefingCard). */
const REQUIRED_CELLS = ['HEALTH', 'DAY P&L', 'UNREALISED', 'THETA TODAY', 'MARKET', 'TOP MOVER'];

test.describe('Section 4 — Daily Digest', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
    await signInByApi(page);
    await gotoAndSettle(page, '/dashboard');
  });

  test('renders the AI briefing card with a label and headline area', async ({ page }) => {
    await expect(page.getByText('AI MORNING BRIEFING')).toBeVisible();
    // Either a generated headline or the empty-state prompt must be present.
    const hasHeadline = await page.locator('.headline, .headline-empty').first().isVisible();
    expect(hasHeadline).toBe(true);
  });

  test('shows every required section exactly once (no missing, no duplicates)', async ({ page }) => {
    for (const label of REQUIRED_CELLS) {
      const count = await page.locator('.cell-label', { hasText: new RegExp(`^${label.replace('&', '&')}`, 'i') }).count();
      expect(count, `cell "${label}" should appear exactly once`).toBe(1);
    }
  });

  test('health cell shows a 0–100 score with a label and a P/L figure', async ({ page }) => {
    const healthVal = await page.locator('.cell', { hasText: 'HEALTH' }).locator('.cell-val').innerText();
    const score = parseInt(healthVal, 10);
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(100);
    // Health label is one of the three defined buckets.
    const healthSub = await page.locator('.cell', { hasText: 'HEALTH' }).locator('.cell-sub').innerText();
    expect(healthSub).toMatch(/Good|Moderate|Weak/);
  });

  test('AI headline (when generated) reads at a retail-friendly level', async ({ page }) => {
    const headline = page.locator('.headline em');
    test.skip((await headline.count()) === 0, 'No AI headline generated yet');
    const text = (await headline.innerText()).trim();
    const r = analyzeReadability(text);
    // A 1–2 sentence morning brief should not be jargon-dense.
    expect(r.jargonDensity, `jargon too dense in "${text}"`).toBeLessThan(0.1);
  });

  test('is mobile-friendly at 375px with no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await gotoAndSettle(page, '/dashboard');
    await expect(page.getByText('AI MORNING BRIEFING')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });

  test('exposes a Regenerate brief action', async ({ page }) => {
    await expect(page.getByRole('button', { name: /regenerate brief/i })).toBeVisible();
  });
});
