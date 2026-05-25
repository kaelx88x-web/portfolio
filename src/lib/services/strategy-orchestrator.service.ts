import { randomUUID } from 'node:crypto';
import { prisma } from '$lib/server/db';
import {
  BENCHMARKS,
  ANALYTICS_PERIODS,
  type AnalyticsBenchmark,
  type AnalyticsPeriod
} from '$lib/services/analytics.service';
import {
  buildAiPortfolioContext,
  parseAiBenchmark,
  parseAiPeriod,
  type AiPortfolioContext
} from '$lib/services/ai-context.service';
import { validatePortfolioGuardrails, type GuardrailReport } from '$lib/services/guardrail.service';
import {
  getUserPortfolioMode,
  saveUserPortfolioMode,
  type PortfolioMode
} from '$lib/services/optimization-engine.service';
import {
  getAllocationExposure,
  getAllocationHealth,
  getPortfolioStyle,
  type AllocationExposure,
  type AllocationHealthReport
} from '$lib/services/smart-allocation.service';
import { getOptionsExposure, type OptionsExposureReport } from '$lib/services/options-intelligence.service';
import {
  getPortfolioProjection,
  getRebalanceProjection,
  getStressTest,
  type PortfolioProjection,
  type RebalanceProjection
} from '$lib/services/scenario-simulation.service';

export const STRATEGY_ORCHESTRATOR_VERSION = 'phase-6D';

export const STRATEGY_MODES = [
  'growth',
  'aggressive_growth',
  'balanced',
  'balanced_income',
  'income',
  'defensive',
  'defensive_income',
  'hybrid',
  'aggressive_options'
] as const;

export type StrategyMode = (typeof STRATEGY_MODES)[number];
export type StrategyPriority = 'low' | 'medium' | 'high';
export type StrategyRiskLevel = 'low' | 'moderate' | 'high';
export type ConflictSeverity = 'low' | 'medium' | 'high';

export type PortfolioStrategyProfile = {
  id?: string;
  profileType: StrategyMode;
  riskTolerance: number;
  incomeTarget: number;
  growthTarget: number;
  cashTarget: number;
  optionsTarget: number;
  metadata: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
};

export type StrategyRecommendation = {
  id?: string;
  strategyMode: StrategyMode;
  title: string;
  summary: string;
  priority: StrategyPriority;
  riskLevel: StrategyRiskLevel;
  recommendation: {
    objective: string;
    actions: string[];
    tradeoffs: string[];
    expectedImpact: string;
    noAutoTrading: true;
  };
  metadata: Record<string, unknown>;
  createdAt?: string;
};

export type StrategyConflict = {
  id?: string;
  conflictType: string;
  severity: ConflictSeverity;
  description: string;
  resolutionSuggestion: string;
  metadata: Record<string, unknown>;
  createdAt?: string;
};

export type DynamicPortfolioMode = {
  strategyMode: StrategyMode;
  portfolioMode: PortfolioMode;
  label: string;
  riskLevel: StrategyRiskLevel;
  incomeWeight: number;
  growthWeight: number;
  defensiveWeight: number;
  optionsWeight: number;
  explanation: string;
};

type StrategyContext = {
  context: AiPortfolioContext;
  profile: PortfolioStrategyProfile;
  allocationHealth: AllocationHealthReport;
  allocationExposure: AllocationExposure;
  style: Awaited<ReturnType<typeof getPortfolioStyle>>;
  optionsExposure: OptionsExposureReport;
  stressTest: Awaited<ReturnType<typeof getStressTest>>;
  projection: PortfolioProjection;
  rebalanceProjection: RebalanceProjection;
  guardrail: GuardrailReport;
  currentPortfolioMode: PortfolioMode;
};

type ProfileRow = {
  id: string;
  profileType: StrategyMode;
  riskTolerance: number;
  incomeTarget: number;
  growthTarget: number;
  cashTarget: number;
  optionsTarget: number;
  metadataJson: string;
  createdAt: Date;
  updatedAt: Date;
};

type RecommendationRow = {
  id: string;
  strategyMode: StrategyMode;
  title: string;
  summary: string;
  priority: StrategyPriority;
  riskLevel: StrategyRiskLevel;
  recommendationJson: string;
  metadataJson: string;
  createdAt: Date;
};

type ConflictRow = {
  id: string;
  conflictType: string;
  severity: ConflictSeverity;
  description: string;
  resolutionSuggestion: string;
  metadataJson: string;
  createdAt: Date;
};

export async function getStrategyDashboard(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark; forceRefresh?: boolean } = {}
) {
  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const profile = options.forceRefresh
    ? await refreshStrategyOrchestrator(userId, { period, benchmark }).then((result) => result.profile)
    : await getStrategyProfile(userId, { period, benchmark });
  const [recommendations, conflicts, modes] = await Promise.all([
    getStrategyRecommendations(userId, { period, benchmark }),
    getStrategyConflicts(userId, { period, benchmark }),
    getStrategyModes(userId, { period, benchmark })
  ]);
  const activeMode = modes.find((mode) => mode.strategyMode === profile.profileType) ?? modes[0];
  return {
    period,
    benchmark,
    periods: ANALYTICS_PERIODS,
    benchmarks: BENCHMARKS,
    profile,
    recommendations,
    conflicts,
    modes,
    activeMode,
    widgets: buildStrategyWidgets(profile, conflicts, activeMode),
    aiExplanation: buildDashboardExplanation(profile, conflicts, activeMode)
  };
}

export async function getStrategyProfile(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark } = {}
): Promise<PortfolioStrategyProfile> {
  const stored = await getLatestStrategyProfile(userId);
  if (stored) return stored;
  const ctx = await buildStrategyContext(userId, {
    period: options.period ?? 'MAX',
    benchmark: options.benchmark ?? 'SPY',
    profileOverride: null
  });
  const profile = inferStrategyProfile(ctx);
  await saveStrategyProfile(userId, profile);
  return (await getLatestStrategyProfile(userId)) ?? profile;
}

export async function updateStrategyProfile(
  userId: string,
  input: Partial<Omit<PortfolioStrategyProfile, 'id' | 'metadata' | 'createdAt' | 'updatedAt'>>,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark } = {}
) {
  const current = await getStrategyProfile(userId, options);
  const profile: PortfolioStrategyProfile = normalizeProfile({
    ...current,
    ...input,
    metadata: {
      ...current.metadata,
      version: STRATEGY_ORCHESTRATOR_VERSION,
      source: 'user_objective_update',
      guardrail: 'Profile update changes advisory strategy settings only. It does not execute trades.'
    }
  });
  await saveStrategyProfile(userId, profile);
  await refreshStrategyOrchestrator(userId, {
    period: options.period ?? 'MAX',
    benchmark: options.benchmark ?? 'SPY',
    profileOverride: profile
  });
  return (await getLatestStrategyProfile(userId)) ?? profile;
}

export async function getStrategyRecommendations(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark; limit?: number } = {}
) {
  const stored = await getStoredRecommendations(userId, options.limit ?? 10);
  if (stored.length > 0) return stored;
  await refreshStrategyOrchestrator(userId, {
    period: options.period ?? 'MAX',
    benchmark: options.benchmark ?? 'SPY'
  });
  return getStoredRecommendations(userId, options.limit ?? 10);
}

export async function getStrategyConflicts(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark; limit?: number } = {}
) {
  const stored = await getStoredConflicts(userId, options.limit ?? 12);
  if (stored.length > 0) return stored;
  await refreshStrategyOrchestrator(userId, {
    period: options.period ?? 'MAX',
    benchmark: options.benchmark ?? 'SPY'
  });
  return getStoredConflicts(userId, options.limit ?? 12);
}

export async function getStrategyModes(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark } = {}
) {
  const strategy = await buildStrategyContext(userId, {
    period: options.period ?? 'MAX',
    benchmark: options.benchmark ?? 'SPY',
    profileOverride: await getLatestStrategyProfile(userId)
  });
  return buildDynamicModes(strategy);
}

export async function refreshStrategyOrchestrator(
  userId: string,
  options: {
    period?: AnalyticsPeriod;
    benchmark?: AnalyticsBenchmark;
    profileOverride?: PortfolioStrategyProfile | null;
  } = {}
) {
  if (process.env.STRATEGY_ORCHESTRATOR_ENABLED === 'false') {
    throw new Error('Strategy orchestrator is disabled by STRATEGY_ORCHESTRATOR_ENABLED=false.');
  }
  await enforceDailyRefreshLimit(userId);
  const strategy = await buildStrategyContext(userId, {
    period: options.period ?? 'MAX',
    benchmark: options.benchmark ?? 'SPY',
    profileOverride: options.profileOverride ?? await getLatestStrategyProfile(userId)
  });
  const profile = strategy.profile.id ? strategy.profile : inferStrategyProfile(strategy);
  await saveStrategyProfile(userId, {
    ...profile,
    metadata: {
      ...profile.metadata,
      source: 'strategy_refresh',
      refreshedAt: new Date().toISOString()
    }
  });
  const normalizedProfile = (await getLatestStrategyProfile(userId)) ?? profile;
  const hydratedStrategy = { ...strategy, profile: normalizedProfile };
  const [recommendations, conflicts] = [
    buildStrategyRecommendations(hydratedStrategy),
    buildStrategyConflicts(hydratedStrategy)
  ];
  await replaceStrategyRecommendations(userId, recommendations);
  await replaceStrategyConflicts(userId, conflicts);
  return {
    refreshed_at: new Date().toISOString(),
    profile: normalizedProfile,
    recommendations,
    conflicts,
    modes: buildDynamicModes(hydratedStrategy),
    ai_explanation: buildDashboardExplanation(normalizedProfile, conflicts, buildDynamicModes(hydratedStrategy)[0])
  };
}

export async function applyDynamicPortfolioMode(userId: string, strategyMode: StrategyMode) {
  if (process.env.PORTFOLIO_MODE_DYNAMIC === 'false') {
    return { status: 'disabled', message: 'Dynamic portfolio mode is disabled.' };
  }
  const mode = strategyMode === 'aggressive_options' ? 'options' : strategyMode === 'hybrid' || strategyMode.includes('income') ? 'hybrid' : 'stock';
  await saveUserPortfolioMode(userId, mode);
  return {
    status: 'saved',
    portfolioMode: mode,
    guardrail: 'Dynamic mode changes the saved planning mode only. It does not rebalance or trade.'
  };
}

export function parseStrategyPeriod(value: string | null) {
  return parseAiPeriod(value);
}

export function parseStrategyBenchmark(value: string | null) {
  return parseAiBenchmark(value);
}

export function parseStrategyMode(value: FormDataEntryValue | string | null): StrategyMode {
  return STRATEGY_MODES.includes(value as StrategyMode) ? (value as StrategyMode) : 'balanced';
}

async function buildStrategyContext(
  userId: string,
  options: {
    period: AnalyticsPeriod;
    benchmark: AnalyticsBenchmark;
    profileOverride?: PortfolioStrategyProfile | null;
  }
): Promise<StrategyContext> {
  const currentPortfolioMode = await getUserPortfolioMode(userId);
  const [
    context,
    allocationHealth,
    allocationExposure,
    style,
    optionsExposure,
    stressTest,
    projection,
    rebalanceProjection,
    guardrail
  ] = await Promise.all([
    buildAiPortfolioContext(userId, { period: options.period, benchmark: options.benchmark }),
    getAllocationHealth(userId, { period: options.period, benchmark: options.benchmark }),
    getAllocationExposure(userId, { period: options.period, benchmark: options.benchmark }),
    getPortfolioStyle(userId, { period: options.period, benchmark: options.benchmark }),
    getOptionsExposure(userId, { period: options.period, benchmark: options.benchmark }),
    getStressTest(userId, { period: options.period, benchmark: options.benchmark, portfolioMode: currentPortfolioMode }),
    getPortfolioProjection(userId, { period: options.period, benchmark: options.benchmark, portfolioMode: currentPortfolioMode }),
    getRebalanceProjection(userId, { period: options.period, benchmark: options.benchmark, portfolioMode: currentPortfolioMode }),
    validatePortfolioGuardrails(userId, currentPortfolioMode).catch(() => ({ passed: true, violations: [], summary: 'Guardrail validation unavailable.' }))
  ]);
  const placeholder: StrategyContext = {
    context,
    profile: options.profileOverride ?? defaultProfileFromContext(context, allocationExposure, optionsExposure),
    allocationHealth,
    allocationExposure,
    style,
    optionsExposure,
    stressTest,
    projection,
    rebalanceProjection,
    guardrail,
    currentPortfolioMode
  };
  return {
    ...placeholder,
    profile: options.profileOverride ?? defaultProfileFromContext(context, allocationExposure, optionsExposure)
  };
}

function inferStrategyProfile(strategy: StrategyContext): PortfolioStrategyProfile {
  const { context, allocationExposure, optionsExposure, stressTest } = strategy;
  const riskTolerance = clamp(
    70 - Math.max(0, context.risk.volatilityPct - 12) * 1.4 - Math.max(0, Math.abs(stressTest.worst_case?.projectedDrawdown ?? 0) - 12) * 0.8,
    15,
    88
  );
  const incomeTarget = clamp(4 + Math.min(8, context.performance.incomeTotal / Math.max(1, context.portfolio.value) * 100) + Math.min(4, optionsExposure.premium_generated_monthly / Math.max(1, context.portfolio.value) * 100), 3, 16);
  const growthTarget = clamp(baselineGrowthTarget(context), 4, 22);
  const cashTarget = clamp(Math.max(6, Math.min(20, context.risk.volatilityPct * 0.55 + Math.abs(context.risk.maxDrawdownPct) * 0.15)), 5, 24);
  const optionsTarget = clamp(optionsExposure.options_allocation > 0 ? Math.max(8, optionsExposure.options_allocation + 3) : strategy.currentPortfolioMode === 'options' ? 20 : strategy.currentPortfolioMode === 'hybrid' ? 14 : 5, 0, 30);
  const profileType = classifyStrategyMode({
    riskTolerance,
    incomeTarget,
    growthTarget,
    cashTarget,
    optionsTarget,
    allocationExposure,
    optionsExposure,
    context
  });
  return normalizeProfile({
    profileType,
    riskTolerance,
    incomeTarget,
    growthTarget,
    cashTarget,
    optionsTarget,
    metadata: {
      version: STRATEGY_ORCHESTRATOR_VERSION,
      source: 'inferred_from_portfolio_context',
      allocationStyle: strategy.style.portfolio_style,
      contextHash: context.metadata.contextHash,
      guardrail: 'Strategy profile is advisory and does not change allocation automatically.'
    }
  });
}

function defaultProfileFromContext(
  context: AiPortfolioContext,
  allocationExposure: AllocationExposure,
  optionsExposure: OptionsExposureReport
): PortfolioStrategyProfile {
  return normalizeProfile({
    profileType: 'balanced',
    riskTolerance: context.risk.healthLabel === 'stable' ? 65 : context.risk.healthLabel === 'watch' ? 50 : 35,
    incomeTarget: optionsExposure.options_allocation > 0 ? 8 : 5,
    growthTarget: allocationExposure.cash_pct > 25 ? 7 : 12,
    cashTarget: Math.max(6, Math.min(20, context.portfolio.cashRatio || 8)),
    optionsTarget: Math.min(20, Math.max(0, optionsExposure.options_allocation + 3)),
    metadata: {
      version: STRATEGY_ORCHESTRATOR_VERSION,
      source: 'default_from_context',
      guardrail: 'Default strategy profile is suggestion-only.'
    }
  });
}

function buildStrategyRecommendations(strategy: StrategyContext): StrategyRecommendation[] {
  const mode = strategy.profile.profileType;
  const recommendations: StrategyRecommendation[] = [];
  recommendations.push({
    strategyMode: mode,
    title: `Coordinate portfolio as ${labelMode(mode)}`,
    summary: `Prioritize ${primaryObjective(mode)} while keeping risk tolerance near ${strategy.profile.riskTolerance.toFixed(0)}/100.`,
    priority: 'high',
    riskLevel: strategyRiskLevel(strategy),
    recommendation: {
      objective: primaryObjective(mode),
      actions: [
        `Keep cash target near ${strategy.profile.cashTarget.toFixed(1)}%.`,
        `Keep options target near ${strategy.profile.optionsTarget.toFixed(1)}%.`,
        `Use rebalance projection before changing large positions.`
      ],
      tradeoffs: strategyTradeoffs(mode),
      expectedImpact: `This coordinates growth target ${strategy.profile.growthTarget.toFixed(1)}%, income target ${strategy.profile.incomeTarget.toFixed(1)}%, and volatility forecast ${strategy.projection.expected_volatility.toFixed(1)}%.`,
      noAutoTrading: true
    },
    metadata: {
      version: STRATEGY_ORCHESTRATOR_VERSION,
      guardrail: 'Recommendation is advisory-only. No order is placed.'
    }
  });

  if (strategy.rebalanceProjection.riskReduction > 2) {
    recommendations.push({
      strategyMode: mode,
      title: 'Use rebalance projection as risk budget input',
      summary: `Projected rebalance reduces modeled risk by ${strategy.rebalanceProjection.riskReduction.toFixed(2)} points without executing trades.`,
      priority: 'high',
      riskLevel: strategyRiskLevel(strategy),
      recommendation: {
        objective: 'volatility reduction',
        actions: ['Review oversized holdings.', 'Compare current vs projected allocation.', 'Keep changes inside saved guardrail constraints.'],
        tradeoffs: ['Lower concentration may reduce upside from the largest winner.', 'Higher cash/defensive sleeves can reduce participation in rallies.'],
        expectedImpact: `Volatility change estimate is ${strategy.rebalanceProjection.volatilityChange.toFixed(2)} points.`,
        noAutoTrading: true
      },
      metadata: { version: STRATEGY_ORCHESTRATOR_VERSION, source: 'rebalance_projection' }
    });
  }

  if (strategy.optionsExposure.options_allocation > 0 || strategy.profile.optionsTarget >= 8) {
    recommendations.push({
      strategyMode: mode,
      title: 'Keep options income inside a defined sleeve',
      summary: `Options allocation is ${strategy.optionsExposure.options_allocation.toFixed(2)}% with assignment risk score ${strategy.optionsExposure.assignment_risk_score}/100.`,
      priority: strategy.optionsExposure.risk_level === 'high' ? 'high' : 'medium',
      riskLevel: strategy.optionsExposure.risk_level === 'high' ? 'high' : 'moderate',
      recommendation: {
        objective: 'options premium generation',
        actions: ['Maintain collateral reserve before premium targets.', 'Avoid growing options exposure above the profile target.', 'Review assignment concentration before new premium trades.'],
        tradeoffs: ['More premium can increase assignment and liquidity risk.', 'Lower collateral usage may reduce income.'],
        expectedImpact: `Target options sleeve is ${strategy.profile.optionsTarget.toFixed(1)}%.`,
        noAutoTrading: true
      },
      metadata: { version: STRATEGY_ORCHESTRATOR_VERSION, source: 'options_intelligence' }
    });
  }

  if (!strategy.guardrail.passed) {
    recommendations.push({
      strategyMode: mode,
      title: 'Resolve guardrail breaches before strategy expansion',
      summary: strategy.guardrail.summary,
      priority: 'high',
      riskLevel: 'high',
      recommendation: {
        objective: 'risk-aware strategy balancing',
        actions: strategy.guardrail.violations.slice(0, 3).map((violation) => violation.message),
        tradeoffs: ['Fixing guardrails may delay growth or income objectives.', 'Ignoring breaches can make scenario outcomes less reliable.'],
        expectedImpact: 'A cleaner guardrail state improves consistency across optimization, simulation, and strategy modules.',
        noAutoTrading: true
      },
      metadata: { version: STRATEGY_ORCHESTRATOR_VERSION, source: 'guardrail_service' }
    });
  }

  return recommendations;
}

function buildStrategyConflicts(strategy: StrategyContext): StrategyConflict[] {
  const conflicts: StrategyConflict[] = [];
  const p = strategy.profile;
  if (p.growthTarget >= 14 && (p.cashTarget >= 18 || p.riskTolerance <= 40)) {
    conflicts.push(conflict('growth_vs_defensive', 'medium', `Growth target ${p.growthTarget.toFixed(1)}% conflicts with defensive cash/risk settings.`, 'Choose either a lower growth target or a lower defensive cash target before treating the profile as growth-led.', { growthTarget: p.growthTarget, cashTarget: p.cashTarget, riskTolerance: p.riskTolerance }));
  }
  if (p.incomeTarget >= 8 && strategy.projection.expected_volatility >= 20) {
    conflicts.push(conflict('income_vs_volatility', 'medium', `Income target ${p.incomeTarget.toFixed(1)}% is paired with ${strategy.projection.expected_volatility.toFixed(1)}% volatility forecast.`, 'Favor covered, collateral-aware income and avoid stretching for yield while volatility is elevated.', { incomeTarget: p.incomeTarget, volatility: strategy.projection.expected_volatility }));
  }
  if (strategy.optionsExposure.options_allocation > p.optionsTarget + 2 || strategy.optionsExposure.assignment_risk_score >= 55) {
    conflicts.push(conflict('options_exposure_conflict', strategy.optionsExposure.risk_level === 'high' ? 'high' : 'medium', `Options exposure or assignment risk is above the profile comfort zone.`, 'Reduce new options commitments until assignment risk and collateral usage sit inside the profile target.', { optionsAllocation: strategy.optionsExposure.options_allocation, optionsTarget: p.optionsTarget, assignmentRisk: strategy.optionsExposure.assignment_risk_score }));
  }
  if (strategy.context.portfolio.cashRatio < p.cashTarget - 2) {
    conflicts.push(conflict('cash_reserve_weakness', 'medium', `Cash is ${strategy.context.portfolio.cashRatio.toFixed(1)}%, below strategy target ${p.cashTarget.toFixed(1)}%.`, 'Rebuild cash reserve before increasing growth, income, or options risk.', { cashRatio: strategy.context.portfolio.cashRatio, cashTarget: p.cashTarget }));
  }
  if (strategy.context.risk.concentrationRiskPct >= 25 && p.growthTarget >= 12) {
    conflicts.push(conflict('concentration_vs_growth', 'high', `${strategy.context.risk.largestHoldingSymbol || 'Largest holding'} concentration is ${strategy.context.risk.concentrationRiskPct.toFixed(1)}% while growth remains a priority.`, 'Use concentration caps or staged rebalancing before adding more growth exposure.', { concentration: strategy.context.risk.concentrationRiskPct, growthTarget: p.growthTarget }));
  }
  for (const violation of strategy.guardrail.violations.filter((item) => item.severity !== 'ok').slice(0, 4)) {
    conflicts.push(conflict(`guardrail_${violation.rule}`, violation.severity === 'breach' ? 'high' : 'medium', violation.message, 'Resolve this guardrail item before refreshing strategy recommendations.', violation));
  }
  if (conflicts.length === 0) {
    conflicts.push(conflict('objective_alignment', 'low', 'No major strategy conflict detected across growth, income, options, cash, and volatility objectives.', 'Keep monitoring because conflicts can appear after price, volatility, or objective changes.', { status: 'aligned' }));
  }
  return conflicts;
}

function buildDynamicModes(strategy: StrategyContext): DynamicPortfolioMode[] {
  const p = strategy.profile;
  const modes: DynamicPortfolioMode[] = [
    mode('balanced', 'stock', 'Balanced', 'moderate', 35, 35, 20, 10, 'Balanced mode keeps growth and income targets even while controlling cash and volatility.'),
    mode('hybrid', 'hybrid', 'Hybrid Strategy', 'moderate', 30, 30, 20, 20, 'Hybrid mode coordinates stock allocation with a defined options income sleeve.'),
    mode('income', 'hybrid', 'Income Focused', 'moderate', 50, 18, 18, 14, 'Income mode prioritizes dividend and premium generation without ignoring volatility.'),
    mode('defensive', 'stock', 'Defensive', 'low', 20, 15, 55, 10, 'Defensive mode prioritizes drawdown control, cash reserve, and reduced concentration.'),
    mode('growth', 'stock', 'Growth', 'moderate', 15, 60, 20, 5, 'Growth mode prioritizes capital appreciation while keeping options exposure limited.'),
    mode('aggressive_options', 'options', 'Aggressive Options', 'high', 35, 25, 10, 30, 'Aggressive options mode increases premium focus and requires strict collateral review.')
  ];
  const selected = classifyStrategyMode({
    riskTolerance: p.riskTolerance,
    incomeTarget: p.incomeTarget,
    growthTarget: p.growthTarget,
    cashTarget: p.cashTarget,
    optionsTarget: p.optionsTarget,
    allocationExposure: strategy.allocationExposure,
    optionsExposure: strategy.optionsExposure,
    context: strategy.context
  });
  return modes
    .map((item) => item.strategyMode === selected ? { ...item, label: `${item.label} (Recommended)` } : item)
    .sort((a, b) => (a.strategyMode === selected ? -1 : b.strategyMode === selected ? 1 : 0));
}

function buildStrategyWidgets(
  profile: PortfolioStrategyProfile,
  conflicts: StrategyConflict[],
  mode?: DynamicPortfolioMode
) {
  const highConflicts = conflicts.filter((item) => item.severity === 'high').length;
  const objectiveStatus = highConflicts ? 'Review' : conflicts.some((item) => item.severity === 'medium') ? 'Watch' : 'Aligned';
  return [
    { label: 'Current Portfolio Strategy', value: labelMode(profile.profileType), status: highConflicts ? 'high' : 'low' },
    { label: 'Risk Profile', value: `${profile.riskTolerance.toFixed(0)}/100`, status: profile.riskTolerance < 40 ? 'high' : 'medium' },
    { label: 'Income vs Growth Balance', value: `${profile.incomeTarget.toFixed(1)} / ${profile.growthTarget.toFixed(1)}`, status: 'medium' },
    { label: 'Strategy Conflicts', value: String(conflicts.length), status: highConflicts ? 'high' : conflicts.length > 1 ? 'medium' : 'low' },
    { label: 'Portfolio Objective Status', value: objectiveStatus, status: objectiveStatus === 'Review' ? 'high' : objectiveStatus === 'Watch' ? 'medium' : 'low' },
    { label: 'Dynamic Mode', value: mode?.portfolioMode ?? 'stock', status: mode?.riskLevel === 'high' ? 'high' : 'medium' }
  ];
}

function buildDashboardExplanation(
  profile: PortfolioStrategyProfile,
  conflicts: StrategyConflict[],
  mode?: DynamicPortfolioMode
) {
  const conflictText = conflicts.some((item) => item.severity === 'high')
    ? 'High-severity conflicts should be reviewed before expanding risk.'
    : conflicts.some((item) => item.severity === 'medium')
      ? 'Some objectives are competing and should be monitored.'
      : 'Objectives are currently aligned.';
  return `The orchestrator classifies this portfolio as ${labelMode(profile.profileType)} with ${profile.riskTolerance.toFixed(0)}/100 risk tolerance. ${mode?.explanation ?? ''} ${conflictText} This is advisory-only and cannot execute trades.`;
}

async function saveStrategyProfile(userId: string, profile: PortfolioStrategyProfile) {
  const normalized = normalizeProfile(profile);
  await prisma.$executeRaw`
    INSERT INTO portfolio_strategy_profiles
      (id, user_id, profile_type, risk_tolerance, income_target, growth_target, cash_target, options_target, metadata, created_at, updated_at)
    VALUES
      (${randomUUID()}, ${userId}, ${normalized.profileType}, ${normalized.riskTolerance}, ${normalized.incomeTarget}, ${normalized.growthTarget}, ${normalized.cashTarget}, ${normalized.optionsTarget}, ${JSON.stringify(normalized.metadata)}, NOW(), NOW())
  `;
}

async function replaceStrategyRecommendations(userId: string, recommendations: StrategyRecommendation[]) {
  await prisma.$executeRaw`DELETE FROM strategy_recommendations WHERE user_id = ${userId}`;
  for (const item of recommendations) {
    await prisma.$executeRaw`
      INSERT INTO strategy_recommendations
        (id, user_id, strategy_mode, title, summary, priority, risk_level, recommendation_json, metadata, created_at, updated_at)
      VALUES
        (${randomUUID()}, ${userId}, ${item.strategyMode}, ${item.title}, ${item.summary}, ${item.priority}, ${item.riskLevel}, ${JSON.stringify(item.recommendation)}, ${JSON.stringify(item.metadata)}, NOW(), NOW())
    `;
  }
}

async function replaceStrategyConflicts(userId: string, conflicts: StrategyConflict[]) {
  await prisma.$executeRaw`DELETE FROM strategy_conflicts WHERE user_id = ${userId}`;
  for (const item of conflicts) {
    await prisma.$executeRaw`
      INSERT INTO strategy_conflicts
        (id, user_id, conflict_type, severity, description, resolution_suggestion, metadata, created_at, updated_at)
      VALUES
        (${randomUUID()}, ${userId}, ${item.conflictType}, ${item.severity}, ${item.description}, ${item.resolutionSuggestion}, ${JSON.stringify(item.metadata)}, NOW(), NOW())
    `;
  }
}

async function getLatestStrategyProfile(userId: string) {
  const rows = await prisma.$queryRaw<ProfileRow[]>`
    SELECT
      id,
      profile_type AS profileType,
      risk_tolerance AS riskTolerance,
      income_target AS incomeTarget,
      growth_target AS growthTarget,
      cash_target AS cashTarget,
      options_target AS optionsTarget,
      metadata AS metadataJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM portfolio_strategy_profiles
    WHERE user_id = ${userId}
    ORDER BY updated_at DESC
    LIMIT 1
  `;
  return rows[0] ? mapProfileRow(rows[0]) : null;
}

async function getStoredRecommendations(userId: string, limit: number) {
  const rows = await prisma.$queryRaw<RecommendationRow[]>`
    SELECT
      id,
      strategy_mode AS strategyMode,
      title,
      summary,
      priority,
      risk_level AS riskLevel,
      recommendation_json AS recommendationJson,
      metadata AS metadataJson,
      created_at AS createdAt
    FROM strategy_recommendations
    WHERE user_id = ${userId}
    ORDER BY FIELD(priority, 'high', 'medium', 'low'), created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(mapRecommendationRow);
}

async function getStoredConflicts(userId: string, limit: number) {
  const rows = await prisma.$queryRaw<ConflictRow[]>`
    SELECT
      id,
      conflict_type AS conflictType,
      severity,
      description,
      resolution_suggestion AS resolutionSuggestion,
      metadata AS metadataJson,
      created_at AS createdAt
    FROM strategy_conflicts
    WHERE user_id = ${userId}
    ORDER BY FIELD(severity, 'high', 'medium', 'low'), created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(mapConflictRow);
}

async function enforceDailyRefreshLimit(userId: string) {
  const maxRuns = Number(process.env.MAX_STRATEGY_REFRESH_PER_DAY ?? 20);
  if (!Number.isFinite(maxRuns) || maxRuns <= 0) return;
  const [row] = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
    FROM portfolio_strategy_profiles
    WHERE user_id = ${userId}
      AND created_at >= CURRENT_DATE()
      AND metadata LIKE '%"source":"strategy_refresh"%'
  `;
  if (Number(row?.count ?? 0) >= maxRuns) {
    throw new Error(`Daily strategy refresh limit reached (${maxRuns}).`);
  }
}

function classifyStrategyMode(input: {
  riskTolerance: number;
  incomeTarget: number;
  growthTarget: number;
  cashTarget: number;
  optionsTarget: number;
  allocationExposure: AllocationExposure;
  optionsExposure: OptionsExposureReport;
  context: AiPortfolioContext;
}): StrategyMode {
  if (input.optionsTarget >= 24 || input.optionsExposure.collateral_usage_pct >= 80) return 'aggressive_options';
  if (input.riskTolerance <= 35 && input.incomeTarget >= 7) return 'defensive_income';
  if (input.riskTolerance <= 35 || input.cashTarget >= 18 || input.context.risk.healthLabel === 'elevated_risk') return 'defensive';
  if (input.incomeTarget >= 9 && input.growthTarget >= 10) return 'balanced_income';
  if (input.incomeTarget >= 9) return 'income';
  if (input.growthTarget >= 17 && input.riskTolerance >= 65) return 'aggressive_growth';
  if (input.growthTarget >= 14) return 'growth';
  if (input.optionsTarget >= 10 || input.allocationExposure.options_exposure_pct > 0) return 'hybrid';
  return 'balanced';
}

function strategyRiskLevel(strategy: StrategyContext): StrategyRiskLevel {
  const highStress = Math.abs(strategy.stressTest.worst_case?.projectedDrawdown ?? 0) >= 24;
  if (strategy.context.risk.healthLabel === 'elevated_risk' || strategy.optionsExposure.risk_level === 'high' || highStress) return 'high';
  if (strategy.context.risk.healthLabel === 'watch' || strategy.projection.expected_volatility >= 18) return 'moderate';
  return 'low';
}

function normalizeProfile(profile: PortfolioStrategyProfile): PortfolioStrategyProfile {
  return {
    ...profile,
    profileType: parseStrategyMode(profile.profileType),
    riskTolerance: round(clamp(Number(profile.riskTolerance), 0, 100)),
    incomeTarget: round(clamp(Number(profile.incomeTarget), 0, 40)),
    growthTarget: round(clamp(Number(profile.growthTarget), 0, 40)),
    cashTarget: round(clamp(Number(profile.cashTarget), 0, 60)),
    optionsTarget: round(clamp(Number(profile.optionsTarget), 0, 60)),
    metadata: profile.metadata ?? {}
  };
}

function baselineGrowthTarget(context: AiPortfolioContext) {
  const value = context.performance.cagrPct || context.performance.totalReturnPct || context.benchmark.benchmarkReturnPct || 10;
  return clamp(value + (context.risk.healthLabel === 'stable' ? 3 : 0), 4, 22);
}

function mode(
  strategyMode: StrategyMode,
  portfolioMode: PortfolioMode,
  label: string,
  riskLevel: StrategyRiskLevel,
  incomeWeight: number,
  growthWeight: number,
  defensiveWeight: number,
  optionsWeight: number,
  explanation: string
): DynamicPortfolioMode {
  return { strategyMode, portfolioMode, label, riskLevel, incomeWeight, growthWeight, defensiveWeight, optionsWeight, explanation };
}

function conflict(
  conflictType: string,
  severity: ConflictSeverity,
  description: string,
  resolutionSuggestion: string,
  metadata: Record<string, unknown>
): StrategyConflict {
  return {
    conflictType,
    severity,
    description,
    resolutionSuggestion,
    metadata: {
      ...metadata,
      version: STRATEGY_ORCHESTRATOR_VERSION,
      guardrail: 'Conflict detection is advisory-only and does not execute trades.'
    }
  };
}

function primaryObjective(mode: StrategyMode) {
  if (mode.includes('income')) return 'income generation';
  if (mode.includes('growth')) return 'capital appreciation';
  if (mode === 'defensive') return 'capital preservation';
  if (mode === 'aggressive_options') return 'options premium generation';
  if (mode === 'hybrid') return 'multi-strategy balance';
  return 'balanced risk-adjusted growth';
}

function strategyTradeoffs(mode: StrategyMode) {
  if (mode.includes('income')) return ['Higher income targets can raise assignment, yield, or concentration risk.', 'Defensive cash can reduce current income.'];
  if (mode.includes('growth')) return ['Higher growth exposure can increase drawdown and concentration.', 'Lower cash reserve can reduce flexibility during stress.'];
  if (mode === 'defensive') return ['Lower volatility can reduce upside participation.', 'Higher cash may create opportunity cost.'];
  if (mode === 'aggressive_options') return ['Premium targets can increase assignment and collateral stress.', 'Strict guardrails may limit trade frequency.'];
  return ['Balanced strategy may underweight the strongest single objective.', 'Diversification can dilute concentrated winners.'];
}

function labelMode(mode: string) {
  return mode.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function mapProfileRow(row: ProfileRow): PortfolioStrategyProfile {
  return {
    id: row.id,
    profileType: row.profileType,
    riskTolerance: Number(row.riskTolerance),
    incomeTarget: Number(row.incomeTarget),
    growthTarget: Number(row.growthTarget),
    cashTarget: Number(row.cashTarget),
    optionsTarget: Number(row.optionsTarget),
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapRecommendationRow(row: RecommendationRow): StrategyRecommendation {
  return {
    id: row.id,
    strategyMode: row.strategyMode,
    title: row.title,
    summary: row.summary,
    priority: row.priority,
    riskLevel: row.riskLevel,
    recommendation: parseJson<StrategyRecommendation['recommendation']>(row.recommendationJson, {
      objective: 'strategy coordination',
      actions: [],
      tradeoffs: [],
      expectedImpact: 'Unavailable',
      noAutoTrading: true
    }),
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
    createdAt: row.createdAt.toISOString()
  };
}

function mapConflictRow(row: ConflictRow): StrategyConflict {
  return {
    id: row.id,
    conflictType: row.conflictType,
    severity: row.severity,
    description: row.description,
    resolutionSuggestion: row.resolutionSuggestion,
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
    createdAt: row.createdAt.toISOString()
  };
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
