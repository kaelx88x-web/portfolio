/**
 * Section 10 — Production Readiness Score.
 *
 * Aggregates the five pillar scores into an overall score and a ship/no-ship
 * verdict. Weighting reflects that a retail AI advisor is unusable if it
 * fabricates data or cannot be trusted, so Data Integrity and Trustworthiness
 * carry the most weight.
 */
import type { ReadinessReport, ReadinessVerdict } from './types';

const WEIGHTS = {
  dataIntegrity: 0.3,
  trustworthiness: 0.25,
  aiAccuracy: 0.2,
  uxReadability: 0.15,
  performance: 0.1,
} as const;

export function verdictFor(overall: number): ReadinessVerdict {
  if (overall >= 80) return 'Production Ready';
  if (overall >= 60) return 'Beta Ready';
  return 'Not Ready';
}

export function badgeFor(verdict: ReadinessVerdict): string {
  return verdict === 'Production Ready'
    ? '✅ Production Ready'
    : verdict === 'Beta Ready'
      ? '⚠️ Beta Ready'
      : '❌ Not Ready';
}

export function computeReadiness(pillars: {
  dataIntegrity: number;
  aiAccuracy: number;
  uxReadability: number;
  trustworthiness: number;
  performance: number;
}): ReadinessReport {
  const clamp = (n: number) => Math.max(0, Math.min(100, n));
  const p = {
    dataIntegrity: clamp(pillars.dataIntegrity),
    aiAccuracy: clamp(pillars.aiAccuracy),
    uxReadability: clamp(pillars.uxReadability),
    trustworthiness: clamp(pillars.trustworthiness),
    performance: clamp(pillars.performance),
  };

  const overall = Math.round(
    p.dataIntegrity * WEIGHTS.dataIntegrity +
      p.trustworthiness * WEIGHTS.trustworthiness +
      p.aiAccuracy * WEIGHTS.aiAccuracy +
      p.uxReadability * WEIGHTS.uxReadability +
      p.performance * WEIGHTS.performance,
  );

  const verdict = verdictFor(overall);
  return { ...p, overall, verdict, badge: badgeFor(verdict) };
}

/** Renders the Section 10 scorecard for console / report output. */
export function formatReadinessReport(r: ReadinessReport): string {
  return [
    'PRODUCTION READINESS SCORE',
    '──────────────────────────',
    `Data Integrity:   ${r.dataIntegrity}/100`,
    `AI Accuracy:      ${r.aiAccuracy}/100`,
    `UX Readability:   ${r.uxReadability}/100`,
    `Trustworthiness:  ${r.trustworthiness}/100`,
    `Performance:      ${r.performance}/100`,
    '──────────────────────────',
    `Overall:          ${r.overall}/100`,
    `Verdict:          ${r.badge}`,
  ].join('\n');
}
