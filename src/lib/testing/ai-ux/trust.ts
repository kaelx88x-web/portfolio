/**
 * Section 7 — AI Trust / Traceability.
 *
 * Every recommendation must trace: Recommendation → Reason → Supporting Data →
 * Data Source. A recommendation that cannot be traced fails. For structured
 * `TraceableRecommendation`s we check each link directly and confirm the cited
 * data reconciles against `KnownPortfolioData`; for free-text we detect reason
 * markers, embedded data tokens, and a source attribution.
 */
import type { AiResponseUnderTest, KnownPortfolioData, TraceResult } from './types';
import { extractMoneyValues, matchesKnownNumber } from './data-integrity';

const REASON_MARKERS = [
  'because', 'due to', 'since', 'driven by', 'as a result', 'reason', 'given that',
  'reflects', 'caused by', 'so that', 'in order to',
];

const SOURCE_MARKERS = [
  'broker', 'position data', 'snapshot', 'market data', 'moomoo', 'portfolio data',
  'source', 'context', 'holdings data',
];

/** Does a data string carry at least one concrete, checkable figure? */
function dataHasFigures(data: string[]): boolean {
  return data.some((d) => /[\d]/.test(d));
}

function dataGroundedIn(data: string[], known: KnownPortfolioData): boolean {
  const values = data.flatMap((d) => extractMoneyValues(d).concat(bareNumbers(d)));
  if (values.length === 0) return false;
  // Every cited monetary/ratio figure should reconcile to known data.
  return values.every((v) => matchesKnownNumber(v, known) || isPlausibleRatio(v));
}

function bareNumbers(text: string): number[] {
  return (text.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number).filter(Number.isFinite);
}

/** DTE / counts / small ratios are derived, not portfolio dollar figures. */
function isPlausibleRatio(v: number): boolean {
  return Math.abs(v) <= 365; // days-to-expiry, small counts, percentages
}

export function checkTraceability(
  response: AiResponseUnderTest,
  known: KnownPortfolioData,
): TraceResult {
  const traces: TraceResult['traces'] = [];
  const failures: string[] = [];

  if (response.recommendations && response.recommendations.length > 0) {
    for (const rec of response.recommendations) {
      const hasReason = rec.reason.trim().length > 0;
      const hasData = rec.data.length > 0 && dataHasFigures(rec.data);
      const hasSource = rec.source.trim().length > 0;
      const dataGroundedInKnown = hasData && dataGroundedIn(rec.data, known);
      const traceable = hasReason && hasData && hasSource && dataGroundedInKnown;
      traces.push({ recommendation: rec.recommendation, hasReason, hasData, hasSource, dataGroundedInKnown, traceable });
      if (!traceable) {
        const missing = [
          !hasReason && 'reason',
          !hasData && 'data',
          !hasSource && 'source',
          hasData && !dataGroundedInKnown && 'data-not-grounded',
        ].filter(Boolean);
        failures.push(`"${rec.recommendation}" not traceable (missing: ${missing.join(', ')})`);
      }
    }
  } else {
    // Free-text fallback: the whole response must show reason + data + source.
    const lower = response.text.toLowerCase();
    const hasReason = REASON_MARKERS.some((m) => lower.includes(m));
    const hasData = /[\d]/.test(response.text);
    const hasSource =
      (response.sourceContexts?.length ?? 0) > 0 || SOURCE_MARKERS.some((m) => lower.includes(m));
    const traceable = hasReason && hasData && hasSource;
    traces.push({
      recommendation: '(free-text response)',
      hasReason,
      hasData,
      hasSource,
      dataGroundedInKnown: hasData,
      traceable,
    });
    if (!traceable) {
      const missing = [!hasReason && 'reason', !hasData && 'data', !hasSource && 'source'].filter(Boolean);
      failures.push(`Free-text response not traceable (missing: ${missing.join(', ')})`);
    }
  }

  const traceableCount = traces.filter((t) => t.traceable).length;
  const score = traces.length > 0 ? Math.round((traceableCount / traces.length) * 100) : 0;

  return { passed: failures.length === 0, score, traces, failures };
}
