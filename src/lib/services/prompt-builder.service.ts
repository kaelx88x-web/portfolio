import { createHash, randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { prisma } from '$lib/server/db';
import {
  buildAiPortfolioContext,
  buildStandardAiContextPayload,
  parseAiBenchmark,
  parseAiPeriod,
  type AiContextScope,
  type AiPortfolioContext
} from '$lib/services/ai-context.service';
import type { AnalyticsBenchmark, AnalyticsPeriod } from '$lib/services/analytics.service';

export const PROMPT_BUILDER_VERSION = 'phase-4b.0';

export const PROMPT_TYPES = [
  'portfolio_health',
  'risk_analysis',
  'allocation_review',
  'benchmark_summary',
  'performance_summary',
  'market_commentary'
] as const;

export const PROMPT_PROVIDERS = ['openai', 'gemini', 'claude', 'ollama'] as const;

export type PromptType = (typeof PROMPT_TYPES)[number];
export type PromptProvider = (typeof PROMPT_PROVIDERS)[number];

export type PromptTemplate = {
  id: string;
  name: string;
  slug: PromptType;
  version: string;
  systemPrompt: string;
  userPromptTemplate: string;
  isActive: boolean;
  metadata: Record<string, unknown>;
  updatedAt: Date;
};

export type PromptBuilderOptions = {
  promptType?: PromptType;
  provider?: PromptProvider;
  model?: string;
  question?: string;
  period?: AnalyticsPeriod;
  benchmark?: AnalyticsBenchmark;
  compression?: boolean;
  forceRefresh?: boolean;
};

export type PromptMessages = {
  system: string;
  user: string;
};

type PromptTemplateRow = {
  id: string;
  name: string;
  slug: string;
  version: string;
  systemPrompt: string;
  userPromptTemplate: string;
  isActive: boolean;
  metadataJson: string;
  updatedAt: Date;
};

type CachedPromptRow = {
  payloadJson: string;
  generatedAt: Date;
  expiresAt: Date;
};

const DEFAULT_SYSTEM_PROMPT = [
  'You are Portfolio AI Copilot, an advisory-only portfolio analysis assistant.',
  'Use only the supplied structured portfolio context.',
  'Explain uncertainty, missing data, risk, and assumptions clearly.',
  'Never promise profits, execute trades, or give direct buy/sell commands.',
  'Keep language neutral and practical.'
].join('\n');

const SAFETY_PROMPT = [
  'Safety rules:',
  '- Do not guarantee returns.',
  '- Do not instruct the user to buy or sell immediately.',
  '- Do not invent holdings, prices, or benchmark data.',
  '- Separate observed data from possible considerations.',
  '- Mention stale or missing context when relevant.'
].join('\n');

const DEFAULT_TEMPLATES: Record<PromptType, { name: string; user: string; scope: AiContextScope }> = {
  portfolio_health: {
    name: 'Portfolio Health',
    scope: 'full',
    user: [
      'Review the portfolio health using the context below.',
      '',
      'Portfolio Context:',
      '{{portfolio_context}}',
      '',
      'User Question:',
      '{{question}}',
      '',
      'Return:',
      '- Health summary',
      '- Key performance and risk observations',
      '- Missing data or uncertainty',
      '- Advisory-only considerations'
    ].join('\n')
  },
  risk_analysis: {
    name: 'Risk Analysis',
    scope: 'risk',
    user: [
      'Explain portfolio risk clearly.',
      '',
      'Portfolio Context:',
      '{{portfolio_context}}',
      '',
      'User Question:',
      '{{question}}',
      '',
      'Return:',
      '- Risk summary',
      '- Main concentration risk',
      '- Important observations',
      '- Safer considerations'
    ].join('\n')
  },
  allocation_review: {
    name: 'Allocation Review',
    scope: 'allocation',
    user: [
      'Review allocation balance, asset mix, currency mix, and drift.',
      '',
      'Portfolio Context:',
      '{{portfolio_context}}',
      '',
      'User Question:',
      '{{question}}',
      '',
      'Return:',
      '- Allocation summary',
      '- Largest exposures',
      '- Drift observations',
      '- Rebalancing considerations without trade commands'
    ].join('\n')
  },
  benchmark_summary: {
    name: 'Benchmark Summary',
    scope: 'benchmark',
    user: [
      'Compare the portfolio with the selected benchmark.',
      '',
      'Portfolio Context:',
      '{{portfolio_context}}',
      '',
      'User Question:',
      '{{question}}',
      '',
      'Return:',
      '- Benchmark comparison',
      '- Alpha or relative return observation',
      '- Market data quality',
      '- Caveats'
    ].join('\n')
  },
  performance_summary: {
    name: 'Performance Summary',
    scope: 'performance',
    user: [
      'Summarize portfolio performance.',
      '',
      'Portfolio Context:',
      '{{portfolio_context}}',
      '',
      'User Question:',
      '{{question}}',
      '',
      'Return:',
      '- Performance summary',
      '- Main contributors',
      '- Return and drawdown context',
      '- Missing data warnings'
    ].join('\n')
  },
  market_commentary: {
    name: 'Market Commentary',
    scope: 'benchmark',
    user: [
      'Explain market context tied to the portfolio and benchmark data.',
      '',
      'Portfolio Context:',
      '{{portfolio_context}}',
      '',
      'User Question:',
      '{{question}}',
      '',
      'Return:',
      '- Market state summary',
      '- Benchmark movement',
      '- Holdings data availability',
      '- Advisory-only caveats'
    ].join('\n')
  }
};

export async function listPromptTemplates() {
  const rows = await prisma.$queryRaw<PromptTemplateRow[]>`
    SELECT id, name, slug, version, systemPrompt, userPromptTemplate, isActive, metadataJson, updatedAt
    FROM ai_prompt_templates
    ORDER BY slug ASC
  `;

  if (rows.length > 0) return rows.map(mapTemplateRow).filter((row) => PROMPT_TYPES.includes(row.slug));
  return fallbackTemplates();
}

export async function getPromptTemplate(slug: PromptType) {
  const [row] = await prisma.$queryRaw<PromptTemplateRow[]>`
    SELECT id, name, slug, version, systemPrompt, userPromptTemplate, isActive, metadataJson, updatedAt
    FROM ai_prompt_templates
    WHERE slug = ${slug} AND isActive = true
    ORDER BY updatedAt DESC
    LIMIT 1
  `;

  if (row) return mapTemplateRow(row);
  return fallbackTemplates().find((template) => template.slug === slug) ?? fallbackTemplates()[0];
}

export async function reloadPromptTemplates() {
  const now = new Date();
  for (const [slug, template] of Object.entries(DEFAULT_TEMPLATES) as Array<[PromptType, (typeof DEFAULT_TEMPLATES)[PromptType]]>) {
    await prisma.$executeRaw`
      INSERT INTO ai_prompt_templates (
        id, name, slug, version, systemPrompt, userPromptTemplate, isActive, metadataJson, createdAt, updatedAt
      )
      VALUES (
        ${randomUUID()}, ${template.name}, ${slug}, ${PROMPT_BUILDER_VERSION}, ${DEFAULT_SYSTEM_PROMPT},
        ${template.user}, true, ${JSON.stringify({ source: 'phase-4b-default', scope: template.scope })}, ${now}, ${now}
      )
      ON DUPLICATE KEY UPDATE
        name = VALUES(name),
        systemPrompt = VALUES(systemPrompt),
        userPromptTemplate = VALUES(userPromptTemplate),
        isActive = VALUES(isActive),
        metadataJson = VALUES(metadataJson),
        updatedAt = VALUES(updatedAt)
    `;
  }

  return listPromptTemplates();
}

export async function generatePrompt(userId: string, options: PromptBuilderOptions = {}) {
  if (env.PROMPT_BUILDER_ENABLED === 'false') {
    return {
      status: 'disabled' as const,
      message: 'Prompt Builder is disabled by PROMPT_BUILDER_ENABLED=false.'
    };
  }

  const promptType = options.promptType ?? 'portfolio_health';
  const provider = options.provider ?? defaultProvider();
  const model = options.model ?? defaultModel(provider);
  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const compressionEnabled = options.compression ?? env.PROMPT_COMPRESSION_ENABLED !== 'false';
  const template = await getPromptTemplate(promptType);
  const context = await buildAiPortfolioContext(userId, { period, benchmark });
  const contextPayload = buildStandardAiContextPayload(context, contextScopeForPrompt(promptType));
  const compressed = compressPromptContext(contextPayload, promptType);
  const contextForPrompt = compressionEnabled ? compressed.context : contextPayload;
  const contextBlock = JSON.stringify(contextForPrompt, null, 2);
  const question = sanitizeQuestion(options.question ?? defaultQuestion(promptType));
  const cacheKey = promptCacheKey(userId, promptType, provider, model, context.metadata.contextHash, question, compressionEnabled);
  const cacheEnabled = env.PROMPT_CACHE_ENABLED !== 'false';

  if (cacheEnabled && !options.forceRefresh) {
    const cached = await readPromptCache(cacheKey);
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

  const messages = buildPromptMessages(template, contextBlock, question);
  const formatted = formatForProvider(provider, model, messages);
  const rawMessages = buildPromptMessages(template, JSON.stringify(contextPayload, null, 2), question);
  const rawPromptTokens = estimateTokens(rawMessages.system + rawMessages.user);
  const compressedTokens = estimateTokens(messages.system + messages.user);

  const payload = {
    status: 'ready' as const,
    provider,
    model,
    prompt_type: promptType,
    version: PROMPT_BUILDER_VERSION,
    template: {
      slug: template.slug,
      name: template.name,
      version: template.version
    },
    context: {
      hash: context.metadata.contextHash,
      period,
      benchmark,
      scope: contextScopeForPrompt(promptType),
      compressed: compressionEnabled,
      raw_tokens: rawPromptTokens,
      compressed_tokens: compressedTokens,
      compression_ratio: rawPromptTokens > 0 ? round((1 - compressedTokens / rawPromptTokens) * 100, 2) : 0,
      removed_fields: compressionEnabled ? compressed.removedFields : []
    },
    prompt: `${messages.system}\n\n${messages.user}`,
    messages,
    formatted
  };

  const generatedAt = new Date();
  const expiresAt = new Date(generatedAt.getTime() + promptCacheTtlSeconds() * 1000);
  if (cacheEnabled) await writePromptCache(userId, cacheKey, promptType, payload, generatedAt, expiresAt);
  await logPromptBuild(userId, promptType, provider, model, rawPromptTokens, compressedTokens, 'ready', {
    contextHash: context.metadata.contextHash,
    cacheKey: cacheEnabled ? cacheKey : null,
    compressionEnabled
  });

  return {
    ...payload,
    cache: {
      enabled: cacheEnabled,
      hit: false,
      key: cacheEnabled ? cacheKey : undefined,
      generatedAt: generatedAt.toISOString(),
      expiresAt: cacheEnabled ? expiresAt.toISOString() : undefined
    }
  };
}

export async function compressLivePromptContext(userId: string, options: PromptBuilderOptions = {}) {
  const promptType = options.promptType ?? 'portfolio_health';
  const period = options.period ?? 'MAX';
  const benchmark = options.benchmark ?? 'SPY';
  const context = await buildAiPortfolioContext(userId, { period, benchmark });
  const raw = buildStandardAiContextPayload(context, contextScopeForPrompt(promptType));
  const compressed = compressPromptContext(raw, promptType);

  return {
    status: 'ready' as const,
    prompt_type: promptType,
    context_hash: context.metadata.contextHash,
    raw_tokens: estimateTokens(JSON.stringify(raw)),
    compressed_tokens: estimateTokens(JSON.stringify(compressed.context)),
    removed_fields: compressed.removedFields,
    context: compressed.context
  };
}

export async function refreshPromptCache(userId: string) {
  const templates = await reloadPromptTemplates();
  const now = new Date();
  await prisma.$executeRaw`
    UPDATE analytics_cache
    SET expires_at = ${now}, updated_at = ${now}
    WHERE user_id = ${userId} AND cache_type LIKE 'phase4b_prompt_%'
  `;

  return {
    status: 'refreshed' as const,
    templates: templates.length
  };
}

export function buildProviderMessages(result: Awaited<ReturnType<typeof generatePrompt>>): PromptMessages {
  if ('messages' in result) return result.messages;
  return { system: DEFAULT_SYSTEM_PROMPT, user: '' };
}

export function parsePromptType(value: string | null): PromptType {
  return PROMPT_TYPES.includes(value as PromptType) ? (value as PromptType) : 'portfolio_health';
}

export function parsePromptProvider(value: string | null): PromptProvider {
  const provider = value?.toLowerCase() ?? '';
  return PROMPT_PROVIDERS.includes(provider as PromptProvider) ? (provider as PromptProvider) : defaultProvider();
}

export function parsePromptPeriod(value: string | null) {
  return parseAiPeriod(value);
}

export function parsePromptBenchmark(value: string | null) {
  return parseAiBenchmark(value);
}

function buildPromptMessages(template: PromptTemplate, contextBlock: string, question: string): PromptMessages {
  return {
    system: [template.systemPrompt.trim(), SAFETY_PROMPT].filter(Boolean).join('\n\n'),
    user: template.userPromptTemplate
      .replaceAll('{{portfolio_context}}', contextBlock)
      .replaceAll('{{question}}', question)
      .trim()
  };
}

function formatForProvider(provider: PromptProvider, model: string, messages: PromptMessages) {
  if (provider === 'openai') {
    return {
      model,
      messages: [
        { role: 'system', content: messages.system },
        { role: 'user', content: messages.user }
      ]
    };
  }

  if (provider === 'gemini') {
    return {
      model,
      systemInstruction: { parts: [{ text: messages.system }] },
      contents: [{ role: 'user', parts: [{ text: messages.user }] }]
    };
  }

  if (provider === 'claude') {
    return {
      model,
      system: messages.system,
      messages: [{ role: 'user', content: messages.user }]
    };
  }

  return {
    model,
    stream: false,
    messages: [
      { role: 'system', content: messages.system },
      { role: 'user', content: messages.user }
    ]
  };
}

function compressPromptContext(context: unknown, promptType: PromptType) {
  const payload = JSON.parse(JSON.stringify(context));
  const removedFields: string[] = [];

  if (payload?.portfolio?.holdings?.length > 8) {
    payload.portfolio.holdings = payload.portfolio.holdings.slice(0, 8);
    removedFields.push('portfolio.holdings trimmed to top 8');
  }

  if (payload?.performance?.compressed_value_series?.length > 8) {
    payload.performance.compressed_value_series = lastItems(payload.performance.compressed_value_series, 8);
    removedFields.push('performance.compressed_value_series trimmed to last 8');
  }

  if (payload?.benchmark?.market_data?.benchmark_candles?.length > 8) {
    payload.benchmark.market_data.benchmark_candles = lastItems(payload.benchmark.market_data.benchmark_candles, 8);
    removedFields.push('benchmark.market_data.benchmark_candles trimmed to last 8');
  }

  if (payload?.benchmark?.market_data?.errors?.length === 0) {
    delete payload.benchmark.market_data.errors;
    removedFields.push('benchmark.market_data.errors removed when empty');
  }

  if (promptType !== 'market_commentary' && payload?.benchmark?.market_data) {
    delete payload.benchmark.market_data.benchmark_candles;
    removedFields.push('benchmark.market_data.benchmark_candles removed outside market commentary');
  }

  if (promptType === 'risk_analysis') {
    if (payload.allocation) {
      delete payload.allocation;
      removedFields.push('allocation removed for risk_analysis');
    }
    if (payload.benchmark) {
      delete payload.benchmark;
      removedFields.push('benchmark removed for risk_analysis');
    }
  }

  if (promptType === 'allocation_review') {
    if (payload.risk?.flags) {
      delete payload.risk.flags;
      removedFields.push('risk.flags removed for allocation_review');
    }
    if (payload.performance) {
      delete payload.performance;
      removedFields.push('performance removed for allocation_review');
    }
  }

  return { context: payload, removedFields };
}

function contextScopeForPrompt(promptType: PromptType): AiContextScope {
  return DEFAULT_TEMPLATES[promptType].scope;
}

function fallbackTemplates(): PromptTemplate[] {
  return (Object.entries(DEFAULT_TEMPLATES) as Array<[PromptType, (typeof DEFAULT_TEMPLATES)[PromptType]]>).map(
    ([slug, template]) => ({
      id: slug,
      name: template.name,
      slug,
      version: PROMPT_BUILDER_VERSION,
      systemPrompt: DEFAULT_SYSTEM_PROMPT,
      userPromptTemplate: template.user,
      isActive: true,
      metadata: { source: 'in-memory-default', scope: template.scope },
      updatedAt: new Date()
    })
  );
}

function mapTemplateRow(row: PromptTemplateRow): PromptTemplate {
  return {
    ...row,
    slug: parsePromptType(row.slug),
    metadata: parseJson(row.metadataJson, {})
  };
}

function defaultProvider(): PromptProvider {
  return parseProviderValue(env.PROMPT_DEFAULT_PROVIDER ?? 'gemini');
}

function parseProviderValue(value: string): PromptProvider {
  const provider = value.toLowerCase();
  return PROMPT_PROVIDERS.includes(provider as PromptProvider) ? (provider as PromptProvider) : 'gemini';
}

function defaultModel(provider: PromptProvider) {
  if (env.PROMPT_DEFAULT_MODEL) return env.PROMPT_DEFAULT_MODEL;
  if (provider === 'openai') return 'gpt-4.1-mini';
  if (provider === 'claude') return 'claude-3-5-sonnet-latest';
  if (provider === 'ollama') return 'llama3.1';
  return 'gemini-2.5-pro';
}

function defaultQuestion(promptType: PromptType) {
  return `Generate a ${promptType.replaceAll('_', ' ')} for this portfolio.`;
}

function sanitizeQuestion(question: string) {
  const clean = question.trim().replace(/\s+/g, ' ');
  return clean.length > 0 ? clean.slice(0, 800) : 'Review this portfolio.';
}

function promptCacheKey(
  userId: string,
  promptType: PromptType,
  provider: PromptProvider,
  model: string,
  contextHash: string,
  question: string,
  compression: boolean
) {
  return `prompt:${userId}:${promptType}:${provider}:${model}:${contextHash}:${compression ? 'compressed' : 'raw'}:${shortHash(question)}`;
}

function promptCacheTtlSeconds() {
  const ttl = Number(env.PROMPT_CACHE_TTL ?? 300);
  return Number.isFinite(ttl) && ttl > 0 ? ttl : 300;
}

async function readPromptCache(cacheKey: string) {
  const now = new Date();
  const [row] = await prisma.$queryRaw<CachedPromptRow[]>`
    SELECT payload_json AS payloadJson, generated_at AS generatedAt, expires_at AS expiresAt
    FROM analytics_cache
    WHERE cache_key = ${cacheKey}
      AND expires_at > ${now}
    LIMIT 1
  `;
  return row ?? null;
}

async function writePromptCache(
  userId: string,
  cacheKey: string,
  promptType: PromptType,
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
      ${randomUUID()}, ${userId}, ${cacheKey}, ${`phase4b_prompt_${promptType}`}, ${JSON.stringify(payload)},
      ${generatedAt}, ${expiresAt}, ${now}, ${now}
    )
    ON DUPLICATE KEY UPDATE
      payload_json = VALUES(payload_json),
      generated_at = VALUES(generated_at),
      expires_at = VALUES(expires_at),
      updated_at = VALUES(updated_at)
  `;
}

async function logPromptBuild(
  userId: string,
  promptType: PromptType,
  provider: PromptProvider,
  model: string,
  promptTokens: number,
  compressedTokens: number,
  status: string,
  metadata: Record<string, unknown>
) {
  const now = new Date();
  await prisma.$executeRaw`
    INSERT INTO ai_prompt_logs (
      id, user_id, prompt_type, provider, model, prompt_tokens, compressed_tokens, status, metadata, created_at, updated_at
    )
    VALUES (
      ${randomUUID()}, ${userId}, ${promptType}, ${provider}, ${model}, ${promptTokens}, ${compressedTokens},
      ${status}, ${JSON.stringify(metadata)}, ${now}, ${now}
    )
  `;
}

function estimateTokens(value: string) {
  return Math.max(1, Math.ceil(value.length / 4));
}

function lastItems<T>(items: T[], count: number) {
  return items.slice(Math.max(items.length - count, 0));
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
