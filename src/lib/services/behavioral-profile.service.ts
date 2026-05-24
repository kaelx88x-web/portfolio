// src/lib/services/behavioral-profile.service.ts
import { prisma } from '$lib/server/db';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DimensionColor = 'red' | 'amber' | 'green';

export type BehavioralDimension = {
  label: string;
  score: number;       // 0–100
  color: DimensionColor;
};

export type BehavioralEvidenceLine = {
  text: string;
  boldPart?: string;   // portion rendered in bold
};

export type ScenarioWeights = {
  aggressive: number;
  balanced: number;
  conservative: number;
  cashFloorPct: number;
  goalDefault: string;
  rebalanceTrigger: string;
};

export type BehavioralProfile = {
  statedProfile: string;   // most recent manual riskProfile selection
  actualProfile: string;   // derived from behaviour
  confidencePct: number;   // 0–100, based on data volume
  dataPoints: number;      // runs + transactions count
  dimensions: BehavioralDimension[];
  evidence: BehavioralEvidenceLine[];
  weights: ScenarioWeights;
};

// ─── Internal row types ───────────────────────────────────────────────────────

type RunRow = {
  portfolioMode: string;
  optimizationGoal: string;
  riskProfile: string;
  createdAt: Date;
};

type TxRow = {
  type: string;
  tradeDate: Date;
};

type SnapRow = {
  totalValue: number;
  cashBalance: number;
};

// ─── Main export ──────────────────────────────────────────────────────────────

export async function getBehavioralProfile(userId: string): Promise<BehavioralProfile> {
  const [runs, txRows, snaps, userRows] = await Promise.all([
    prisma.$queryRaw<RunRow[]>`
      SELECT portfolio_mode  AS portfolioMode,
             optimization_goal AS optimizationGoal,
             risk_profile    AS riskProfile,
             created_at      AS createdAt
      FROM   optimization_runs
      WHERE  user_id = ${userId}
      ORDER  BY created_at DESC
      LIMIT  50
    `,
    prisma.$queryRaw<TxRow[]>`
      SELECT type, tradeDate
      FROM   \`Transaction\`
      WHERE  userId = ${userId}
      ORDER  BY tradeDate DESC
      LIMIT  200
    `,
    prisma.$queryRaw<SnapRow[]>`
      SELECT totalValue, cashBalance
      FROM   \`PortfolioSnapshot\`
      WHERE  userId = ${userId}
      ORDER  BY snapshotDate DESC
      LIMIT  30
    `,
    prisma.$queryRaw<Array<{ portfolioMode: string }>>`
      SELECT portfolioMode FROM \`user\` WHERE id = ${userId} LIMIT 1
    `,
  ]);

  const aggScore          = computeAggressiveness(runs);
  const fomoScore         = computeFomo(txRows);
  const shortTermScore    = computeShortTerm(txRows);
  const fullyInvestedScore = computeFullyInvested(snaps);

  const dimensions: BehavioralDimension[] = [
    { label: 'Aggressiveness',    score: aggScore,           color: dimColor(aggScore) },
    { label: 'FOMO buy pattern',  score: fomoScore,          color: dimColor(fomoScore) },
    { label: 'Short-term trading', score: shortTermScore,    color: dimColor(shortTermScore) },
    { label: 'Fully invested',    score: fullyInvestedScore, color: dimColor(fullyInvestedScore) },
  ];

  const weighted = aggScore * 0.4 + fomoScore * 0.2 + shortTermScore * 0.2 + fullyInvestedScore * 0.2;
  const actualProfile  = weighted >= 65 ? 'aggressive' : weighted >= 38 ? 'balanced' : 'conservative';
  const statedProfile  = deriveStated(runs, userRows[0]?.portfolioMode ?? 'stock');
  const dataPoints     = runs.length + txRows.length;
  const confidencePct  = Math.min(100, Math.round((dataPoints / 50) * 100));

  return {
    statedProfile,
    actualProfile,
    confidencePct,
    dataPoints,
    dimensions,
    evidence: buildEvidence(runs, txRows, snaps),
    weights:  buildWeights(actualProfile, runs),
  };
}

// ─── Score computers ──────────────────────────────────────────────────────────

function computeAggressiveness(runs: RunRow[]): number {
  if (runs.length === 0) return 0;
  const n = runs.filter(r => r.riskProfile === 'aggressive' || r.portfolioMode === 'options').length;
  return Math.round((n / runs.length) * 100);
}

function computeFomo(txs: TxRow[]): number {
  const buys = txs
    .filter(t => t.type === 'buy')
    .map(t => new Date(t.tradeDate).getTime())
    .sort((a, b) => a - b);
  if (buys.length < 2) return 0;
  let bursts = 0;
  for (let i = 1; i < buys.length; i++) {
    if ((buys[i] - buys[i - 1]) / 86_400_000 <= 3) bursts++;
  }
  return Math.min(100, Math.round((bursts / (buys.length - 1)) * 100));
}

function computeShortTerm(txs: TxRow[]): number {
  if (txs.length === 0) return 0;
  const dates = txs.map(t => new Date(t.tradeDate).getTime()).sort((a, b) => a - b);
  const rangeDays    = Math.max(1, (dates[dates.length - 1] - dates[0]) / 86_400_000);
  const monthsActive = Math.max(1, rangeDays / 30);
  const tpm          = txs.length / monthsActive;   // trades per month
  return Math.min(100, Math.round((tpm / 10) * 100));
}

function computeFullyInvested(snaps: SnapRow[]): number {
  if (snaps.length === 0) return 50;
  const avgCashPct = snaps.reduce(
    (sum, s) => sum + (Number(s.totalValue) > 0 ? (Number(s.cashBalance) / Number(s.totalValue)) * 100 : 0),
    0
  ) / snaps.length;
  return Math.max(0, Math.min(100, Math.round(100 - avgCashPct)));
}

function dimColor(score: number): DimensionColor {
  return score >= 70 ? 'red' : score >= 45 ? 'amber' : 'green';
}

// ─── Stated profile ───────────────────────────────────────────────────────────

function deriveStated(runs: RunRow[], portfolioMode: string): string {
  if (runs.length > 0) return runs[0].riskProfile;
  if (portfolioMode === 'options') return 'aggressive';
  return 'balanced';
}

// ─── Evidence builder ─────────────────────────────────────────────────────────

function buildEvidence(runs: RunRow[], txs: TxRow[], snaps: SnapRow[]): BehavioralEvidenceLine[] {
  const lines: BehavioralEvidenceLine[] = [];

  // 1. Most frequent risk profile in runs
  if (runs.length > 0) {
    const counts = tally(runs.map(r => r.riskProfile));
    const [topMode, topCount] = topEntry(counts);
    lines.push({ text: `${topCount}/${runs.length} optimization runs guna mod `, boldPart: topMode });
  }

  // 2. Average interval between transactions
  if (txs.length >= 2) {
    const dates = txs.map(t => new Date(t.tradeDate).getTime()).sort((a, b) => a - b);
    const rangeDays    = Math.max(1, (dates[dates.length - 1] - dates[0]) / 86_400_000);
    const avgInterval  = Math.round(rangeDays / (txs.length - 1));
    const label = avgInterval <= 14 ? 'short-term trader' : avgInterval <= 60 ? 'medium-term trader' : 'long-term holder';
    lines.push({ text: 'Purata holding period: ', boldPart: `${avgInterval} hari (${label})` });
  }

  // 3. Cash ratio trend
  if (snaps.length > 0) {
    const avgCashPct = snaps.reduce(
      (sum, s) => sum + (Number(s.totalValue) > 0 ? (Number(s.cashBalance) / Number(s.totalValue)) * 100 : 0),
      0
    ) / snaps.length;
    const label = avgCashPct < 5 ? 'suka fully invested' : avgCashPct < 15 ? 'ada cash buffer' : 'suka pegang cash';
    lines.push({ text: 'Cash ratio trend: ', boldPart: `${avgCashPct.toFixed(1)}% — ${label}` });
  }

  // 4. FOMO burst pattern
  const buys = txs.filter(t => t.type === 'buy').map(t => new Date(t.tradeDate).getTime()).sort((a, b) => a - b);
  if (buys.length >= 2) {
    let bursts = 0;
    for (let i = 1; i < buys.length; i++) {
      if ((buys[i] - buys[i - 1]) / 86_400_000 <= 3) bursts++;
    }
    const pct = Math.round((bursts / (buys.length - 1)) * 100);
    if (pct >= 20) {
      lines.push({ text: `${pct}% trades beli dalam kluster 3 hari — `, boldPart: 'momentum buyer' });
    }
  }

  // 5. Most frequent optimization goal
  if (runs.length > 0) {
    const [topGoal] = topEntry(tally(runs.map(r => r.optimizationGoal)));
    lines.push({ text: 'Goal paling kerap: ', boldPart: topGoal });
  }

  return lines;
}

// ─── Weights builder ──────────────────────────────────────────────────────────

function buildWeights(actualProfile: string, runs: RunRow[]): ScenarioWeights {
  const wMap: Record<string, { aggressive: number; balanced: number; conservative: number }> = {
    aggressive:   { aggressive: 60, balanced: 30, conservative: 10 },
    balanced:     { aggressive: 33, balanced: 34, conservative: 33 },
    conservative: { aggressive: 10, balanced: 30, conservative: 60 },
  };
  const w = wMap[actualProfile] ?? wMap.balanced;

  const cashMap:    Record<string, number> = { aggressive: 3, balanced: 5, conservative: 10 };
  const triggerMap: Record<string, string> = {
    aggressive:   'Momentum + threshold',
    balanced:     'Threshold rebalance',
    conservative: 'Calendar rebalance',
  };

  const topGoal = runs.length > 0
    ? topEntry(tally(runs.map(r => r.optimizationGoal)))[0]
    : 'maximum_sharpe';

  return {
    ...w,
    cashFloorPct:      cashMap[actualProfile] ?? 5,
    goalDefault:       topGoal,
    rebalanceTrigger:  triggerMap[actualProfile] ?? 'Threshold rebalance',
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tally(values: string[]): Record<string, number> {
  return values.reduce<Record<string, number>>((acc, v) => {
    acc[v] = (acc[v] ?? 0) + 1;
    return acc;
  }, {});
}

function topEntry(counts: Record<string, number>): [string, number] {
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0] ?? ['unknown', 0];
}

// ─── Recommended Strategy ────────────────────────────────────────────────────

export type RiskLevel = 'conservative' | 'moderate' | 'aggressive';

export type RecommendedStrategy = {
  riskLevel: RiskLevel;
  portfolioMode: 'stock' | 'hybrid' | 'options';
  riskProfile: 'conservative' | 'balanced' | 'aggressive';
  optimizationGoal: string;
  cashFloorPct: number;
  rebalanceTrigger: string;
  scenarioWeights: { aggressive: number; balanced: number; conservative: number };
  confidence: number;
  actualProfile: string;
  conflictDetected: boolean;
  aiRecommendedLevel: RiskLevel;
};

// ─── Risk clamps: cashFloorPct must stay within these bounds per risk level ──

const RISK_CLAMPS = {
  conservative: { cashFloorMin: 8,  cashFloorMax: 20 },
  moderate:     { cashFloorMin: 4,  cashFloorMax: 12 },
  aggressive:   { cashFloorMin: 1,  cashFloorMax: 6  },
} as const;

// Base scenario weights (percentages) per risk level — used for blending
const BASE_WEIGHTS: Record<RiskLevel, { conservative: number; balanced: number; aggressive: number }> = {
  conservative: { conservative: 70, balanced: 25, aggressive:  5 },
  moderate:     { conservative: 25, balanced: 50, aggressive: 25 },
  aggressive:   { conservative:  5, balanced: 30, aggressive: 65 },
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function mapActualToRiskLevel(actualProfile: string): RiskLevel {
  if (actualProfile === 'aggressive')   return 'aggressive';
  if (actualProfile === 'conservative') return 'conservative';
  return 'moderate';
}

function blendScenarioWeights(
  behavioral: { aggressive: number; balanced: number; conservative: number },
  effectiveRisk: RiskLevel
): { aggressive: number; balanced: number; conservative: number } {
  const base = BASE_WEIGHTS[effectiveRisk];
  return {
    conservative: Math.round(behavioral.conservative * 0.6 + base.conservative * 0.4),
    balanced:     Math.round(behavioral.balanced     * 0.6 + base.balanced     * 0.4),
    aggressive:   Math.round(behavioral.aggressive   * 0.6 + base.aggressive   * 0.4),
  };
}

function validateStrategyConsistency(strategy: RecommendedStrategy): void {
  const clamp = RISK_CLAMPS[strategy.riskLevel];
  if (strategy.cashFloorPct < clamp.cashFloorMin) {
    throw new Error(
      `cashFloorPct ${strategy.cashFloorPct} is too low for ${strategy.riskLevel} (min ${clamp.cashFloorMin})`
    );
  }
  const dominantWeight = Math.max(
    strategy.scenarioWeights.conservative,
    strategy.scenarioWeights.balanced,
    strategy.scenarioWeights.aggressive
  );
  if (dominantWeight > 85) {
    console.warn('[behavioral] Scenario weights are heavily skewed — check behavioral data quality');
  }
}

function buildRecommendedStrategy(
  profile: BehavioralProfile,
  userRiskLevel?: RiskLevel
): RecommendedStrategy {
  const aiRiskLevel    = mapActualToRiskLevel(profile.actualProfile);
  const effectiveRisk  = userRiskLevel ?? aiRiskLevel;
  const clamp          = RISK_CLAMPS[effectiveRisk];

  const rawCashFloor     = profile.weights.cashFloorPct;
  const clampedCashFloor = Math.min(Math.max(rawCashFloor, clamp.cashFloorMin), clamp.cashFloorMax);

  const optimizationGoal =
    effectiveRisk === 'aggressive'   ? 'maximum_return' :
    effectiveRisk === 'conservative' ? 'minimum_volatility' :
    (profile.weights.goalDefault ?? 'maximum_sharpe');

  const behavioralWeights = {
    aggressive:   profile.weights.aggressive,
    balanced:     profile.weights.balanced,
    conservative: profile.weights.conservative,
  };

  const strategy: RecommendedStrategy = {
    riskLevel:       effectiveRisk,
    portfolioMode:   effectiveRisk === 'aggressive' ? 'options' : effectiveRisk === 'conservative' ? 'stock' : 'hybrid',
    riskProfile:     effectiveRisk === 'aggressive' ? 'aggressive' : effectiveRisk === 'conservative' ? 'conservative' : 'balanced',
    optimizationGoal,
    cashFloorPct:    clampedCashFloor,
    rebalanceTrigger: profile.weights.rebalanceTrigger,
    scenarioWeights: blendScenarioWeights(behavioralWeights, effectiveRisk),
    confidence:      profile.confidencePct,
    actualProfile:   profile.actualProfile,
    conflictDetected:   !!userRiskLevel && userRiskLevel !== aiRiskLevel,
    aiRecommendedLevel: aiRiskLevel,
  };

  validateStrategyConsistency(strategy);
  return strategy;
}

// ─── Default (no behavioral data yet) ────────────────────────────────────────

const DEFAULT_STRATEGY: RecommendedStrategy = {
  riskLevel:        'moderate',
  portfolioMode:    'hybrid',
  riskProfile:      'balanced',
  optimizationGoal: 'maximum_sharpe',
  cashFloorPct:     5,
  rebalanceTrigger: 'Threshold rebalance',
  scenarioWeights:  { aggressive: 25, balanced: 50, conservative: 25 },
  confidence:       0,
  actualProfile:    'balanced',
  conflictDetected: false,
  aiRecommendedLevel: 'moderate',
};

// ─── In-memory cache (5-min TTL) ─────────────────────────────────────────────

const _strategyCache = new Map<string, { data: RecommendedStrategy; ts: number }>();
const STRATEGY_CACHE_TTL = 5 * 60 * 1000;

export async function getRecommendedStrategy(
  userId: string,
  userRiskLevel?: RiskLevel
): Promise<RecommendedStrategy> {
  const cacheKey = `${userId}:${userRiskLevel ?? 'ai'}`;
  const cached   = _strategyCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < STRATEGY_CACHE_TTL) return cached.data;

  const profile = await getBehavioralProfile(userId);
  const result  = profile.dataPoints === 0
    ? DEFAULT_STRATEGY
    : buildRecommendedStrategy(profile, userRiskLevel);

  _strategyCache.set(cacheKey, { data: result, ts: Date.now() });
  return result;
}
