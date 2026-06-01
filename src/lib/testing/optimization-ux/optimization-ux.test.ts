import { describe, it, expect } from 'vitest';
import {
  checkUnderstandability,
  checkBeforeAfter,
  checkExplainability,
  checkConfidence,
  checkOptionsExplanation,
  checkTradePlanner,
  checkDecisionSimulation,
} from './text-checks';
import { checkOptionsCap, extractCapAndSuggestion } from './guardrails';
import { checkOptimizationTrust } from './trust';
import { computeOptimizationReportCard, optimizationVerdict } from './report-card';
import {
  GOOD_OPTIMIZATION_TEXT,
  BLACKBOX_TEXT,
  GOOD_RECOMMENDATIONS,
  GOOD_OPTIONS_TEXT,
  GOOD_PLANNER_TEXT,
} from './fixtures';

describe('Test 1 — Understandability', () => {
  it('passes the full 5-stage chain', () => {
    const r = checkUnderstandability(GOOD_OPTIMIZATION_TEXT);
    expect(r.passed).toBe(true);
    expect(r.score).toBe(100);
    expect(r.blackBox).toBe(false);
  });
  it('flags a black box', () => {
    const r = checkUnderstandability(BLACKBOX_TEXT);
    expect(r.passed).toBe(false);
    expect(r.blackBox).toBe(true);
  });
});

describe('Test 2 — Before/After', () => {
  it('detects before, after, deltas and improvement metrics', () => {
    const r = checkBeforeAfter(GOOD_OPTIMIZATION_TEXT);
    expect(r.passed).toBe(true);
    expect(r.hasBefore && r.hasAfter).toBe(true);
    expect(r.improvementMetrics).toEqual(expect.arrayContaining(['risk', 'diversif', 'volatility']));
  });
  it('fails when only a current allocation is shown', () => {
    expect(checkBeforeAfter('Current: QQQ 50%, SCHD 30%, Cash 20%.').passed).toBe(false);
  });
});

describe('Test 3 — Explainability', () => {
  it('passes when every recommendation has what/why/outcome', () => {
    expect(checkExplainability(GOOD_RECOMMENDATIONS).passed).toBe(true);
  });
  it('fails when expected outcome is missing', () => {
    const r = checkExplainability([{ action: 'Reduce QQQ', reason: 'Too high', data: ['QQQ=50%'], expectedOutcome: '' }]);
    expect(r.passed).toBe(false);
    expect(r.failures[0]).toContain('expected-outcome');
  });
});

describe('Test 4 — Confidence', () => {
  it('passes when a confidence level is shown', () => {
    expect(checkConfidence('Reduce QQQ — Confidence: High').passed).toBe(true);
    expect(checkConfidence('Confidence 4%').passed).toBe(true);
  });
  it('fails when confidence is absent', () => {
    expect(checkConfidence('Reduce QQQ.').passed).toBe(false);
  });
});

describe('Test 6 — Hybrid options cap', () => {
  it('passes within the cap', () => {
    expect(checkOptionsCap(18, 20).passed).toBe(true);
  });
  it('fails when options exceed the configured cap', () => {
    const r = checkOptionsCap(28, 20);
    expect(r.passed).toBe(false);
    expect(r.breachedBy).toBeGreaterThan(0);
  });
  it('extracts cap + suggestion from text', () => {
    const { capPct, suggestedPct } = extractCapAndSuggestion('Configured Cap: 20% — AI Suggested: 28%');
    expect(capPct).toBe(20);
    expect(suggestedPct).toBe(28);
  });
});

describe('Test 7 — Options optimizer explanation', () => {
  it('passes when all five facets are covered', () => {
    const r = checkOptionsExplanation(GOOD_OPTIONS_TEXT);
    expect(r.passed).toBe(true);
    expect(r.covered.assignmentRisk && r.covered.capitalRequired).toBe(true);
  });
  it('fails a bare "Sell Put"', () => {
    expect(checkOptionsExplanation('Sell Put.').passed).toBe(false);
  });
});

describe('Test 8 — Trade planner', () => {
  it('passes with today / this week / next expiry', () => {
    const r = checkTradePlanner(GOOD_PLANNER_TEXT);
    expect(r.passed).toBe(true);
    expect(r.horizons).toEqual({ today: true, thisWeek: true, nextExpiry: true });
  });
  it('fails when horizons are missing', () => {
    expect(checkTradePlanner('Today: monitor NIO.').passed).toBe(false);
  });
});

describe('Test 9 — Trust', () => {
  it('passes a fully traceable recommendation', () => {
    expect(checkOptimizationTrust(GOOD_RECOMMENDATIONS).passed).toBe(true);
  });
  it('fails when supporting data lacks figures', () => {
    const r = checkOptimizationTrust([
      { action: 'Reduce QQQ', reason: 'Too high', data: ['it is overweight'], expectedOutcome: 'Lower risk' },
    ]);
    expect(r.passed).toBe(false);
  });
});

describe('Test 10 — Decision simulation', () => {
  it('passes with 3 comparable named strategies', () => {
    const r = checkDecisionSimulation('Conservative +5.1% · Moderate +6.5% · Aggressive +7.1% — compare risk and return.');
    expect(r.passed).toBe(true);
    expect(r.optionsFound.length).toBeGreaterThanOrEqual(3);
  });
  it('fails with a single option', () => {
    expect(checkDecisionSimulation('Aggressive scenario, +7.1% return.').passed).toBe(false);
  });
});

describe('Test 12 — Report card', () => {
  it('maps bands to verdicts', () => {
    expect(optimizationVerdict(85)).toBe('Production Ready');
    expect(optimizationVerdict(65)).toBe('Needs Improvement');
    expect(optimizationVerdict(40)).toBe('Confusing');
  });
  it('weights trust + explainability heavily', () => {
    const weak = computeOptimizationReportCard({ readability: 90, explainability: 20, trust: 20, actionability: 90, decisionClarity: 90 });
    expect(weak.verdict).not.toBe('Production Ready');
    const strong = computeOptimizationReportCard({ readability: 85, explainability: 88, trust: 90, actionability: 85, decisionClarity: 82 });
    expect(strong.verdict).toBe('Production Ready');
    expect(strong.badge).toContain('✅');
  });
});
