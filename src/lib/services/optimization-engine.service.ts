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

export const OPTIMIZATION_ENGINE_VERSION = 'phase-6';

export const PORTFOLIO_MODES = ['stock', 'hybrid', 'options'] as const;
export const OPTIMIZATION_GOALS = [
  'minimum_volatility',
  'maximum_sharpe',
  'risk_parity',
  'efficient_frontier',
  'target_volatility',
  'target_income',
  'defensive_allocation'
] as const;
export const RISK_PROFILES = ['conservative', 'balanced', 'aggressive'] as const;

export type PortfolioMode = (typeof PORTFOLIO_MODES)[number];
export type OptimizationGoal = (typeof OPTIMIZATION_GOALS)[number];
export type RiskProfile = (typeof RISK_PROFILES)[number];

export type OptimizationConstraintSet = {
  singleStockMaxPct: number;
  optionsMaxPct: number;
  cashMinPct: number;
  sectorMaxPct: number;
  collateralReservePct: number;
  targetVolatilityPct: number;
  hybridStockPct: number;
};

export type OptimizationAllocation = {
  label: string;
  currentPct: number;
  targetPct: number;
  deltaPct: number;
  role: 'holding' | 'cash' | 'core' | 'defensive' | 'options';
};

export type OptimizationScenario = {
  id?: string;
  scenarioName: string;
  expectedReturn: number;
  expectedVolatility: number;
  sharpeRatio: number;
  allocation: OptimizationAllocation[];
  optionsAllocation: Array<{ label: string; percentage: number; note: string }> | null;
  metadata: Record<string, unknown>;
};

export type RebalanceSuggestion = {
  id?: string;
  title: string;
  summary: string;
  currentAllocation: Array<{ label: string; percentage: number }>;
  targetAllocation: OptimizationAllocation[];
  riskImpact: string;
  volatilityImpact: string;
  status: string;
  metadata: Record<string, unknown>;
  createdAt?: string;
};

type OptimizationRunRow = {
  id: string;
  portfolioMode: PortfolioMode;
  optimizationGoal: OptimizationGoal;
  riskProfile: RiskProfile;
  status: string;
  metadataJson: string;
  createdAt: Date;
  updatedAt: Date;
};

type OptimizationScenarioRow = {
  id: string;
  optimizationRunId: string;
  scenarioName: string;
  expectedReturn: number;
  expectedVolatility: number;
  sharpeRatio: number;
  allocationJson: string;
  optionsAllocationJson: string | null;
  metadataJson: string;
  createdAt: Date;
};

type RebalanceSuggestionRow = {
  id: string;
  title: string;
  summary: string;
  currentAllocationJson: string;
  targetAllocationJson: string;
  riskImpact: string;
  volatilityImpact: string;
  status: string;
  metadataJson: string;
  createdAt: Date;
};

const DEFAULT_CONSTRAINTS: OptimizationConstraintSet = {
  singleStockMaxPct: 15,
  optionsMaxPct: 80,
  cashMinPct: 5,
  sectorMaxPct: 35,
  collateralReservePct: 20,
  targetVolatilityPct: 18,
  hybridStockPct: 20
};

export async function getOptimizationDashboard(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark } = {}
) {
  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const latest = await getLatestOptimizationRun(userId);
  const run = latest ?? (await runOptimization(userId, { period, benchmark })).run;
  const [scenarios, rebalance, constraints, history] = await Promise.all([
    getOptimizationScenarios(userId, run.id),
    getRebalanceSuggestions(userId),
    getOptimizationConstraints(userId),
    getOptimizationHistory(userId)
  ]);

  return {
    period,
    benchmark,
    periods: ANALYTICS_PERIODS,
    benchmarks: BENCHMARKS,
    portfolioModes: PORTFOLIO_MODES,
    optimizationGoals: OPTIMIZATION_GOALS,
    riskProfiles: RISK_PROFILES,
    run,
    scenarios,
    rebalance,
    constraints,
    history,
    efficientFrontier: buildEfficientFrontierPoints(scenarios),
    riskParity: buildRiskParityRows(scenarios[0]?.allocation ?? [])
  };
}

export async function runOptimization(
  userId: string,
  payload: {
    portfolioMode?: PortfolioMode;
    optimizationGoal?: OptimizationGoal;
    riskProfile?: RiskProfile;
    period?: AnalyticsPeriod;
    benchmark?: AnalyticsBenchmark;
  } = {}
) {
  const portfolioMode = payload.portfolioMode ?? 'hybrid';
  const optimizationGoal = payload.optimizationGoal ?? 'risk_parity';
  const riskProfile = payload.riskProfile ?? 'balanced';
  const period = payload.period ?? 'MAX';
  const benchmark = payload.benchmark ?? 'SPY';
  const [context, constraints] = await Promise.all([
    buildAiPortfolioContext(userId, { period, benchmark }),
    getOptimizationConstraints(userId)
  ]);

  const runId = randomUUID();
  const metadata = {
    version: OPTIMIZATION_ENGINE_VERSION,
    period,
    benchmark,
    contextHash: context.metadata.contextHash,
    accountMode: portfolioMode === 'options' ? 'options_simulation' : 'suggestion_only',
    guardrail: 'Suggestion and scenario simulation only. No trades are executed.'
  };

  await prisma.$executeRaw`
    INSERT INTO optimization_runs (id, user_id, portfolio_mode, optimization_goal, risk_profile, status, metadata, created_at, updated_at)
    VALUES (${runId}, ${userId}, ${portfolioMode}, ${optimizationGoal}, ${riskProfile}, 'completed', ${JSON.stringify(metadata)}, NOW(), NOW())
  `;

  const scenarios = buildOptimizationScenarios(context, constraints, portfolioMode, optimizationGoal, riskProfile);
  for (const scenario of scenarios) {
    await prisma.$executeRaw`
      INSERT INTO optimization_scenarios
        (id, optimization_run_id, scenario_name, expected_return, expected_volatility, sharpe_ratio, allocation_json, options_allocation_json, metadata, created_at, updated_at)
      VALUES
        (${randomUUID()}, ${runId}, ${scenario.scenarioName}, ${scenario.expectedReturn}, ${scenario.expectedVolatility}, ${scenario.sharpeRatio},
         ${JSON.stringify(scenario.allocation)}, ${scenario.optionsAllocation ? JSON.stringify(scenario.optionsAllocation) : null},
         ${JSON.stringify(scenario.metadata)}, NOW(), NOW())
    `;
  }

  const suggestions = buildRebalanceSuggestions(context, scenarios, constraints);
  for (const suggestion of suggestions) {
    await prisma.$executeRaw`
      INSERT INTO rebalance_suggestions
        (id, user_id, snapshot_id, title, summary, current_allocation_json, target_allocation_json, risk_impact, volatility_impact, status, metadata, created_at, updated_at)
      VALUES
        (${randomUUID()}, ${userId}, ${null}, ${suggestion.title}, ${suggestion.summary}, ${JSON.stringify(suggestion.currentAllocation)},
         ${JSON.stringify(suggestion.targetAllocation)}, ${suggestion.riskImpact}, ${suggestion.volatilityImpact}, 'suggested',
         ${JSON.stringify(suggestion.metadata)}, NOW(), NOW())
    `;
  }

  const run = await getLatestOptimizationRun(userId);
  return {
    run: run!,
    scenarios: await getOptimizationScenarios(userId, runId),
    rebalance: await getRebalanceSuggestions(userId)
  };
}

export async function getOptimizationScenarios(userId: string, runId?: string) {
  const run = runId ? { id: runId } : await getLatestOptimizationRun(userId);
  if (!run) return [];
  const rows = await prisma.$queryRaw<OptimizationScenarioRow[]>`
    SELECT
      id,
      optimization_run_id AS optimizationRunId,
      scenario_name AS scenarioName,
      expected_return AS expectedReturn,
      expected_volatility AS expectedVolatility,
      sharpe_ratio AS sharpeRatio,
      allocation_json AS allocationJson,
      options_allocation_json AS optionsAllocationJson,
      metadata AS metadataJson,
      created_at AS createdAt
    FROM optimization_scenarios
    WHERE optimization_run_id = ${run.id}
    ORDER BY expected_volatility ASC
  `;
  return rows.map(mapScenarioRow);
}

export async function getRebalanceSuggestions(userId: string, limit = 8) {
  const rows = await prisma.$queryRaw<RebalanceSuggestionRow[]>`
    SELECT
      id,
      title,
      summary,
      current_allocation_json AS currentAllocationJson,
      target_allocation_json AS targetAllocationJson,
      risk_impact AS riskImpact,
      volatility_impact AS volatilityImpact,
      status,
      metadata AS metadataJson,
      created_at AS createdAt
    FROM rebalance_suggestions
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(mapSuggestionRow);
}

export async function getOptimizationConstraints(userId: string): Promise<OptimizationConstraintSet> {
  const rows = await prisma.$queryRaw<Array<{ constraintJson: string }>>`
    SELECT constraint_json AS constraintJson
    FROM optimization_constraints
    WHERE user_id = ${userId} AND constraint_key = 'default'
    LIMIT 1
  `;
  if (!rows[0]) return DEFAULT_CONSTRAINTS;
  return normalizeConstraints(parseJson<OptimizationConstraintSet>(rows[0].constraintJson, DEFAULT_CONSTRAINTS));
}

export async function saveOptimizationConstraints(userId: string, constraints: Partial<OptimizationConstraintSet>) {
  const normalized = normalizeConstraints({ ...DEFAULT_CONSTRAINTS, ...constraints });
  await prisma.$executeRaw`
    INSERT INTO optimization_constraints (id, user_id, constraint_key, constraint_json, created_at, updated_at)
    VALUES (${randomUUID()}, ${userId}, 'default', ${JSON.stringify(normalized)}, NOW(), NOW())
    ON DUPLICATE KEY UPDATE constraint_json = VALUES(constraint_json), updated_at = NOW()
  `;
  return normalized;
}

export async function getUserPortfolioMode(userId: string): Promise<PortfolioMode> {
  const rows = await prisma.$queryRaw<Array<{ portfolioMode: string }>>`
    SELECT portfolioMode FROM \`user\` WHERE id = ${userId} LIMIT 1
  `;
  return parsePortfolioMode(rows[0]?.portfolioMode);
}

export async function saveUserPortfolioMode(userId: string, mode: PortfolioMode): Promise<PortfolioMode> {
  await prisma.$executeRaw`
    UPDATE \`user\` SET portfolioMode = ${mode}, updatedAt = NOW() WHERE id = ${userId}
  `;
  return mode;
}

export async function getOptimizationHistory(userId: string, limit = 10) {
  const rows = await prisma.$queryRaw<OptimizationRunRow[]>`
    SELECT
      id,
      portfolio_mode AS portfolioMode,
      optimization_goal AS optimizationGoal,
      risk_profile AS riskProfile,
      status,
      metadata AS metadataJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM optimization_runs
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  return rows.map(mapRunRow);
}

export function parseOptimizationPeriod(value: string | null) {
  return parseAiPeriod(value);
}

export function parseOptimizationBenchmark(value: string | null) {
  return parseAiBenchmark(value);
}

export function parsePortfolioMode(value: FormDataEntryValue | string | null): PortfolioMode {
  return PORTFOLIO_MODES.includes(value as PortfolioMode) ? (value as PortfolioMode) : 'hybrid';
}

export function parseOptimizationGoal(value: FormDataEntryValue | string | null): OptimizationGoal {
  return OPTIMIZATION_GOALS.includes(value as OptimizationGoal) ? (value as OptimizationGoal) : 'risk_parity';
}

export function parseRiskProfile(value: FormDataEntryValue | string | null): RiskProfile {
  return RISK_PROFILES.includes(value as RiskProfile) ? (value as RiskProfile) : 'balanced';
}

async function getLatestOptimizationRun(userId: string) {
  const rows = await prisma.$queryRaw<OptimizationRunRow[]>`
    SELECT
      id,
      portfolio_mode AS portfolioMode,
      optimization_goal AS optimizationGoal,
      risk_profile AS riskProfile,
      status,
      metadata AS metadataJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM optimization_runs
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT 1
  `;
  return rows[0] ? mapRunRow(rows[0]) : null;
}

function buildOptimizationScenarios(
  context: AiPortfolioContext,
  constraints: OptimizationConstraintSet,
  mode: PortfolioMode,
  goal: OptimizationGoal,
  riskProfile: RiskProfile
): OptimizationScenario[] {
  const definitions = [
    { name: 'Conservative Scenario', risk: 'conservative' as RiskProfile, returnBoost: -0.15, volFactor: 0.62, cash: Math.max(constraints.cashMinPct, 12) },
    { name: 'Balanced Scenario', risk: 'balanced' as RiskProfile, returnBoost: 0, volFactor: 0.78, cash: Math.max(constraints.cashMinPct, 7) },
    { name: 'Aggressive Scenario', risk: 'aggressive' as RiskProfile, returnBoost: 0.18, volFactor: 0.95, cash: constraints.cashMinPct }
  ];
  return definitions.map((definition) => {
    const allocation = buildTargetAllocation(context, constraints, mode, definition.risk, definition.cash);
    const expectedVolatility = round(Math.min(context.risk.volatilityPct * definition.volFactor, constraints.targetVolatilityPct * (definition.risk === 'aggressive' ? 1.4 : 1.05)), 2);
    const baselineReturn = context.performance.cagrPct || context.performance.totalReturnPct || context.benchmark.benchmarkReturnPct || 6;
    const expectedReturn = round(Math.max(-10, baselineReturn * (1 + definition.returnBoost) + (definition.risk === riskProfile ? 0.5 : 0)), 2);
    const sharpeRatio = round(expectedVolatility > 0 ? (expectedReturn - 4) / expectedVolatility : 0, 2);
    return {
      scenarioName: definition.name,
      expectedReturn,
      expectedVolatility,
      sharpeRatio,
      allocation,
      optionsAllocation: mode === 'options' || mode === 'hybrid' ? buildOptionsAllocation(constraints, definition.risk) : null,
      metadata: {
        goal,
        riskProfile: definition.risk,
        explanation: scenarioExplanation(definition.risk, goal),
        guardrail: 'Simulation only; no order placement or automatic rebalancing.'
      }
    };
  });
}

function buildTargetAllocation(
  context: AiPortfolioContext,
  constraints: OptimizationConstraintSet,
  mode: PortfolioMode,
  riskProfile: RiskProfile,
  cashTargetPct: number
): OptimizationAllocation[] {
  // Stocks used as covered call or CSP underlyings stay in the options bucket.
  // Parse underlying symbol from option ticker: "US.NIO260522C5500" → "NIO"
  const optionUnderlyings = new Set(
    context.portfolio.holdings
      .filter((h) => h.assetType === 'option')
      .map((h) => h.symbol.replace(/^US\./, '').match(/^([A-Z]+)\d{6}[CP]/)?.[1])
      .filter((s): s is string => !!s)
  );

  const cap = riskProfile === 'aggressive' ? Math.min(30, Math.max(constraints.singleStockMaxPct, 20)) : constraints.singleStockMaxPct;
  const current = context.allocation.bySymbol.length
    ? context.allocation.bySymbol.map((slice) => {
        const sym = slice.label.replace(/^US\./, '').match(/^([A-Z]+)/)?.[1] ?? slice.label;
        const isOptionsUnderlying = optionUnderlyings.has(sym);
        return {
          label: slice.label,
          currentPct: round(slice.percentage, 2),
          targetPct: round(isOptionsUnderlying ? slice.percentage : Math.min(slice.percentage, cap), 2),
          role: (isOptionsUnderlying ? 'options' : 'holding') as OptimizationAllocation['role']
        };
      })
    : [{ label: 'Cash', currentPct: 100, targetPct: 100, role: 'cash' as const }];

  // Only free up pure stock holdings that exceed the cap — not options underlyings.
  let freed = round(current.reduce((sum, row) => (row.role !== 'options' ? sum + Math.max(0, row.currentPct - row.targetPct) : sum), 0), 2);
  const currentCash = round(context.portfolio.cashRatio, 2);
  const cashGap = Math.max(0, cashTargetPct - currentCash);
  if (cashGap > 0) {
    trimLargest(current.filter((r) => r.role !== 'options'), cashGap);
    freed += cashGap;
  }

  const sleeves: Array<{ label: string; role: OptimizationAllocation['role']; targetPct: number }> = [];
  const stockFraction = clamp(constraints.hybridStockPct, 0, 100) / 100;
  const optionsFraction = 1 - stockFraction;
  // stock mode: freed capital → core stocks + defensive sleeve
  // hybrid mode: user-configured split (default 20% stock / 80% options)
  // options mode: 20% stock core + 80% options
  const defensivePct = mode === 'stock' ? (riskProfile === 'conservative' ? freed * 0.55 : freed * 0.3) : 0;
  const corePct = mode === 'hybrid' ? freed * stockFraction : mode === 'options' ? freed * 0.2 : freed - defensivePct;
  const optionsPct = mode !== 'stock' ? Math.min(constraints.optionsMaxPct, freed * (mode === 'hybrid' ? optionsFraction : 0.8)) : 0;

  if (corePct > 0.1) sleeves.push({ label: 'Diversified Core Basket', role: 'core', targetPct: round(corePct, 2) });
  if (defensivePct > 0.1) sleeves.push({ label: 'Defensive ETF Sleeve', role: 'defensive', targetPct: round(defensivePct, 2) });
  if (optionsPct > 0.1) sleeves.push({ label: 'Options Income Sleeve', role: 'options', targetPct: round(optionsPct, 2) });
  if (cashTargetPct > currentCash) sleeves.push({ label: 'Cash Reserve', role: 'cash', targetPct: round(cashGap, 2) });

  const combined = [
    ...current.map((row) => ({ ...row, deltaPct: round(row.targetPct - row.currentPct, 2) })),
    ...sleeves.map((row) => ({ ...row, currentPct: 0, deltaPct: row.targetPct }))
  ].filter((row) => row.targetPct > 0.05 || row.currentPct > 0.05);

  return normalizeTargetTotal(combined);
}

function buildOptionsAllocation(constraints: OptimizationConstraintSet, riskProfile: RiskProfile) {
  const optionsPct = riskProfile === 'aggressive' ? constraints.optionsMaxPct : riskProfile === 'balanced' ? Math.min(15, constraints.optionsMaxPct) : Math.min(8, constraints.optionsMaxPct);
  return [
    { label: 'Collateral reserve', percentage: constraints.collateralReservePct, note: 'Capital reserved for assignment and margin safety.' },
    { label: 'Defined options risk budget', percentage: optionsPct, note: 'Scenario allocation cap for premium strategies, not an order.' },
    { label: 'Buffer cash', percentage: Math.max(0, 100 - constraints.collateralReservePct), note: 'Liquidity buffer for volatility and assignment events.' }
  ];
}

function buildRebalanceSuggestions(
  context: AiPortfolioContext,
  scenarios: OptimizationScenario[],
  constraints: OptimizationConstraintSet
): RebalanceSuggestion[] {
  const target = scenarios.find((scenario) => scenario.scenarioName.includes('Balanced')) ?? scenarios[0];
  const currentAllocation = context.allocation.bySymbol.map((slice) => ({ label: slice.label, percentage: round(slice.percentage, 2) }));
  const largest = currentAllocation[0];
  const suggestions: RebalanceSuggestion[] = [];

  if (largest && largest.percentage > constraints.singleStockMaxPct) {
    suggestions.push({
      title: `Reduce ${largest.label} concentration pressure`,
      summary: `${largest.label} is ${largest.percentage.toFixed(2)}% of visible allocation. The balanced scenario caps single-name exposure and redirects excess weight into diversified sleeves.`,
      currentAllocation,
      targetAllocation: target.allocation,
      riskImpact: `Single-name concentration is brought closer to the ${constraints.singleStockMaxPct}% constraint.`,
      volatilityImpact: `Estimated volatility moves from ${context.risk.volatilityPct.toFixed(2)}% toward ${target.expectedVolatility.toFixed(2)}% in the scenario model.`,
      status: 'suggested',
      metadata: { source: 'phase-6', guardrail: 'Review only. No trade is placed.' }
    });
  }

  if (context.portfolio.cashRatio < constraints.cashMinPct) {
    suggestions.push({
      title: 'Restore minimum cash reserve',
      summary: `Cash is ${context.portfolio.cashRatio.toFixed(2)}%, below the ${constraints.cashMinPct}% constraint used by the optimizer.`,
      currentAllocation,
      targetAllocation: target.allocation,
      riskImpact: 'A cash buffer can reduce forced selling risk during drawdowns.',
      volatilityImpact: 'Cash reserve slightly reduces scenario volatility while also lowering market exposure.',
      status: 'suggested',
      metadata: { source: 'phase-6', guardrail: 'Liquidity planning only.' }
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: 'Maintain current allocation with monitoring',
      summary: 'Current allocation does not breach the main Phase 6 default constraints. The optimizer still provides scenario targets for planning.',
      currentAllocation,
      targetAllocation: target.allocation,
      riskImpact: 'No urgent concentration constraint breach detected.',
      volatilityImpact: `Scenario volatility is estimated at ${target.expectedVolatility.toFixed(2)}%.`,
      status: 'suggested',
      metadata: { source: 'phase-6', guardrail: 'Observation and planning only.' }
    });
  }
  return suggestions;
}

function buildEfficientFrontierPoints(scenarios: OptimizationScenario[]) {
  if (!scenarios.length) return [];
  const minVol = Math.min(...scenarios.map((scenario) => scenario.expectedVolatility));
  const maxVol = Math.max(...scenarios.map((scenario) => scenario.expectedVolatility));
  return Array.from({ length: 7 }, (_, index) => {
    const risk = round(minVol + ((maxVol - minVol || 6) * index) / 6, 2);
    const expectedReturn = round((scenarios[0].expectedReturn ?? 4) + index * 0.9 - Math.max(0, index - 4) * 0.35, 2);
    return { risk, expectedReturn, label: index === 0 ? 'Min Vol' : index === 3 ? 'Balanced' : index === 6 ? 'Growth' : `Point ${index + 1}` };
  });
}

function buildRiskParityRows(allocation: OptimizationAllocation[]) {
  const holdings = allocation.filter((row) => row.role === 'holding' || row.role === 'core' || row.role === 'defensive');
  const targetContribution = holdings.length ? 100 / holdings.length : 0;
  return holdings.map((row) => ({
    label: row.label,
    targetWeightPct: row.targetPct,
    riskContributionPct: round((row.targetPct / Math.max(1, holdings.reduce((sum, item) => sum + item.targetPct, 0))) * 100, 2),
    targetContributionPct: round(targetContribution, 2)
  }));
}

function scenarioExplanation(profile: RiskProfile, goal: OptimizationGoal) {
  if (profile === 'conservative') return `Prioritizes drawdown control, cash reserve, and lower concentration under the ${goal} objective.`;
  if (profile === 'aggressive') return `Allows more growth exposure while keeping explicit concentration and options caps under the ${goal} objective.`;
  return `Balances diversification, volatility control, and return potential under the ${goal} objective.`;
}

function trimLargest(rows: Array<{ targetPct: number }>, amount: number) {
  let remaining = amount;
  for (const row of [...rows].sort((a, b) => b.targetPct - a.targetPct)) {
    if (remaining <= 0) return;
    const trim = Math.min(row.targetPct * 0.2, remaining);
    row.targetPct = round(row.targetPct - trim, 2);
    remaining = round(remaining - trim, 2);
  }
}

function normalizeTargetTotal(rows: OptimizationAllocation[]) {
  const total = rows.reduce((sum, row) => sum + row.targetPct, 0);
  if (total <= 0) return rows;
  return rows.map((row) => {
    const targetPct = round((row.targetPct / total) * 100, 2);
    return { ...row, targetPct, deltaPct: round(targetPct - row.currentPct, 2) };
  });
}

function normalizeConstraints(input: OptimizationConstraintSet): OptimizationConstraintSet {
  return {
    singleStockMaxPct: clamp(Number(input.singleStockMaxPct) || DEFAULT_CONSTRAINTS.singleStockMaxPct, 1, 80),
    optionsMaxPct: clamp(Number(input.optionsMaxPct) || DEFAULT_CONSTRAINTS.optionsMaxPct, 0, 100),
    cashMinPct: clamp(Number(input.cashMinPct) || DEFAULT_CONSTRAINTS.cashMinPct, 0, 60),
    sectorMaxPct: clamp(Number(input.sectorMaxPct) || DEFAULT_CONSTRAINTS.sectorMaxPct, 5, 90),
    collateralReservePct: clamp(Number(input.collateralReservePct) || DEFAULT_CONSTRAINTS.collateralReservePct, 0, 100),
    targetVolatilityPct: clamp(Number(input.targetVolatilityPct) || DEFAULT_CONSTRAINTS.targetVolatilityPct, 1, 120),
    hybridStockPct: clamp(Number(input.hybridStockPct) || DEFAULT_CONSTRAINTS.hybridStockPct, 0, 100)
  };
}

function mapRunRow(row: OptimizationRunRow) {
  return {
    id: row.id,
    portfolioMode: row.portfolioMode,
    optimizationGoal: row.optimizationGoal,
    riskProfile: row.riskProfile,
    status: row.status,
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapScenarioRow(row: OptimizationScenarioRow): OptimizationScenario {
  return {
    id: row.id,
    scenarioName: row.scenarioName,
    expectedReturn: Number(row.expectedReturn),
    expectedVolatility: Number(row.expectedVolatility),
    sharpeRatio: Number(row.sharpeRatio),
    allocation: parseJson<OptimizationAllocation[]>(row.allocationJson, []),
    optionsAllocation: row.optionsAllocationJson ? parseJson<Array<{ label: string; percentage: number; note: string }>>(row.optionsAllocationJson, []) : null,
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {})
  };
}

function mapSuggestionRow(row: RebalanceSuggestionRow): RebalanceSuggestion {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    currentAllocation: parseJson<Array<{ label: string; percentage: number }>>(row.currentAllocationJson, []),
    targetAllocation: parseJson<OptimizationAllocation[]>(row.targetAllocationJson, []),
    riskImpact: row.riskImpact,
    volatilityImpact: row.volatilityImpact,
    status: row.status,
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
