/**
 * Optimization UX — Test 9: User Trust.
 * Every recommendation must trace: Recommendation → Reason → Supporting Data →
 * Expected Outcome. (Like the AI-suite trust check, but the 4th link is the
 * expected outcome rather than a data source.)
 */
import type { OptimizationRecommendation, OptTrustResult } from './types';

const hasFigures = (data: string[]) => data.some((d) => /\d/.test(d));

export function checkOptimizationTrust(recommendations: OptimizationRecommendation[]): OptTrustResult {
  if (recommendations.length === 0) {
    return { passed: false, score: 0, traces: [], failures: ['No recommendations to verify'] };
  }
  const traces = recommendations.map((rec) => {
    const hasReason = rec.reason.trim().length > 0;
    const hasData = rec.data.length > 0 && hasFigures(rec.data);
    const hasExpectedOutcome = rec.expectedOutcome.trim().length > 0;
    const traceable = hasReason && hasData && hasExpectedOutcome;
    return { recommendation: rec.action, hasReason, hasData, hasExpectedOutcome, traceable };
  });
  const failures = traces
    .filter((t) => !t.traceable)
    .map((t) => {
      const missing = [
        !t.hasReason && 'reason',
        !t.hasData && 'supporting-data',
        !t.hasExpectedOutcome && 'expected-outcome',
      ].filter(Boolean);
      return `"${t.recommendation}" not traceable (missing: ${missing.join(', ')})`;
    });
  const traceable = traces.filter((t) => t.traceable).length;
  return {
    passed: failures.length === 0,
    score: Math.round((traceable / traces.length) * 100),
    traces,
    failures,
  };
}
