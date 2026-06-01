/**
 * Shared helpers for the AI UX Playwright specs.
 *
 * Auth follows the repo's established pattern (sign-in by API, skip when no
 * E2E_EMAIL/E2E_PASSWORD), so these specs are inert in CI until creds are set
 * but fully exercise the live AI Suite locally.
 */
import { expect, type Page } from '@playwright/test';
import { fromAiContext } from '../../../src/lib/testing/ai-ux/data-integrity';
import type { KnownPortfolioData } from '../../../src/lib/testing/ai-ux/types';

export function hasE2ECredentials(): boolean {
  return Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);
}

export async function signInByApi(page: Page): Promise<void> {
  const res = await page.request.post('/api/auth/sign-in/email', {
    data: { email: process.env.E2E_EMAIL!, password: process.env.E2E_PASSWORD! },
  });
  expect(res.ok(), `sign-in API failed: ${await res.text()}`).toBe(true);
}

export async function gotoAndSettle(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await page.waitForLoadState('networkidle');
}

/** Mobile + tablet widths required by Section 8. */
export const VIEWPORTS = [
  { name: '320px (small phone)', width: 320, height: 720 },
  { name: '375px (iPhone)', width: 375, height: 812 },
  { name: '390px (iPhone Pro)', width: 390, height: 844 },
  { name: '768px (tablet)', width: 768, height: 1024 },
] as const;

/**
 * Section 8 — asserts the page (or a sub-tree) has no horizontal overflow:
 * scrollWidth must not exceed the viewport width by more than a 2px rounding
 * tolerance.
 */
export async function expectNoHorizontalOverflow(page: Page): Promise<void> {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return { scrollW: doc.scrollWidth, clientW: doc.clientWidth };
  });
  expect(
    overflow.scrollW,
    `horizontal overflow: scrollWidth ${overflow.scrollW} > clientWidth ${overflow.clientW}`,
  ).toBeLessThanOrEqual(overflow.clientW + 2);
}

/**
 * Section 9 — times a navigation to a URL until the network is idle and the
 * given anchor text/selector is visible. Returns elapsed milliseconds.
 */
export async function measureLoad(page: Page, url: string, readySelector: string): Promise<number> {
  const start = Date.now();
  await page.goto(url);
  await page.waitForSelector(readySelector, { state: 'visible', timeout: 15_000 });
  await page.waitForLoadState('networkidle');
  return Date.now() - start;
}

/** Whole visible text of the page, normalised to single spaces. */
export async function visibleText(page: Page): Promise<string> {
  return (await page.evaluate(() => document.body.innerText)).replace(/\s+/g, ' ').trim();
}

/**
 * Text of the main AI content region only (excludes the topbar/nav chrome where
 * the avatar initials, account badge, and global labels live). Used for the
 * ticker/figure integrity checks so page chrome isn't mistaken for AI output.
 */
export async function aiContentText(page: Page): Promise<string> {
  return (
    await page.evaluate(() => {
      const main = document.querySelector('main');
      return (main ?? document.body).innerText;
    })
  )
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Fetches the live AI context payload for the signed-in user and turns it into
 * the ground-truth `KnownPortfolioData`. UX specs use this to verify that the
 * AI text rendered on a page never references tickers/prices outside the user's
 * real, account-scoped portfolio. Returns null if the endpoint is unavailable.
 */
export async function fetchKnownData(page: Page): Promise<KnownPortfolioData | null> {
  const res = await page.request.get('/api/v1/ai/context?scope=full');
  if (!res.ok()) return null;
  const body = (await res.json()) as { context?: unknown };
  const ctx = body.context ?? body;
  return fromAiContext(ctx as never);
}
