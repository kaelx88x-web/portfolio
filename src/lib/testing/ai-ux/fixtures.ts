/**
 * Shared fixtures for the AI UX framework's unit tests. Models a small, realistic
 * retail portfolio (the kind PortfolioAI surfaces) so tests read like real data.
 */
import type { KnownPortfolioData } from './types';

/** A 4-position USD account: SCHG ETF, NIO stock, a NIO covered call, cash. */
export const KNOWN: KnownPortfolioData = {
  currency: 'USD',
  allowedTickers: ['US.SCHG', 'NIO', 'NIO260530C00005500', 'SPY', 'USD'],
  knownNumbers: [
    1719.5, // portfolio value
    1372.57, // cash
    175.76, // SCHG market value
    90.3, // SCHG price
    5.44, // NIO price
    21.25, // NIO market value
    -14, // covered-call market value
    -3, // covered-call P/L
    5.5, // strike
  ],
  cashBalance: 1372.57,
  buyingPower: 1372.57,
  hasOptions: true,
};

/** A clean, well-grounded response that should pass every section. */
export const GOOD_RESPONSE_TEXT =
  'Your portfolio is worth $1,719.50 with $1,372.57 in cash. NIO is near its $5.50 strike at $5.44, so the covered call may be assigned soon. Consider rolling it this week because the position is close to the money.';

/** A response that invents a ticker and a price — should hard-fail Section 1. */
export const HALLUCINATED_RESPONSE_TEXT =
  'You hold TSLA at $242.18 and should buy more GOOG before earnings. Your portfolio gained $9,999.00 today.';
