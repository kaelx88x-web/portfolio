import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { env } from '$env/dynamic/private';
import { prisma } from '$lib/server/db';
import {
  BENCHMARKS,
  ANALYTICS_PERIODS,
  getAnalyticsDashboard,
  type AnalyticsBenchmark,
  type AnalyticsDashboard,
  type AnalyticsPeriod
} from '$lib/services/analytics.service';
import {
  getHistoricalCandles,
  getMarketStates,
  getQuoteSnapshots,
  type HistoricalCandle,
  type MarketState,
  type QuoteSnapshot
} from '$lib/services/broker.service';
import type { AllocationSlice, SnapshotHolding } from '$lib/types/portfolio';

export const AI_CONTEXT_VERSION = 'phase-4.0';

const BENCHMARK_CODES: Record<AnalyticsBenchmark, string> = {
  SPY: 'US.SPY',
  QQQ: 'US.QQQ',
  VOO: 'US.VOO',
  DIA: 'US.DIA',
  SCHG: 'US.SCHG',
  SCHD: 'US.SCHD',
  VT: 'US.VT'
};

export type AiContextScope = 'full' | 'portfolio' | 'risk' | 'allocation' | 'performance' | 'benchmark';

export type AiRiskFlag = {
  severity: 'low' | 'medium' | 'high';
  code: string;
  title: string;
  detail: string;
};

export type AiPromptPayload = {
  system: string;
  developer: string[];
  contextBlock: string;
  userTemplates: {
    portfolioReview: string;
    riskReview: string;
    allocationReview: string;
    benchmarkReview: string;
  };
};

export type AiPortfolioContext = {
  metadata: {
    version: string;
    generatedAt: string;
    userId: string;
    period: AnalyticsPeriod;
    benchmark: AnalyticsBenchmark;
    contextHash: string;
    dataSource: 'portfolio_snapshots' | 'empty';
    latestSnapshotDate: string | null;
    snapshotCount: number;
    baseCurrency: string;
  };
  portfolio: {
    value: number;
    investedValue: number;
    cashBalance: number;
    cashRatio: number;
    netContribution: number;
    holdingsCount: number;
    holdings: AiHoldingContext[];
  };
  performance: {
    status: string;
    totalReturnPct: number;
    dailyReturnPct: number;
    mtdReturnPct: number;
    ytdReturnPct: number;
    cagrPct: number;
    unrealizedPnl: number;
    incomeTotal: number;
    compressedValueSeries: Array<{ date: string; value: number; returnPct: number }>;
  };
  risk: {
    status: string;
    healthScore: number;
    healthLabel: 'stable' | 'watch' | 'elevated_risk';
    volatilityPct: number;
    maxDrawdownPct: number;
    sharpeRatio: number;
    sortinoRatio: number;
    concentrationRiskPct: number;
    largestHoldingSymbol: string;
    flags: AiRiskFlag[];
  };
  allocation: {
    bySymbol: AllocationSlice[];
    byAssetType: AllocationSlice[];
    byCurrency: AllocationSlice[];
    drift: AnalyticsDashboard['allocation']['drift'];
  };
  benchmark: AnalyticsDashboard['benchmark'];
  marketData: AiMoomooMarketContext;
  income: AnalyticsDashboard['income'];
  topContributors: AnalyticsDashboard['topContributors'];
  promptHints: {
    missingData: string[];
    resolvedFromMoomoo: string[];
    observationSeeds: string[];
    suggestedAgentOrder: string[];
  };
};

export type AiHoldingContext = {
  symbol: string;
  name: string;
  assetType: string;
  currency: string;
  quantity: number;
  marketPrice: number;
  marketValue: number;
  allocationPct: number;
  unrealizedPnl: number;
  todayPl: number;
  tags: string[];
};

export type AiMoomooMarketContext = {
  source: 'moomoo_api';
  status: 'ready' | 'partial' | 'unavailable';
  checkedAt: string;
  holdingsQuoteCount: number;
  holdingsStateCount: number;
  benchmarkCode: string;
  benchmarkHistoryCount: number;
  benchmarkHistoryPeriod: { start: string; end: string };
  quotes: Array<{
    code: string;
    name: string;
    updateTime: string | null;
    lastPrice: number;
    prevClosePrice: number;
    bidPrice: number;
    askPrice: number;
    volume: number;
  }>;
  marketStates: Array<{
    code: string;
    marketState: string;
  }>;
  benchmarkCandles: Array<{
    date: string;
    close: number;
    changeRate: number;
  }>;
  errors: string[];
  resolved: string[];
};

type BuildOptions = {
  period?: AnalyticsPeriod;
  benchmark?: AnalyticsBenchmark;
};

type CachedAiContextRow = {
  payloadJson: string;
  generatedAt: Date;
  expiresAt: Date;
};

type AiContextCacheOptions = BuildOptions & {
  scope?: AiContextScope;
  forceRefresh?: boolean;
};

type AiMemoryRow = {
  id: string;
  contextType: string;
  period: string;
  benchmark: string;
  contextHash: string;
  summary: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export async function getCachedAiContextPayload(userId: string, options: AiContextCacheOptions = {}) {
  if (env.AI_CONTEXT_ENABLED === 'false') {
    return {
      status: 'disabled' as const,
      scope: options.scope ?? 'full',
      cache: { enabled: false, hit: false },
      context: null,
      message: 'AI context layer is disabled by AI_CONTEXT_ENABLED=false.'
    };
  }

  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const scope = options.scope ?? 'full';
  const cacheEnabled = env.AI_CONTEXT_CACHE_ENABLED !== 'false';
  const cacheKey = aiContextCacheKey(userId, period, benchmark, scope);

  if (cacheEnabled && !options.forceRefresh) {
    const cached = await readAiContextCache(cacheKey);
    if (cached) {
      return {
        status: 'ready' as const,
        scope,
        cache: {
          enabled: true,
          hit: true,
          key: cacheKey,
          generatedAt: cached.generatedAt.toISOString(),
          expiresAt: cached.expiresAt.toISOString()
        },
        context: JSON.parse(cached.payloadJson)
      };
    }
  }

  const context = await buildAiPortfolioContext(userId, { period, benchmark });
  const payload = buildStandardAiContextPayload(context, scope);
  const generatedAt = new Date();
  const expiresAt = new Date(generatedAt.getTime() + aiContextCacheTtlSeconds() * 1000);

  if (cacheEnabled) {
    await writeAiContextCache(userId, cacheKey, scope, payload, generatedAt, expiresAt);
  }

  return {
    status: 'ready' as const,
    scope,
    cache: {
      enabled: cacheEnabled,
      hit: false,
      key: cacheEnabled ? cacheKey : undefined,
      generatedAt: generatedAt.toISOString(),
      expiresAt: cacheEnabled ? expiresAt.toISOString() : undefined
    },
    context: payload
  };
}

export async function buildAiPortfolioContext(
  userId: string,
  options: BuildOptions = {}
): Promise<AiPortfolioContext> {
  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const [analytics, user] = await Promise.all([
    getAnalyticsDashboard(userId, period, benchmark),
    prisma.user.findUnique({ where: { id: userId }, select: { baseCurrency: true } })
  ]);

  const latestSnapshot = await prisma.portfolioSnapshot.findFirst({
    where: { userId },
    orderBy: { snapshotDate: 'desc' }
  });
  const holdings = parseHoldings(latestSnapshot?.holdingsJson);
  const bySymbol = new Map(analytics.allocation.bySymbol.map((slice) => [slice.label, slice.percentage]));
  const marketData = await buildMoomooMarketContext(holdings, period, benchmark, latestSnapshot?.snapshotDate ?? new Date());
  const riskFlags = buildRiskFlags(analytics);
  const missingData = buildMissingData(analytics, marketData);
  const healthScore = calculateHealthScore(analytics, riskFlags);

  const contextWithoutHash = {
    metadata: {
      version: AI_CONTEXT_VERSION,
      generatedAt: new Date().toISOString(),
      userId,
      period,
      benchmark,
      contextHash: '',
      dataSource: latestSnapshot ? 'portfolio_snapshots' as const : 'empty' as const,
      latestSnapshotDate: analytics.summary.latestSnapshotDate,
      snapshotCount: analytics.summary.snapshotCount,
      baseCurrency: user?.baseCurrency ?? 'USD'
    },
    portfolio: {
      value: round(analytics.summary.portfolioValue),
      investedValue: round(analytics.summary.investedValue),
      cashBalance: round(analytics.summary.cashBalance),
      cashRatio: round(analytics.summary.cashRatio),
      netContribution: round(analytics.summary.netContribution),
      holdingsCount: holdings.length,
      holdings: holdings.map((holding) => holdingToContext(holding, bySymbol.get(holding.symbol) ?? 0))
    },
    performance: {
      status: analytics.summary.status,
      totalReturnPct: round(analytics.summary.totalReturnPct),
      dailyReturnPct: round(analytics.summary.dailyReturnPct),
      mtdReturnPct: round(analytics.summary.mtdReturnPct),
      ytdReturnPct: round(analytics.summary.ytdReturnPct),
      cagrPct: round(analytics.summary.cagrPct),
      unrealizedPnl: round(analytics.summary.unrealizedPnl),
      incomeTotal: round(analytics.summary.incomeTotal),
      compressedValueSeries: compressSeries(analytics.valueSeries).map((point) => ({
        date: point.date,
        value: round(point.value),
        returnPct: round(point.returnPct)
      }))
    },
    risk: {
      status: analytics.risk.status,
      healthScore,
      healthLabel: healthLabel(healthScore),
      volatilityPct: round(analytics.risk.volatilityPct),
      maxDrawdownPct: round(analytics.risk.maxDrawdownPct),
      sharpeRatio: round(analytics.risk.sharpeRatio),
      sortinoRatio: round(analytics.risk.sortinoRatio),
      concentrationRiskPct: round(analytics.risk.concentrationRiskPct),
      largestHoldingSymbol: analytics.risk.largestHoldingSymbol,
      flags: riskFlags
    },
    allocation: {
      bySymbol: analytics.allocation.bySymbol.map(roundSlice),
      byAssetType: analytics.allocation.byAssetType.map(roundSlice),
      byCurrency: analytics.allocation.byCurrency.map(roundSlice),
      drift: analytics.allocation.drift.map((row) => ({
        label: row.label,
        currentPct: round(row.currentPct),
        targetPct: round(row.targetPct),
        driftPct: round(row.driftPct),
        value: round(row.value)
      }))
    },
    benchmark: {
      ...analytics.benchmark,
      portfolioReturnPct: round(analytics.benchmark.portfolioReturnPct),
      benchmarkReturnPct: round(analytics.benchmark.benchmarkReturnPct),
      alphaPct: round(analytics.benchmark.alphaPct)
    },
    marketData,
    income: {
      total: round(analytics.income.total),
      byMonth: analytics.income.byMonth.map((row) => ({
        month: row.month,
        dividend: round(row.dividend),
        interest: round(row.interest),
        total: round(row.total)
      }))
    },
    topContributors: {
      gainers: analytics.topContributors.gainers.map((row) => ({
        ...row,
        marketValue: round(row.marketValue),
        unrealizedPnl: round(row.unrealizedPnl),
        unrealizedPnlPct: round(row.unrealizedPnlPct)
      })),
      losers: analytics.topContributors.losers.map((row) => ({
        ...row,
        marketValue: round(row.marketValue),
        unrealizedPnl: round(row.unrealizedPnl),
        unrealizedPnlPct: round(row.unrealizedPnlPct)
      }))
    },
    promptHints: {
      missingData,
      resolvedFromMoomoo: marketData.resolved,
      observationSeeds: buildObservationSeeds(analytics, riskFlags, marketData),
      suggestedAgentOrder: ['risk-agent', 'allocation-agent', 'benchmark-agent', 'copilot-agent']
    }
  } satisfies AiPortfolioContext;

  const contextHash = hashContext(contextWithoutHash);
  return {
    ...contextWithoutHash,
    metadata: {
      ...contextWithoutHash.metadata,
      contextHash
    }
  };
}

export function selectAiContextScope(context: AiPortfolioContext, scope: AiContextScope) {
  if (scope === 'portfolio') return { metadata: context.metadata, portfolio: context.portfolio, performance: context.performance };
  if (scope === 'risk') return { metadata: context.metadata, risk: context.risk, topContributors: context.topContributors };
  if (scope === 'allocation') return { metadata: context.metadata, allocation: context.allocation, portfolio: context.portfolio };
  if (scope === 'performance') return { metadata: context.metadata, performance: context.performance, topContributors: context.topContributors };
  if (scope === 'benchmark') return { metadata: context.metadata, benchmark: context.benchmark, marketData: context.marketData, performance: context.performance };
  return context;
}

export function buildStandardAiContextPayload(context: AiPortfolioContext, scope: AiContextScope = 'full') {
  const fullPayload = {
    metadata: {
      version: context.metadata.version,
      generated_at: context.metadata.generatedAt,
      context_hash: context.metadata.contextHash,
      period: context.metadata.period,
      benchmark: context.metadata.benchmark,
      data_source: context.metadata.dataSource,
      latest_snapshot_date: context.metadata.latestSnapshotDate,
      snapshot_count: context.metadata.snapshotCount
    },
    portfolio: {
      total_value: context.portfolio.value,
      invested_value: context.portfolio.investedValue,
      cash_balance: context.portfolio.cashBalance,
      cash_ratio: context.portfolio.cashRatio,
      net_contribution: context.portfolio.netContribution,
      holdings_count: context.portfolio.holdingsCount,
      currency: context.metadata.baseCurrency,
      holdings: context.portfolio.holdings
    },
    risk: {
      risk_level: context.risk.healthLabel,
      health_score: context.risk.healthScore,
      volatility: context.risk.volatilityPct,
      max_drawdown: context.risk.maxDrawdownPct,
      sharpe_ratio: context.risk.sharpeRatio,
      sortino_ratio: context.risk.sortinoRatio,
      concentration_risk: context.risk.concentrationRiskPct,
      largest_holding_symbol: context.risk.largestHoldingSymbol,
      flags: context.risk.flags
    },
    allocation: {
      by_symbol: context.allocation.bySymbol,
      by_asset_type: context.allocation.byAssetType,
      by_currency: context.allocation.byCurrency,
      drift: context.allocation.drift
    },
    performance: {
      status: context.performance.status,
      total_return: context.performance.totalReturnPct,
      daily_return: context.performance.dailyReturnPct,
      mtd_return: context.performance.mtdReturnPct,
      ytd_return: context.performance.ytdReturnPct,
      cagr: context.performance.cagrPct,
      unrealized_pnl: context.performance.unrealizedPnl,
      income_total: context.performance.incomeTotal,
      compressed_value_series: context.performance.compressedValueSeries,
      top_contributors: context.topContributors
    },
    benchmark: {
      ...context.benchmark,
      market_data: {
        status: context.marketData.status,
        benchmark_code: context.marketData.benchmarkCode,
        benchmark_history_count: context.marketData.benchmarkHistoryCount,
        benchmark_history_period: context.marketData.benchmarkHistoryPeriod,
        benchmark_candles: context.marketData.benchmarkCandles,
        errors: context.marketData.errors
      }
    },
    summary: {
      observations: context.promptHints.observationSeeds,
      missing_data: context.promptHints.missingData,
      resolved_from_moomoo: context.promptHints.resolvedFromMoomoo
    }
  };

  if (scope === 'portfolio') return { metadata: fullPayload.metadata, portfolio: fullPayload.portfolio };
  if (scope === 'risk') return { metadata: fullPayload.metadata, risk: fullPayload.risk, summary: fullPayload.summary };
  if (scope === 'allocation') return { metadata: fullPayload.metadata, allocation: fullPayload.allocation };
  if (scope === 'performance') return { metadata: fullPayload.metadata, performance: fullPayload.performance };
  if (scope === 'benchmark') return { metadata: fullPayload.metadata, benchmark: fullPayload.benchmark };
  return fullPayload;
}

export function buildAiPromptPayload(context: AiPortfolioContext): AiPromptPayload {
  return {
    system:
      'You are Portfolio AI Copilot. Analyze only the supplied structured portfolio context. Be clear about missing data and avoid guarantees.',
    developer: [
      'Use the context generatedAt timestamp as the freshness boundary.',
      'Separate observations from suggestions.',
      'Do not place trades, claim tax advice, or invent holdings not present in the context.',
      'When data is insufficient, explain the exact missing inputs.'
    ],
    contextBlock: JSON.stringify(context, null, 2),
    userTemplates: {
      portfolioReview: 'Review this portfolio context and summarize health, performance, risk, and allocation issues.',
      riskReview: 'Focus on risk flags, concentration, drawdown, volatility, and missing risk data.',
      allocationReview: 'Focus on asset type, currency, symbol allocation, and drift versus equal-weight reference.',
      benchmarkReview: `Compare the portfolio with ${context.metadata.benchmark} using only the benchmark section.`
    }
  };
}

export async function refreshAiMemory(userId: string, options: BuildOptions = {}) {
  const context = await buildAiPortfolioContext(userId, options);
  const prompt = buildAiPromptPayload(context);
  const summary = buildMemorySummary(context);
  const payloadJson = JSON.stringify(context);
  const promptJson = JSON.stringify(prompt);
  const now = new Date();
  const id = randomUUID();

  await prisma.$executeRaw`
    INSERT INTO AiMemory (
      id, userId, contextType, period, benchmark, contextHash, payloadJson, promptJson, summary, createdAt, updatedAt
    )
    VALUES (
      ${id}, ${userId}, 'portfolio', ${context.metadata.period}, ${context.metadata.benchmark},
      ${context.metadata.contextHash}, ${payloadJson}, ${promptJson}, ${summary}, ${now}, ${now}
    )
    ON DUPLICATE KEY UPDATE
      payloadJson = VALUES(payloadJson),
      promptJson = VALUES(promptJson),
      summary = VALUES(summary),
      updatedAt = VALUES(updatedAt)
  `;

  const [memory] = await prisma.$queryRaw<AiMemoryRow[]>`
    SELECT id, contextType, period, benchmark, contextHash, summary, createdAt, updatedAt
    FROM AiMemory
    WHERE userId = ${userId}
      AND contextType = 'portfolio'
      AND period = ${context.metadata.period}
      AND benchmark = ${context.metadata.benchmark}
      AND contextHash = ${context.metadata.contextHash}
    LIMIT 1
  `;

  return { context, prompt, memory };
}

export async function listAiMemories(userId: string, limit = 10) {
  return prisma.$queryRaw<AiMemoryRow[]>(
    Prisma.sql`
      SELECT id, contextType, period, benchmark, contextHash, summary, createdAt, updatedAt
      FROM AiMemory
      WHERE userId = ${userId}
      ORDER BY createdAt DESC
      LIMIT ${limit}
    `
  );
}

export function parseAiPeriod(value: string | null): AnalyticsPeriod {
  return ANALYTICS_PERIODS.includes(value as AnalyticsPeriod) ? (value as AnalyticsPeriod) : 'MAX';
}

export function parseAiBenchmark(value: string | null): AnalyticsBenchmark {
  return BENCHMARKS.includes(value as AnalyticsBenchmark) ? (value as AnalyticsBenchmark) : 'SPY';
}

export function parseAiScope(value: string | null): AiContextScope {
  if (
    value === 'portfolio' ||
    value === 'risk' ||
    value === 'allocation' ||
    value === 'performance' ||
    value === 'benchmark'
  ) return value;
  return 'full';
}

function aiContextCacheKey(userId: string, period: AnalyticsPeriod, benchmark: AnalyticsBenchmark, scope: AiContextScope) {
  return `ai:${userId}:context:${scope}:${period}:${benchmark}`;
}

function aiContextCacheTtlSeconds() {
  const ttl = Number(env.AI_CONTEXT_CACHE_TTL ?? 300);
  return Number.isFinite(ttl) && ttl > 0 ? ttl : 300;
}

async function readAiContextCache(cacheKey: string) {
  const now = new Date();
  const [row] = await prisma.$queryRaw<CachedAiContextRow[]>`
    SELECT payload_json AS payloadJson, generated_at AS generatedAt, expires_at AS expiresAt
    FROM analytics_cache
    WHERE cache_key = ${cacheKey}
      AND expires_at > ${now}
    LIMIT 1
  `;
  return row ?? null;
}

async function writeAiContextCache(
  userId: string,
  cacheKey: string,
  scope: AiContextScope,
  payload: unknown,
  generatedAt: Date,
  expiresAt: Date
) {
  const payloadJson = JSON.stringify(payload);
  const now = new Date();
  await prisma.$executeRaw`
    INSERT INTO analytics_cache (
      id, user_id, cache_key, cache_type, payload_json, generated_at, expires_at, created_at, updated_at
    )
    VALUES (
      ${randomUUID()}, ${userId}, ${cacheKey}, ${`phase4a_ai_context_${scope}`}, ${payloadJson},
      ${generatedAt}, ${expiresAt}, ${now}, ${now}
    )
    ON DUPLICATE KEY UPDATE
      payload_json = VALUES(payload_json),
      generated_at = VALUES(generated_at),
      expires_at = VALUES(expires_at),
      updated_at = VALUES(updated_at)
  `;
}

function holdingToContext(holding: SnapshotHolding, allocationPct: number): AiHoldingContext {
  const tags = [
    holding.assetType === 'option' ? 'derivative' : '',
    holding.quantity < 0 ? 'short_position' : '',
    allocationPct >= 25 ? 'large_weight' : '',
    holding.unrealizedPnl < 0 ? 'unrealized_loss' : 'unrealized_gain'
  ].filter(Boolean);

  return {
    symbol: holding.symbol,
    name: holding.name || holding.symbol,
    assetType: holding.assetType || 'stock',
    currency: holding.currency || 'USD',
    quantity: round(holding.quantity),
    marketPrice: round(holding.marketPrice),
    marketValue: round(holding.marketValue),
    allocationPct: round(allocationPct),
    unrealizedPnl: round(holding.unrealizedPnl),
    todayPl: round(holding.todayPl),
    tags
  };
}

async function buildMoomooMarketContext(
  holdings: SnapshotHolding[],
  period: AnalyticsPeriod,
  benchmark: AnalyticsBenchmark,
  latestSnapshotDate: Date
): Promise<AiMoomooMarketContext> {
  const codes = [...new Set(holdings.map((holding) => holding.symbol).filter(Boolean))];
  const benchmarkCode = BENCHMARK_CODES[benchmark];
  const end = isoDate(new Date());
  const start = isoDate(marketStartDate(period, latestSnapshotDate));
  const errors: string[] = [];

  const [quotesResult, statesResult, benchmarkResult] = await Promise.allSettled([
    getQuoteSnapshots(codes),
    getMarketStates(codes),
    getHistoricalCandles(benchmarkCode, start, end)
  ]);

  const quotes = unwrapSettled(quotesResult, 'Moomoo quote snapshot unavailable', errors);
  const marketStates = unwrapSettled(statesResult, 'Moomoo market state unavailable', errors);
  const benchmarkCandles = unwrapSettled(benchmarkResult, 'Moomoo benchmark history unavailable', errors);
  const resolved: string[] = [];

  if (quotes.length > 0) resolved.push(`Moomoo quote snapshot returned ${quotes.length} holding quotes.`);
  if (marketStates.length > 0) resolved.push(`Moomoo market-state API returned ${marketStates.length} holding states.`);
  if (benchmarkCandles.length >= 2) {
    resolved.push(`Moomoo historical candles returned ${benchmarkCandles.length} rows for ${benchmarkCode}.`);
  }

  const status =
    errors.length === 0 && (quotes.length > 0 || marketStates.length > 0 || benchmarkCandles.length > 0)
      ? 'ready'
      : errors.length > 0 && (quotes.length > 0 || marketStates.length > 0 || benchmarkCandles.length > 0)
        ? 'partial'
        : 'unavailable';

  return {
    source: 'moomoo_api',
    status,
    checkedAt: new Date().toISOString(),
    holdingsQuoteCount: quotes.length,
    holdingsStateCount: marketStates.length,
    benchmarkCode,
    benchmarkHistoryCount: benchmarkCandles.length,
    benchmarkHistoryPeriod: { start, end },
    quotes: quotes.map(normalizeQuote),
    marketStates: marketStates.map(normalizeMarketState),
    benchmarkCandles: compressSeries(benchmarkCandles).map((candle) => ({
      date: String(candle.time_key).slice(0, 10),
      close: round(Number(candle.close)),
      changeRate: round(Number(candle.change_rate ?? 0))
    })),
    errors,
    resolved
  };
}

function buildRiskFlags(analytics: AnalyticsDashboard): AiRiskFlag[] {
  const flags: AiRiskFlag[] = [];
  if (analytics.summary.status === 'insufficient_data') {
    flags.push({
      severity: 'medium',
      code: 'INSUFFICIENT_HISTORY',
      title: 'Limited snapshot history',
      detail: analytics.summary.message
    });
  }
  if (analytics.risk.concentrationRiskPct >= 35) {
    flags.push({
      severity: analytics.risk.concentrationRiskPct >= 50 ? 'high' : 'medium',
      code: 'CONCENTRATION_RISK',
      title: 'Largest holding concentration',
      detail: `${analytics.risk.largestHoldingSymbol || 'Largest holding'} is ${round(analytics.risk.concentrationRiskPct)}% of positive invested holdings.`
    });
  }
  const hasOptions = [...analytics.topContributors.gainers, ...analytics.topContributors.losers].some(
    (holding) => holding.assetType.toLowerCase() === 'option'
  );
  if (hasOptions) {
    flags.push({
      severity: 'medium',
      code: 'OPTIONS_EXPOSURE',
      title: 'Options exposure present',
      detail: 'Portfolio contains option positions that may need separate risk review.'
    });
  }
  if (analytics.risk.maxDrawdownPct <= -10) {
    flags.push({
      severity: analytics.risk.maxDrawdownPct <= -20 ? 'high' : 'medium',
      code: 'DRAWDOWN',
      title: 'Drawdown pressure',
      detail: `Max drawdown is ${round(analytics.risk.maxDrawdownPct)}%.`
    });
  }
  if (analytics.summary.cashRatio >= 30) {
    flags.push({
      severity: 'low',
      code: 'HIGH_CASH',
      title: 'High cash ratio',
      detail: `Cash is ${round(analytics.summary.cashRatio)}% of portfolio value.`
    });
  }

  return flags;
}

function buildMissingData(analytics: AnalyticsDashboard, marketData: AiMoomooMarketContext) {
  const missing: string[] = [];
  if (analytics.summary.snapshotCount < 2) {
    missing.push('Need at least 2 portfolio snapshots for portfolio returns. Moomoo quotes were checked, but they cannot reconstruct previous total account value by themselves.');
  }
  if (analytics.summary.snapshotCount < 3) {
    missing.push('Need at least 3 portfolio snapshots for volatility, Sharpe, and Sortino. Moomoo market data can enrich prices, but risk needs portfolio value history.');
  }
  if (analytics.benchmark.status !== 'ready' && marketData.benchmarkHistoryCount < 2) {
    missing.push(analytics.benchmark.message);
  }
  if (marketData.status === 'unavailable') missing.push(`Moomoo market API unavailable: ${marketData.errors.join(' ') || 'No quote response.'}`);
  if (analytics.income.byMonth.length === 0) missing.push('No dividend or interest transactions available.');
  return missing;
}

function buildObservationSeeds(
  analytics: AnalyticsDashboard,
  flags: AiRiskFlag[],
  marketData: AiMoomooMarketContext
) {
  const seeds = [
    `Portfolio value is ${round(analytics.summary.portfolioValue)} with ${round(analytics.summary.cashRatio)}% cash.`,
    `Selected-period return is ${round(analytics.summary.totalReturnPct)}%.`,
    `Benchmark alpha versus ${analytics.benchmark.benchmark} is ${round(analytics.benchmark.alphaPct)}%.`,
    `Moomoo market API status is ${marketData.status}; ${marketData.holdingsQuoteCount} quotes and ${marketData.benchmarkHistoryCount} benchmark candles were available.`,
    ...flags.map((flag) => `${flag.title}: ${flag.detail}`)
  ];

  return seeds.slice(0, 8);
}

function calculateHealthScore(analytics: AnalyticsDashboard, flags: AiRiskFlag[]) {
  let score = 100;
  score -= Math.min(Math.max(analytics.risk.concentrationRiskPct - 20, 0), 35);
  score -= Math.min(Math.abs(Math.min(analytics.risk.maxDrawdownPct, 0)), 25);
  score -= flags.filter((flag) => flag.severity === 'high').length * 15;
  score -= flags.filter((flag) => flag.severity === 'medium').length * 8;
  if (analytics.summary.status === 'insufficient_data') score -= 10;
  return Math.max(0, Math.min(100, round(score, 0)));
}

function healthLabel(score: number): AiPortfolioContext['risk']['healthLabel'] {
  if (score >= 75) return 'stable';
  if (score >= 50) return 'watch';
  return 'elevated_risk';
}

function buildMemorySummary(context: AiPortfolioContext) {
  return [
    `${context.metadata.period}/${context.metadata.benchmark}`,
    `value ${context.portfolio.value}`,
    `${context.portfolio.holdingsCount} holdings`,
    `health ${context.risk.healthLabel}`,
    `${context.risk.flags.length} risk flags`
  ].join(' | ');
}

function hashContext(context: AiPortfolioContext) {
  const stableContext = {
    ...context,
    metadata: {
      ...context.metadata,
      generatedAt: '',
      contextHash: ''
    },
    marketData: {
      ...context.marketData,
      checkedAt: ''
    }
  };
  return createHash('sha256').update(JSON.stringify(stableContext)).digest('hex').slice(0, 16);
}

function parseHoldings(json: string | undefined): SnapshotHolding[] {
  try {
    const rows = JSON.parse(json ?? '[]');
    return Array.isArray(rows) ? rows : [];
  } catch {
    return [];
  }
}

function compressSeries<T>(series: T[]) {
  if (series.length <= 12) return series;
  const step = Math.ceil(series.length / 10);
  const sampled = series.filter((_, index) => index % step === 0);
  const last = series.at(-1);
  return last && sampled.at(-1) !== last ? [...sampled, last] : sampled;
}

function unwrapSettled<T>(result: PromiseSettledResult<T[]>, label: string, errors: string[]) {
  if (result.status === 'fulfilled') return result.value;
  errors.push(`${label}: ${result.reason instanceof Error ? result.reason.message : String(result.reason)}`);
  return [];
}

function normalizeQuote(quote: QuoteSnapshot) {
  return {
    code: quote.code,
    name: quote.name ?? quote.code,
    updateTime: quote.update_time ?? null,
    lastPrice: round(Number(quote.last_price ?? 0)),
    prevClosePrice: round(Number(quote.prev_close_price ?? 0)),
    bidPrice: round(Number(quote.bid_price ?? 0)),
    askPrice: round(Number(quote.ask_price ?? 0)),
    volume: round(Number(quote.volume ?? 0), 0)
  };
}

function normalizeMarketState(state: MarketState) {
  return {
    code: state.code,
    marketState: String(state.market_state ?? '')
  };
}

function marketStartDate(period: AnalyticsPeriod, latestSnapshotDate: Date) {
  const start = new Date(latestSnapshotDate);
  const days = {
    '1D': 7,
    '1W': 7,
    '1M': 31,
    '3M': 92,
    '6M': 183,
    YTD: Math.max(31, Math.ceil((latestSnapshotDate.getTime() - Date.UTC(latestSnapshotDate.getUTCFullYear(), 0, 1)) / 86_400_000)),
    '1Y': 365,
    '3Y': 365 * 3,
    '5Y': 365 * 5,
    MAX: 31
  }[period];
  start.setUTCDate(start.getUTCDate() - days);
  return start;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function roundSlice(slice: AllocationSlice): AllocationSlice {
  return {
    label: slice.label,
    value: round(slice.value),
    percentage: round(slice.percentage)
  };
}

function round(value: number, decimals = 4) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
