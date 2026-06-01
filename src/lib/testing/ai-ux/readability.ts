/**
 * Section 3 — Retail Investor Readability.
 *
 * Retail investors must understand a response without a finance degree. We
 * measure jargon density (penalising unexplained technical terms), Flesch
 * reading ease, and average sentence length, then fold them into a single
 * clarity score. All heuristics are deterministic.
 */
import type { ReadabilityResult } from './types';

/**
 * Finance/technical jargon that confuses retail investors when used without a
 * plain-language gloss. The framework does not forbid these terms outright —
 * it flags excessive density so authors keep explanations alongside them.
 */
export const JARGON_TERMS = [
  'sortino', 'sharpe', 'alpha', 'beta', 'theta', 'gamma', 'vega', 'delta', 'rho',
  'volatility', 'drawdown', 'kurtosis', 'skewness', 'covariance', 'correlation',
  'standard deviation', 'variance', 'cagr', 'annualized', 'annualised',
  'basis points', 'bps', 'rebalance', 'liquidity', 'leverage', 'notional',
  'assignment', 'moneyness', 'intrinsic value', 'extrinsic value', 'implied volatility',
  'mark-to-market', 'vix', 'duration', 'convexity', 'hedge', 'derivative',
  'concentration risk', 'systematic risk', 'idiosyncratic', 'tail risk',
];

const ACTION_VERBS = [
  'consider', 'review', 'monitor', 'reduce', 'increase', 'trim', 'add', 'close',
  'roll', 'hold', 'sell', 'buy', 'rebalance', 'diversify', 'watch', 'check',
];

function words(text: string): string[] {
  return text.toLowerCase().match(/[a-z][a-z'-]*/g) ?? [];
}

function sentences(text: string): string[] {
  return text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/** Approximate English syllable count for a single word. */
export function countSyllables(word: string): number {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (w.length <= 3) return 1;
  const trimmed = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '');
  const groups = trimmed.match(/[aeiouy]{1,2}/g);
  return Math.max(1, groups ? groups.length : 1);
}

/** Flesch Reading Ease (0–100, higher = easier). Clamped to the 0–100 range. */
export function fleschReadingEase(text: string): number {
  const w = words(text);
  const s = sentences(text);
  if (w.length === 0 || s.length === 0) return 0;
  const syllables = w.reduce((sum, word) => sum + countSyllables(word), 0);
  const wordsPerSentence = w.length / s.length;
  const syllablesPerWord = syllables / w.length;
  const score = 206.835 - 1.015 * wordsPerSentence - 84.6 * syllablesPerWord;
  return Math.max(0, Math.min(100, score));
}

/** Count of distinct jargon terms appearing in the text. */
export function findJargon(text: string): string[] {
  const lower = text.toLowerCase();
  return JARGON_TERMS.filter((term) => new RegExp(`\\b${term}\\b`).test(lower));
}

/** True when the text contains at least one clear recommended action verb. */
export function hasActionableLanguage(text: string): boolean {
  const lower = text.toLowerCase();
  return ACTION_VERBS.some((v) => new RegExp(`\\b${v}`).test(lower));
}

export function analyzeReadability(text: string): ReadabilityResult {
  const w = words(text);
  const s = sentences(text);
  const jargonTerms = findJargon(text);
  const jargonHits = jargonTerms.reduce(
    (sum, term) => sum + (text.toLowerCase().match(new RegExp(`\\b${term}\\b`, 'g'))?.length ?? 0),
    0,
  );
  const jargonDensity = w.length > 0 ? jargonHits / w.length : 0;
  const readingEase = fleschReadingEase(text);
  const avgSentenceLength = s.length > 0 ? w.length / s.length : w.length;

  // Clarity blends reading ease with penalties for jargon density and very long
  // sentences. A 9th-grade-readable, low-jargon answer lands near 100.
  let clarity = readingEase;
  clarity -= jargonDensity * 300; // each 1% jargon ≈ −3 clarity pts
  if (avgSentenceLength > 25) clarity -= (avgSentenceLength - 25) * 2;
  clarity = Math.max(0, Math.min(100, clarity));

  const failures: string[] = [];
  if (jargonDensity > 0.06) failures.push(`Excessive jargon density: ${(jargonDensity * 100).toFixed(1)}%`);
  if (avgSentenceLength > 30) failures.push(`Sentences too long: ${avgSentenceLength.toFixed(0)} words avg`);
  if (readingEase < 40) failures.push(`Hard to read (Flesch ${readingEase.toFixed(0)})`);

  return {
    readingEase,
    jargonDensity,
    jargonTerms,
    avgSentenceLength,
    clarity,
    passed: failures.length === 0,
    failures,
  };
}
