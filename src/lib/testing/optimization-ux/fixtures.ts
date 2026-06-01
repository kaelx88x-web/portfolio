/** Shared fixtures for optimization-ux unit tests. */
import type { OptimizationRecommendation } from './types';

/** A clear optimization narrative covering the 5-stage chain + before/after. */
export const GOOD_OPTIMIZATION_TEXT = `
Your current portfolio holds 50% QQQ, 30% SCHD and 20% cash. The problem we found
is that technology concentration is too high, so risk is elevated. There is an
opportunity to optimize toward a more balanced mix. We recommend you reduce QQQ
and increase SCHD. Optimized allocation: QQQ 35%, SCHD 35%, Cash 30%. Expected
improvement — Risk Score: 72 → 58, Diversification: 63 → 81, Income: +4%,
Volatility: -11%. Confidence: High.
`;

/** A black-box one-liner: an action with no current/problem/opportunity/outcome. */
export const BLACKBOX_TEXT = 'Sell put.';

export const GOOD_RECOMMENDATIONS: OptimizationRecommendation[] = [
  {
    action: 'Reduce QQQ allocation',
    reason: 'Technology concentration is too high',
    data: ['QQQ = 50%', 'target = 35%'],
    expectedOutcome: 'Lower portfolio volatility',
    confidence: 'high',
  },
];

/** An options optimizer explanation covering all five required facets. */
export const GOOD_OPTIONS_TEXT = `
Sell cash-secured put on NIO. Premium potential is $113 (premium yield). Assignment
risk is medium at 41%. Probability of profit is about 59%. Capital required:
collateral $2,000 locked. Expected return: 12% annualized.
`;

/** A logical trade plan across all three horizons. */
export const GOOD_PLANNER_TEXT = `
Today: Monitor NIO. This Week: Sell a CSP if premium > 0.15. Next Expiry: Evaluate
whether to roll the position.
`;
