/**
 * Layer 2 — /cashflow UX (Playwright, live data from the Moomoo bridge).
 *
 * Data is SSR-loaded from the bridge, so empty/error states cannot be forced
 * from the browser (would need OpenD offline) — those are covered at the unit
 * layer and marked skip-with-note here. Populated/filter/format/responsive/a11y
 * run against whatever the live account returns.
 *
 * Totals are rendered PER CURRENCY (no FX): one stat-strip per currency, each in
 * its own unit. The live account currently returns both MYR and USD, so the
 * reconciliation below is done per-currency, never across currencies.
 */
import { expect, test, type Page } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle, expectNoHorizontalOverflow } from '../e2e/ai-ux/helpers';

const num = (t: string | null) => {
  const m = (t ?? '').match(/-?[\d,]+\.\d{2}/);
  return m ? parseFloat(m[0].replace(/,/g, '')) : NaN;
};

const currencyOf = (t: string | null) => ((t ?? '').match(/[A-Z]{3}/) ?? [''])[0];

async function hasData(page: Page) {
  return (await page.getByTestId('cf-empty').count()) === 0 && (await page.getByTestId('cf-row').count()) > 0;
}

/** Per-currency summary tiles, keyed by the data-currency on each cf-currency block. */
async function currencyTiles(page: Page) {
  const blocks = page.getByTestId('cf-currency');
  const out: Record<string, { totalIn: number; totalOut: number; net: number }> = {};
  for (let i = 0; i < (await blocks.count()); i++) {
    const b = blocks.nth(i);
    const currency = (await b.getAttribute('data-currency')) ?? '';
    out[currency] = {
      totalIn: num(await b.getByTestId('cf-total-in').innerText()),
      totalOut: num(await b.getByTestId('cf-total-out').innerText()),
      net: num(await b.getByTestId('cf-net').innerText()),
    };
  }
  return out;
}

test.describe('Layer 2 — /cashflow UX', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
    await signInByApi(page);
    await gotoAndSettle(page, '/cashflow');
  });

  test('header + per-currency summary tiles render', async ({ page }) => {
    await expect(page.getByText('Cash Flow', { exact: true })).toBeVisible();
    await expect(page.getByText('Account transactions from Moomoo broker — last 60 days')).toBeVisible();
    test.skip(!(await hasData(page)), 'No live cash-flow data in window');
    // At least one currency block, each with its three tiles.
    const blocks = page.getByTestId('cf-currency');
    expect(await blocks.count()).toBeGreaterThan(0);
    const first = blocks.first();
    await expect(first.getByTestId('cf-total-in')).toBeVisible();
    await expect(first.getByTestId('cf-total-out')).toBeVisible();
    await expect(first.getByTestId('cf-net')).toBeVisible();
  });

  test('every summary tile carries an explicit currency unit (no FX, shown as-is)', async ({ page }) => {
    test.skip(!(await hasData(page)), 'No live cash-flow data in window');
    const blocks = page.getByTestId('cf-currency');
    for (let i = 0; i < (await blocks.count()); i++) {
      const b = blocks.nth(i);
      const ccy = await b.getAttribute('data-currency');
      expect(ccy, 'block must declare a currency').toMatch(/^[A-Z]{3}$/);
      // Tiles must name that same currency — never a bare, unitless number.
      expect(currencyOf(await b.getByTestId('cf-total-in').innerText())).toBe(ccy);
      expect(currencyOf(await b.getByTestId('cf-net').innerText())).toBe(ccy);
    }
  });

  test('populated: count line matches rendered rows', async ({ page }) => {
    test.skip(!(await hasData(page)), 'No live cash-flow data in window');
    const rows = await page.getByTestId('cf-row').count();
    const countText = await page.getByTestId('cf-count').innerText();
    expect(countText).toContain(`${rows} transaction`);
  });

  test('populated: each currency tile reconciles with its own rows (no cross-currency sum)', async ({ page }) => {
    test.skip(!(await hasData(page)), 'No live cash-flow data in window');
    const tiles = await currencyTiles(page);
    // Sum row magnitudes per currency, by sign.
    const fromRows: Record<string, { inSum: number; outSum: number }> = {};
    for (const a of await page.getByTestId('cf-amount').allInnerTexts()) {
      const ccy = currencyOf(a);
      const v = Math.abs(num(a));
      (fromRows[ccy] ??= { inSum: 0, outSum: 0 });
      if (a.trim().startsWith('+')) fromRows[ccy].inSum += v;
      else fromRows[ccy].outSum += v;
    }
    // Each currency present in rows must have a matching tile that reconciles.
    // Tolerance 0 dp: the live bridge does ~60 sequential day-queries.
    for (const [ccy, sums] of Object.entries(fromRows)) {
      expect(tiles[ccy], `missing summary tile for ${ccy}`).toBeDefined();
      expect(tiles[ccy].totalIn).toBeCloseTo(sums.inSum, 0);
      expect(tiles[ccy].totalOut).toBeCloseTo(sums.outSum, 0);
    }
  });

  test('every row amount is formatted "<sign><number.2dp> <CCY>"', async ({ page }) => {
    test.skip(!(await hasData(page)), 'No live cash-flow data in window');
    for (const a of await page.getByTestId('cf-amount').allInnerTexts()) {
      expect(a.trim(), `bad amount format: ${a}`).toMatch(/^[+\-][\d,]+\.\d{2}\s+[A-Z]{3}$/);
    }
  });

  test('direction filter IN shows only inflows; every currency tile has zero out', async ({ page }) => {
    test.skip(!(await hasData(page)), 'No live cash-flow data in window');
    await page.getByTestId('cf-filter-dir-IN').click();
    const amounts = await page.getByTestId('cf-amount').allInnerTexts();
    test.skip(amounts.length === 0, 'No IN transactions in window');
    expect(amounts.every((a) => a.trim().startsWith('+'))).toBe(true);
    const tiles = await currencyTiles(page);
    for (const [ccy, t] of Object.entries(tiles)) expect(t.totalOut, `${ccy} out`).toBe(0);
  });

  test('direction filter OUT shows only outflows; every currency tile has zero in', async ({ page }) => {
    test.skip(!(await hasData(page)), 'No live cash-flow data in window');
    await page.getByTestId('cf-filter-dir-OUT').click();
    const amounts = await page.getByTestId('cf-amount').allInnerTexts();
    test.skip(amounts.length === 0, 'No OUT transactions in window');
    expect(amounts.every((a) => a.trim().startsWith('-'))).toBe(true);
    const tiles = await currencyTiles(page);
    for (const [ccy, t] of Object.entries(tiles)) expect(t.totalIn, `${ccy} in`).toBe(0);
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
