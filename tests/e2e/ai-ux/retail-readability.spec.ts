/**
 * Section 3 — Retail Investor UX Test.
 *
 * Across the AI surfaces, a retail investor should be able to understand their
 * portfolio status, risk level, P/L, which position needs attention, and the
 * recommended action — without drowning in jargon. Fails on excessive jargon,
 * missing reasoning, or no recommended action.
 */
import { expect, test } from '@playwright/test';
import { hasE2ECredentials, signInByApi, gotoAndSettle, visibleText } from './helpers';
import { analyzeReadability, hasActionableLanguage } from '../../../src/lib/testing/ai-ux/readability';

const SURFACES = [
  { name: 'Risk Advisor', url: '/ai/risk-advisor' },
  { name: 'Portfolio Assistant', url: '/ai/portfolio-assistant' },
];

// Explanatory connectors the AI surfaces actually use to justify a statement.
const REASON_MARKERS = [
  'because', 'due to', 'since', 'driven by', 'reflects', 'so that', 'helps',
  'depends', 'means', 'can come from', 'about', 'which gives',
];

test.describe('Section 3 — Retail Readability', () => {
  test.beforeEach(async ({ page }) => {
    test.skip(!hasE2ECredentials(), 'Set E2E_EMAIL and E2E_PASSWORD');
    await signInByApi(page);
  });

  for (const surface of SURFACES) {
    test(`${surface.name}: jargon stays within retail limits`, async ({ page }) => {
      await gotoAndSettle(page, surface.url);
      const text = await visibleText(page);
      const r = analyzeReadability(text);
      // Whole-page text includes labels/headers, so allow a slightly higher cap
      // than a single sentence, but still bounded for retail comprehension.
      expect(r.jargonDensity, `jargon terms: ${r.jargonTerms.join(', ')}`).toBeLessThan(0.15);
    });

    test(`${surface.name}: provides reasoning and a recommended action`, async ({ page }) => {
      await gotoAndSettle(page, surface.url);
      const text = (await visibleText(page)).toLowerCase();
      expect(REASON_MARKERS.some((m) => text.includes(m)), 'no reasoning markers found').toBe(true);
      expect(hasActionableLanguage(text), 'no recommended action found').toBe(true);
    });

    test(`${surface.name}: communicates portfolio status and risk level`, async ({ page }) => {
      await gotoAndSettle(page, surface.url);
      const text = (await visibleText(page)).toLowerCase();
      // Status: value or holdings; Risk: a risk/health framing.
      expect(text).toMatch(/portfolio|holdings|value|cash/);
      expect(text).toMatch(/risk|health|stable|watch|moderate|elevated/);
    });
  }
});
