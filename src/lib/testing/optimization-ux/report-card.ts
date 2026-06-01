/**
 * Optimization UX — Test 12: Optimization Report Card.
 * Aggregates the five pillars into an overall score + verdict.
 */
import type { OptimizationReportCard, OptimizationVerdict } from './types';

export function optimizationVerdict(overall: number): OptimizationVerdict {
  if (overall >= 80) return 'Production Ready';
  if (overall >= 60) return 'Needs Improvement';
  return 'Confusing';
}

export function optimizationBadge(v: OptimizationVerdict): string {
  return v === 'Production Ready' ? '✅ Production Ready' : v === 'Needs Improvement' ? '⚠️ Needs Improvement' : '❌ Confusing';
}

export function computeOptimizationReportCard(pillars: {
  readability: number;
  explainability: number;
  trust: number;
  actionability: number;
  decisionClarity: number;
}): OptimizationReportCard {
  const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));
  const p = {
    readability: clamp(pillars.readability),
    explainability: clamp(pillars.explainability),
    trust: clamp(pillars.trust),
    actionability: clamp(pillars.actionability),
    decisionClarity: clamp(pillars.decisionClarity),
  };
  // Trust + explainability weigh most: a recommendation users can't trust or
  // understand is worse than one that's merely terse.
  const overall = clamp(
    p.trust * 0.25 + p.explainability * 0.25 + p.actionability * 0.2 + p.readability * 0.15 + p.decisionClarity * 0.15,
  );
  const verdict = optimizationVerdict(overall);
  return { ...p, overall, verdict, badge: optimizationBadge(verdict) };
}

export function formatOptimizationReportCard(r: OptimizationReportCard): string {
  return [
    'OPTIMIZATION REPORT CARD',
    '────────────────────────',
    `Readability:      ${r.readability}/100`,
    `Explainability:   ${r.explainability}/100`,
    `Trust:            ${r.trust}/100`,
    `Actionability:    ${r.actionability}/100`,
    `Decision Clarity: ${r.decisionClarity}/100`,
    '────────────────────────',
    `Overall:          ${r.overall}/100`,
    `Verdict:          ${r.badge}`,
  ].join('\n');
}
