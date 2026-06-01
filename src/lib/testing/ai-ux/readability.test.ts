import { describe, it, expect } from 'vitest';
import {
  countSyllables,
  fleschReadingEase,
  findJargon,
  hasActionableLanguage,
  analyzeReadability,
} from './readability';
import { GOOD_RESPONSE_TEXT } from './fixtures';

describe('Section 3 — countSyllables', () => {
  it('approximates common words', () => {
    expect(countSyllables('cat')).toBe(1);
    expect(countSyllables('portfolio')).toBeGreaterThanOrEqual(3);
    expect(countSyllables('volatility')).toBeGreaterThanOrEqual(4);
  });
});

describe('Section 3 — fleschReadingEase', () => {
  it('rates a plain sentence as easier than a jargon-dense one', () => {
    const easy = fleschReadingEase('Your cash is safe. You can buy more if you want.');
    const hard = fleschReadingEase(
      'The portfolio exhibits elevated idiosyncratic volatility alongside unfavourable convexity characteristics.',
    );
    expect(easy).toBeGreaterThan(hard);
  });
});

describe('Section 3 — findJargon / hasActionableLanguage', () => {
  it('detects jargon terms', () => {
    expect(findJargon('Your Sortino ratio and max drawdown look bad.')).toEqual(
      expect.arrayContaining(['sortino', 'drawdown']),
    );
  });

  it('detects a recommended action', () => {
    expect(hasActionableLanguage('Consider rolling the call this week.')).toBe(true);
    expect(hasActionableLanguage('The sky is blue.')).toBe(false);
  });
});

describe('Section 3 — analyzeReadability', () => {
  it('passes a clear, low-jargon retail response', () => {
    const r = analyzeReadability(GOOD_RESPONSE_TEXT);
    expect(r.passed).toBe(true);
    expect(r.jargonDensity).toBeLessThan(0.06);
    expect(r.clarity).toBeGreaterThan(50);
  });

  it('flags a jargon-dense, run-on response', () => {
    const r = analyzeReadability(
      'Your annualized Sortino ratio reflects idiosyncratic tail risk and implied volatility skewness across the convexity surface, while the notional leverage and assignment moneyness compound the systematic drawdown exposure considerably beyond prudent thresholds for retail allocation mandates today.',
    );
    expect(r.passed).toBe(false);
    expect(r.failures.length).toBeGreaterThan(0);
  });
});
