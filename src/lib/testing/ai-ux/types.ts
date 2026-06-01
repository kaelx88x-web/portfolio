/**
 * AI UX Testing Framework — shared types.
 *
 * The framework verifies that AI responses surfaced to retail investors are
 * Accurate, Explainable, Trustworthy, easy to understand, and grounded ONLY in
 * real portfolio data. Every scorer in this package is pure and deterministic
 * so it can run in unit tests (Vitest) and be reused from Playwright UX specs.
 */

/**
 * The ground-truth a response is allowed to talk about. Built from the real
 * portfolio context / DB (see `fromAiContext`). Anything an AI response asserts
 * that cannot be reconciled against this set is treated as a hallucination.
 */
export type KnownPortfolioData = {
  /** Display currency of the scoped account (e.g. 'USD'). */
  currency: string;
  /** Tickers legitimately present: holdings + benchmarks + cash currencies. */
  allowedTickers: string[];
  /** Every legitimate numeric value: prices, market values, P&L, strikes,
   * premiums, cash, buying power — plus their rounded forms. Used to decide
   * whether a money figure in the text was invented. */
  knownNumbers: number[];
  cashBalance: number;
  buyingPower: number;
  /** True when the underlying account actually has option positions. */
  hasOptions: boolean;
};

/** A single AI response (or section) under test. */
export type AiResponseUnderTest = {
  id: string;
  /** Which surface produced it: 'daily-digest' | 'risk-advisor' | … */
  surface: string;
  /** Full natural-language text shown to the user. */
  text: string;
  /** Structured, traceable recommendations when the surface exposes them. */
  recommendations?: TraceableRecommendation[];
  /** Provenance hints (e.g. risk-advisor `source_contexts`). */
  sourceContexts?: string[];
  /** True when the surface renders a risk/advisory disclaimer. */
  hasDisclaimer?: boolean;
};

/** Section 7 — a recommendation that must be traceable to its data + source. */
export type TraceableRecommendation = {
  recommendation: string;
  reason: string;
  /** Supporting data points, e.g. ['NIO = $5.44', 'Strike = $5.50', 'DTE = 3']. */
  data: string[];
  /** Origin of the data, e.g. 'Broker Position Data'. */
  source: string;
};

// ─── Section 1: Data Integrity ─────────────────────────────────────────────

export type IntegrityResult = {
  passed: boolean;
  score: number; // 0–100
  tickersFound: string[];
  hallucinatedTickers: string[];
  moneyValuesFound: number[];
  /** Money figures in the text that match no known number (possible invention). */
  unverifiedMoneyValues: number[];
  failures: string[];
};

// ─── Section 2: AI Response Quality ────────────────────────────────────────

export type QualityScores = {
  accuracy: number;
  explainability: number;
  clarity: number;
  trust: number;
  actionability: number;
  /** Mean of the five, 0–100. */
  overall: number;
  passed: boolean; // overall >= PASS_THRESHOLD
};

// ─── Section 3: Retail Readability ─────────────────────────────────────────

export type ReadabilityResult = {
  /** 0–100, higher = easier (Flesch reading ease, clamped). */
  readingEase: number;
  /** Jargon terms / total words, 0–1. */
  jargonDensity: number;
  jargonTerms: string[];
  avgSentenceLength: number;
  /** Derived 0–100 clarity score. */
  clarity: number;
  passed: boolean;
  failures: string[];
};

// ─── Section 7: Trust / Traceability ───────────────────────────────────────

export type TraceResult = {
  passed: boolean;
  score: number; // 0–100
  /** Per-recommendation breakdown of which trace links resolved. */
  traces: Array<{
    recommendation: string;
    hasReason: boolean;
    hasData: boolean;
    hasSource: boolean;
    dataGroundedInKnown: boolean;
    traceable: boolean;
  }>;
  failures: string[];
};

// ─── Section 10: Production Readiness ──────────────────────────────────────

export type ReadinessVerdict = 'Not Ready' | 'Beta Ready' | 'Production Ready';

export type ReadinessReport = {
  dataIntegrity: number;
  aiAccuracy: number;
  uxReadability: number;
  trustworthiness: number;
  performance: number;
  overall: number;
  verdict: ReadinessVerdict;
  /** Emoji-prefixed verdict for digest/console output. */
  badge: string;
};

/** Pass threshold shared across sections (Section 2 says "80+"). */
export const PASS_THRESHOLD = 80;
