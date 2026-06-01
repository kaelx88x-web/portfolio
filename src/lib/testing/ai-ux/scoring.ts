/**
 * Section 2 — AI Response Quality.
 *
 * Folds the per-discipline signals into the five scores the spec requires:
 * Accuracy, Explainability, Clarity, Trust, Actionability — each 0–100, with a
 * shared pass threshold of 80. Accuracy comes from data integrity, clarity from
 * readability, trust from traceability; explainability and actionability are
 * scored here from reasoning markers and recommended-action structure.
 */
import type { AiResponseUnderTest, KnownPortfolioData, QualityScores } from './types';
import { PASS_THRESHOLD } from './types';
import { checkDataIntegrity } from './data-integrity';
import { analyzeReadability, hasActionableLanguage } from './readability';
import { checkTraceability } from './trust';

const EXPLAIN_MARKERS = [
  'because', 'due to', 'since', 'driven by', 'as a result', 'this means',
  'which means', 'reflects', 'for example', 'in other words', 'that is',
];

const TIMEFRAME_MARKERS = ['today', 'this week', 'this month', 'now', 'soon', 'before', 'by '];

/** Explainability: reasoning markers + supporting figures + cited source. */
export function scoreExplainability(response: AiResponseUnderTest): number {
  const lower = response.text.toLowerCase();
  const reasonHits = EXPLAIN_MARKERS.filter((m) => lower.includes(m)).length;
  const hasFigures = /[\d]/.test(response.text);
  const hasSource =
    (response.sourceContexts?.length ?? 0) > 0 || (response.recommendations?.length ?? 0) > 0;
  let score = 0;
  if (reasonHits >= 1) score += 50; // a clear "because/so that" reason
  score += Math.min(reasonHits - 1, 2) * 10; // up to +20 for layered reasoning
  if (hasFigures) score += 15; // grounds the explanation in numbers
  if (hasSource) score += 15; // points back at where it came from
  return Math.max(0, Math.min(100, score));
}

/** Actionability: a clear action verb plus, ideally, a timeframe. */
export function scoreActionability(response: AiResponseUnderTest): number {
  const lower = response.text.toLowerCase();
  let score = 0;
  if (hasActionableLanguage(response.text)) score += 60;
  if (TIMEFRAME_MARKERS.some((m) => lower.includes(m))) score += 20;
  if ((response.recommendations?.length ?? 0) > 0) score += 20;
  return Math.max(0, Math.min(100, score));
}

export function scoreResponse(
  response: AiResponseUnderTest,
  known: KnownPortfolioData,
): QualityScores {
  const accuracy = checkDataIntegrity(response, known).score;
  const clarity = analyzeReadability(response.text).clarity;
  const trust = checkTraceability(response, known).score;
  const explainability = scoreExplainability(response);
  const actionability = scoreActionability(response);

  const overall = Math.round((accuracy + explainability + clarity + trust + actionability) / 5);

  return {
    accuracy,
    explainability,
    clarity,
    trust,
    actionability,
    overall,
    passed: overall >= PASS_THRESHOLD,
  };
}
