/**
 * Layer 2 — /cashflow UX (Playwright, live data from the Moomoo bridge).
 *
 * Data is SSR-loaded from the bridge, so empty/error states cannot be forced
 * from the browser (would need OpenD offline) — those are covered at the unit
 * layer and marked skip-with-note here. Populated/filter/format/responsive/a11y
 * run against whatever the live account returns.
 */
import { expect, test, type Page } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle, expectNoHorizontalOverflow } from '../e2e/ai-ux/helpers';

const num = (t: string | null) => {
  const m = (t ?? '').match(/-?[\d,]+\.\d{2}/);
  return m ? parseFloat(m[0].replace(/,/g, '')) : NaN;
};

async function hasData(page: Page) {
  return (await page.getByTestId('cf-empty').count()) === 0 && (await page.getByTestId('cf-row').count()) > 0;
}

test.describe('Layer 2 — /cashflow UX', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
    await signInByApi(page);
    await gotoAndSettle(page, '/cashflow');
  });

  test('header + summary tiles render', async ({ page }) => {
    await expect(page.getByText('Cash Flow', { exact: true })).toBeVisible();
    await expect(page.getByText('Account transactions from Moomoo broker — last 60 days')).toBeVisible();
    await expect(page.getByTestId('cf-total-in')).toBeVisible();
    await expect(page.getByTestId('cf-total-out')).toBeVisible();
    await expect(page.getByTestId('cf-net')).toBeVisible();
  });

  test('populated: count tile matches rendered rows', async ({ page }) => {
    test.skip(!(await hasData(page)), 'No live cash-flow data in window');
    const rows = await page.getByTestId('cf-row').count();
    const countText = await page.getByTestId('cf-count').innerText();
    expect(countText).toContain(`${rows} transaction`);
  });

  test('populated: summary tiles reconcile with row amounts (internal consistency)', async ({ page }) => {
    test.skip(!(await hasData(page)), 'No live cash-flow data in window');
    const amounts = await page.getByTestId('cf-amount').allInnerTexts();
    let inSum = 0;
    let outSum = 0;
    for (const a of amounts) {
      const v = Math.abs(num(a));
      if (a.trim().startsWith('+')) inSum += v;
      else outSum += v;
    }
    // Gross consistency only — exact aggregation is proven in the Vitest layer.
    // The live bridge does ~60 sequential day-queries and can return partial data,
    // so allow a small tolerance rather than asserting to the cent here.
    expect(num(await page.getByTestId('cf-total-in').innerText())).toBeCloseTo(inSum, 0);
    expect(num(await page.getByTestId('cf-total-out').innerText())).toBeCloseTo(outSum, 0);
  });

  test('every row amount is formatted "<sign><number.2dp> <CCY>"', async ({ page }) => {
    test.skip(!(await hasData(page)), 'No live cash-flow data in window');
    for (const a of await page.getByTestId('cf-amount').allInnerTexts()) {
      expect(a.trim(), `bad amount format: ${a}`).toMatch(/^[+\-][\d,]+\.\d{2}\s+[A-Z]{3}$/);
    }
  });

  test('direction filter IN shows only inflows and recomputes totals', async ({ page }) => {
    test.skip(!(await hasData(page)), 'No live cash-flow data in window');
    await page.getByTestId('cf-filter-dir-IN').click();
    const amounts = await page.getByTestId('cf-amount').allInnerTexts();
    test.skip(amounts.length === 0, 'No IN transactions in window');
    expect(amounts.every((a) => a.trim().startsWith('+'))).toBe(true);
    expect(num(await page.getByTestId('cf-total-out').innerText())).toBe(0);
  });

  test('direction filter OUT shows only outflows', async ({ page }) => {
    test.skip(!(await hasData(page)), 'No live cash-flow data in window');
    await page.getByTestId('cf-filter-dir-OUT').click();
    const amounts = await page.getByTestId('cf-amount').allInnerTexts();
    test.skip(amounts.length === 0, 'No OUT transactions in window');
    expect(amounts.every((a) => a.trim().startsWith('-'))).toBe(true);
    expect(num(await page.getByTestId('cf-total-in').innerText())).toBe(0);
  });

  test('a11y: direction filter is a labelled group with aria-pressed buttons', async ({ page }) => {
    const group = page.getByTestId('cf-filter-dir');
    await expect(group).toHaveAttribute('role', 'group');
    await expect(group).toHaveAttribute('aria-label', /direction/i);
    await expect(page.getByTestId('cf-filter-dir-All')).toHaveAttribute('aria-pressed', 'true');
    await page.getByTestId('cf-filter-dir-IN').focus();
    await expect(page.getByTestId('cf-filter-dir-IN')).toBeFocused();
  });

  for (const vp of [
    { name: '375px', width: 375, height: 812 },
    { name: '1024px', width: 1024, height: 1366 },
    { name: '1440px', width: 1440, height: 900 },
  ]) {
    test(`responsive @ ${vp.name}: no horizontal overflow, summary visible`, async ({ page }) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      await gotoAndSettle(page, '/cashflow');
      await expect(page.getByTestId('cf-summary')).toBeVisible();
      await expectNoHorizontalOverflow(page);
    });
  }

  // ── Documented gaps (cannot be forced from the browser via SSR) ──
  test('empty state (no data / OpenD offline)', async ({ page }) => {
    const empty = await page.getByTestId('cf-empty').count();
    test.skip(empty === 0, 'Account has data; empty state needs OpenD offline (covered in unit layer).');
    await expect(page.getByText('No cash flow data')).toBeVisible();
    await expect(page.getByText(/Connect Moomoo OpenD/i)).toBeVisible();
  });
});
