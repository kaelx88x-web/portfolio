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

export const SMART_ALLOCATION_VERSION = 'phase-6A';

export type PortfolioStyle = 'defensive' | 'balanced' | 'growth' | 'aggressive' | 'income_focused' | 'high_volatility';
export type AllocationHealthLevel = 'healthy' | 'moderate' | 'watch' | 'critical';
export type AllocationPriority = 'low' | 'medium' | 'high';

export type AllocationHealthReport = {
  allocation_score: number;
  diversification_score: number;
  cash_efficiency_score: number;
  volatility_balance_score: number;
  portfolio_style: PortfolioStyle;
  health_level: AllocationHealthLevel;
  warnings: string[];
  explanation: string;
  metadata: Record<string, unknown>;
  generated_at: string;
};

export type AllocationExposure = {
  top_exposure: string;
  symbol_exposure: ExposureRow[];
  category_exposure: ExposureRow[];
  asset_type_exposure: ExposureRow[];
  currency_exposure: ExposureRow[];
  options_exposure_pct: number;
  cash_pct: number;
};

export type ExposureRow = {
  label: string;
  percentage: number;
  risk_level: AllocationPriority;
  explanation: string;
};

export type AllocationSuggestion = {
  id?: string;
  title: string;
  summary: string;
  current_state: Record<string, unknown>;
  suggested_state: Record<string, unknown>;
  impact_estimate: string;
  priority: AllocationPriority;
  metadata: Record<string, unknown>;
  created_at?: string;
};

type AllocationHealthRow = {
  id: string;
  snapshotDate: Date;
  allocationScore: number;
  diversificationScore: number;
  cashEfficiencyScore: number;
  volatilityBalanceScore: number;
  portfolioStyle: PortfolioStyle;
  healthLevel: AllocationHealthLevel;
  metadataJson: string;
  createdAt: Date;
};

type AllocationSuggestionRow = {
  id: string;
  title: string;
  summary: string;
  currentStateJson: string;
  suggestedStateJson: string;
  impactEstimate: string;
  priority: AllocationPriority;
  metadataJson: string;
  createdAt: Date;
};

export async function getSmartAllocationDashboard(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark; forceRefresh?: boolean } = {}
) {
  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const [health, exposure, style, suggestions] = await Promise.all([
    getAllocationHealth(userId, { period, benchmark, forceRefresh: options.forceRefresh }),
    getAllocationExposure(userId, { period, benchmark }),
    getPortfolioStyle(userId, { period, benchmark }),
    getAllocationSuggestions(userId, { period, benchmark, forceRefresh: options.forceRefresh })
  ]);

  return {
    period,
    benchmark,
    periods: ANALYTICS_PERIODS,
    benchmarks: BENCHMARKS,
    health,
    exposure,
    style,
    suggestions,
    widgets: buildAllocationWidgets(health, exposure)
  };
}

export async function getAllocationHealth(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark; forceRefresh?: boolean } = {}
): Promise<AllocationHealthReport> {
  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';

  if (!options.forceRefresh) {
    const stored = await getLatestStoredHealth(userId);
    if (stored) return stored;
  }

  const context = await buildAiPortfolioContext(userId, { period, benchmark });
  const report = buildAllocationHealth(context);
  await saveAllocationHealth(userId, context, report);
  return report;
}

export async function getAllocationExposure(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark } = {}
): Promise<AllocationExposure> {
  const context = await buildAiPortfolioContext(userId, {
    period: options.period ?? 'MAX',
    benchmark: options.benchmark ?? 'SPY'
  });
  return buildAllocationExposure(context);
}

export async function getPortfolioStyle(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark } = {}
) {
  const context = await buildAiPortfolioContext(userId, {
    period: options.period ?? 'MAX',
    benchmark: options.benchmark ?? 'SPY'
  });
  const exposure = buildAllocationExposure(context);
  const style = detectPortfolioStyle(context, exposure);
  return {
    portfolio_style: style,
    confidence: context.portfolio.holdingsCount >= 3 ? 'high' : 'medium',
    explanation: styleExplanation(style, context, exposure),
    signals: styleSignals(context, exposure)
  };
}

export async function getAllocationSuggestions(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark; forceRefresh?: boolean; limit?: number } = {}
) {
  if (!options.forceRefresh) {
    const stored = await getStoredSuggestions(userId, options.limit ?? 8);
    if (stored.length > 0) return stored;
  }

  const context = await buildAiPortfolioContext(userId, {
    period: options.period ?? 'MAX',
    benchmark: options.benchmark ?? 'SPY'
  });
  const health = buildAllocationHealth(context);
  const exposure = buildAllocationExposure(context);
  const suggestions = buildAllocationSuggestions(context, health, exposure);
  await saveAllocationSuggestions(userId, suggestions);
  return suggestions;
}

export async function refreshSmartAllocation(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark } = {}
) {
  const dashboard = await getSmartAllocationDashboard(userId, {
    period: options.period ?? 'MAX',
    benchmark: options.benchmark ?? 'SPY',
    forceRefresh: true
  });
  return {
    refreshed_at: new Date().toISOString(),
    allocation_score: dashboard.health.allocation_score,
    portfolio_style: dashboard.health.portfolio_style,
    suggestions: dashboard.suggestions.length
  };
}

export function parseSmartAllocationPeriod(value: string | null) {
  return parseAiPeriod(value);
}

export function parseSmartAllocationBenchmark(value: string | null) {
  return parseAiBenchmark(value);
}

function buildAllocationHealth(context: AiPortfolioContext): AllocationHealthReport {
  const exposure = buildAllocationExposure(context);
  const largest = exposure.symbol_exposure[0]?.percentage ?? 0;
  const holdingCount = context.portfolio.holdingsCount;
  const diversificationScore = clamp(
    100 - Math.max(0, largest - 15) * 1.25 + Math.min(20, holdingCount * 3),
    0,
    100
  );
  const cash = context.portfolio.cashRatio;
  const cashEfficiencyScore = cash < 5 ? 45 + cash * 5 : cash <= 25 ? 95 - Math.abs(12 - cash) : Math.max(45, 95 - (cash - 25) * 1.5);
  const volatilityBalanceScore = clamp(100 - Math.max(0, context.risk.volatilityPct - 18) * 0.85 - Math.max(0, Math.abs(context.risk.maxDrawdownPct) - 10), 0, 100);
  const allocationScore = clamp(diversificationScore * 0.42 + cashEfficiencyScore * 0.22 + volatilityBalanceScore * 0.26 + Math.max(0, 100 - exposure.options_exposure_pct) * 0.1, 0, 100);
  const portfolioStyle = detectPortfolioStyle(context, exposure);
  const warnings = buildWarnings(context, exposure);
  return {
    allocation_score: round(allocationScore, 0),
    diversification_score: round(diversificationScore, 0),
    cash_efficiency_score: round(cashEfficiencyScore, 0),
    volatility_balance_score: round(volatilityBalanceScore, 0),
    portfolio_style: portfolioStyle,
    health_level: healthLevel(allocationScore),
    warnings,
    explanation: allocationExplanation(portfolioStyle, allocationScore, warnings),
    metadata: {
      version: SMART_ALLOCATION_VERSION,
      contextHash: context.metadata.contextHash,
      latestSnapshotDate: context.metadata.latestSnapshotDate,
      guardrail: 'Allocation intelligence is advisory only and does not execute trades.'
    },
    generated_at: new Date().toISOString()
  };
}

function buildAllocationExposure(context: AiPortfolioContext): AllocationExposure {
  const symbolExposure = context.allocation.bySymbol.map((slice) => exposureRow(slice.label, slice.percentage, 'symbol'));
  const assetTypeExposure = context.allocation.byAssetType.map((slice) => exposureRow(slice.label, slice.percentage, 'asset type'));
  const currencyExposure = context.allocation.byCurrency.map((slice) => exposureRow(slice.label, slice.percentage, 'currency'));
  const categoryExposure = buildCategoryExposure(context);
  const optionValue = context.portfolio.holdings
    .filter((holding) => holding.assetType.toLowerCase() === 'option' || optionLike(holding.symbol))
    .reduce((sum, holding) => sum + Math.abs(holding.marketValue), 0);
  const optionsExposurePct = context.portfolio.value > 0 ? (optionValue / context.portfolio.value) * 100 : 0;
  return {
    top_exposure: symbolExposure[0]?.label ?? 'No exposure',
    symbol_exposure: symbolExposure,
    category_exposure: categoryExposure,
    asset_type_exposure: assetTypeExposure,
    currency_exposure: currencyExposure,
    options_exposure_pct: round(optionsExposurePct, 2),
    cash_pct: round(context.portfolio.cashRatio, 2)
  };
}

function buildAllocationSuggestions(
  context: AiPortfolioContext,
  health: AllocationHealthReport,
  exposure: AllocationExposure
): AllocationSuggestion[] {
  const suggestions: AllocationSuggestion[] = [];
  const largest = exposure.symbol_exposure[0];
  const category = exposure.category_exposure[0];

  if (largest && largest.percentage > 25) {
    suggestions.push({
      title: `Reduce ${largest.label} single-name dependency`,
      summary: `${largest.label} is ${largest.percentage.toFixed(2)}% of visible allocation, above the high concentration threshold.`,
      current_state: { label: largest.label, percentage: largest.percentage },
      suggested_state: { targetMaxPct: 15, destination: 'diversified core or defensive sleeve' },
      impact_estimate: 'May improve diversification score and reduce portfolio volatility sensitivity.',
      priority: 'high',
      metadata: { rule: 'single_stock_gt_25', guardrail: 'Review only. No rebalance is executed.' }
    });
  } else if (largest && largest.percentage > 15) {
    suggestions.push({
      title: `Monitor ${largest.label} concentration`,
      summary: `${largest.label} is above the moderate concentration threshold.`,
      current_state: { label: largest.label, percentage: largest.percentage },
      suggested_state: { targetMaxPct: 15 },
      impact_estimate: 'Keeping single-stock exposure near 15% can make drawdowns less dependent on one holding.',
      priority: 'medium',
      metadata: { rule: 'single_stock_gt_15', guardrail: 'Review only.' }
    });
  }

  if (category && category.percentage > 50) {
    suggestions.push({
      title: `Balance ${category.label} exposure`,
      summary: `${category.label} represents ${category.percentage.toFixed(2)}% of category exposure.`,
      current_state: { label: category.label, percentage: category.percentage },
      suggested_state: { addCounterweight: category.label === 'Growth' ? 'income or defensive sleeve' : 'broad market core' },
      impact_estimate: 'Category balance can reduce style-specific drawdown risk.',
      priority: 'medium',
      metadata: { rule: 'category_gt_50' }
    });
  }

  if (context.portfolio.cashRatio < 5) {
    suggestions.push({
      title: 'Restore liquidity buffer',
      summary: `Cash reserve is ${context.portfolio.cashRatio.toFixed(2)}%, below the 5% allocation rule.`,
      current_state: { cashPct: context.portfolio.cashRatio },
      suggested_state: { cashMinPct: 5 },
      impact_estimate: 'Improves cash efficiency score and reduces forced-action risk during volatility.',
      priority: 'high',
      metadata: { rule: 'cash_lt_5' }
    });
  }

  if (exposure.options_exposure_pct > 20) {
    suggestions.push({
      title: 'Review options overlay size',
      summary: `Options exposure is estimated at ${exposure.options_exposure_pct.toFixed(2)}%, above the 20% aggressive-profile rule.`,
      current_state: { optionsExposurePct: exposure.options_exposure_pct },
      suggested_state: { optionsMaxPct: 20, collateralReservePct: 90 },
      impact_estimate: 'May reduce assignment and volatility spillover risk.',
      priority: 'high',
      metadata: { rule: 'options_gt_20' }
    });
  }

  if (context.risk.volatilityPct > 35) {
    suggestions.push({
      title: 'Add volatility counterweight',
      summary: `Portfolio volatility is ${context.risk.volatilityPct.toFixed(2)}%, so allocation balance is dominated by high-volatility exposure.`,
      current_state: { volatilityPct: context.risk.volatilityPct, healthLevel: health.health_level },
      suggested_state: { candidates: ['defensive ETF sleeve', 'cash reserve', 'broader core allocation'] },
      impact_estimate: 'Can improve volatility balance score in the allocation health model.',
      priority: 'medium',
      metadata: { rule: 'volatility_gt_35' }
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: 'Maintain allocation discipline',
      summary: 'No major 6A allocation rule breach was detected. Keep monitoring concentration, cash reserve, and style drift.',
      current_state: { allocationScore: health.allocation_score },
      suggested_state: { action: 'monitor' },
      impact_estimate: 'Maintains current allocation health with periodic review.',
      priority: 'low',
      metadata: { rule: 'no_major_breach' }
    });
  }

  return suggestions;
}

function buildCategoryExposure(context: AiPortfolioContext): ExposureRow[] {
  const totals = new Map<string, number>();
  for (const holding of context.portfolio.holdings) {
    const category = categoryForHolding(holding.symbol, holding.assetType);
    totals.set(category, (totals.get(category) ?? 0) + Math.max(0, holding.marketValue));
  }
  const total = [...totals.values()].reduce((sum, value) => sum + value, 0);
  return [...totals.entries()]
    .map(([label, value]) => exposureRow(label, total > 0 ? (value / total) * 100 : 0, 'category'))
    .sort((a, b) => b.percentage - a.percentage);
}

function detectPortfolioStyle(context: AiPortfolioContext, exposure: AllocationExposure): PortfolioStyle {
  const growthPct = exposure.category_exposure.find((row) => row.label === 'Growth')?.percentage ?? 0;
  const incomePct = exposure.category_exposure.find((row) => row.label === 'Income')?.percentage ?? 0;
  const defensivePct = exposure.category_exposure.find((row) => row.label === 'Defensive')?.percentage ?? 0;
  if (context.risk.volatilityPct >= 50) return 'high_volatility';
  if (exposure.options_exposure_pct > 20 || context.risk.concentrationRiskPct > 45) return 'aggressive';
  if (incomePct >= 35) return 'income_focused';
  if (growthPct >= 45) return 'growth';
  if (defensivePct + context.portfolio.cashRatio >= 35) return 'defensive';
  return 'balanced';
}

function styleSignals(context: AiPortfolioContext, exposure: AllocationExposure) {
  return [
    `Largest exposure: ${exposure.top_exposure}`,
    `Cash reserve: ${round(exposure.cash_pct)}%`,
    `Options exposure: ${round(exposure.options_exposure_pct)}%`,
    `Volatility: ${round(context.risk.volatilityPct)}%`,
    `Concentration: ${round(context.risk.concentrationRiskPct)}%`
  ];
}

function styleExplanation(style: PortfolioStyle, context: AiPortfolioContext, exposure: AllocationExposure) {
  const leader = exposure.category_exposure[0];
  return `Portfolio style is classified as ${style.replace('_', ' ')} based on ${leader?.label ?? 'visible'} exposure, ${context.risk.volatilityPct.toFixed(2)}% volatility, ${context.risk.concentrationRiskPct.toFixed(2)}% concentration, and ${exposure.options_exposure_pct.toFixed(2)}% options exposure.`;
}

function buildWarnings(context: AiPortfolioContext, exposure: AllocationExposure) {
  const warnings: string[] = [];
  const largest = exposure.symbol_exposure[0];
  const category = exposure.category_exposure[0];
  if (largest && largest.percentage > 25) warnings.push(`${largest.label} exceeds 25% high concentration threshold.`);
  else if (largest && largest.percentage > 15) warnings.push(`${largest.label} exceeds 15% moderate concentration threshold.`);
  if (category && category.percentage > 50) warnings.push(`${category.label} style/category exposure is elevated at ${category.percentage.toFixed(2)}%.`);
  if (context.portfolio.cashRatio < 5) warnings.push('Cash reserve is below 5%.');
  if (exposure.options_exposure_pct > 20) warnings.push('Options exposure is above 20% aggressive-profile threshold.');
  if (context.risk.volatilityPct > 35) warnings.push('Volatility profile is elevated for allocation balance.');
  return warnings;
}

function buildAllocationWidgets(health: AllocationHealthReport, exposure: AllocationExposure) {
  return [
    { label: 'Allocation Health', value: `${health.allocation_score}/100`, status: health.health_level },
    { label: 'Portfolio Style', value: health.portfolio_style.replace('_', ' '), status: health.health_level },
    { label: 'Top Exposure', value: exposure.top_exposure, status: exposure.symbol_exposure[0]?.risk_level ?? 'low' },
    { label: 'Diversification', value: `${health.diversification_score}/100`, status: health.diversification_score >= 70 ? 'healthy' : 'watch' },
    { label: 'Cash Reserve', value: `${exposure.cash_pct.toFixed(2)}%`, status: exposure.cash_pct < 5 ? 'critical' : 'healthy' }
  ];
}

function allocationExplanation(style: PortfolioStyle, score: number, warnings: string[]) {
  const tone = score >= 75 ? 'healthy' : score >= 55 ? 'moderate' : score >= 35 ? 'watch' : 'critical';
  return `Allocation health is ${tone}. The portfolio currently reads as ${style.replace('_', ' ')}. ${warnings[0] ?? 'No major allocation warning is active.'}`;
}

function exposureRow(label: string, percentage: number, scope: string): ExposureRow {
  const pct = round(Math.abs(percentage), 2);
  return {
    label,
    percentage: pct,
    risk_level: pct > 25 ? 'high' : pct > 15 ? 'medium' : 'low',
    explanation: `${label} is ${pct.toFixed(2)}% of ${scope} exposure.`
  };
}

function categoryForHolding(symbol: string, assetType: string) {
  const upper = symbol.toUpperCase();
  if (assetType.toLowerCase() === 'option' || optionLike(upper)) return 'Options Overlay';
  if (/(SCHD|SPYT|JEPI|JEPQ|DIV|DIVO|YLD)/.test(upper)) return 'Income';
  if (/(TLT|BND|AGG|SHY|IEF|GLD|SGOV|CASH)/.test(upper)) return 'Defensive';
  if (/(QQQ|SCHG|ARKK|NIO|TSLA|NVDA|META|AMZN|GOOG|MSFT)/.test(upper)) return 'Growth';
  if (/(SPY|VOO|VTI|VT|DIA|IWM)/.test(upper)) return 'Core';
  return 'Other';
}

function optionLike(symbol: string) {
  return /\d{6}[CP]\d+/.test(symbol.toUpperCase());
}

function healthLevel(score: number): AllocationHealthLevel {
  if (score >= 75) return 'healthy';
  if (score >= 55) return 'moderate';
  if (score >= 35) return 'watch';
  return 'critical';
}

async function saveAllocationHealth(userId: string, context: AiPortfolioContext, report: AllocationHealthReport) {
  const snapshotDate = context.metadata.latestSnapshotDate ? new Date(context.metadata.latestSnapshotDate) : new Date();
  await prisma.$executeRaw`
    INSERT INTO allocation_health_reports
      (id, user_id, snapshot_date, allocation_score, diversification_score, cash_efficiency_score, volatility_balance_score, portfolio_style, health_level, metadata, created_at, updated_at)
    VALUES
      (${randomUUID()}, ${userId}, ${snapshotDate}, ${report.allocation_score}, ${report.diversification_score}, ${report.cash_efficiency_score}, ${report.volatility_balance_score}, ${report.portfolio_style}, ${report.health_level}, ${JSON.stringify({ ...report.metadata, warnings: report.warnings, explanation: report.explanation })}, NOW(), NOW())
  `;
}

async function saveAllocationSuggestions(userId: string, suggestions: AllocationSuggestion[]) {
  for (const suggestion of suggestions) {
    await prisma.$executeRaw`
      INSERT INTO allocation_suggestions
        (id, user_id, title, summary, current_state_json, suggested_state_json, impact_estimate, priority, metadata, created_at, updated_at)
      VALUES
        (${randomUUID()}, ${userId}, ${suggestion.title}, ${suggestion.summary}, ${JSON.stringify(suggestion.current_state)}, ${JSON.stringify(suggestion.suggested_state)}, ${suggestion.impact_estimate}, ${suggestion.priority}, ${JSON.stringify(suggestion.metadata)}, NOW(), NOW())
    `;
  }
}

async function getLatestStoredHealth(userId: string): Promise<AllocationHealthReport | null> {
  const rows = await prisma.$queryRaw<AllocationHealthRow[]>`
    SELECT
      id,
      snapshot_date AS snapshotDate,
      allocation_score AS allocationScore,
      diversification_score AS diversificationScore,
      cash_efficiency_score AS cashEfficiencyScore,
      volatility_balance_score AS volatilityBalanceScore,
      portfolio_style AS portfolioStyle,
      health_level AS healthLevel,
      metadata AS metadataJson,
      created_at AS createdAt
    FROM allocation_health_reports
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (!rows[0]) return null;
  const metadata = parseJson<Record<string, unknown>>(rows[0].metadataJson, {});
  return {
    allocation_score: Number(rows[0].allocationScore),
    diversification_score: Number(rows[0].diversificationScore),
    cash_efficiency_score: Number(rows[0].cashEfficiencyScore),
    volatility_balance_score: Number(rows[0].volatilityBalanceScore),
    portfolio_style: rows[0].portfolioStyle,
    health_level: rows[0].healthLevel,
    warnings: Array.isArray(metadata.warnings) ? (metadata.warnings as string[]) : [],
    explanation: typeof metadata.explanation === 'string' ? metadata.explanation : '',
    metadata,
    generated_at: rows[0].createdAt.toISOString()
  };
}

async function getStoredSuggestions(userId: string, limit: number) {
  const rows = await prisma.$queryRaw<AllocationSuggestionRow[]>`
    SELECT
      id,
      title,
      summary,
      current_state_json AS currentStateJson,
      suggested_state_json AS suggestedStateJson,
      impact_estimate AS impactEstimate,
      priority,
      metadata AS metadataJson,
      created_at AS createdAt
    FROM allocation_suggestions
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    summary: row.summary,
    current_state: parseJson<Record<string, unknown>>(row.currentStateJson, {}),
    suggested_state: parseJson<Record<string, unknown>>(row.suggestedStateJson, {}),
    impact_estimate: row.impactEstimate,
    priority: row.priority,
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
    created_at: row.createdAt.toISOString()
  }));
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
