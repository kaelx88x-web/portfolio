import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '$lib/server/db';
import {
  buildAiPortfolioContext,
  parseAiBenchmark,
  parseAiPeriod,
  type AiPortfolioContext
} from '$lib/services/ai-context.service';
import type { AnalyticsBenchmark, AnalyticsPeriod } from '$lib/services/analytics.service';

export const AI_PORTFOLIO_ASSISTANT_VERSION = 'phase-5B';

export const PORTFOLIO_EXPLANATION_TYPES = [
  'portfolio',
  'allocation',
  'diversification',
  'performance',
  'holdings'
] as const;

export type PortfolioExplanationType = (typeof PORTFOLIO_EXPLANATION_TYPES)[number];
export type AccountMode = 'read_only_real' | 'sandbox_paper';

export type PortfolioAssistantResponse = {
  type: PortfolioExplanationType;
  title: string;
  summary: string;
  key_observations: string[];
  risk_considerations: string[];
  educational_note: string;
  account_mode: AccountMode;
  confidence: 'low' | 'medium' | 'high';
  source_contexts: string[];
  missing_data: string[];
  generated_at: string;
};

export type PortfolioAssistantOverview = {
  narrative: PortfolioNarrative;
  summary: PortfolioAssistantResponse;
  allocation: PortfolioAssistantResponse;
  diversification: PortfolioAssistantResponse;
  performance: PortfolioAssistantResponse;
  holdings: PortfolioAssistantResponse;
  holdingsTable: HoldingInsightRow[];
  storyTimeline: StoryTimelinePoint[];
  suggestedQuestions: string[];
  recentExplanations: PortfolioExplanationRow[];
};

export type PortfolioNarrative = {
  id?: string;
  title: string;
  summary: string;
  narrative: string;
  riskLevel: string;
  metadata: Record<string, unknown>;
  createdAt?: Date;
};

export type HoldingInsightRow = {
  symbol: string;
  name: string;
  role: string;
  allocationPct: number;
  marketValue: number;
  unrealizedPnl: number;
  insight: string;
  riskNote: string;
};

export type StoryTimelinePoint = {
  label: string;
  title: string;
  detail: string;
};

type PortfolioExplanationRow = {
  id: string;
  explanationType: PortfolioExplanationType;
  question: string;
  responseJson: string;
  contextHash: string;
  metadataJson: string;
  createdAt: Date;
};

type PortfolioNarrativeRow = {
  id: string;
  title: string;
  summary: string;
  narrative: string;
  riskLevel: string;
  metadataJson: string;
  createdAt: Date;
};

type CacheRow = {
  payloadJson: string;
  generatedAt: Date;
  expiresAt: Date;
};

export async function getPortfolioAssistantOverview(
  userId: string,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark; forceRefresh?: boolean } = {}
): Promise<PortfolioAssistantOverview> {
  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const [summary, allocation, diversification, performance, holdings, recentExplanations] = await Promise.all([
    getPortfolioAssistantSection(userId, 'portfolio', { period, benchmark, forceRefresh: options.forceRefresh }),
    getPortfolioAssistantSection(userId, 'allocation', { period, benchmark, forceRefresh: options.forceRefresh }),
    getPortfolioAssistantSection(userId, 'diversification', { period, benchmark, forceRefresh: options.forceRefresh }),
    getPortfolioAssistantSection(userId, 'performance', { period, benchmark, forceRefresh: options.forceRefresh }),
    getPortfolioAssistantSection(userId, 'holdings', { period, benchmark, forceRefresh: options.forceRefresh }),
    listPortfolioExplanations(userId, 8)
  ]);

  const context = await buildAiPortfolioContext(userId, { period, benchmark });
  const narrative = await getOrCreatePortfolioNarrative(userId, context, options.forceRefresh ?? false);

  return {
    narrative,
    summary,
    allocation,
    diversification,
    performance,
    holdings,
    holdingsTable: buildHoldingsInsightTable(context),
    storyTimeline: buildPortfolioStoryTimeline(context),
    suggestedQuestions: suggestedPortfolioAssistantQuestions(context),
    recentExplanations
  };
}

export async function getPortfolioAssistantSection(
  userId: string,
  type: PortfolioExplanationType,
  options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark; forceRefresh?: boolean } = {}
) {
  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const cacheKey = portfolioAssistantCacheKey(userId, type, period, benchmark);

  if (!options.forceRefresh) {
    const cached = await readAssistantCache(cacheKey);
    if (cached) return parseJson<PortfolioAssistantResponse>(cached.payloadJson, fallbackResponse(type));
  }

  const context = await buildAiPortfolioContext(userId, { period, benchmark });
  const response = buildAssistantResponse(type, context);
  await Promise.all([
    writeAssistantCache(userId, cacheKey, type, response),
    savePortfolioExplanation(userId, type, defaultQuestionForType(type), response, context)
  ]);
  return response;
}

export async function explainPortfolioAssistantQuestion(
  userId: string,
  payload: { question: string; type?: PortfolioExplanationType; period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark }
) {
  assertQuestion(payload.question);
  const period = payload.period ?? 'MAX';
  const benchmark = payload.benchmark ?? 'SPY';
  const context = await buildAiPortfolioContext(userId, { period, benchmark });
  const type = payload.type ?? inferExplanationType(payload.question);
  const base = buildAssistantResponse(type, context);
  const response: PortfolioAssistantResponse = {
    ...base,
    title: 'Portfolio Assistant Answer',
    summary: answerQuestionSummary(payload.question, type, context),
    key_observations: prioritizeObservationsForQuestion(payload.question, base.key_observations),
    generated_at: new Date().toISOString()
  };

  await savePortfolioExplanation(userId, type, payload.question, response, context);
  return response;
}

export async function refreshPortfolioAssistant(userId: string, options: { period?: AnalyticsPeriod; benchmark?: AnalyticsBenchmark } = {}) {
  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const overview = await getPortfolioAssistantOverview(userId, { period, benchmark, forceRefresh: true });
  return {
    refreshedAt: new Date().toISOString(),
    contextHash: overview.summary.source_contexts[0]?.replace('portfolio:', ''),
    sections: PORTFOLIO_EXPLANATION_TYPES
  };
}

export function parsePortfolioAssistantPeriod(value: string | null) {
  return parseAiPeriod(value);
}

export function parsePortfolioAssistantBenchmark(value: string | null) {
  return parseAiBenchmark(value);
}

export function parsePortfolioExplanationType(value: FormDataEntryValue | string | null): PortfolioExplanationType {
  return PORTFOLIO_EXPLANATION_TYPES.includes(value as PortfolioExplanationType)
    ? (value as PortfolioExplanationType)
    : 'portfolio';
}

async function getOrCreatePortfolioNarrative(userId: string, context: AiPortfolioContext, forceRefresh: boolean): Promise<PortfolioNarrative> {
  if (!forceRefresh) {
    const [existing] = await prisma.$queryRaw<PortfolioNarrativeRow[]>`
      SELECT id, title, summary, narrative, risk_level AS riskLevel, metadata AS metadataJson, created_at AS createdAt
      FROM ai_portfolio_narratives
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    const metadata = parseJson<{ contextHash?: string }>(existing?.metadataJson ?? '{}', {});
    if (existing && metadata.contextHash === context.metadata.contextHash) {
      return {
        id: existing.id,
        title: existing.title,
        summary: existing.summary,
        narrative: existing.narrative,
        riskLevel: existing.riskLevel,
        metadata: parseJson(existing.metadataJson, {}),
        createdAt: existing.createdAt
      };
    }
  }

  const narrative = buildPortfolioNarrative(context);
  const id = randomUUID();
  const now = new Date();
  await prisma.$executeRaw`
    INSERT INTO ai_portfolio_narratives (
      id, user_id, title, summary, narrative, risk_level, metadata, created_at, updated_at
    )
    VALUES (
      ${id}, ${userId}, ${narrative.title}, ${narrative.summary}, ${narrative.narrative},
      ${narrative.riskLevel}, ${JSON.stringify(narrative.metadata)}, ${now}, ${now}
    )
  `;

  return { ...narrative, id, createdAt: now };
}

function buildAssistantResponse(type: PortfolioExplanationType, context: AiPortfolioContext): PortfolioAssistantResponse {
  const builders: Record<PortfolioExplanationType, () => PortfolioAssistantResponse> = {
    portfolio: () => buildPortfolioExplanation(context),
    allocation: () => buildAllocationExplanation(context),
    diversification: () => buildDiversificationExplanation(context),
    performance: () => buildPerformanceExplanation(context),
    holdings: () => buildHoldingsExplanation(context)
  };
  return builders[type]();
}

function buildPortfolioExplanation(context: AiPortfolioContext): PortfolioAssistantResponse {
  const topHolding = largestHolding(context);
  return responseShell('portfolio', context, {
    title: 'Portfolio Structure',
    summary: `Your portfolio has ${context.portfolio.holdingsCount} visible holdings, ${formatMoney(context.portfolio.value)} total value, and ${formatPct(context.portfolio.cashRatio)} cash.`,
    key_observations: [
      topHolding
        ? `${topHolding.symbol} is the largest visible position by market value at ${formatPct(topHolding.allocationPct)} allocation.`
        : 'No holding-level allocation is available yet.',
      `Portfolio health is ${context.risk.healthLabel} with a ${context.risk.healthScore}/100 score.`,
      `Selected-period return is ${formatPct(context.performance.totalReturnPct)}.`,
      `Market data status is ${context.marketData.status}.`
    ],
    risk_considerations: riskConsiderations(context),
    educational_note: 'A portfolio overview helps separate what you own, how concentrated it is, and which data is fresh enough to trust.'
  });
}

function buildAllocationExplanation(context: AiPortfolioContext): PortfolioAssistantResponse {
  const symbol = context.allocation.bySymbol[0];
  const asset = context.allocation.byAssetType[0];
  const currency = context.allocation.byCurrency[0];
  return responseShell('allocation', context, {
    title: 'Allocation Explanation',
    summary: `Allocation is led by ${symbol?.label ?? 'available holdings'} with ${formatPct(symbol?.percentage ?? 0)} of positive allocation and ${formatPct(context.portfolio.cashRatio)} cash.`,
    key_observations: [
      symbol ? `${symbol.label} is the largest symbol allocation at ${formatPct(symbol.percentage)}.` : 'Symbol allocation is not available yet.',
      asset ? `${asset.label} is the largest asset-class allocation at ${formatPct(asset.percentage)}.` : 'Asset-class allocation is not available yet.',
      currency ? `${currency.label} is the largest currency exposure at ${formatPct(currency.percentage)}.` : 'Currency allocation is not available yet.',
      ...context.allocation.drift.slice(0, 2).map((row) => `${row.label} is ${formatPct(Math.abs(row.driftPct))} away from equal-weight reference.`)
    ],
    risk_considerations: [
      ...riskConsiderations(context),
      context.portfolio.cashRatio >= 30 ? `Cash is elevated at ${formatPct(context.portfolio.cashRatio)}, which changes risk and opportunity profile.` : `Cash is ${formatPct(context.portfolio.cashRatio)}.`
    ],
    educational_note: 'Allocation explains where outcomes may come from; concentration can matter more than the number of holdings.'
  });
}

function buildDiversificationExplanation(context: AiPortfolioContext): PortfolioAssistantResponse {
  const topThree = context.allocation.bySymbol.slice(0, 3).reduce((total, row) => total + row.percentage, 0);
  const assetTypes = context.allocation.byAssetType.length;
  const currencies = context.allocation.byCurrency.length;
  return responseShell('diversification', context, {
    title: 'Diversification Insight',
    summary: `Diversification looks ${diversificationLabel(context, topThree)}: the top three allocation slices represent ${formatPct(topThree)} and the largest holding risk is ${formatPct(context.risk.concentrationRiskPct)}.`,
    key_observations: [
      `${assetTypes} asset-class bucket(s) and ${currencies} currency bucket(s) are visible in the current context.`,
      `Largest holding concentration is ${formatPct(context.risk.concentrationRiskPct)}.`,
      `Portfolio contains ${context.portfolio.holdings.filter((holding) => holding.assetType === 'option').length} option position(s).`,
      `Health score is ${context.risk.healthScore}/100.`
    ],
    risk_considerations: [
      ...riskConsiderations(context),
      topThree >= 60 ? 'A high top-three share can create hidden dependency on a small number of positions.' : 'Top-three concentration is not the only diversification test; sector and factor overlap can still matter.'
    ],
    educational_note: 'Diversification is about independent risk drivers, not simply holding more ticker symbols.'
  });
}

function buildPerformanceExplanation(context: AiPortfolioContext): PortfolioAssistantResponse {
  return responseShell('performance', context, {
    title: 'Performance Explanation',
    summary: `Selected-period return is ${formatPct(context.performance.totalReturnPct)} versus ${context.metadata.benchmark} at ${formatPct(context.benchmark.benchmarkReturnPct)}, producing ${formatPct(context.benchmark.alphaPct)} alpha.`,
    key_observations: [
      `Daily return is ${formatPct(context.performance.dailyReturnPct)} and YTD return is ${formatPct(context.performance.ytdReturnPct)}.`,
      `Unrealized P/L is ${formatMoney(context.performance.unrealizedPnl)}.`,
      `Benchmark status is ${context.benchmark.status}.`,
      ...context.topContributors.gainers.slice(0, 2).map((row) => `${row.symbol} is a top visible gainer with ${formatMoney(row.unrealizedPnl)} unrealized P/L.`),
      ...context.topContributors.losers.slice(0, 2).map((row) => `${row.symbol} is a top visible laggard with ${formatMoney(row.unrealizedPnl)} unrealized P/L.`)
    ].slice(0, 6),
    risk_considerations: [
      `Volatility is ${formatPct(context.risk.volatilityPct)} and max drawdown is ${formatPct(context.risk.maxDrawdownPct)} for the available data.`,
      ...riskConsiderations(context)
    ],
    educational_note: 'Performance should be read with context: a gain can still come with concentration, volatility, or limited history.'
  });
}

function buildHoldingsExplanation(context: AiPortfolioContext): PortfolioAssistantResponse {
  const rows = buildHoldingsInsightTable(context);
  return responseShell('holdings', context, {
    title: 'Holdings Intelligence',
    summary: `${rows.length} holdings were profiled for role, contribution, and risk notes.`,
    key_observations: rows.slice(0, 5).map((row) => `${row.symbol}: ${row.insight}`),
    risk_considerations: rows.slice(0, 5).map((row) => row.riskNote),
    educational_note: 'Holdings intelligence helps identify what each position is doing inside the portfolio: growth, income, hedge, cash-like, or volatility driver.'
  });
}

function responseShell(
  type: PortfolioExplanationType,
  context: AiPortfolioContext,
  body: Pick<PortfolioAssistantResponse, 'title' | 'summary' | 'key_observations' | 'risk_considerations' | 'educational_note'>
): PortfolioAssistantResponse {
  return {
    type,
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

function buildPortfolioNarrative(context: AiPortfolioContext): PortfolioNarrative {
  const top = largestHolding(context);
  const riskLine =
    context.risk.healthLabel === 'stable'
      ? 'The current risk profile looks relatively stable from the available context.'
      : context.risk.healthLabel === 'watch'
        ? 'The current risk profile deserves monitoring, especially around concentration and volatility.'
        : 'The current risk profile is elevated and should be reviewed carefully.';

  return {
    title: 'Portfolio Story',
    summary: `A ${context.risk.healthLabel.replaceAll('_', ' ')} portfolio with ${context.portfolio.holdingsCount} holdings and ${formatPct(context.portfolio.cashRatio)} cash.`,
    narrative: [
      `Your portfolio currently holds ${context.portfolio.holdingsCount} visible position(s) with total value of ${formatMoney(context.portfolio.value)}.`,
      top ? `The largest visible position by market value is ${top.symbol}, which gives the portfolio a clear center of gravity.` : 'No largest holding can be identified from the current context.',
      `The selected-period return is ${formatPct(context.performance.totalReturnPct)}, while benchmark alpha versus ${context.metadata.benchmark} is ${formatPct(context.benchmark.alphaPct)}.`,
      riskLine,
      `This assistant is operating in ${accountMode(context) === 'read_only_real' ? 'read-only analytics mode' : 'sandbox simulation mode'} and will not execute trades.`
    ].join(' '),
    riskLevel: context.risk.healthLabel,
    metadata: {
      contextHash: context.metadata.contextHash,
      generatedAt: context.metadata.generatedAt,
      version: AI_PORTFOLIO_ASSISTANT_VERSION,
      accountMode: accountMode(context)
    }
  };
}

export function buildHoldingsInsightTable(context: AiPortfolioContext): HoldingInsightRow[] {
  const gainers = new Set(context.topContributors.gainers.map((row) => row.symbol));
  const losers = new Set(context.topContributors.losers.map((row) => row.symbol));
  return [...context.portfolio.holdings]
    .sort((left, right) => Math.abs(right.marketValue) - Math.abs(left.marketValue))
    .slice(0, 12)
    .map((holding) => {
      const role = holding.assetType === 'option' ? 'Volatility / derivative' : holding.allocationPct >= 20 ? 'Core driver' : 'Satellite holding';
      const contribution = gainers.has(holding.symbol)
        ? 'visible positive contributor'
        : losers.has(holding.symbol)
          ? 'visible negative contributor'
          : 'portfolio component';
      return {
        symbol: holding.symbol,
        name: holding.name,
        role,
        allocationPct: holding.allocationPct,
        marketValue: holding.marketValue,
        unrealizedPnl: holding.unrealizedPnl,
        insight: `${holding.symbol} is a ${contribution} with ${formatPct(holding.allocationPct)} allocation.`,
        riskNote:
          holding.assetType === 'option'
            ? 'Options can behave non-linearly and may need separate risk review.'
            : holding.allocationPct >= 25
              ? 'Large position size can dominate portfolio movement.'
              : 'Position risk depends on correlation with the rest of the portfolio.'
      };
    });
}

function buildPortfolioStoryTimeline(context: AiPortfolioContext): StoryTimelinePoint[] {
  return [
    {
      label: 'Structure',
      title: `${context.portfolio.holdingsCount} holdings`,
      detail: `${formatMoney(context.portfolio.value)} total value with ${formatPct(context.portfolio.cashRatio)} cash.`
    },
    {
      label: 'Allocation',
      title: context.allocation.bySymbol[0]?.label ?? 'No top allocation',
      detail: `Largest allocation slice is ${formatPct(context.allocation.bySymbol[0]?.percentage ?? 0)}.`
    },
    {
      label: 'Risk',
      title: context.risk.healthLabel.replaceAll('_', ' '),
      detail: `Health score ${context.risk.healthScore}/100 and concentration ${formatPct(context.risk.concentrationRiskPct)}.`
    },
    {
      label: 'Performance',
      title: `${formatPct(context.performance.totalReturnPct)} return`,
      detail: `${formatPct(context.benchmark.alphaPct)} alpha versus ${context.metadata.benchmark}.`
    }
  ];
}

async function savePortfolioExplanation(
  userId: string,
  type: PortfolioExplanationType,
  question: string,
  response: PortfolioAssistantResponse,
  context: AiPortfolioContext
) {
  const now = new Date();
  await prisma.$executeRaw`
    INSERT INTO ai_portfolio_explanations (
      id, user_id, explanation_type, question, response, context_hash, metadata, created_at, updated_at
    )
    VALUES (
      ${randomUUID()}, ${userId}, ${type}, ${question}, ${JSON.stringify(response)}, ${context.metadata.contextHash},
      ${JSON.stringify({
        version: AI_PORTFOLIO_ASSISTANT_VERSION,
        period: context.metadata.period,
        benchmark: context.metadata.benchmark,
        accountMode: response.account_mode
      })}, ${now}, ${now}
    )
  `;
}

async function listPortfolioExplanations(userId: string, limit = 10) {
  const rows = await prisma.$queryRaw<PortfolioExplanationRow[]>(
    Prisma.sql`
      SELECT id, explanation_type AS explanationType, question, response AS responseJson,
        context_hash AS contextHash, metadata AS metadataJson, created_at AS createdAt
      FROM ai_portfolio_explanations
      WHERE user_id = ${userId}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `
  );

  return rows.map((row) => ({
    ...row,
    response: parseJson(row.responseJson, {}),
    metadata: parseJson(row.metadataJson, {})
  }));
}

async function readAssistantCache(cacheKey: string) {
  const now = new Date();
  const [row] = await prisma.$queryRaw<CacheRow[]>`
    SELECT payload_json AS payloadJson, generated_at AS generatedAt, expires_at AS expiresAt
    FROM analytics_cache
    WHERE cache_key = ${cacheKey}
      AND expires_at > ${now}
    LIMIT 1
  `;
  return row ?? null;
}

async function writeAssistantCache(userId: string, cacheKey: string, type: PortfolioExplanationType, payload: PortfolioAssistantResponse) {
  const generatedAt = new Date();
  const expiresAt = new Date(generatedAt.getTime() + assistantCacheTtlSeconds() * 1000);
  await prisma.$executeRaw`
    INSERT INTO analytics_cache (
      id, user_id, cache_key, cache_type, payload_json, generated_at, expires_at, created_at, updated_at
    )
    VALUES (
      ${randomUUID()}, ${userId}, ${cacheKey}, ${`phase5b_portfolio_assistant_${type}`},
      ${JSON.stringify(payload)}, ${generatedAt}, ${expiresAt}, ${generatedAt}, ${generatedAt}
    )
    ON DUPLICATE KEY UPDATE
      payload_json = VALUES(payload_json),
      generated_at = VALUES(generated_at),
      expires_at = VALUES(expires_at),
      updated_at = VALUES(updated_at)
  `;
}

function inferExplanationType(question: string): PortfolioExplanationType {
  const lower = question.toLowerCase();
  if (lower.includes('allocation') || lower.includes('exposure') || lower.includes('cash')) return 'allocation';
  if (lower.includes('divers') || lower.includes('overlap') || lower.includes('correlation')) return 'diversification';
  if (lower.includes('performance') || lower.includes('return') || lower.includes('p/l') || lower.includes('benchmark')) return 'performance';
  if (lower.includes('holding') || lower.includes('position') || lower.includes('driver')) return 'holdings';
  return 'portfolio';
}

function defaultQuestionForType(type: PortfolioExplanationType) {
  return {
    portfolio: 'Explain my portfolio in simple terms.',
    allocation: 'How balanced is my allocation?',
    diversification: 'Am I diversified enough?',
    performance: 'Explain my portfolio performance.',
    holdings: 'Which holdings drive my portfolio?'
  }[type];
}

function answerQuestionSummary(question: string, type: PortfolioExplanationType, context: AiPortfolioContext) {
  return `${question.trim()} Based on the ${type} context, the main portfolio signal is ${context.risk.largestHoldingSymbol || 'the largest visible exposure'} with ${formatPct(context.risk.concentrationRiskPct)} concentration risk and ${context.risk.healthLabel.replaceAll('_', ' ')} overall health.`;
}

function prioritizeObservationsForQuestion(question: string, observations: string[]) {
  const lower = question.toLowerCase();
  if (lower.includes('risk')) return [...observations].sort((item) => (item.toLowerCase().includes('risk') || item.toLowerCase().includes('concentration') ? -1 : 1));
  return observations;
}

function riskConsiderations(context: AiPortfolioContext) {
  const flags = context.risk.flags.map((flag) => flag.detail);
  return flags.length
    ? flags.slice(0, 4)
    : ['No major generated risk flag is present, but this depends on available history and holdings data.'];
}

function diversificationLabel(context: AiPortfolioContext, topThreePct: number) {
  if (context.risk.concentrationRiskPct >= 50 || topThreePct >= 70) return 'concentrated';
  if (context.risk.concentrationRiskPct >= 30 || topThreePct >= 50) return 'moderately concentrated';
  return 'reasonably spread out';
}

function accountMode(context: AiPortfolioContext): AccountMode {
  const hasPaperMarker = context.portfolio.holdings.some((holding) => holding.tags.includes('paper') || holding.name.toLowerCase().includes('paper'));
  return hasPaperMarker ? 'sandbox_paper' : 'read_only_real';
}

function confidence(context: AiPortfolioContext): PortfolioAssistantResponse['confidence'] {
  if (context.metadata.snapshotCount >= 3 && context.promptHints.missingData.length === 0) return 'high';
  if (context.metadata.snapshotCount >= 1 && context.promptHints.missingData.length <= 2) return 'medium';
  return 'low';
}

function largestHolding(context: AiPortfolioContext) {
  return [...context.portfolio.holdings].sort((left, right) => Math.abs(right.marketValue) - Math.abs(left.marketValue))[0] ?? null;
}

function suggestedPortfolioAssistantQuestions(context: AiPortfolioContext) {
  return [
    'Explain my portfolio in simple terms',
    'What is my biggest exposure?',
    'Am I diversified enough?',
    'Why is my portfolio volatile?',
    'Which holdings drive most of my performance?',
    `How does my portfolio compare to ${context.metadata.benchmark}?`
  ];
}

function portfolioAssistantCacheKey(userId: string, type: PortfolioExplanationType, period: AnalyticsPeriod, benchmark: AnalyticsBenchmark) {
  return `ai:portfolio-assistant:${userId}:${type}:${period}:${benchmark}`;
}

function assistantCacheTtlSeconds() {
  const ttl = Number(process.env.AI_PORTFOLIO_ASSISTANT_CACHE_TTL ?? 600);
  return Number.isFinite(ttl) && ttl > 0 ? ttl : 600;
}

function fallbackResponse(type: PortfolioExplanationType): PortfolioAssistantResponse {
  return {
    type,
    title: 'Portfolio Assistant',
    summary: 'Portfolio assistant response is unavailable.',
    key_observations: [],
    risk_considerations: [],
    educational_note: 'Refresh the assistant to rebuild this explanation.',
    account_mode: 'read_only_real',
    confidence: 'low',
    source_contexts: [],
    missing_data: [],
    generated_at: new Date().toISOString()
  };
}

function assertQuestion(question: string) {
  if (question.trim().length < 3) throw new Error('Ask a portfolio question first.');
  if (question.length > 800) throw new Error('Keep the question under 800 characters.');
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 }).format(value);
}

function formatPct(value: number) {
  return `${Number.isFinite(value) ? value.toFixed(2) : '0.00'}%`;
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
