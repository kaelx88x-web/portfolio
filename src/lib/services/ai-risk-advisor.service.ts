import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '$lib/server/db';
import { getActiveBrokerAccId } from '$lib/server/active-account';
import {
  buildAiPortfolioContext,
  parseAiBenchmark,
  parseAiPeriod,
  type AiPortfolioContext
} from '$lib/services/ai-context.service';
import type { AnalyticsBenchmark, AnalyticsPeriod } from '$lib/services/analytics.service';

export const AI_RISK_ADVISOR_VERSION = 'phase-5C';

export const RISK_EXPLANATION_TYPES = [
  'risk',
  'volatility',
  'concentration',
  'drawdown',
  'exposure',
  'stress_analysis'
] as const;

export type RiskExplanationType = (typeof RISK_EXPLANATION_TYPES)[number];
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';
export type RiskAccountMode = 'read_only_real' | 'sandbox_paper';

export type RiskAdvisorResponse = {
  type: RiskExplanationType;
  risk_level: string;
  title: string;
  summary: string;
  main_risk_drivers: string[];
  warnings: string[];
  safer_considerations: string[];
  educational_note: string;
  account_mode: RiskAccountMode;
  confidence: 'low' | 'medium' | 'high';
  source_contexts: string[];
  missing_data: string[];
  generated_at: string;
};

export type RiskAlert = {
  alert_type: string;
  severity: RiskSeverity;
  message: string;
  status: 'active' | 'monitoring';
  metadata: Record<string, unknown>;
};

export type ConcentrationRow = {
  label: string;
  type: string;
  allocationPct: number;
  severity: RiskSeverity;
  explanation: string;
};

export type ExposureSlice = {
  label: string;
  value: number;
  percentage: number;
  riskLevel: RiskSeverity;
};

export type StressScenario = {
  scenario: string;
  shockPct: number;
  estimatedImpactPct: number;
  explanation: string;
  warning: string;
};

type RiskNarrativeRow = {
  id: string;
  riskLevel: string;
  summary: string;
  narrative: string;
  warningsJson: string;
  metadataJson: string;
  createdAt: Date;
};

type RiskExplanationRow = {
  id: string;
  explanationType: RiskExplanationType;
  question: string;
  responseJson: string;
  contextHash: string;
  metadataJson: string;
  createdAt: Date;
};

type CacheRow = {
  payloadJson: string;
  generatedAt: Date;
  expiresAt: Date;
};

export async function getRiskAdvisorOverview(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark; forceRefresh?: boolean; brokerAccId?: string | null } = {}
) {
  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const brokerAccId =
    options.brokerAccId === undefined ? await getActiveBrokerAccId(userId) : options.brokerAccId;
  const [summary, volatility, concentration, drawdown, exposure, stressAnalysis, recentExplanations] = await Promise.all([
    getRiskAdvisorSection(userId, 'risk', { period, benchmark, brokerAccId, forceRefresh: options.forceRefresh }),
    getRiskAdvisorSection(userId, 'volatility', { period, benchmark, brokerAccId, forceRefresh: options.forceRefresh }),
    getRiskAdvisorSection(userId, 'concentration', { period, benchmark, brokerAccId, forceRefresh: options.forceRefresh }),
    getRiskAdvisorSection(userId, 'drawdown', { period, benchmark, brokerAccId, forceRefresh: options.forceRefresh }),
    getRiskAdvisorSection(userId, 'exposure', { period, benchmark, brokerAccId, forceRefresh: options.forceRefresh }),
    getRiskAdvisorSection(userId, 'stress_analysis', { period, benchmark, brokerAccId, forceRefresh: options.forceRefresh }),
    listRiskExplanations(userId, 8)
  ]);
  const context = await buildAiPortfolioContext(userId, { period, benchmark, brokerAccId });
  const alerts = await generateAndStoreRiskAlerts(userId, context, options.forceRefresh ?? false);
  const narrative = await getOrCreateRiskNarrative(userId, context, alerts, options.forceRefresh ?? false);

  return {
    narrative,
    summary,
    volatility,
    concentration,
    drawdown,
    exposure,
    stressAnalysis,
    alerts,
    concentrationTable: buildConcentrationTable(context),
    exposureSlices: buildExposureSlices(context),
    stressScenarios: buildStressScenarios(context),
    heatmap: buildRiskHeatmap(context),
    suggestedQuestions: suggestedRiskQuestions(context),
    recentExplanations
  };
}

export async function getRiskAdvisorSection(
  userId: string,
  type: RiskExplanationType,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark; forceRefresh?: boolean; brokerAccId?: string | null } = {}
) {
  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const brokerAccId =
    options.brokerAccId === undefined ? await getActiveBrokerAccId(userId) : options.brokerAccId;
  const cacheKey = riskAdvisorCacheKey(userId, type, period, benchmark, brokerAccId);

  if (!options.forceRefresh) {
    const cached = await readRiskAdvisorCache(cacheKey);
    if (cached) return parseJson<RiskAdvisorResponse>(cached.payloadJson, fallbackRiskResponse(type));
  }

  const context = await buildAiPortfolioContext(userId, { period, benchmark, brokerAccId });
  const response = buildRiskResponse(type, context);
  await Promise.all([
    writeRiskAdvisorCache(userId, cacheKey, type, response),
    saveRiskExplanation(userId, type, defaultQuestionForType(type), response, context)
  ]);
  return response;
}

export async function explainRiskAdvisorQuestion(
  userId: string,
  payload: { question: string; type?: RiskExplanationType; period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark; brokerAccId?: string | null }
) {
  assertQuestion(payload.question);
  const period = payload.period ?? 'MAX';
  const benchmark = payload.benchmark ?? 'SPY';
  const brokerAccId =
    payload.brokerAccId === undefined ? await getActiveBrokerAccId(userId) : payload.brokerAccId;
  const context = await buildAiPortfolioContext(userId, { period, benchmark, brokerAccId });
  const type = payload.type ?? inferRiskExplanationType(payload.question);
  const base = buildRiskResponse(type, context);
  const response: RiskAdvisorResponse = {
    ...base,
    title: 'Risk Advisor Answer',
    summary: answerRiskQuestionSummary(payload.question, type, context),
    main_risk_drivers: prioritizeRiskDrivers(payload.question, base.main_risk_drivers),
    generated_at: new Date().toISOString()
  };

  await saveRiskExplanation(userId, type, payload.question, response, context);
  return response;
}

export async function refreshRiskAdvisor(userId: string, options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark } = {}) {
  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const overview = await getRiskAdvisorOverview(userId, { period, benchmark, forceRefresh: true });
  return {
    refreshedAt: new Date().toISOString(),
    contextHash: overview.summary.source_contexts[0]?.replace('portfolio:', ''),
    sections: RISK_EXPLANATION_TYPES,
    alerts: overview.alerts.length
  };
}

export function parseRiskAdvisorPeriod(value: string | null) {
  return parseAiPeriod(value);
}

export function parseRiskAdvisorBenchmark(value: string | null) {
  return parseAiBenchmark(value);
}

export function parseRiskExplanationType(value: FormDataEntryValue | string | null): RiskExplanationType {
  return RISK_EXPLANATION_TYPES.includes(value as RiskExplanationType) ? (value as RiskExplanationType) : 'risk';
}

function buildRiskResponse(type: RiskExplanationType, context: AiPortfolioContext): RiskAdvisorResponse {
  const builders: Record<RiskExplanationType, () => RiskAdvisorResponse> = {
    risk: () => buildPortfolioRiskExplanation(context),
    volatility: () => buildVolatilityExplanation(context),
    concentration: () => buildConcentrationExplanation(context),
    drawdown: () => buildDrawdownExplanation(context),
    exposure: () => buildExposureExplanation(context),
    stress_analysis: () => buildStressExplanation(context)
  };
  return builders[type]();
}

function buildPortfolioRiskExplanation(context: AiPortfolioContext): RiskAdvisorResponse {
  return riskShell('risk', context, {
    title: 'Portfolio Risk Summary',
    summary: `Portfolio risk is ${riskLevel(context)} with a ${context.risk.healthScore}/100 health score, ${formatPct(context.risk.concentrationRiskPct)} concentration risk, and ${formatPct(context.risk.volatilityPct)} volatility.`,
    main_risk_drivers: [
      `Largest holding concentration is ${formatPct(context.risk.concentrationRiskPct)} in ${context.risk.largestHoldingSymbol || 'the largest visible position'}.`,
      `Volatility is ${formatPct(context.risk.volatilityPct)} for the available return history.`,
      `Max drawdown is ${formatPct(context.risk.maxDrawdownPct)} for the available period.`,
      ...context.risk.flags.map((flag) => flag.detail)
    ].slice(0, 6),
    warnings: buildRiskWarnings(context),
    safer_considerations: saferRiskConsiderations(context),
    educational_note: 'Risk level summarizes concentration, volatility, drawdown, diversification, and missing data; it is not a trade instruction.'
  });
}

function buildVolatilityExplanation(context: AiPortfolioContext): RiskAdvisorResponse {
  const relative = context.benchmark.relativeVolatilityPct || 0;
  return riskShell('volatility', context, {
    title: 'Volatility Intelligence',
    summary: `Portfolio volatility is ${formatPct(context.risk.volatilityPct)}; benchmark-relative volatility is ${formatPct(relative)} when enough benchmark data exists.`,
    main_risk_drivers: [
      `Largest visible exposure is ${context.risk.largestHoldingSymbol || 'not available'}.`,
      `Options exposure count is ${optionCount(context)}, which can make behavior less linear.`,
      `Sharpe ratio is ${context.risk.sharpeRatio.toFixed(2)} and Sortino ratio is ${context.risk.sortinoRatio.toFixed(2)}.`,
      `Market data status is ${context.marketData.status}.`
    ],
    warnings: [
      context.risk.volatilityPct >= 40 ? 'High historical volatility can make short-term movement feel unstable.' : 'Volatility is not the only risk; concentration can still dominate outcomes.',
      ...buildRiskWarnings(context).slice(0, 2)
    ],
    safer_considerations: saferRiskConsiderations(context),
    educational_note: 'Volatility measures how much values move, not whether an investment is good or bad.'
  });
}

function buildConcentrationExplanation(context: AiPortfolioContext): RiskAdvisorResponse {
  const table = buildConcentrationTable(context);
  return riskShell('concentration', context, {
    title: 'Concentration Risk',
    summary: `Concentration risk is ${formatPct(context.risk.concentrationRiskPct)}; ${table.filter((row) => row.severity === 'high' || row.severity === 'critical').length} concentration item(s) need attention.`,
    main_risk_drivers: table.slice(0, 5).map((row) => `${row.label}: ${row.explanation}`),
    warnings: [
      context.risk.concentrationRiskPct >= 50 ? 'A single large exposure can dominate downside and upside outcomes.' : 'Concentration is present but below the highest warning threshold.',
      ...buildRiskWarnings(context).slice(0, 3)
    ],
    safer_considerations: saferRiskConsiderations(context),
    educational_note: 'Concentration can be intentional, but it should be understood because portfolio results may depend on fewer independent drivers.'
  });
}

function buildDrawdownExplanation(context: AiPortfolioContext): RiskAdvisorResponse {
  return riskShell('drawdown', context, {
    title: 'Drawdown & Downside',
    summary: `Max drawdown is ${formatPct(context.risk.maxDrawdownPct)} in the available data; downside interpretation is ${context.metadata.snapshotCount >= 3 ? 'usable' : 'limited'} because snapshot history count is ${context.metadata.snapshotCount}.`,
    main_risk_drivers: [
      `Concentration risk can amplify drawdown if ${context.risk.largestHoldingSymbol || 'the largest exposure'} moves sharply.`,
      `Volatility is ${formatPct(context.risk.volatilityPct)}, which can widen peak-to-trough movement.`,
      `Selected-period return is ${formatPct(context.performance.totalReturnPct)}.`,
      ...context.promptHints.missingData
    ].slice(0, 6),
    warnings: [
      context.metadata.snapshotCount < 3 ? 'Drawdown analysis is limited by short portfolio history.' : 'Historical drawdown does not cap future downside.',
      ...buildRiskWarnings(context).slice(0, 3)
    ],
    safer_considerations: saferRiskConsiderations(context),
    educational_note: 'Drawdown describes the decline from a previous high. It helps frame downside behavior without predicting future losses.'
  });
}

function buildExposureExplanation(context: AiPortfolioContext): RiskAdvisorResponse {
  const slices = buildExposureSlices(context);
  return riskShell('exposure', context, {
    title: 'Exposure Intelligence',
    summary: `Exposure is led by ${slices[0]?.label ?? 'available holdings'} at ${formatPct(slices[0]?.percentage ?? 0)} across symbol, asset-type, and currency views.`,
    main_risk_drivers: slices.slice(0, 6).map((slice) => `${slice.label} ${slice.percentage.toFixed(2)}% (${slice.riskLevel} risk signal).`),
    warnings: [
      ...slices.filter((slice) => slice.riskLevel === 'high' || slice.riskLevel === 'critical').slice(0, 3).map((slice) => `${slice.label} exposure is elevated at ${formatPct(slice.percentage)}.`),
      ...buildRiskWarnings(context).slice(0, 2)
    ],
    safer_considerations: saferRiskConsiderations(context),
    educational_note: 'Exposure analysis shows where the portfolio may be sensitive by symbol, asset class, and currency.'
  });
}

function buildStressExplanation(context: AiPortfolioContext): RiskAdvisorResponse {
  const scenarios = buildStressScenarios(context);
  return riskShell('stress_analysis', context, {
    title: 'Stress Scenario Analysis',
    summary: `Stress analysis models hypothetical downside scenarios. The largest estimated scenario impact here is ${formatPct(Math.min(...scenarios.map((scenario) => scenario.estimatedImpactPct)))}.`,
    main_risk_drivers: scenarios.map((scenario) => `${scenario.scenario}: ${scenario.explanation}`),
    warnings: scenarios.map((scenario) => scenario.warning),
    safer_considerations: [
      'Use stress scenarios as planning context, not as predictions.',
      'Review whether one holding, asset class, or currency dominates the downside story.',
      'Keep position sizing and liquidity needs separate from short-term market noise.'
    ],
    educational_note: 'Stress scenarios are hypothetical. They help imagine portfolio behavior under shocks, but they do not guarantee future outcomes.'
  });
}

function riskShell(
  type: RiskExplanationType,
  context: AiPortfolioContext,
  body: Pick<RiskAdvisorResponse, 'title' | 'summary' | 'main_risk_drivers' | 'warnings' | 'safer_considerations' | 'educational_note'>
): RiskAdvisorResponse {
  return {
    type,
    risk_level: riskLevel(context),
    ...body,
    account_mode: accountMode(context),
    confidence: confidence(context),
    source_contexts: [
      `portfolio:${context.metadata.contextHash}`,
      `period:${context.metadata.period}`,
      `benchmark:${context.metadata.benchmark}`,
      `market-data:${context.marketData.status}`
    ],
    missing_data: context.promptHints.missingData,
    generated_at: new Date().toISOString()
  };
}

async function getOrCreateRiskNarrative(userId: string, context: AiPortfolioContext, alerts: RiskAlert[], forceRefresh: boolean) {
  if (!forceRefresh) {
    const [existing] = await prisma.$queryRaw<RiskNarrativeRow[]>`
      SELECT id, risk_level AS riskLevel, summary, narrative, warnings_json AS warningsJson, metadata AS metadataJson, created_at AS createdAt
      FROM ai_risk_narratives
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const metadata = parseJson<{ contextHash?: string }>(existing?.metadataJson ?? '{}', {});
    if (existing && metadata.contextHash === context.metadata.contextHash) {
      return {
        id: existing.id,
        riskLevel: existing.riskLevel,
        summary: existing.summary,
        narrative: existing.narrative,
        warnings: parseJson(existing.warningsJson, []),
        metadata,
        createdAt: existing.createdAt
      };
    }
  }

  const id = randomUUID();
  const now = new Date();
  const summary = `Risk is ${riskLevel(context)} with ${alerts.length} active AI warning(s).`;
  const narrative = [
    `Your portfolio risk profile is currently ${riskLevel(context)}.`,
    `The clearest risk driver is ${context.risk.largestHoldingSymbol || 'the largest visible exposure'}, with concentration risk at ${formatPct(context.risk.concentrationRiskPct)}.`,
    `Volatility is ${formatPct(context.risk.volatilityPct)} and max drawdown is ${formatPct(context.risk.maxDrawdownPct)} for available history.`,
    `This advisor uses calm, read-only risk education and will not place trades or trigger liquidation.`
  ].join(' ');
  const metadata = {
    contextHash: context.metadata.contextHash,
    version: AI_RISK_ADVISOR_VERSION,
    generatedAt: context.metadata.generatedAt,
    accountMode: accountMode(context)
  };

  await prisma.$executeRaw`
    INSERT INTO ai_risk_narratives (
      id, user_id, risk_level, summary, narrative, warnings_json, metadata, created_at, updated_at
    )
    VALUES (
      ${id}, ${userId}, ${riskLevel(context)}, ${summary}, ${narrative}, ${JSON.stringify(alerts.map((alert) => alert.message))},
      ${JSON.stringify(metadata)}, ${now}, ${now}
    )
  `;

  return { id, riskLevel: riskLevel(context), summary, narrative, warnings: alerts.map((alert) => alert.message), metadata, createdAt: now };
}

async function generateAndStoreRiskAlerts(userId: string, context: AiPortfolioContext, forceRefresh: boolean) {
  const alerts = buildRiskAlerts(context);
  if (!forceRefresh) {
    const existing = await listStoredRiskAlerts(userId, context.metadata.contextHash);
    if (existing.length > 0) return existing;
  }

  const expiresAt = new Date(Date.now() + riskAdvisorCacheTtlSeconds() * 1000);
  const now = new Date();
  for (const alert of alerts) {
    await prisma.$executeRaw`
      INSERT INTO ai_risk_alerts (
        id, user_id, alert_type, severity, message, status, expires_at, metadata, created_at, updated_at
      )
      VALUES (
        ${randomUUID()}, ${userId}, ${alert.alert_type}, ${alert.severity}, ${alert.message}, ${alert.status},
        ${expiresAt}, ${JSON.stringify({ ...alert.metadata, contextHash: context.metadata.contextHash, version: AI_RISK_ADVISOR_VERSION })},
        ${now}, ${now}
      )
    `;
  }
  return alerts;
}

async function listStoredRiskAlerts(userId: string, contextHash: string): Promise<RiskAlert[]> {
  const rows = await prisma.$queryRaw<Array<{ alertType: string; severity: RiskSeverity; message: string; status: 'active' | 'monitoring'; metadataJson: string }>>`
    SELECT alert_type AS alertType, severity, message, status, metadata AS metadataJson
    FROM ai_risk_alerts
    WHERE user_id = ${userId}
      AND status IN ('active', 'monitoring')
      AND (expires_at IS NULL OR expires_at > ${new Date()})
    ORDER BY created_at DESC
    LIMIT 12
  `;
  return rows
    .map((row) => ({ alert_type: row.alertType, severity: row.severity, message: row.message, status: row.status, metadata: parseJson<{ contextHash?: string }>(row.metadataJson, {}) }))
    .filter((alert) => alert.metadata.contextHash === contextHash);
}

function buildRiskAlerts(context: AiPortfolioContext): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  if (context.risk.concentrationRiskPct >= 35) {
    alerts.push({
      alert_type: 'concentration',
      severity: context.risk.concentrationRiskPct >= 60 ? 'critical' : 'high',
      message: `${context.risk.largestHoldingSymbol || 'Largest holding'} concentration is ${formatPct(context.risk.concentrationRiskPct)}.`,
      status: 'active',
      metadata: { value: context.risk.concentrationRiskPct }
    });
  }
  if (context.risk.volatilityPct >= 35) {
    alerts.push({
      alert_type: 'volatility',
      severity: context.risk.volatilityPct >= 70 ? 'high' : 'medium',
      message: `Portfolio volatility is elevated at ${formatPct(context.risk.volatilityPct)}.`,
      status: 'active',
      metadata: { value: context.risk.volatilityPct }
    });
  }
  if (context.risk.maxDrawdownPct <= -10) {
    alerts.push({
      alert_type: 'drawdown',
      severity: context.risk.maxDrawdownPct <= -20 ? 'high' : 'medium',
      message: `Max drawdown reached ${formatPct(context.risk.maxDrawdownPct)} in available history.`,
      status: 'active',
      metadata: { value: context.risk.maxDrawdownPct }
    });
  }
  if (context.portfolio.cashRatio < 3) {
    alerts.push({
      alert_type: 'liquidity_warning',
      severity: 'medium',
      message: `Cash reserve is low at ${formatPct(context.portfolio.cashRatio)}.`,
      status: 'monitoring',
      metadata: { value: context.portfolio.cashRatio }
    });
  }
  if (optionCount(context) > 0) {
    alerts.push({
      alert_type: 'volatility',
      severity: 'medium',
      message: `${optionCount(context)} option position(s) may add non-linear risk behavior.`,
      status: 'monitoring',
      metadata: { optionCount: optionCount(context) }
    });
  }
  return alerts.length ? alerts : [{
    alert_type: 'concentration',
    severity: 'low',
    message: 'No high-severity generated risk alert is active from the current context.',
    status: 'monitoring',
    metadata: {}
  }];
}

export function buildConcentrationTable(context: AiPortfolioContext): ConcentrationRow[] {
  const symbolRows = context.allocation.bySymbol.slice(0, 8).map((slice) => ({
    label: slice.label,
    type: 'symbol',
    allocationPct: slice.percentage,
    severity: severityFromPct(slice.percentage),
    explanation: `${slice.label} represents ${formatPct(slice.percentage)} of visible positive allocation.`
  }));
  const assetRows = context.allocation.byAssetType.slice(0, 4).map((slice) => ({
    label: slice.label,
    type: 'asset_type',
    allocationPct: slice.percentage,
    severity: severityFromPct(slice.percentage),
    explanation: `${slice.label} exposure is ${formatPct(slice.percentage)}.`
  }));
  const currencyRows = context.allocation.byCurrency.slice(0, 3).map((slice) => ({
    label: slice.label,
    type: 'currency',
    allocationPct: slice.percentage,
    severity: severityFromPct(slice.percentage),
    explanation: `${slice.label} currency exposure is ${formatPct(slice.percentage)}.`
  }));
  return [...symbolRows, ...assetRows, ...currencyRows].sort((left, right) => right.allocationPct - left.allocationPct);
}

export function buildExposureSlices(context: AiPortfolioContext): ExposureSlice[] {
  return [
    ...context.allocation.bySymbol.slice(0, 5).map((slice) => ({ ...slice, riskLevel: severityFromPct(slice.percentage) })),
    ...context.allocation.byAssetType.map((slice) => ({ ...slice, riskLevel: severityFromPct(slice.percentage) })),
    ...context.allocation.byCurrency.map((slice) => ({ ...slice, riskLevel: severityFromPct(slice.percentage) }))
  ].sort((left, right) => right.percentage - left.percentage);
}

export function buildStressScenarios(context: AiPortfolioContext): StressScenario[] {
  const concentrationMultiplier = Math.min(context.risk.concentrationRiskPct / 100, 0.85);
  const optionMultiplier = optionCount(context) > 0 ? 1.2 : 1;
  const growthShock = round(-20 * concentrationMultiplier * optionMultiplier);
  const singleNameShock = round(-15 * concentrationMultiplier);
  const liquidityShock = round(context.portfolio.cashRatio < 5 ? -6 : -2);
  return [
    {
      scenario: 'Growth market pullback',
      shockPct: -20,
      estimatedImpactPct: growthShock,
      explanation: `A broad growth pullback may matter because the largest exposure is ${context.risk.largestHoldingSymbol || 'concentrated'}.`,
      warning: 'This is hypothetical and should be used for planning, not prediction.'
    },
    {
      scenario: 'Largest holding shock',
      shockPct: -15,
      estimatedImpactPct: singleNameShock,
      explanation: `A decline in ${context.risk.largestHoldingSymbol || 'the largest holding'} could be visible because concentration is ${formatPct(context.risk.concentrationRiskPct)}.`,
      warning: 'Single-name stress is more severe when allocation is concentrated.'
    },
    {
      scenario: 'Liquidity pressure',
      shockPct: -5,
      estimatedImpactPct: liquidityShock,
      explanation: `Cash ratio is ${formatPct(context.portfolio.cashRatio)}, which affects flexibility during downside periods.`,
      warning: 'Cash does not remove risk, but it can change how much forced action is needed.'
    }
  ];
}

function buildRiskHeatmap(context: AiPortfolioContext) {
  return [
    { label: 'Concentration', score: Math.min(100, context.risk.concentrationRiskPct), severity: severityFromPct(context.risk.concentrationRiskPct) },
    { label: 'Volatility', score: Math.min(100, context.risk.volatilityPct), severity: severityFromPct(context.risk.volatilityPct) },
    { label: 'Drawdown', score: Math.min(100, Math.abs(context.risk.maxDrawdownPct)), severity: severityFromPct(Math.abs(context.risk.maxDrawdownPct) * 2) },
    { label: 'Options', score: Math.min(100, optionCount(context) * 20), severity: optionCount(context) > 0 ? 'medium' : 'low' },
    { label: 'Missing Data', score: Math.min(100, context.promptHints.missingData.length * 25), severity: context.promptHints.missingData.length >= 3 ? 'high' : context.promptHints.missingData.length ? 'medium' : 'low' }
  ];
}

async function saveRiskExplanation(userId: string, type: RiskExplanationType, question: string, response: RiskAdvisorResponse, context: AiPortfolioContext) {
  const now = new Date();
  await prisma.$executeRaw`
    INSERT INTO ai_risk_explanations (
      id, user_id, explanation_type, question, response, context_hash, metadata, created_at, updated_at
    )
    VALUES (
      ${randomUUID()}, ${userId}, ${type}, ${question}, ${JSON.stringify(response)}, ${context.metadata.contextHash},
      ${JSON.stringify({ version: AI_RISK_ADVISOR_VERSION, period: context.metadata.period, benchmark: context.metadata.benchmark, accountMode: response.account_mode })},
      ${now}, ${now}
    )
  `;
}

async function listRiskExplanations(userId: string, limit = 10) {
  const rows = await prisma.$queryRaw<RiskExplanationRow[]>(
    Prisma.sql`
      SELECT id, explanation_type AS explanationType, question, response AS responseJson,
        context_hash AS contextHash, metadata AS metadataJson, created_at AS createdAt
      FROM ai_risk_explanations
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
  );
  return rows.map((row) => ({ ...row, response: parseJson(row.responseJson, {}), metadata: parseJson(row.metadataJson, {}) }));
}

async function readRiskAdvisorCache(cacheKey: string) {
  const [row] = await prisma.$queryRaw<CacheRow[]>`
    SELECT payload_json AS payloadJson, generated_at AS generatedAt, expires_at AS expiresAt
    FROM analytics_cache
    WHERE cache_key = ${cacheKey}
      AND expires_at > ${new Date()}
    LIMIT 1
  `;
  return row ?? null;
}

async function writeRiskAdvisorCache(userId: string, cacheKey: string, type: RiskExplanationType, payload: RiskAdvisorResponse) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + riskAdvisorCacheTtlSeconds() * 1000);
  await prisma.$executeRaw`
    INSERT INTO analytics_cache (
      id, user_id, cache_key, cache_type, payload_json, generated_at, expires_at, created_at, updated_at
    )
    VALUES (
      ${randomUUID()}, ${userId}, ${cacheKey}, ${`phase5c_risk_advisor_${type}`},
      ${JSON.stringify(payload)}, ${now}, ${expiresAt}, ${now}, ${now}
    )
    ON DUPLICATE KEY UPDATE
      payload_json = VALUES(payload_json),
      generated_at = VALUES(generated_at),
      expires_at = VALUES(expires_at),
      updated_at = VALUES(updated_at)
  `;
}

function inferRiskExplanationType(question: string): RiskExplanationType {
  const lower = question.toLowerCase();
  if (lower.includes('volatility') || lower.includes('volatile')) return 'volatility';
  if (lower.includes('concentrated') || lower.includes('concentration')) return 'concentration';
  if (lower.includes('drawdown') || lower.includes('downside')) return 'drawdown';
  if (lower.includes('exposed') || lower.includes('exposure') || lower.includes('sector')) return 'exposure';
  if (lower.includes('stress') || lower.includes('drops') || lower.includes('crash') || lower.includes('what happens')) return 'stress_analysis';
  return 'risk';
}

function defaultQuestionForType(type: RiskExplanationType) {
  return {
    risk: 'Why is my portfolio risky?',
    volatility: 'What causes most volatility?',
    concentration: 'Am I too concentrated?',
    drawdown: 'Why did my drawdown increase?',
    exposure: 'How exposed am I to one sector?',
    stress_analysis: 'What happens if growth markets drop?'
  }[type];
}

function answerRiskQuestionSummary(question: string, type: RiskExplanationType, context: AiPortfolioContext) {
  return `${question.trim()} The ${type.replaceAll('_', ' ')} view points to ${context.risk.largestHoldingSymbol || 'the largest visible exposure'}, ${formatPct(context.risk.concentrationRiskPct)} concentration risk, and ${formatPct(context.risk.volatilityPct)} volatility.`;
}

function prioritizeRiskDrivers(question: string, drivers: string[]) {
  const lower = question.toLowerCase();
  if (lower.includes('volatility')) return [...drivers].sort((driver) => driver.toLowerCase().includes('volatility') ? -1 : 1);
  if (lower.includes('concentration')) return [...drivers].sort((driver) => driver.toLowerCase().includes('concentration') ? -1 : 1);
  return drivers;
}

function buildRiskWarnings(context: AiPortfolioContext) {
  const warnings = context.risk.flags.map((flag) => flag.detail);
  if (context.promptHints.missingData.length) warnings.push(...context.promptHints.missingData.slice(0, 2));
  return warnings.length ? warnings.slice(0, 5) : ['No high-severity generated warning is present in the current context.'];
}

function saferRiskConsiderations(context: AiPortfolioContext) {
  return [
    'Review risk drivers calmly instead of reacting to a single market move.',
    'Separate concentration risk, volatility risk, and liquidity needs.',
    context.metadata.snapshotCount < 3 ? 'Collect more portfolio history before relying on volatility or drawdown signals.' : 'Use available history as context, not as a guarantee of future behavior.',
    'This module is read-only and does not execute trades, liquidation, hedging, or rebalancing.'
  ];
}

function riskLevel(context: AiPortfolioContext) {
  if (context.risk.concentrationRiskPct >= 60 || context.risk.healthLabel === 'elevated_risk') return 'moderate_high';
  if (context.risk.concentrationRiskPct >= 35 || context.risk.healthLabel === 'watch') return 'moderate';
  return 'low_moderate';
}

function accountMode(context: AiPortfolioContext): RiskAccountMode {
  const hasPaperMarker = context.portfolio.holdings.some((holding) => holding.tags.includes('paper') || holding.name.toLowerCase().includes('paper'));
  return hasPaperMarker ? 'sandbox_paper' : 'read_only_real';
}

function confidence(context: AiPortfolioContext): RiskAdvisorResponse['confidence'] {
  if (context.metadata.snapshotCount >= 3 && context.promptHints.missingData.length === 0) return 'high';
  if (context.metadata.snapshotCount >= 1 && context.promptHints.missingData.length <= 2) return 'medium';
  return 'low';
}

function severityFromPct(value: number): RiskSeverity {
  if (value >= 70) return 'critical';
  if (value >= 45) return 'high';
  if (value >= 20) return 'medium';
  return 'low';
}

function optionCount(context: AiPortfolioContext) {
  return context.portfolio.holdings.filter((holding) => holding.assetType === 'option').length;
}

function suggestedRiskQuestions(context: AiPortfolioContext) {
  return [
    'Why is my portfolio risky?',
    'What causes most volatility?',
    'What happens if growth markets drop?',
    'Am I too concentrated?',
    'Why did my drawdown increase?',
    `How exposed am I to ${context.risk.largestHoldingSymbol || 'my largest holding'}?`
  ];
}

function riskAdvisorCacheKey(
  userId: string,
  type: RiskExplanationType,
  period: AnalyticsPeriod,
  benchmark: AnalyticsBenchmark,
  brokerAccId: string | null
) {
  return `ai:risk-advisor:v2:${userId}:${brokerAccId ?? 'all'}:${type}:${period}:${benchmark}`;
}

function riskAdvisorCacheTtlSeconds() {
  const ttl = Number(process.env.AI_RISK_ADVISOR_CACHE_TTL ?? 600);
  return Number.isFinite(ttl) && ttl > 0 ? ttl : 600;
}

function fallbackRiskResponse(type: RiskExplanationType): RiskAdvisorResponse {
  return {
    type,
    risk_level: 'unknown',
    title: 'Risk Advisor',
    summary: 'Risk advisor response is unavailable.',
    main_risk_drivers: [],
    warnings: [],
    safer_considerations: [],
    educational_note: 'Refresh the risk advisor to rebuild this explanation.',
    account_mode: 'read_only_real',
    confidence: 'low',
    source_contexts: [],
    missing_data: [],
    generated_at: new Date().toISOString()
  };
}

function assertQuestion(question: string) {
  if (question.trim().length < 3) throw new Error('Ask a risk question first.');
  if (question.length > 800) throw new Error('Keep the question under 800 characters.');
}

function formatPct(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(2) : '0.00'}%`;
}

function round(value: number) {
  return Math.round(value * 100) / 100;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
