/**
 * Optimization UX — text/keyword validators (deterministic).
 * Tests 1, 2, 3, 4, 7, 8, 10.
 */
import type {
  BeforeAfterResult,
  CheckResult,
  DecisionSimResult,
  OptionsExplanationResult,
  OptimizationRecommendation,
  TradePlannerResult,
  UnderstandabilityResult,
} from './types';

const has = (text: string, re: RegExp) => re.test(text);

// ── Test 1 — Understandability: the 5-stage chain ──────────────────────────
export function checkUnderstandability(text: string): UnderstandabilityResult {
  const t = text.toLowerCase();
  const stages = {
    currentPortfolio: has(t, /current (portfolio|allocation)|portfolio value|holdings|you (hold|own)|now\b/),
    problemsFound: has(t, /problem|concentrat|too high|overweight|drift|issue|warning|risk (is|level|score)/),
    opportunity: has(t, /opportunit|optimi[sz]|could (improve|reduce|lower)|suggest|recommend|scenario/),
    recommendedChanges: has(t, /reduce|increase|trim|add|buy|sell|rebalance|target|move toward|→|->/),
    expectedImprovement: has(t, /expected (improvement|return|outcome)|improve|lower (volatility|risk)|better|diversif|\+\d|\d+\s*→\s*\d/),
  };
  const present = Object.values(stages).filter(Boolean).length;
  const score = Math.round((present / 5) * 100);
  const failures: string[] = [];
  for (const [k, v] of Object.entries(stages)) if (!v) failures.push(`Missing stage: ${k}`);
  return { passed: present >= 4, score, stages, blackBox: present <= 1, failures };
}

// ── Test 2 — Before / After ────────────────────────────────────────────────
const IMPROVEMENT_KEYS = ['risk', 'diversif', 'income', 'volatility', 'sharpe', 'return', 'concentration'];
export function checkBeforeAfter(text: string): BeforeAfterResult {
  const t = text.toLowerCase();
  const hasBefore = has(t, /current|before|now\b|today/);
  const hasAfter = has(t, /optimi[sz]ed|after|target|suggested|proposed/);
  // A delta is shown either as "72 → 58", "-11%", "+4%", or a change column.
  const hasDelta = has(text, /\d+(\.\d+)?\s*(→|->)\s*\d+(\.\d+)?|[+\-]\d+(\.\d+)?%|change/i);
  const improvementMetrics = IMPROVEMENT_KEYS.filter((k) => t.includes(k));
  const failures: string[] = [];
  if (!hasBefore) failures.push('No "before/current" state shown');
  if (!hasAfter) failures.push('No "after/optimized/target" state shown');
  if (!hasDelta) failures.push('No before→after delta or improvement figure');
  if (improvementMetrics.length === 0) failures.push('No improvement metric (risk/diversification/volatility/income)');
  const passed = hasBefore && hasAfter && hasDelta && improvementMetrics.length > 0;
  const score = Math.round(
    ((hasBefore ? 1 : 0) + (hasAfter ? 1 : 0) + (hasDelta ? 1 : 0) + (improvementMetrics.length > 0 ? 1 : 0)) * 25,
  );
  return { passed, score, hasBefore, hasAfter, improvementMetrics, failures };
}

// ── Test 3 — Explainability: every recommendation has What / Why / Outcome ──
export function checkExplainability(recommendations: OptimizationRecommendation[]): CheckResult {
  if (recommendations.length === 0) {
    return { passed: false, score: 0, failures: ['No recommendations to explain'] };
  }
  const failures: string[] = [];
  let complete = 0;
  for (const rec of recommendations) {
    const what = rec.action.trim().length > 0;
    const why = rec.reason.trim().length > 0;
    const outcome = rec.expectedOutcome.trim().length > 0;
    if (what && why && outcome) complete++;
    else {
      const missing = [!what && 'what', !why && 'why', !outcome && 'expected-outcome'].filter(Boolean);
      failures.push(`"${rec.action || '(blank)'}" missing: ${missing.join(', ')}`);
    }
  }
  const score = Math.round((complete / recommendations.length) * 100);
  return { passed: complete === recommendations.length, score, failures };
}

// ── Test 4 — Confidence display ─────────────────────────────────────────────
export function checkConfidence(text: string): CheckResult {
  const visible = has(text, /confidence[:\s]*\b(high|medium|low)\b/i) || has(text, /confidence[:\s]*\d{1,3}\s*%/i);
  return {
    passed: visible,
    score: visible ? 100 : 0,
    failures: visible ? [] : ['No confidence level (High/Medium/Low or %) shown'],
  };
}

// ── Test 7 — Options optimizer explanation coverage ─────────────────────────
export function checkOptionsExplanation(text: string): OptionsExplanationResult {
  const t = text.toLowerCase();
  const covered = {
    premiumPotential: has(t, /premium/),
    assignmentRisk: has(t, /assignment/),
    probabilityOfProfit: has(t, /probability|pop\b|chance of profit|win rate|delta/),
    capitalRequired: has(t, /capital|collateral|cash[- ]secured|buying power|locked/),
    expectedReturn: has(t, /expected return|ann\.? yield|annuali[sz]ed|yield|roi|return/),
  };
  const hits = Object.values(covered).filter(Boolean).length;
  const score = Math.round((hits / 5) * 100);
  const failures: string[] = [];
  for (const [k, v] of Object.entries(covered)) if (!v) failures.push(`Options explanation missing: ${k}`);
  // Fail hard if it's a bare "sell put" with no explanation at all.
  return { passed: hits >= 4, score, covered, failures };
}

// ── Test 8 — Trade planner horizons ─────────────────────────────────────────
export function checkTradePlanner(text: string): TradePlannerResult {
  const t = text.toLowerCase();
  const horizons = {
    today: has(t, /\btoday\b/),
    thisWeek: has(t, /this week\b/),
    nextExpiry: has(t, /next expiry|expiry week|at expiry|roll|expiration/),
  };
  const count = Object.values(horizons).filter(Boolean).length;
  const failures: string[] = [];
  for (const [k, v] of Object.entries(horizons)) if (!v) failures.push(`Missing horizon: ${k}`);
  return { passed: count === 3, score: Math.round((count / 3) * 100), horizons, failures };
}

// ── Test 10 — Decision simulation (comparable options) ──────────────────────
export function checkDecisionSimulation(text: string): DecisionSimResult {
  const t = text.toLowerCase();
  const named = ['conservative', 'moderate', 'aggressive', 'balanced'].filter((n) => t.includes(n));
  const abc = /\boption\s+[abc]\b/gi.test(text);
  const optionsFound = named.length ? named : abc ? ['Option A', 'Option B', 'Option C'] : [];
  // Comparable when ≥2 named choices AND a comparable metric is shown for them.
  const hasComparableMetric = has(t, /return|risk|volatility|sharpe|drawdown/);
  const comparable = optionsFound.length >= 2 && hasComparableMetric;
  const failures: string[] = [];
  if (optionsFound.length < 2) failures.push('Fewer than 2 comparable choices presented');
  if (!hasComparableMetric) failures.push('No shared metric to compare choices on');
  return {
    passed: comparable && optionsFound.length >= 3,
    score: Math.min(100, optionsFound.length * 30 + (hasComparableMetric ? 10 : 0)),
    optionsFound,
    comparable,
    failures,
  };
}
