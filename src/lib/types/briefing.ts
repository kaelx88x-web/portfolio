export type BriefingAlertType = 'warning' | 'success' | 'info';

export type BriefingAlert = {
  type: BriefingAlertType;
  text: string;
};

export type PortfolioMover = {
  symbol: string;
  changePercent: number; // e.g. -2.1 means -2.1%
};

export type ParsedBriefingOption = {
  symbol: string;
  underlying: string;
  optionType: 'call' | 'put';
  strike: number;
  expiration: string;   // YYYY-MM-DD
  dte: number;          // days to expiration
  premium: number;      // abs(marketValue)
  marketValue: number;
  unrealizedPnl: number;
  quantity: number;
};

export type DailyBriefing = {
  // AI-generated headline (null = not yet generated)
  aiHeadline: string | null;
  headlineGeneratedAt: string | null; // ISO timestamp

  // Computed server-side
  healthScore: number;                        // 0–100
  healthLabel: 'Good' | 'Moderate' | 'Weak';

  dayPl: number | null;     // null when no broker snapshot
  dayPlPct: number | null;

  unrealisedPnl: number;
  unrealisedPnlPct: number;

  thetaToday: number;    // 0 when no options
  optionsCount: number;

  marketRegime: 'Risk-On' | 'Neutral' | 'Risk-Off' | 'Bearish';
  vixLevel: number;

  topMover: PortfolioMover | null;

  alerts: BriefingAlert[]; // max 3
};
