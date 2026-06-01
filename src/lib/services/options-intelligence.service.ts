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
  type AiHoldingContext,
  type AiPortfolioContext
} from '$lib/services/ai-context.service';

export const OPTIONS_INTELLIGENCE_VERSION = 'phase-6B';

export type OptionType = 'put' | 'call';
export type OptionsRiskLevel = 'low' | 'medium' | 'high';

export type ParsedOptionPosition = {
  symbol: string;
  underlying: string;
  option_type: OptionType;
  strike: number;
  expiration_date: string;
  days_to_expiration: number;
  contracts: number;
  quantity: number;
  market_value: number;
  premium: number;
  collateral: number;
  underlying_price: number;
  premium_yield: number;
  annualized_yield: number;
  assignment_probability: number;
  assignment_risk: OptionsRiskLevel;
  status: 'open' | 'expired_or_stale';
};

export type OptionsExposureReport = {
  options_allocation: number;
  total_options_exposure: number;
  put_exposure: number;
  call_exposure: number;
  collateral_locked: number;
  premium_generated_monthly: number;
  assignment_risk_score: number;
  collateral_usage_pct: number;
  risk_level: OptionsRiskLevel;
  warnings: string[];
  explanation: string;
  generated_at: string;
};

export type CoveredCallCandidate = {
  symbol: string;
  shares_available: number;
  possible_contracts: number;
  active_contracts: number;
  underlying_price: number;
  suggested_strike: number;
  estimated_premium: number;
  upside_cap_pct: number;
  coverage_status: 'available' | 'partially_covered' | 'covered';
  note: string;
};

export type PutExposureRow = {
  symbol: string;
  strike: number;
  expiration_date: string;
  contracts: number;
  collateral: number;
  premium: number;
  premium_yield: number;
  annualized_yield: number;
  assignment_probability: number;
  risk_level: OptionsRiskLevel;
};

export type WheelStrategyReport = {
  symbol: string;
  strategy_status: 'cash_secured_put' | 'covered_call' | 'ready_for_put' | 'monitor';
  premium_collected: number;
  assignment_count: number;
  covered_call_cycles: number;
  realized_income: number;
  assignment_probability: number;
  collateral_efficiency: number;
  next_step: string;
  metadata: Record<string, unknown>;
};

type OptionsReportRow = {
  metadataJson: string;
  createdAt: Date;
};

export async function getOptionsIntelligenceDashboard(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark; forceRefresh?: boolean } = {}
) {
  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const [exposure, coveredCalls, puts, wheel, premium, risk] = await Promise.all([
    // Always compute exposure fresh so the summary tiles match the live
    // puts/coveredCalls detail (a stale stored report showed $0/0% while
    // positions existed). Don't persist on a read — only the refresh action does.
    getOptionsExposure(userId, { period, benchmark, forceRefresh: true, persist: false }),
    getCoveredCallAnalysis(userId, { period, benchmark }),
    getPutExposureAnalysis(userId, { period, benchmark }),
    getWheelStrategyAnalysis(userId, { period, benchmark, forceRefresh: options.forceRefresh }),
    getPremiumAnalytics(userId, { period, benchmark }),
    getOptionsRiskAnalysis(userId, { period, benchmark })
  ]);

  return {
    period,
    benchmark,
    periods: ANALYTICS_PERIODS,
    benchmarks: BENCHMARKS,
    exposure,
    coveredCalls,
    puts,
    wheel,
    premium,
    risk,
    widgets: [
      { label: 'Options Allocation', value: `${exposure.options_allocation.toFixed(2)}%`, status: exposure.risk_level },
      { label: 'Monthly Premium', value: money(exposure.premium_generated_monthly), status: 'low' },
      { label: 'Collateral Usage', value: `${exposure.collateral_usage_pct.toFixed(2)}%`, status: exposure.collateral_usage_pct > 90 ? 'high' : 'medium' },
      { label: 'Assignment Risk', value: `${exposure.assignment_risk_score}/100`, status: exposure.risk_level },
      { label: 'Covered Calls', value: String(coveredCalls.length), status: coveredCalls.length ? 'low' : 'medium' }
    ]
  };
}

export async function getOptionsExposure(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark; forceRefresh?: boolean; persist?: boolean } = {}
): Promise<OptionsExposureReport> {
  if (!options.forceRefresh) {
    const stored = await getStoredExposureReport(userId);
    if (stored) return stored;
  }
  const context = await buildAiPortfolioContext(userId, {
    period: options.period ?? 'MAX',
    benchmark: options.benchmark ?? 'SPY'
  });
  const positions = extractOptionPositions(context);
  const report = buildExposureReport(context, positions);
  // The dashboard (read path) computes fresh but must not persist a new
  // snapshot on every page view — that's the refresh action's job.
  if (options.persist !== false) await saveOptionsSnapshot(userId, context, positions, report);
  return report;
}

export async function getCoveredCallAnalysis(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark } = {}
) {
  const context = await buildAiPortfolioContext(userId, {
    period: options.period ?? 'MAX',
    benchmark: options.benchmark ?? 'SPY'
  });
  const positions = extractOptionPositions(context);
  return buildCoveredCallCandidates(context, positions);
}

export async function getPutExposureAnalysis(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark } = {}
) {
  const context = await buildAiPortfolioContext(userId, {
    period: options.period ?? 'MAX',
    benchmark: options.benchmark ?? 'SPY'
  });
  return extractOptionPositions(context)
    .filter((position) => position.option_type === 'put')
    .map((position) => ({
      symbol: position.symbol,
      strike: position.strike,
      expiration_date: position.expiration_date,
      contracts: position.contracts,
      collateral: position.collateral,
      premium: position.premium,
      premium_yield: position.premium_yield,
      annualized_yield: position.annualized_yield,
      assignment_probability: position.assignment_probability,
      risk_level: position.assignment_risk
    }));
}

export async function getWheelStrategyAnalysis(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark; forceRefresh?: boolean } = {}
) {
  const context = await buildAiPortfolioContext(userId, {
    period: options.period ?? 'MAX',
    benchmark: options.benchmark ?? 'SPY'
  });
  const wheel = buildWheelReports(context, extractOptionPositions(context));
  if (options.forceRefresh) await saveWheelReports(userId, wheel);
  return wheel;
}

export async function getPremiumAnalytics(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark } = {}
) {
  const context = await buildAiPortfolioContext(userId, {
    period: options.period ?? 'MAX',
    benchmark: options.benchmark ?? 'SPY'
  });
  const positions = extractOptionPositions(context);
  const totalPremium = sum(positions.map((position) => position.premium));
  const totalCollateral = sum(positions.map((position) => position.collateral));
  const averageYield = positions.length ? sum(positions.map((position) => position.premium_yield)) / positions.length : 0;
  const averageAnnualizedYield = positions.length ? sum(positions.map((position) => position.annualized_yield)) / positions.length : 0;
  const efficiencyScore = clamp((averageYield * 10) + Math.max(0, 100 - averageAnnualizedYield * 0.4), 0, 100);
  return {
    premium_collected: round(totalPremium),
    collateral_base: round(totalCollateral),
    average_premium_yield: round(averageYield),
    average_annualized_yield: round(averageAnnualizedYield),
    premium_efficiency_score: round(efficiencyScore, 0),
    positions: positions.map((position) => ({
      symbol: position.symbol,
      premium_yield: position.premium_yield,
      annualized_yield: position.annualized_yield,
      risk_level: position.assignment_risk
    }))
  };
}

export async function getOptionsRiskAnalysis(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark } = {}
) {
  const context = await buildAiPortfolioContext(userId, {
    period: options.period ?? 'MAX',
    benchmark: options.benchmark ?? 'SPY'
  });
  const positions = extractOptionPositions(context);
  const exposure = buildExposureReport(context, positions);
  return {
    assignment_risk_score: exposure.assignment_risk_score,
    risk_level: exposure.risk_level,
    warnings: exposure.warnings,
    assignment_concentration: buildAssignmentConcentration(positions),
    explanation: exposure.explanation,
    guardrail: 'Options intelligence is analytical only. It does not place, roll, or close options orders.'
  };
}

export async function refreshOptionsIntelligence(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark } = {}
) {
  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const [exposure, wheel] = await Promise.all([
    getOptionsExposure(userId, { period, benchmark, forceRefresh: true }),
    getWheelStrategyAnalysis(userId, { period, benchmark, forceRefresh: true })
  ]);
  return {
    refreshed_at: new Date().toISOString(),
    options_allocation: exposure.options_allocation,
    assignment_risk_score: exposure.assignment_risk_score,
    wheel_reports: wheel.length
  };
}

export function parseOptionsPeriod(value: string | null) {
  return parseAiPeriod(value);
}

export function parseOptionsBenchmark(value: string | null) {
  return parseAiBenchmark(value);
}

function extractOptionPositions(context: AiPortfolioContext): ParsedOptionPosition[] {
  const stockPrices = new Map(
    context.portfolio.holdings
      .filter((holding) => !isOptionHolding(holding))
      .map((holding) => [stripMarket(holding.symbol), holding.marketPrice || Math.abs(holding.marketValue / Math.max(1, holding.quantity))])
  );
  return context.portfolio.holdings
    .filter(isOptionHolding)
    .map((holding) => buildOptionPosition(holding, stockPrices))
    .filter((position): position is ParsedOptionPosition => Boolean(position));
}

function buildOptionPosition(
  holding: AiHoldingContext,
  stockPrices: Map<string, number>
): ParsedOptionPosition | null {
  const parsed = parseOptionSymbol(holding.symbol);
  if (!parsed) return null;
  const contracts = Math.max(1, Math.abs(holding.quantity));
  const underlyingPrice = stockPrices.get(parsed.underlying) ?? Math.max(0.01, parsed.strike * 0.9);
  const premium = Math.abs(holding.marketValue);
  const collateral = parsed.option_type === 'put'
    ? parsed.strike * 100 * contracts
    : underlyingPrice * 100 * contracts;
  const dte = Math.max(0, daysBetween(new Date(), new Date(parsed.expiration_date)));
  const moneyness =
    parsed.option_type === 'put'
      ? (parsed.strike - underlyingPrice) / Math.max(underlyingPrice, 0.01)
      : (underlyingPrice - parsed.strike) / Math.max(underlyingPrice, 0.01);
  const assignmentProbability = clamp(0.22 + moneyness * 1.2 + (dte <= 7 ? 0.12 : dte <= 21 ? 0.06 : 0), 0.05, 0.92);
  const premiumYield = collateral > 0 ? (premium / collateral) * 100 : 0;
  const annualizedYield = dte > 0 ? premiumYield * (365 / dte) : premiumYield;
  return {
    symbol: holding.symbol,
    underlying: parsed.underlying,
    option_type: parsed.option_type,
    strike: parsed.strike,
    expiration_date: parsed.expiration_date,
    days_to_expiration: dte,
    contracts,
    quantity: holding.quantity,
    market_value: round(holding.marketValue),
    premium: round(premium),
    collateral: round(collateral),
    underlying_price: round(underlyingPrice),
    premium_yield: round(premiumYield),
    annualized_yield: round(annualizedYield),
    assignment_probability: round(assignmentProbability, 2),
    assignment_risk: assignmentProbability >= 0.55 ? 'high' : assignmentProbability >= 0.3 ? 'medium' : 'low',
    status: dte === 0 ? 'expired_or_stale' : 'open'
  };
}

function buildExposureReport(context: AiPortfolioContext, positions: ParsedOptionPosition[]): OptionsExposureReport {
  const totalOptionsExposure = sum(positions.map((position) => Math.abs(position.market_value)));
  const putExposure = sum(positions.filter((position) => position.option_type === 'put').map((position) => Math.abs(position.market_value)));
  const callExposure = sum(positions.filter((position) => position.option_type === 'call').map((position) => Math.abs(position.market_value)));
  const collateralLocked = sum(positions.map((position) => position.collateral));
  const premiumGenerated = sum(positions.map((position) => position.premium));
  const optionsAllocation = context.portfolio.value > 0 ? (totalOptionsExposure / context.portfolio.value) * 100 : 0;
  const collateralUsage = context.portfolio.value > 0 ? (collateralLocked / context.portfolio.value) * 100 : 0;
  const weightedRisk = positions.length ? sum(positions.map((position) => position.assignment_probability * 100 * Math.max(1, position.collateral))) / Math.max(1, collateralLocked) : 0;
  const warnings = buildWarnings(optionsAllocation, collateralUsage, positions);
  const riskLevel: OptionsRiskLevel = weightedRisk >= 60 || optionsAllocation > 35 || collateralUsage > 100 ? 'high' : weightedRisk >= 35 || optionsAllocation > 20 ? 'medium' : 'low';
  return {
    options_allocation: round(optionsAllocation),
    total_options_exposure: round(totalOptionsExposure),
    put_exposure: round(putExposure),
    call_exposure: round(callExposure),
    collateral_locked: round(collateralLocked),
    premium_generated_monthly: round(premiumGenerated),
    assignment_risk_score: round(weightedRisk, 0),
    collateral_usage_pct: round(collateralUsage),
    risk_level: riskLevel,
    warnings,
    explanation: positions.length
      ? `Options exposure is ${round(optionsAllocation)}% of portfolio value with ${round(collateralUsage)}% collateral usage and assignment risk score ${round(weightedRisk, 0)}/100.`
      : 'No option positions were detected in the latest portfolio context.',
    generated_at: new Date().toISOString()
  };
}

function buildCoveredCallCandidates(context: AiPortfolioContext, positions: ParsedOptionPosition[]): CoveredCallCandidate[] {
  const callContractsByUnderlying = new Map<string, number>();
  for (const position of positions.filter((item) => item.option_type === 'call')) {
    callContractsByUnderlying.set(position.underlying, (callContractsByUnderlying.get(position.underlying) ?? 0) + position.contracts);
  }
  return context.portfolio.holdings
    .filter((holding) => !isOptionHolding(holding) && holding.quantity >= 100)
    .map((holding) => {
      const underlying = stripMarket(holding.symbol);
      const possibleContracts = Math.floor(holding.quantity / 100);
      const activeCalls = callContractsByUnderlying.get(underlying) ?? 0;
      const availableContracts = Math.max(0, possibleContracts - activeCalls);
      const price = Math.max(0.01, holding.marketPrice);
      return {
        symbol: holding.symbol,
        shares_available: holding.quantity,
        possible_contracts: availableContracts,
        active_contracts: activeCalls,
        underlying_price: round(price),
        suggested_strike: round(price * 1.08, 2),
        estimated_premium: round(price * 100 * availableContracts * 0.015),
        upside_cap_pct: 8,
        coverage_status: activeCalls >= possibleContracts ? 'covered' : activeCalls > 0 ? 'partially_covered' : 'available',
        note: availableContracts > 0
          ? 'Candidate only. Review earnings, liquidity, and tax impact before using any covered call.'
          : 'Existing call coverage appears to consume available 100-share lots.'
      };
    });
}

function buildWheelReports(context: AiPortfolioContext, positions: ParsedOptionPosition[]): WheelStrategyReport[] {
  const underlyings = new Set([
    ...positions.map((position) => position.underlying),
    ...context.portfolio.holdings.filter((holding) => !isOptionHolding(holding) && holding.quantity >= 100).map((holding) => stripMarket(holding.symbol))
  ]);
  return [...underlyings].map((underlying) => {
    const related = positions.filter((position) => position.underlying === underlying);
    const puts = related.filter((position) => position.option_type === 'put');
    const calls = related.filter((position) => position.option_type === 'call');
    const shares = context.portfolio.holdings.find((holding) => stripMarket(holding.symbol) === underlying && !isOptionHolding(holding))?.quantity ?? 0;
    const premium = sum(related.map((position) => position.premium));
    const assignmentProbability = related.length ? Math.max(...related.map((position) => position.assignment_probability)) : 0.12;
    const collateralEfficiency = related.length ? clamp(100 - assignmentProbability * 45 + Math.min(20, average(related.map((position) => position.premium_yield)) * 4), 0, 100) : 70;
    const status: WheelStrategyReport['strategy_status'] = puts.length > 0
      ? 'cash_secured_put'
      : calls.length > 0
        ? 'covered_call'
        : shares >= 100
          ? 'covered_call'
          : 'ready_for_put';
    return {
      symbol: underlying,
      strategy_status: status,
      premium_collected: round(premium),
      assignment_count: 0,
      covered_call_cycles: calls.length,
      realized_income: round(premium),
      assignment_probability: round(assignmentProbability, 2),
      collateral_efficiency: round(collateralEfficiency, 0),
      next_step: nextWheelStep(status),
      metadata: {
        version: OPTIONS_INTELLIGENCE_VERSION,
        putContracts: sum(puts.map((position) => position.contracts)),
        callContracts: sum(calls.map((position) => position.contracts)),
        guardrail: 'Wheel analysis is informational only. No option order or roll is executed.'
      }
    };
  });
}

function buildAssignmentConcentration(positions: ParsedOptionPosition[]) {
  const byUnderlying = new Map<string, number>();
  for (const position of positions) {
    byUnderlying.set(position.underlying, (byUnderlying.get(position.underlying) ?? 0) + position.collateral);
  }
  return [...byUnderlying.entries()]
    .map(([symbol, collateral]) => ({ symbol, collateral: round(collateral), percentage: round(collateral / Math.max(1, sum([...byUnderlying.values()])) * 100) }))
    .sort((a, b) => b.percentage - a.percentage);
}

function buildWarnings(optionsAllocation: number, collateralUsage: number, positions: ParsedOptionPosition[]) {
  const warnings: string[] = [];
  if (optionsAllocation > 35) warnings.push('Options allocation is above the aggressive 35% rule.');
  else if (optionsAllocation > 20) warnings.push('Options allocation is above the recommended 20% rule.');
  if (collateralUsage > 90) warnings.push('Collateral usage is above the 90% reserve rule.');
  if (positions.some((position) => position.assignment_risk === 'high')) warnings.push('At least one option has elevated assignment risk.');
  if (positions.some((position) => position.status === 'expired_or_stale')) warnings.push('One or more option symbols appear expired or stale and should be reviewed.');
  return warnings;
}

function parseOptionSymbol(symbol: string) {
  const local = stripMarket(symbol).toUpperCase();
  const match = local.match(/^([A-Z]+)(\d{6})([CP])(\d+)$/);
  if (!match) return null;
  const [, underlying, rawDate, cp, rawStrike] = match;
  const year = 2000 + Number(rawDate.slice(0, 2));
  const month = Number(rawDate.slice(2, 4));
  const day = Number(rawDate.slice(4, 6));
  return {
    underlying,
    option_type: cp === 'P' ? 'put' as const : 'call' as const,
    strike: normalizeStrike(rawStrike),
    expiration_date: `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  };
}

function normalizeStrike(raw: string) {
  const value = Number(raw);
  if (!Number.isFinite(value)) return 0;
  if (value >= 100000) return value / 1000;
  if (value >= 1000) return value / 1000;
  return value;
}

function isOptionHolding(holding: AiHoldingContext) {
  return holding.assetType.toLowerCase() === 'option' || Boolean(parseOptionSymbol(holding.symbol));
}

function stripMarket(symbol: string) {
  return symbol.split('.').at(-1) ?? symbol;
}

function nextWheelStep(status: WheelStrategyReport['strategy_status']) {
  if (status === 'cash_secured_put') return 'Monitor assignment risk and collateral reserve until expiration.';
  if (status === 'covered_call') return 'Monitor upside cap, expiry risk, and available 100-share lots.';
  if (status === 'ready_for_put') return 'Candidate for put analysis only if collateral and risk limits are acceptable.';
  return 'Keep monitoring premium, assignment, and concentration risk.';
}

async function saveOptionsSnapshot(
  userId: string,
  context: AiPortfolioContext,
  positions: ParsedOptionPosition[],
  report: OptionsExposureReport
) {
  for (const position of positions) {
    await prisma.$executeRaw`
      INSERT INTO options_positions
        (id, user_id, trading_account_id, symbol, option_type, strike, expiration_date, contracts, premium, collateral, status, metadata, created_at, updated_at)
      VALUES
        (${randomUUID()}, ${userId}, ${null}, ${position.symbol}, ${position.option_type}, ${position.strike}, ${new Date(position.expiration_date)}, ${position.contracts}, ${position.premium}, ${position.collateral}, ${position.status}, ${JSON.stringify({ version: OPTIONS_INTELLIGENCE_VERSION, underlying: position.underlying, assignmentProbability: position.assignment_probability })}, NOW(), NOW())
    `;
  }
  await prisma.$executeRaw`
    INSERT INTO options_exposure_reports
      (id, user_id, snapshot_date, total_options_exposure, put_exposure, call_exposure, collateral_locked, premium_generated, assignment_risk_score, metadata, created_at, updated_at)
    VALUES
      (${randomUUID()}, ${userId}, ${context.metadata.latestSnapshotDate ? new Date(context.metadata.latestSnapshotDate) : new Date()}, ${report.total_options_exposure}, ${report.put_exposure}, ${report.call_exposure}, ${report.collateral_locked}, ${report.premium_generated_monthly}, ${report.assignment_risk_score}, ${JSON.stringify({ ...report, version: OPTIONS_INTELLIGENCE_VERSION, contextHash: context.metadata.contextHash })}, NOW(), NOW())
  `;
}

async function saveWheelReports(userId: string, reports: WheelStrategyReport[]) {
  for (const report of reports) {
    await prisma.$executeRaw`
      INSERT INTO wheel_strategy_reports
        (id, user_id, symbol, strategy_status, premium_collected, assignment_count, covered_call_cycles, realized_income, metadata, created_at, updated_at)
      VALUES
        (${randomUUID()}, ${userId}, ${report.symbol}, ${report.strategy_status}, ${report.premium_collected}, ${report.assignment_count}, ${report.covered_call_cycles}, ${report.realized_income}, ${JSON.stringify(report.metadata)}, NOW(), NOW())
    `;
  }
}

async function getStoredExposureReport(userId: string): Promise<OptionsExposureReport | null> {
  const rows = await prisma.$queryRaw<OptionsReportRow[]>`
    SELECT metadata AS metadataJson, created_at AS createdAt
    FROM options_exposure_reports
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  if (!rows[0]) return null;
  return parseJson<OptionsExposureReport>(rows[0].metadataJson, null as unknown as OptionsExposureReport);
}

function money(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

function daysBetween(start: Date, end: Date) {
  return Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + (Number.isFinite(value) ? value : 0), 0);
}

function average(values: number[]) {
  return values.length ? sum(values) / values.length : 0;
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
