import { createHash, randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { prisma } from '$lib/server/db';
import {
  buildAiPortfolioContext,
  buildStandardAiContextPayload,
  parseAiBenchmark,
  parseAiPeriod,
  type AiPortfolioContext
} from '$lib/services/ai-context.service';
import type { AnalyticsBenchmark, AnalyticsPeriod } from '$lib/services/analytics.service';

export const AI_MEMORY_VERSION = 'phase-4c.0';

export const AI_MEMORY_TYPES = [
  'portfolio_summary',
  'risk_snapshot',
  'allocation_snapshot',
  'benchmark_snapshot',
  'performance_snapshot',
  'market_commentary'
] as const;

export type AiMemoryType = (typeof AI_MEMORY_TYPES)[number];

export type AiMemoryOptions = {
  period?: AnalyticsPeriod;
  benchmark?: AnalyticsBenchmark;
  snapshotType?: AiMemoryType;
  forceRefresh?: boolean;
};

type AiMemorySnapshotRow = {
  id: string;
  userId: string;
  snapshotType: AiMemoryType;
  snapshotVersion: string;
  contextJson: string;
  compressedContextJson: string;
  summary: string;
  metadataJson: string;
  createdAt: Date;
  updatedAt: Date;
};

type AiTimelineRow = {
  id: string;
  userId: string;
  memorySnapshotId: string;
  timelineType: string;
  timelineKey: string;
  timelineValue: string;
  metadataJson: string;
  createdAt: Date;
};

type AiHistoricalInsightRow = {
  id: string;
  userId: string;
  insightType: string;
  title: string;
  summary: string;
  contextReference: string;
  metadataJson: string;
  createdAt: Date;
};

type CachedMemoryRow = {
  payloadJson: string;
  generatedAt: Date;
  expiresAt: Date;
};

export async function getAiMemoryOverview(userId: string, options: AiMemoryOptions = {}) {
  const [latest, history, timeline, insights] = await Promise.all([
    getLatestAiMemory(userId, options),
    listAiMemorySnapshots(userId, { ...options, limit: 12 }),
    listAiMemoryTimeline(userId, 20),
    listAiHistoricalInsights(userId, 12)
  ]);

  return {
    status: 'ready' as const,
    latest,
    history,
    timeline,
    insights,
    memoryTypes: AI_MEMORY_TYPES
  };
}

export async function getLatestAiMemory(userId: string, options: AiMemoryOptions = {}) {
  if (env.AI_MEMORY_ENABLED === 'false') {
    return {
      status: 'disabled' as const,
      message: 'AI memory layer is disabled by AI_MEMORY_ENABLED=false.'
    };
  }

  const cacheEnabled = env.AI_MEMORY_CACHE_ENABLED !== 'false';
  const cacheKey = latestMemoryCacheKey(userId, options.snapshotType ?? 'portfolio_summary');

  if (cacheEnabled && !options.forceRefresh) {
    const cached = await readMemoryCache(cacheKey);
    if (cached) {
      return {
        ...JSON.parse(cached.payloadJson),
        cache: {
          enabled: true,
          hit: true,
          key: cacheKey,
          generatedAt: cached.generatedAt.toISOString(),
          expiresAt: cached.expiresAt.toISOString()
        }
      };
    }
  }

  const [row] = await prisma.$queryRaw<AiMemorySnapshotRow[]>`
    SELECT id, user_id AS userId, snapshot_type AS snapshotType, snapshot_version AS snapshotVersion,
      context_json AS contextJson, compressed_context_json AS compressedContextJson,
      summary, metadata AS metadataJson, created_at AS createdAt, updated_at AS updatedAt
    FROM ai_memory_snapshots
    WHERE user_id = ${userId}
      AND snapshot_type = ${options.snapshotType ?? 'portfolio_summary'}
    ORDER BY created_at DESC
    LIMIT 1
  `;

  if (!row) return null;

  const payload = mapMemorySnapshot(row);
  if (cacheEnabled) {
    const generatedAt = new Date();
    const expiresAt = new Date(generatedAt.getTime() + aiMemoryCacheTtlSeconds() * 1000);
    await writeMemoryCache(userId, cacheKey, 'latest', payload, generatedAt, expiresAt);
    return {
      ...payload,
      cache: {
        enabled: true,
        hit: false,
        key: cacheKey,
        generatedAt: generatedAt.toISOString(),
        expiresAt: expiresAt.toISOString()
      }
    };
  }

  return { ...payload, cache: { enabled: false, hit: false } };
}

export async function refreshAiMemorySnapshot(userId: string, options: AiMemoryOptions = {}) {
  if (env.AI_MEMORY_ENABLED === 'false') {
    return {
      status: 'disabled' as const,
      message: 'AI memory layer is disabled by AI_MEMORY_ENABLED=false.'
    };
  }

  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const snapshotType = options.snapshotType ?? 'portfolio_summary';
  const context = await buildAiPortfolioContext(userId, { period, benchmark });
  const standardContext = buildStandardAiContextPayload(context, 'full');
  const compressed = compressMemoryContext(context);
  const summary = buildMemorySummary(context, snapshotType);
  const metadata = {
    version: AI_MEMORY_VERSION,
    contextHash: context.metadata.contextHash,
    period,
    benchmark,
    compressionEnabled: env.AI_MEMORY_COMPRESSION !== 'false',
    compressedHash: shortHash(JSON.stringify(compressed)),
    generatedAt: new Date().toISOString()
  };
  const id = randomUUID();
  const now = new Date();

  await prisma.$executeRaw`
    INSERT INTO ai_memory_snapshots (
      id, user_id, snapshot_type, snapshot_version, context_json, compressed_context_json, summary,
      metadata, created_at, updated_at
    )
    VALUES (
      ${id}, ${userId}, ${snapshotType}, ${AI_MEMORY_VERSION}, ${JSON.stringify(standardContext)},
      ${JSON.stringify(compressed)}, ${summary}, ${JSON.stringify(metadata)}, ${now}, ${now}
    )
  `;

  await replaceTimelineEntries(userId, id, context, compressed);
  await writeHistoricalInsights(userId, id, context, compressed);
  await cleanupExpiredMemory(userId);

  const latest = await getLatestAiMemory(userId, { snapshotType, forceRefresh: true });
  const cacheEnabled = env.AI_MEMORY_CACHE_ENABLED !== 'false';
  if (cacheEnabled) {
    const expiresAt = new Date(now.getTime() + aiMemoryCacheTtlSeconds() * 1000);
    await writeMemoryCache(userId, latestMemoryCacheKey(userId, snapshotType), 'latest', latest, now, expiresAt);
    await writeMemoryCache(userId, compressedMemoryCacheKey(userId), 'compressed', compressed, now, expiresAt);
  }

  return {
    status: 'refreshed' as const,
    snapshot: latest,
    compressed,
    timeline: await listAiMemoryTimeline(userId, 20),
    insights: await listAiHistoricalInsights(userId, 12)
  };
}

export async function compressAiMemory(userId: string, options: AiMemoryOptions = {}) {
  const context = await buildAiPortfolioContext(userId, {
    period: options.period ?? 'MAX',
    benchmark: options.benchmark ?? 'SPY'
  });
  const raw = buildStandardAiContextPayload(context, 'full');
  const compressed = compressMemoryContext(context);

  return {
    status: 'ready' as const,
    context_hash: context.metadata.contextHash,
    raw_tokens: estimateTokens(JSON.stringify(raw)),
    compressed_tokens: estimateTokens(JSON.stringify(compressed)),
    compression_ratio: compressionRatio(JSON.stringify(raw), JSON.stringify(compressed)),
    compressed
  };
}

export async function listAiMemorySnapshots(
  userId: string,
  options: AiMemoryOptions & { limit?: number } = {}
) {
  const limit = options.limit ?? 20;
  const rows = await prisma.$queryRaw<AiMemorySnapshotRow[]>`
    SELECT id, user_id AS userId, snapshot_type AS snapshotType, snapshot_version AS snapshotVersion,
      context_json AS contextJson, compressed_context_json AS compressedContextJson,
      summary, metadata AS metadataJson, created_at AS createdAt, updated_at AS updatedAt
    FROM ai_memory_snapshots
    WHERE user_id = ${userId}
      AND snapshot_type = ${options.snapshotType ?? 'portfolio_summary'}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map(mapMemorySnapshot);
}

export async function listAiMemoryTimeline(userId: string, limit = 50) {
  const rows = await prisma.$queryRaw<AiTimelineRow[]>`
    SELECT id, user_id AS userId, memory_snapshot_id AS memorySnapshotId, timeline_type AS timelineType,
      timeline_key AS timelineKey, timeline_value AS timelineValue, metadata AS metadataJson, created_at AS createdAt
    FROM ai_memory_timelines
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    ...row,
    value: parseJson(row.timelineValue, row.timelineValue),
    metadata: parseJson(row.metadataJson, {})
  }));
}

export async function listAiHistoricalInsights(userId: string, limit = 30) {
  const rows = await prisma.$queryRaw<AiHistoricalInsightRow[]>`
    SELECT id, user_id AS userId, insight_type AS insightType, title, summary,
      context_reference AS contextReference, metadata AS metadataJson, created_at AS createdAt
    FROM ai_historical_insights
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map((row) => ({
    ...row,
    metadata: parseJson(row.metadataJson, {})
  }));
}

export function parseAiMemoryType(value: string | null): AiMemoryType {
  return AI_MEMORY_TYPES.includes(value as AiMemoryType) ? (value as AiMemoryType) : 'portfolio_summary';
}

export function parseAiMemoryPeriod(value: string | null) {
  return parseAiPeriod(value);
}

export function parseAiMemoryBenchmark(value: string | null) {
  return parseAiBenchmark(value);
}

function compressMemoryContext(context: AiPortfolioContext) {
  const topHoldings = context.portfolio.holdings
    .slice()
    .sort((a, b) => Math.abs(b.marketValue) - Math.abs(a.marketValue))
    .slice(0, 8)
    .map((holding) => ({
      symbol: holding.symbol,
      asset_type: holding.assetType,
      value: holding.marketValue,
      allocation_pct: holding.allocationPct,
      unrealized_pnl: holding.unrealizedPnl,
      tags: holding.tags
    }));

  return {
    snapshot_date: context.metadata.latestSnapshotDate,
    generated_at: context.metadata.generatedAt,
    context_hash: context.metadata.contextHash,
    version: AI_MEMORY_VERSION,
    portfolio: {
      total_value: context.portfolio.value,
      cash_balance: context.portfolio.cashBalance,
      cash_ratio: context.portfolio.cashRatio,
      holdings_count: context.portfolio.holdingsCount,
      top_holdings: topHoldings
    },
    risk: {
      risk_level: context.risk.healthLabel,
      health_score: context.risk.healthScore,
      main_risk: context.risk.flags[0]?.detail ?? 'No generated risk flag.',
      concentration_risk: context.risk.concentrationRiskPct,
      largest_holding_symbol: context.risk.largestHoldingSymbol,
      volatility: context.risk.volatilityPct,
      flags: context.risk.flags.slice(0, 5)
    },
    allocation: {
      top_symbols: context.allocation.bySymbol.slice(0, 8),
      asset_types: context.allocation.byAssetType,
      currencies: context.allocation.byCurrency,
      drift: context.allocation.drift.slice(0, 8)
    },
    performance: {
      total_return: context.performance.totalReturnPct,
      daily_return: context.performance.dailyReturnPct,
      mtd_return: context.performance.mtdReturnPct,
      ytd_return: context.performance.ytdReturnPct,
      cagr: context.performance.cagrPct,
      unrealized_pnl: context.performance.unrealizedPnl,
      trend: context.performance.compressedValueSeries.slice(-8)
    },
    benchmark: {
      benchmark: context.metadata.benchmark,
      portfolio_return: context.benchmark.portfolioReturnPct,
      benchmark_return: context.benchmark.benchmarkReturnPct,
      alpha: context.benchmark.alphaPct,
      status: context.benchmark.status,
      message: context.benchmark.message
    },
    market: {
      status: context.marketData.status,
      quote_count: context.marketData.holdingsQuoteCount,
      benchmark_code: context.marketData.benchmarkCode,
      benchmark_history_count: context.marketData.benchmarkHistoryCount
    },
    ai_summary: {
      observations: context.promptHints.observationSeeds.slice(0, 8),
      missing_data: context.promptHints.missingData.slice(0, 6),
      resolved_from_moomoo: context.promptHints.resolvedFromMoomoo.slice(0, 5)
    }
  };
}

function buildMemorySummary(context: AiPortfolioContext, type: AiMemoryType) {
  const mainRisk = context.risk.flags[0]?.title ?? 'No major generated risk flag';
  return [
    `${type.replaceAll('_', ' ')}`,
    `value ${context.portfolio.value}`,
    `risk ${context.risk.healthLabel}/${context.risk.healthScore}`,
    `main risk ${mainRisk}`,
    `alpha ${context.benchmark.alphaPct}% vs ${context.metadata.benchmark}`
  ].join(' | ');
}

async function replaceTimelineEntries(
  userId: string,
  memorySnapshotId: string,
  context: AiPortfolioContext,
  compressed: ReturnType<typeof compressMemoryContext>
) {
  const now = new Date();
  const entries = [
    timelineEntry('portfolio_growth', 'portfolio_value', context.portfolio.value, { cashRatio: context.portfolio.cashRatio }),
    timelineEntry('risk_trend', 'health_score', context.risk.healthScore, { riskLevel: context.risk.healthLabel }),
    timelineEntry('risk_trend', 'volatility', context.risk.volatilityPct, { maxDrawdown: context.risk.maxDrawdownPct }),
    timelineEntry('allocation_trend', 'largest_holding', context.risk.largestHoldingSymbol, {
      concentrationRisk: context.risk.concentrationRiskPct
    }),
    timelineEntry('benchmark_trend', 'alpha', context.benchmark.alphaPct, {
      benchmark: context.metadata.benchmark,
      portfolioReturn: context.benchmark.portfolioReturnPct,
      benchmarkReturn: context.benchmark.benchmarkReturnPct
    }),
    timelineEntry('memory_compression', 'compressed_tokens', estimateTokens(JSON.stringify(compressed)), {
      contextHash: context.metadata.contextHash
    })
  ];

  for (const entry of entries) {
    await prisma.$executeRaw`
      INSERT INTO ai_memory_timelines (
        id, user_id, memory_snapshot_id, timeline_type, timeline_key, timeline_value, metadata, created_at, updated_at
      )
      VALUES (
        ${randomUUID()}, ${userId}, ${memorySnapshotId}, ${entry.type}, ${entry.key}, ${JSON.stringify(entry.value)},
        ${JSON.stringify(entry.metadata)}, ${now}, ${now}
      )
    `;
  }
}

async function writeHistoricalInsights(
  userId: string,
  memorySnapshotId: string,
  context: AiPortfolioContext,
  compressed: ReturnType<typeof compressMemoryContext>
) {
  const now = new Date();
  const insights = [
    {
      insightType: 'risk_snapshot',
      title: 'Risk Memory',
      summary: compressed.risk.main_risk,
      metadata: { riskLevel: context.risk.healthLabel, healthScore: context.risk.healthScore }
    },
    {
      insightType: 'allocation_snapshot',
      title: 'Allocation Memory',
      summary: `Largest holding is ${context.risk.largestHoldingSymbol || 'unknown'} with ${context.risk.concentrationRiskPct}% concentration risk.`,
      metadata: { topSymbols: compressed.allocation.top_symbols.slice(0, 3) }
    },
    {
      insightType: 'benchmark_snapshot',
      title: 'Benchmark Memory',
      summary: `Portfolio alpha is ${context.benchmark.alphaPct}% versus ${context.metadata.benchmark}.`,
      metadata: compressed.benchmark
    }
  ];

  for (const insight of insights) {
    await prisma.$executeRaw`
      INSERT INTO ai_historical_insights (
        id, user_id, insight_type, title, summary, context_reference, metadata, created_at, updated_at
      )
      VALUES (
        ${randomUUID()}, ${userId}, ${insight.insightType}, ${insight.title}, ${insight.summary},
        ${memorySnapshotId}, ${JSON.stringify(insight.metadata)}, ${now}, ${now}
      )
    `;
  }
}

async function cleanupExpiredMemory(userId: string) {
  const retentionDays = Number(env.AI_MEMORY_RETENTION_DAYS ?? 365);
  if (!Number.isFinite(retentionDays) || retentionDays <= 0) return;
  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);

  await prisma.$executeRaw`
    DELETE FROM ai_memory_snapshots
    WHERE user_id = ${userId} AND created_at < ${cutoff}
  `;
}

function timelineEntry(type: string, key: string, value: unknown, metadata: Record<string, unknown>) {
  return { type, key, value, metadata };
}

function mapMemorySnapshot(row: AiMemorySnapshotRow) {
  const context = parseJson(row.contextJson, {});
  const compressed = parseJson(row.compressedContextJson, {});
  const metadata = parseJson(row.metadataJson, {});
  return {
    id: row.id,
    userId: row.userId,
    snapshotType: row.snapshotType,
    snapshotVersion: row.snapshotVersion,
    summary: row.summary,
    context,
    compressed,
    metadata,
    tokens: {
      raw: estimateTokens(row.contextJson),
      compressed: estimateTokens(row.compressedContextJson),
      compressionRatio: compressionRatio(row.contextJson, row.compressedContextJson)
    },
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function latestMemoryCacheKey(userId: string, type: AiMemoryType) {
  return `memory:${userId}:latest:${type}`;
}

function compressedMemoryCacheKey(userId: string) {
  return `memory:${userId}:compressed`;
}

function aiMemoryCacheTtlSeconds() {
  const ttl = Number(env.AI_MEMORY_CACHE_TTL ?? 300);
  return Number.isFinite(ttl) && ttl > 0 ? ttl : 300;
}

async function readMemoryCache(cacheKey: string) {
  const now = new Date();
  const [row] = await prisma.$queryRaw<CachedMemoryRow[]>`
    SELECT payload_json AS payloadJson, generated_at AS generatedAt, expires_at AS expiresAt
    FROM analytics_cache
    WHERE cache_key = ${cacheKey}
      AND expires_at > ${now}
    LIMIT 1
  `;
  return row ?? null;
}

async function writeMemoryCache(
  userId: string,
  cacheKey: string,
  label: string,
  payload: unknown,
  generatedAt: Date,
  expiresAt: Date
) {
  const now = new Date();
  await prisma.$executeRaw`
    INSERT INTO analytics_cache (
      id, user_id, cache_key, cache_type, payload_json, generated_at, expires_at, created_at, updated_at
    )
    VALUES (
      ${randomUUID()}, ${userId}, ${cacheKey}, ${`phase4c_ai_memory_${label}`}, ${JSON.stringify(payload)},
      ${generatedAt}, ${expiresAt}, ${now}, ${now}
    )
    ON DUPLICATE KEY UPDATE
      payload_json = VALUES(payload_json),
      generated_at = VALUES(generated_at),
      expires_at = VALUES(expires_at),
      updated_at = VALUES(updated_at)
  `;
}

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function compressionRatio(raw: string, compressed: string) {
  const rawTokens = estimateTokens(raw);
  const compressedTokens = estimateTokens(compressed);
  return rawTokens > 0 ? round(Math.max(0, (1 - compressedTokens / rawTokens) * 100), 2) : 0;
}

function shortHash(value: string) {
  return createHash('sha256').update(value).digest('hex').slice(0, 12);
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function round(value: number, decimals = 2) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}
