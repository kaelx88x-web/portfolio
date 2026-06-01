/**
 * Optimization UX Testing Framework — shared types.
 *
 * Ensures the Optimization Engine's recommendations are Understandable,
 * Explainable, Trustworthy, and Actionable. Validators are pure + deterministic
 * (Vitest-unit-testable) and reused from Playwright specs that feed them the
 * live rendered text. Reuses `$lib/testing/ai-ux` for readability.
 */

/** A structured optimization recommendation (when a surface exposes one). */
export type OptimizationRecommendation = {
  /** What to do, e.g. "Reduce QQQ allocation". */
  action: string;
  /** Why, e.g. "Technology concentration is too high". */
  reason: string;
  /** Concrete figures backing it, e.g. ["QQQ = 50%", "target = 35%"]. */
  data: string[];
  /** Expected outcome, e.g. "Lower portfolio volatility". */
  expectedOutcome: string;
  /** Confidence level if shown. */
  confidence?: 'high' | 'medium' | 'low';
};

export type CheckResult = {
  passed: boolean;
  score: number; // 0–100
  failures: string[];
};

// Test 1 — Understandability (the 5-stage chain)
export type UnderstandabilityResult = CheckResult & {
  stages: {
    currentPortfolio: boolean;
    problemsFound: boolean;
    opportunity: boolean;
    recommendedChanges: boolean;
    expectedImprovement: boolean;
  };
  blackBox: boolean; // true when ≤1 stage is present
};

// Test 2 — Before/After
export type BeforeAfterResult = CheckResult & {
  hasBefore: boolean;
  hasAfter: boolean;
  improvementMetrics: string[]; // e.g. ['risk', 'diversification', 'volatility']
};

// Test 6 — Hybrid options cap
export type OptionsCapResult = CheckResult & {
  suggestedPct: number;
  capPct: number;
  breachedBy: number; // 0 when within cap
};

// Test 7 — Options optimizer explanation coverage
export type OptionsExplanationResult = CheckResult & {
  covered: {
    premiumPotential: boolean;
    assignmentRisk: boolean;
    probabilityOfProfit: boolean;
    capitalRequired: boolean;
    expectedReturn: boolean;
  };
};

// Test 8 — Trade planner horizons
export type TradePlannerResult = CheckResult & {
  horizons: { today: boolean; thisWeek: boolean; nextExpiry: boolean };
};

// Test 9 — Trust (Recommendation → Reason → Data → Expected Outcome)
export type OptTrustResult = CheckResult & {
  traces: Array<{
    recommendation: string;
    hasReason: boolean;
    hasData: boolean;
    hasExpectedOutcome: boolean;
    traceable: boolean;
  }>;
};

// Test 10 — Decision simulation (comparable options)
export type DecisionSimResult = CheckResult & {
  optionsFound: string[];
  comparable: boolean;
};

// Test 12 — Report card
export type OptimizationVerdict = 'Confusing' | 'Needs Improvement' | 'Production Ready';
export type OptimizationReportCard = {
  readability: number;
  explainability: number;
  trust: number;
  actionability: number;
  decisionClarity: number;
  overall: number;
  verdict: OptimizationVerdict;
  badge: string;
};

export const OPT_PASS_THRESHOLD = 80;
