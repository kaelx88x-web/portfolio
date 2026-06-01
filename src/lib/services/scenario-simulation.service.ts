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
import {
  PORTFOLIO_MODES,
  getOptimizationConstraints,
  type OptimizationConstraintSet,
  type PortfolioMode
} from '$lib/services/optimization-engine.service';
import {
  getOptionsExposure,
  getOptionsRiskAnalysis,
  getPremiumAnalytics
} from '$lib/services/options-intelligence.service';

export const SCENARIO_SIMULATION_VERSION = 'phase-6C';

export const SCENARIO_TYPES = [
  'bull_market',
  'bear_market',
  'high_volatility',
  'interest_rate_shock',
  'sector_selloff',
  'tech_crash',
  'options_assignment_stress'
] as const;

export type ScenarioType = (typeof SCENARIO_TYPES)[number];

export type SimulationAllocation = {
  label: string;
  currentPct: number;
  projectedPct: number;
  deltaPct: number;
  shockImpactPct: number;
  role: 'holding' | 'cash' | 'core' | 'defensive' | 'options';
};

export type SimulationRiskSummary = {
  risk_level: 'low' | 'medium' | 'high';
  scenario_risk_score: number;
  largest_risk: string;
  suggested_action: string;
  ai_explanation: string;
  guardrail: string;
  risk_factors: Array<{ label: string; value: string; severity: 'high' | 'medium' | 'low' }>;
};

export type ScenarioSimulationResult = {
  id?: string;
  scenarioName: string;
  projectedReturn: number;
  projectedVolatility: number;
  projectedDrawdown: number;
  allocation: SimulationAllocation[];
  riskSummary: SimulationRiskSummary;
  metadata: Record<string, unknown>;
  createdAt?: string;
};

export type ScenarioSimulationRun = {
  id: string;
  scenarioType: ScenarioType;
  portfolioMode: PortfolioMode;
  status: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

export type ProjectionPoint = {
  label: string;
  months: number;
  expectedValue: number;
  downsideValue: number;
  upsideValue: number;
  expectedReturnPct: number;
  projectedDrawdownPct: number;
  volatilityPct: number;
};

export type PortfolioProjection = {
  generated_at: string;
  base_value: number;
  expected_annual_return: number;
  expected_volatility: number;
  projected_income: number;
  projected_options_premium: number;
  points: ProjectionPoint[];
  risk_summary: SimulationRiskSummary;
  ai_explanation: string;
  guardrail: string;
};

export type RebalanceProjection = {
  id?: string;
  currentAllocation: Array<{ label: string; percentage: number }>;
  projectedAllocation: SimulationAllocation[];
  riskReduction: number;
  expectedReturnChange: number;
  volatilityChange: number;
  metadata: Record<string, unknown>;
  createdAt?: string;
};

type SimulationRunRow = {
  id: string;
  scenarioType: ScenarioType;
  portfolioMode: PortfolioMode;
  status: string;
  metadataJson: string;
  createdAt: Date;
  updatedAt: Date;
};

type SimulationResultRow = {
  id: string;
  simulationRunId: string;
  scenarioName: string;
  projectedReturn: number;
  projectedVolatility: number;
  projectedDrawdown: number;
  allocationJson: string;
  riskSummaryJson: string;
  metadataJson: string;
  createdAt: Date;
};

type RebalanceProjectionRow = {
  id: string;
  currentAllocationJson: string;
  projectedAllocationJson: string;
  riskReduction: number;
  expectedReturnChange: number;
  volatilityChange: number;
  metadataJson: string;
  createdAt: Date;
};

type ScenarioDefinition = {
  type: ScenarioType;
  name: string;
  returnShock: number;
  volatilityFactor: number;
  drawdownShock: number;
  concentrationFactor: number;
  explanation: string;
};

const SCENARIO_DEFINITIONS: ScenarioDefinition[] = [
  {
    type: 'bull_market',
    name: 'Bull Market Expansion',
    returnShock: 16,
    volatilityFactor: 0.85,
    drawdownShock: -6,
    concentrationFactor: 0.6,
    explanation: 'Risk assets benefit from rising prices while drawdown pressure stays controlled.'
  },
  {
    type: 'bear_market',
    name: 'Bear Market Shock',
    returnShock: -18,
    volatilityFactor: 1.35,
    drawdownShock: -24,
    concentrationFactor: 1.1,
    explanation: 'Broad market stress penalizes concentrated positions and weak cash buffers.'
  },
  {
    type: 'high_volatility',
    name: 'High Volatility Regime',
    returnShock: -6,
    volatilityFactor: 1.65,
    drawdownShock: -18,
    concentrationFactor: 0.95,
    explanation: 'Choppy markets increase forecast volatility even if expected return only falls moderately.'
  },
  {
    type: 'interest_rate_shock',
    name: 'Interest Rate Shock',
    returnShock: -10,
    volatilityFactor: 1.25,
    drawdownShock: -15,
    concentrationFactor: 0.85,
    explanation: 'Rate-sensitive growth and long-duration exposure are stressed while cash has a stabilizing role.'
  },
  {
    type: 'sector_selloff',
    name: 'Sector Selloff',
    returnShock: -14,
    volatilityFactor: 1.3,
    drawdownShock: -20,
    concentrationFactor: 1.25,
    explanation: 'A focused selloff tests the largest symbol and asset-type concentration in the portfolio.'
  },
  {
    type: 'tech_crash',
    name: 'Tech Crash',
    returnShock: -22,
    volatilityFactor: 1.55,
    drawdownShock: -28,
    concentrationFactor: 1.35,
    explanation: 'Growth-heavy symbols are stressed with a larger drawdown and slower recovery assumption.'
  },
  {
    type: 'options_assignment_stress',
    name: 'Options Assignment Stress',
    returnShock: -8,
    volatilityFactor: 1.45,
    drawdownShock: -16,
    concentrationFactor: 1,
    explanation: 'Options collateral, assignment probability, and premium efficiency are stressed together.'
  }
];

export async function runScenarioSimulation(
  userId: string,
  payload: {
    scenarioType?: ScenarioType;
    portfolioMode?: PortfolioMode;
    period?: AnalyticsPeriod;
    benchmark?: AnalyticsBenchmark;
  } = {}
) {
  if (process.env.SCENARIO_SIMULATION_ENABLED === 'false') {
    throw new Error('Scenario simulation is disabled by SCENARIO_SIMULATION_ENABLED=false.');
  }

  await enforceDailyRunLimit(userId);

  const scenarioType = payload.scenarioType ?? 'bear_market';
  const portfolioMode = payload.portfolioMode ?? 'hybrid';
  const period = payload.period ?? 'MAX';
  const benchmark = payload.benchmark ?? 'SPY';
  const context = await buildAiPortfolioContext(userId, { period, benchmark });
  const optionsRisk = portfolioMode !== 'stock' ? await getOptionsRiskAnalysis(userId, { period, benchmark }) : null;
  const selected = scenarioType === 'bear_market'
    ? SCENARIO_DEFINITIONS
    : SCENARIO_DEFINITIONS.filter((definition) => definition.type === scenarioType);

  const runId = randomUUID();
  const metadata = {
    version: SCENARIO_SIMULATION_VERSION,
    period,
    benchmark,
    contextHash: context.metadata.contextHash,
    optionsRisk,
    guardrail: 'Simulation only. No trade, rebalance, option roll, or order placement is executed.'
  };

  await prisma.$executeRaw`
    INSERT INTO simulation_runs (id, user_id, scenario_type, portfolio_mode, status, metadata, created_at, updated_at)
    VALUES (${runId}, ${userId}, ${scenarioType}, ${portfolioMode}, 'completed', ${JSON.stringify(metadata)}, NOW(), NOW())
  `;

  const results = selected.map((definition) => buildScenarioResult(context, definition, portfolioMode, optionsRisk));
  for (const result of results) {
    await prisma.$executeRaw`
      INSERT INTO simulation_results
        (id, simulation_run_id, scenario_name, projected_return, projected_volatility, projected_drawdown, allocation_json, risk_summary_json, metadata, created_at, updated_at)
      VALUES
        (${randomUUID()}, ${runId}, ${result.scenarioName}, ${result.projectedReturn}, ${result.projectedVolatility}, ${result.projectedDrawdown},
         ${JSON.stringify(result.allocation)}, ${JSON.stringify(result.riskSummary)}, ${JSON.stringify(result.metadata)}, NOW(), NOW())
    `;
  }

  return {
    run: (await getSimulationRun(runId))!,
    results: await getSimulationResults(userId, { runId })
  };
}

export async function getSimulationResults(
  userId: string,
  options: { runId?: string; limit?: number } = {}
) {
  const run = options.runId ? { id: options.runId } : await getLatestSimulationRun(userId);
  if (!run) return [];
  const limit = options.limit ?? 20;
  const rows = await prisma.$queryRaw<SimulationResultRow[]>`
    SELECT
      sr.id,
      sr.simulation_run_id AS simulationRunId,
      sr.scenario_name AS scenarioName,
      sr.projected_return AS projectedReturn,
      sr.projected_volatility AS projectedVolatility,
      sr.projected_drawdown AS projectedDrawdown,
      sr.allocation_json AS allocationJson,
      sr.risk_summary_json AS riskSummaryJson,
      sr.metadata AS metadataJson,
      sr.created_at AS createdAt
    FROM simulation_results sr
    INNER JOIN simulation_runs r ON r.id = sr.simulation_run_id
    WHERE r.user_id = ${userId} AND sr.simulation_run_id = ${run.id}
    ORDER BY sr.projected_drawdown ASC
    LIMIT ${limit}
  `;
  return rows.map(mapSimulationResultRow);
}

type CacheRow = { dataJson: string };

async function readStressTestCache(userId: string, portfolioMode: string) {
  const rows = await prisma.$queryRaw<CacheRow[]>`
    SELECT data_json AS dataJson FROM stress_test_cache
    WHERE user_id = ${userId} AND portfolio_mode = ${portfolioMode}
    ORDER BY created_at DESC LIMIT 1
  `;
  if (!rows[0]) return null;
  try { return JSON.parse(rows[0].dataJson); } catch { return null; }
}

export async function saveStressTestCache(userId: string, portfolioMode: string, data: unknown) {
  return writeStressTestCache(userId, portfolioMode, data);
}

async function writeStressTestCache(userId: string, portfolioMode: string, data: unknown) {
  await prisma.$executeRaw`DELETE FROM stress_test_cache WHERE user_id = ${userId} AND portfolio_mode = ${portfolioMode}`;
  await prisma.$executeRaw`
    INSERT INTO stress_test_cache (id, user_id, portfolio_mode, data_json, created_at, updated_at)
    VALUES (${randomUUID()}, ${userId}, ${portfolioMode}, ${JSON.stringify(data)}, NOW(), NOW())
  `;
}

async function readProjectionCache(userId: string, portfolioMode: string) {
  const rows = await prisma.$queryRaw<CacheRow[]>`
    SELECT data_json AS dataJson FROM portfolio_projection_cache
    WHERE user_id = ${userId} AND portfolio_mode = ${portfolioMode}
    ORDER BY created_at DESC LIMIT 1
  `;
  if (!rows[0]) return null;
  try { return JSON.parse(rows[0].dataJson) as PortfolioProjection; } catch { return null; }
}

export async function savePortfolioProjectionCache(userId: string, portfolioMode: string, data: PortfolioProjection) {
  return writeProjectionCache(userId, portfolioMode, data);
}

async function writeProjectionCache(userId: string, portfolioMode: string, data: PortfolioProjection) {
  await prisma.$executeRaw`DELETE FROM portfolio_projection_cache WHERE user_id = ${userId} AND portfolio_mode = ${portfolioMode}`;
  await prisma.$executeRaw`
    INSERT INTO portfolio_projection_cache (id, user_id, portfolio_mode, data_json, created_at, updated_at)
    VALUES (${randomUUID()}, ${userId}, ${portfolioMode}, ${JSON.stringify(data)}, NOW(), NOW())
  `;
}

export async function getStressTest(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark; portfolioMode?: PortfolioMode; skipCache?: boolean } = {}
) {
  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const portfolioMode = options.portfolioMode ?? 'hybrid';

  if (!options.skipCache) {
    const cached = await readStressTestCache(userId, portfolioMode);
    if (cached) return cached;
  }
  const [context, optionsRisk] = await Promise.all([
    buildAiPortfolioContext(userId, { period, benchmark }),
    portfolioMode === 'stock' ? Promise.resolve(null) : getOptionsRiskAnalysis(userId, { period, benchmark })
  ]);
  const scenarios = SCENARIO_DEFINITIONS
    .filter((definition) => definition.type !== 'bull_market')
    .map((definition) => buildScenarioResult(context, definition, portfolioMode, optionsRisk));
  const worst = [...scenarios].sort((a, b) => a.projectedDrawdown - b.projectedDrawdown)[0] ?? null;
  return {
    generated_at: new Date().toISOString(),
    period,
    benchmark,
    portfolio_mode: portfolioMode,
    scenarios,
    worst_case: worst,
    widgets: [
      { label: 'Stress Test Result', value: worst ? worst.riskSummary.risk_level.toUpperCase() : 'N/A', status: worst?.riskSummary.risk_level ?? 'medium' },
      { label: 'Projected Drawdown', value: worst ? `${worst.projectedDrawdown.toFixed(2)}%` : '0.00%', status: worst?.riskSummary.risk_level ?? 'medium' },
      { label: 'Volatility Forecast', value: `${round(Math.max(...scenarios.map((scenario) => scenario.projectedVolatility), 0)).toFixed(2)}%`, status: 'medium' },
      { label: 'Scenario Risk Score', value: worst ? `${worst.riskSummary.scenario_risk_score}/100` : '0/100', status: worst?.riskSummary.risk_level ?? 'medium' }
    ],
    ai_explanation: worst
      ? `The harshest simulated case is ${worst.scenarioName}, with projected drawdown of ${worst.projectedDrawdown.toFixed(2)}% and risk score ${worst.riskSummary.scenario_risk_score}/100.`
      : 'No stress scenarios are available yet.',
    guardrail: 'Stress testing is analytical only. It does not execute trades.'
  };
}

export async function getPortfolioProjection(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark; portfolioMode?: PortfolioMode; skipCache?: boolean } = {}
): Promise<PortfolioProjection> {
  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const portfolioMode = options.portfolioMode ?? 'hybrid';

  if (!options.skipCache) {
    const cached = await readProjectionCache(userId, portfolioMode);
    if (cached) return cached;
  }
  const [context, premium] = await Promise.all([
    buildAiPortfolioContext(userId, { period, benchmark }),
    portfolioMode === 'stock' ? Promise.resolve(null) : getPremiumAnalytics(userId, { period, benchmark })
  ]);
  // Options premium "annualized yield" is computed from short-dated premium and
  // is NOT a sustainable long-term return: it assumes every position is reopened
  // indefinitely and ignores assignment losses. Compounding it over 5 years gives
  // absurd, over-optimistic targets. So discount it heavily and cap its
  // contribution to a realistic sustainable rate before projecting.
  const stockReturn = baselineReturn(context);
  const rawPremiumYield = portfolioMode !== 'stock' ? Math.max(0, premium?.average_annualized_yield ?? 0) : 0;
  // Assume ~25% of the headline annualized yield is realistically repeatable, cap 12%/yr.
  const premiumYield = Math.min(rawPremiumYield * 0.25, 12);
  const annualReturn = clamp(stockReturn + premiumYield, -20, 25);
  const volatility = Math.max(context.risk.volatilityPct, 6);
  const baseValue = Math.max(0, context.portfolio.value);
  const horizons = [
    { label: '1 Year', months: 12 },
    { label: '3 Years', months: 36 },
    { label: '5 Years', months: 60 }
  ];
  const points = horizons.map((horizon) => {
    const yearShare = horizon.months / 12;
    // Compound growth over the horizon — simple interest understates long-term returns
    const compoundFactor = Math.pow(1 + annualReturn / 100, yearShare);
    const expectedValue = baseValue * compoundFactor;
    // Volatility band scales with √time (standard deviation of cumulative returns)
    const volBand = volatility * Math.sqrt(yearShare);
    return {
      label: horizon.label,
      months: horizon.months,
      expectedValue: round(expectedValue),
      downsideValue: round(expectedValue * (1 - volBand / 100)),
      upsideValue: round(expectedValue * (1 + volBand / 100)),
      expectedReturnPct: round((compoundFactor - 1) * 100),
      projectedDrawdownPct: round(Math.min(context.risk.maxDrawdownPct, -Math.abs(volBand * 0.7))),
      volatilityPct: round(volatility)  // annualised — constant across horizons; volBand (√t-scaled) drives the range bands above
    };
  });
  const riskSummary = buildRiskSummary(
    'Portfolio Projection',
    annualReturn,
    volatility,
    Math.min(...points.map((point) => point.projectedDrawdownPct)),
    context,
    'Projection depends on current holdings, observed risk, and simplified volatility bands.'
  );
  return {
    generated_at: new Date().toISOString(),
    base_value: round(baseValue),
    expected_annual_return: round(annualReturn),
    expected_volatility: round(volatility),
    projected_income: round(context.performance.incomeTotal + (premium?.premium_collected ?? 0)),
    projected_options_premium: round(premium?.premium_collected ?? 0),
    points,
    risk_summary: riskSummary,
    ai_explanation: premiumYield > 0
      ? `Projection combines a ${round(stockReturn)}% stock return with a conservative ${round(premiumYield)}% sustainable options-income estimate (discounted from a headline ${round(rawPremiumYield)}% annualized yield, which assumes every option is reopened and ignores assignment) = ${round(annualReturn)}% total annual return. Based on ${context.metadata.period}/${context.metadata.benchmark} context and ${round(volatility)}% volatility.`
      : `Projection uses the current ${context.metadata.period}/${context.metadata.benchmark} context, current value ${money(baseValue)}, and a ${round(volatility)}% volatility assumption.`,
    guardrail: 'Projection is not a guarantee. Options premium income is not assured — assignment or fewer trades can lower it. No trades are placed.'
  };
}

export async function getRebalanceProjection(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark; portfolioMode?: PortfolioMode; persist?: boolean } = {}
): Promise<RebalanceProjection> {
  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const portfolioMode = options.portfolioMode ?? 'hybrid';

  if (!options.persist) {
    const stored = await getLatestRebalanceProjection(userId);
    if (stored) return stored;
  }

  const [context, constraints] = await Promise.all([
    buildAiPortfolioContext(userId, { period, benchmark }),
    getOptimizationConstraints(userId)
  ]);
  const projection = buildRebalanceProjection(context, portfolioMode, constraints);
  if (!options.persist) return projection;

  await prisma.$executeRaw`
    INSERT INTO rebalance_projections
      (id, user_id, current_allocation_json, projected_allocation_json, risk_reduction, expected_return_change, volatility_change, metadata, created_at, updated_at)
    VALUES
      (${randomUUID()}, ${userId}, ${JSON.stringify(projection.currentAllocation)}, ${JSON.stringify(projection.projectedAllocation)},
       ${projection.riskReduction}, ${projection.expectedReturnChange}, ${projection.volatilityChange}, ${JSON.stringify(projection.metadata)}, NOW(), NOW())
  `;
  return (await getLatestRebalanceProjection(userId)) ?? projection;
}

export async function simulateRebalance(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark; portfolioMode?: PortfolioMode } = {}
) {
  const projection = await getRebalanceProjection(userId, { ...options, persist: true });
  const portfolioProjection = await getPortfolioProjection(userId, options);
  return {
    status: 'completed',
    projection,
    portfolioProjection,
    ai_explanation: `Projected rebalance reduces modeled risk by ${projection.riskReduction.toFixed(2)} points and changes volatility by ${projection.volatilityChange.toFixed(2)} points. Review only; no automatic trading is enabled.`,
    guardrail: 'No order was created, queued, routed, or executed.'
  };
}

export async function getScenarioSimulationDashboard(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark; portfolioMode?: PortfolioMode } = {}
) {
  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const portfolioMode = options.portfolioMode ?? 'hybrid';
  const [latestRun, stressTest, projection, rebalanceProjection] = await Promise.all([
    getLatestSimulationRun(userId),
    getStressTest(userId, { period, benchmark, portfolioMode }),
    getPortfolioProjection(userId, { period, benchmark, portfolioMode }),
    getRebalanceProjection(userId, { period, benchmark, portfolioMode })
  ]);
  const results = latestRun
    ? await getSimulationResults(userId, { runId: latestRun.id })
    : stressTest.scenarios.slice(0, 3);

  return {
    period,
    benchmark,
    portfolioMode,
    periods: ANALYTICS_PERIODS,
    benchmarks: BENCHMARKS,
    portfolioModes: PORTFOLIO_MODES,
    scenarioTypes: SCENARIO_TYPES,
    latestRun,
    results,
    stressTest,
    projection,
    rebalanceProjection,
    widgets: [
      { label: 'Stress Test Result', value: stressTest.worst_case?.riskSummary.risk_level.toUpperCase() ?? 'N/A', status: stressTest.worst_case?.riskSummary.risk_level ?? 'medium' },
      { label: 'Projected Drawdown', value: `${stressTest.worst_case?.projectedDrawdown.toFixed(2) ?? '0.00'}%`, status: stressTest.worst_case?.riskSummary.risk_level ?? 'medium' },
      { label: 'Rebalance Improvement', value: `${rebalanceProjection.riskReduction.toFixed(2)} pts`, status: 'low' },
      { label: 'Portfolio Projection', value: money(projection.points.at(-1)?.expectedValue ?? projection.base_value), status: projection.risk_summary.risk_level },
      { label: 'Volatility Forecast', value: `${projection.expected_volatility.toFixed(2)}%`, status: projection.risk_summary.risk_level },
      { label: 'Scenario Risk Score', value: `${stressTest.worst_case?.riskSummary.scenario_risk_score ?? 0}/100`, status: stressTest.worst_case?.riskSummary.risk_level ?? 'medium' }
    ],
    aiExplanation: `Simulation combines scenario stress, portfolio projection, and rebalance projection using the ${period}/${benchmark} context. All output is suggestion-only.`
  };
}

export function parseSimulationPeriod(value: string | null) {
  return parseAiPeriod(value);
}

export function parseSimulationBenchmark(value: string | null) {
  return parseAiBenchmark(value);
}

export function parseScenarioType(value: FormDataEntryValue | string | null): ScenarioType {
  return SCENARIO_TYPES.includes(value as ScenarioType) ? (value as ScenarioType) : 'bear_market';
}

export function parseSimulationPortfolioMode(value: FormDataEntryValue | string | null): PortfolioMode {
  return PORTFOLIO_MODES.includes(value as PortfolioMode) ? (value as PortfolioMode) : 'hybrid';
}

async function enforceDailyRunLimit(userId: string) {
  const maxRuns = Number(process.env.MAX_SIMULATION_RUNS_PER_DAY ?? 20);
  if (!Number.isFinite(maxRuns) || maxRuns <= 0) return;
  const [row] = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
    FROM simulation_runs
    WHERE user_id = ${userId} AND created_at >= CURRENT_DATE()
  `;
  if (Number(row?.count ?? 0) >= maxRuns) {
    throw new Error(`Daily simulation run limit reached (${maxRuns}).`);
  }
}

async function getSimulationRun(runId: string) {
  const rows = await prisma.$queryRaw<SimulationRunRow[]>`
    SELECT
      id,
      scenario_type AS scenarioType,
      portfolio_mode AS portfolioMode,
      status,
      metadata AS metadataJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM simulation_runs
    WHERE id = ${runId}
    LIMIT 1
  `;
  return rows[0] ? mapSimulationRunRow(rows[0]) : null;
}

async function getLatestSimulationRun(userId: string) {
  const rows = await prisma.$queryRaw<SimulationRunRow[]>`
    SELECT
      id,
      scenario_type AS scenarioType,
      portfolio_mode AS portfolioMode,
      status,
      metadata AS metadataJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM simulation_runs
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ? mapSimulationRunRow(rows[0]) : null;
}

async function getLatestRebalanceProjection(userId: string) {
  const rows = await prisma.$queryRaw<RebalanceProjectionRow[]>`
    SELECT
      id,
      current_allocation_json AS currentAllocationJson,
      projected_allocation_json AS projectedAllocationJson,
      risk_reduction AS riskReduction,
      expected_return_change AS expectedReturnChange,
      volatility_change AS volatilityChange,
      metadata AS metadataJson,
      created_at AS createdAt
    FROM rebalance_projections
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ? mapRebalanceProjectionRow(rows[0]) : null;
}

function buildScenarioResult(
  context: AiPortfolioContext,
  definition: ScenarioDefinition,
  portfolioMode: PortfolioMode,
  optionsRisk: Awaited<ReturnType<typeof getOptionsRiskAnalysis>> | null
): ScenarioSimulationResult {
  const concentrationPenalty = Math.max(0, context.risk.concentrationRiskPct - 20) * 0.08 * definition.concentrationFactor;
  const cashBuffer = Math.min(context.portfolio.cashRatio, 20) * 0.08;
  const optionsPenalty = portfolioMode !== 'stock' && definition.type === 'options_assignment_stress'
    ? (optionsRisk?.assignment_risk_score ?? 0) * 0.05
    : 0;
  const expectedReturn = round(baselineReturn(context) + definition.returnShock - concentrationPenalty - optionsPenalty + cashBuffer);
  const volatility = round(Math.max(4, context.risk.volatilityPct * definition.volatilityFactor + concentrationPenalty * 0.35 + optionsPenalty * 0.5));
  const drawdown = round(Math.min(-1, definition.drawdownShock - concentrationPenalty * 0.75 - optionsPenalty));
  const allocation = buildStressedAllocation(context, definition, portfolioMode);
  return {
    scenarioName: definition.name,
    projectedReturn: expectedReturn,
    projectedVolatility: volatility,
    projectedDrawdown: drawdown,
    allocation,
    riskSummary: buildRiskSummary(definition.name, expectedReturn, volatility, drawdown, context, definition.explanation),
    metadata: {
      version: SCENARIO_SIMULATION_VERSION,
      scenarioType: definition.type,
      portfolioMode,
      concentrationPenalty: round(concentrationPenalty),
      optionsPenalty: round(optionsPenalty),
      guardrail: 'Scenario simulation only. No automatic trading.'
    }
  };
}

function buildStressedAllocation(
  context: AiPortfolioContext,
  definition: ScenarioDefinition,
  portfolioMode: PortfolioMode
): SimulationAllocation[] {
  const rows: SimulationAllocation[] = context.allocation.bySymbol.length
    ? context.allocation.bySymbol.slice(0, 10).map((slice, index) => {
        const isLargest = index === 0;
        const shockImpact = allocationShock(slice.label, slice.percentage, definition, isLargest);
        return {
          label: slice.label,
          currentPct: round(slice.percentage),
          projectedPct: round(clamp(slice.percentage + shockImpact, 0, 100)),
          deltaPct: round(shockImpact),
          shockImpactPct: round(shockImpact),
          role: 'holding' as const
        };
      })
    : [{ label: 'Cash', currentPct: 100, projectedPct: 100, deltaPct: 0, shockImpactPct: 0, role: 'cash' as const }];

  const cashShock = definition.returnShock < 0 ? Math.min(8, Math.abs(definition.returnShock) * 0.15) : -Math.min(3, definition.returnShock * 0.08);
  rows.push({
    label: 'Cash Buffer Effect',
    currentPct: round(context.portfolio.cashRatio),
    projectedPct: round(clamp(context.portfolio.cashRatio + cashShock, 0, 100)),
    deltaPct: round(cashShock),
    shockImpactPct: round(cashShock),
    role: 'cash'
  });

  if (portfolioMode !== 'stock') {
    rows.push({
      label: 'Options Risk Sleeve',
      currentPct: 0,
      projectedPct: definition.type === 'options_assignment_stress' ? 6 : 2,
      deltaPct: definition.type === 'options_assignment_stress' ? 6 : 2,
      shockImpactPct: definition.type === 'options_assignment_stress' ? -6 : -2,
      role: 'options'
    });
  }

  return normalizeProjected(rows);
}

function allocationShock(label: string, percentage: number, definition: ScenarioDefinition, isLargest: boolean) {
  const upper = label.toUpperCase();
  const growthLike = upper.includes('QQQ') || upper.includes('NVDA') || upper.includes('TSLA') || upper.includes('META') || upper.includes('AAPL') || upper.includes('MSFT');
  const base = definition.returnShock / 12;
  const concentration = isLargest ? -Math.abs(definition.drawdownShock) * 0.08 * definition.concentrationFactor : 0;
  const tech = definition.type === 'tech_crash' && growthLike ? -8 : 0;
  const bull = definition.type === 'bull_market' ? Math.min(5, percentage * 0.08) : 0;
  return round(base + concentration + tech + bull);
}

function normalizeProjected(rows: SimulationAllocation[]) {
  const total = rows.reduce((sum, row) => sum + row.projectedPct, 0);
  if (total <= 0) return rows;
  return rows.map((row) => {
    const projectedPct = round((row.projectedPct / total) * 100);
    return { ...row, projectedPct, deltaPct: round(projectedPct - row.currentPct) };
  });
}

function buildRebalanceProjection(
  context: AiPortfolioContext,
  portfolioMode: PortfolioMode,
  constraints: OptimizationConstraintSet
): RebalanceProjection {
  // Exclude option contracts (negative market value / ticker matches option pattern).
  // They appear as liabilities in bySymbol and must not be shown as holdings to reduce.
  const isOptionTicker = (label: string) => /\d{6}[CP]\d+/.test(label);
  const currentAllocation = context.allocation.bySymbol.length
    ? context.allocation.bySymbol
        .filter((slice) => slice.percentage > 0 && !isOptionTicker(slice.label))
        .map((slice) => ({ label: slice.label, percentage: round(slice.percentage) }))
    : [{ label: 'Cash', percentage: 100 }];

  // Stocks used as covered call or CSP underlyings must not be capped — they are collateral.
  const optionUnderlyings = new Set(
    context.portfolio.holdings
      .filter((h) => h.assetType === 'option')
      .map((h) => h.symbol.replace(/^US\./, '').match(/^([A-Z]+)\d{6}[CP]/)?.[1])
      .filter((s): s is string => !!s)
  );

  const cap = constraints.singleStockMaxPct;
  const projected: SimulationAllocation[] = currentAllocation.map((row) => {
    const sym = row.label.replace(/^US\./, '').match(/^([A-Z]+)/)?.[1] ?? row.label;
    const isUnderlying = optionUnderlyings.has(sym);
    const target = isUnderlying ? row.percentage : Math.min(row.percentage, cap);
    return {
      label: row.label,
      currentPct: row.percentage,
      projectedPct: round(target),
      deltaPct: round(target - row.percentage),
      shockImpactPct: 0,
      role: (isUnderlying ? 'options' : 'holding') as SimulationAllocation['role']
    };
  });

  const freed = round(projected.reduce((sum, row) => sum + Math.max(0, row.currentPct - row.projectedPct), 0));

  if (freed > 0.1) {
    const stockFraction = clamp(constraints.hybridStockPct, 0, 100) / 100;
    const optionsFraction = 1 - stockFraction;
    if (portfolioMode === 'stock') {
      projected.push({ label: 'Diversified Core Basket', currentPct: 0, projectedPct: round(freed * 0.7), deltaPct: round(freed * 0.7), shockImpactPct: 0, role: 'core' });
      projected.push({ label: 'Defensive ETF Sleeve', currentPct: 0, projectedPct: round(freed * 0.2), deltaPct: round(freed * 0.2), shockImpactPct: 0, role: 'defensive' });
      projected.push({ label: 'Cash Reserve', currentPct: round(context.portfolio.cashRatio), projectedPct: round(freed * 0.1), deltaPct: round(freed * 0.1), shockImpactPct: 0, role: 'cash' });
    } else if (portfolioMode === 'hybrid') {
      projected.push({ label: 'Diversified Core Basket', currentPct: 0, projectedPct: round(freed * stockFraction), deltaPct: round(freed * stockFraction), shockImpactPct: 0, role: 'core' });
      projected.push({ label: 'Options Income Sleeve', currentPct: 0, projectedPct: round(freed * optionsFraction), deltaPct: round(freed * optionsFraction), shockImpactPct: 0, role: 'options' });
    } else {
      projected.push({ label: 'Diversified Core Basket', currentPct: 0, projectedPct: round(freed * 0.2), deltaPct: round(freed * 0.2), shockImpactPct: 0, role: 'core' });
      projected.push({ label: 'Options Income Sleeve', currentPct: 0, projectedPct: round(freed * 0.8), deltaPct: round(freed * 0.8), shockImpactPct: 0, role: 'options' });
    }
  }

  const currentVol = Math.max(context.risk.volatilityPct, 8);
  const diversificationGain = freed > 0 ? freed * 0.018 : 0;
  const projectedVol = round(Math.max(currentVol * 0.7, currentVol - diversificationGain));
  const riskReduction = round(Math.max(0, currentVol - projectedVol + Math.max(0, context.risk.concentrationRiskPct - cap) * 0.15));
  const expectedReturnChange = freed > 0
    ? round(portfolioMode === 'options' ? freed * 0.02 : portfolioMode === 'hybrid' ? freed * 0.01 : freed * 0.005)
    : 0;

  return {
    currentAllocation,
    projectedAllocation: normalizeProjected(projected),
    riskReduction,
    expectedReturnChange,
    volatilityChange: round(projectedVol - currentVol),
    metadata: {
      version: SCENARIO_SIMULATION_VERSION,
      portfolioMode,
      currentVolatility: round(currentVol),
      projectedVolatility: projectedVol,
      ai_explanation: freed > 0
        ? `Rebalance caps oversized holdings at the ${cap}% constraint and redirects freed capital into ${portfolioMode === 'stock' ? 'diversified stock and defensive' : portfolioMode === 'hybrid' ? 'stock and options income' : 'options income'} sleeves. Option underlyings are preserved.`
        : 'No concentration trim needed — all holdings are within the single-stock constraint.',
      guardrail: 'Rebalance projection is review-only and does not execute trades.'
    }
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function buildRiskSummary(
  scenarioName: string,
  projectedReturn: number,
  projectedVolatility: number,
  projectedDrawdown: number,
  context: AiPortfolioContext,
  explanation: string
): SimulationRiskSummary {
  const concentrationPenalty = Math.max(0, context.risk.concentrationRiskPct - 20) * 0.5;
  const drawdownPenalty = Math.abs(projectedDrawdown) * 2;
  const volatilityPenalty = projectedVolatility * 1.15;
  const returnOffset = Math.max(projectedReturn, 0) * 0.2;
  const score = clamp(drawdownPenalty + volatilityPenalty + concentrationPenalty - returnOffset, 0, 100);
  const riskLevel = score >= 70 ? 'high' : score >= 42 ? 'medium' : 'low';

  type Sev = 'high' | 'medium' | 'low';
  const risk_factors: SimulationRiskSummary['risk_factors'] = [];

  if (context.risk.concentrationRiskPct >= 30) {
    risk_factors.push({
      label: `${context.risk.largestHoldingSymbol || 'Largest holding'} concentration`,
      value: `${round(context.risk.concentrationRiskPct)}% of portfolio`,
      severity: (context.risk.concentrationRiskPct >= 50 ? 'high' : 'medium') as Sev
    });
  }
  if (Math.abs(projectedDrawdown) >= 10) {
    risk_factors.push({
      label: 'Projected drawdown',
      value: `${projectedDrawdown.toFixed(1)}% worst case`,
      severity: (Math.abs(projectedDrawdown) >= 25 ? 'high' : 'medium') as Sev
    });
  }
  if (projectedVolatility >= 25) {
    risk_factors.push({
      label: 'Portfolio volatility',
      value: `${round(projectedVolatility)}% annualised`,
      severity: (projectedVolatility >= 50 ? 'high' : 'medium') as Sev
    });
  }
  if (projectedReturn < 0) {
    risk_factors.push({ label: 'Negative projected return', value: `${projectedReturn.toFixed(1)}%`, severity: 'high' as Sev });
  }
  if (risk_factors.length === 0) {
    risk_factors.push({ label: 'No major risk factors detected', value: 'All checks passed', severity: 'low' as Sev });
  }

  return {
    risk_level: riskLevel,
    scenario_risk_score: round(score, 0),
    largest_risk: context.risk.largestHoldingSymbol
      ? `${context.risk.largestHoldingSymbol} at ${round(context.risk.concentrationRiskPct)}% — primary concentration risk`
      : 'Limited snapshot history and allocation concentration',
    suggested_action: riskLevel === 'high'
      ? 'Review concentration, cash reserve, and options collateral before increasing risk.'
      : riskLevel === 'medium'
        ? 'Monitor drawdown and rebalance only if allocation drift exceeds your constraints.'
        : 'Current scenario risk is controlled; keep monitoring changes in volatility.',
    ai_explanation: `${scenarioName}: ${explanation}`,
    guardrail: 'AI explanation is informational only. No automatic trading action is performed.',
    risk_factors
  };
}

function baselineReturn(context: AiPortfolioContext) {
  const candidates = [
    context.performance.cagrPct,
    context.performance.totalReturnPct,
    context.benchmark.portfolioReturnPct,
    context.benchmark.benchmarkReturnPct,
    6
  ].filter((value) => Number.isFinite(value) && value !== 0);
  return clamp(Number(candidates[0] ?? 6), -20, 24);
}

function mapSimulationRunRow(row: SimulationRunRow): ScenarioSimulationRun {
  return {
    id: row.id,
    scenarioType: row.scenarioType,
    portfolioMode: row.portfolioMode,
    status: row.status,
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapSimulationResultRow(row: SimulationResultRow): ScenarioSimulationResult {
  return {
    id: row.id,
    scenarioName: row.scenarioName,
    projectedReturn: Number(row.projectedReturn),
    projectedVolatility: Number(row.projectedVolatility),
    projectedDrawdown: Number(row.projectedDrawdown),
    allocation: parseJson<SimulationAllocation[]>(row.allocationJson, []),
    riskSummary: parseJson<SimulationRiskSummary>(row.riskSummaryJson, buildRiskSummary(row.scenarioName, 0, 0, 0, emptyContext(), 'Stored risk summary was unavailable.')),
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
    createdAt: row.createdAt.toISOString()
  };
}

function mapRebalanceProjectionRow(row: RebalanceProjectionRow): RebalanceProjection {
  return {
    id: row.id,
    currentAllocation: parseJson<Array<{ label: string; percentage: number }>>(row.currentAllocationJson, []),
    projectedAllocation: parseJson<SimulationAllocation[]>(row.projectedAllocationJson, []),
    riskReduction: Number(row.riskReduction),
    expectedReturnChange: Number(row.expectedReturnChange),
    volatilityChange: Number(row.volatilityChange),
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
    createdAt: row.createdAt.toISOString()
  };
}

function emptyContext(): AiPortfolioContext {
  return {
    metadata: {
      version: SCENARIO_SIMULATION_VERSION,
      generatedAt: new Date().toISOString(),
      userId: '',
      period: 'MAX',
      benchmark: 'SPY',
      contextHash: '',
      dataSource: 'empty',
      latestSnapshotDate: null,
      snapshotCount: 0,
      baseCurrency: 'USD'
    },
    portfolio: { value: 0, investedValue: 0, cashBalance: 0, cashRatio: 0, netContribution: 0, holdingsCount: 0, holdings: [] },
    performance: { status: 'empty', totalReturnPct: 0, dailyReturnPct: 0, mtdReturnPct: 0, ytdReturnPct: 0, cagrPct: 0, unrealizedPnl: 0, incomeTotal: 0, compressedValueSeries: [] },
    risk: { status: 'empty', healthScore: 0, healthLabel: 'watch', volatilityPct: 0, maxDrawdownPct: 0, sharpeRatio: 0, sortinoRatio: 0, concentrationRiskPct: 0, largestHoldingSymbol: '', flags: [] },
    allocation: { bySymbol: [], byAssetType: [], byCurrency: [], drift: [] },
    benchmark: {
      benchmark: 'SPY',
      status: 'insufficient_data',
      message: '',
      portfolioReturnPct: 0,
      benchmarkReturnPct: 0,
      alphaPct: 0,
      beta: 0,
      correlationPct: 0,
      relativeVolatilityPct: 0,
      relativeDrawdownPct: 0,
      outperformancePct: 0,
      outperformed: false
    },
    marketData: { source: 'moomoo_api', status: 'unavailable', checkedAt: new Date().toISOString(), holdingsQuoteCount: 0, holdingsStateCount: 0, benchmarkCode: 'US.SPY', benchmarkHistoryCount: 0, benchmarkHistoryPeriod: { start: '', end: '' }, quotes: [], marketStates: [], benchmarkCandles: [], errors: [], resolved: [] },
    income: { total: 0, byMonth: [] },
    topContributors: { gainers: [], losers: [] },
    promptHints: { missingData: [], resolvedFromMoomoo: [], observationSeeds: [], suggestedAgentOrder: [] }
  };
}

function money(value: number) {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
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
