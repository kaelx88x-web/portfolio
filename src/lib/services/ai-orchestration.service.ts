import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { env } from '$env/dynamic/private';
import { prisma } from '$lib/server/db';
import {
  buildAiPortfolioContext,
  buildAiPromptPayload,
  parseAiBenchmark,
  parseAiPeriod,
  selectAiContextScope,
  type AiContextScope,
  type AiPortfolioContext
} from '$lib/services/ai-context.service';
import { generatePrompt, type PromptType } from '$lib/services/prompt-builder.service';
import type { AnalyticsBenchmark, AnalyticsPeriod } from '$lib/services/analytics.service';

export const AI_ORCHESTRATION_VERSION = 'phase-5A';

export const AI_INTENT_TYPES = [
  'risk_question',
  'allocation_question',
  'performance_question',
  'benchmark_question',
  'portfolio_health_question',
  'market_commentary_question',
  'general_question'
] as const;

export const AI_TOOL_TYPES = [
  'portfolio_tool',
  'risk_analysis_tool',
  'allocation_tool',
  'benchmark_tool',
  'holdings_tool',
  'snapshot_tool'
] as const;

export const AI_PROVIDER_TYPES = ['local', 'openai', 'claude', 'gemini', 'ollama'] as const;

export type AiIntentType = (typeof AI_INTENT_TYPES)[number];
export type AiToolType = (typeof AI_TOOL_TYPES)[number];
export type AiProviderType = (typeof AI_PROVIDER_TYPES)[number];
export type AiConfidence = 'low' | 'medium' | 'high';

export type AiOrchestratorRequest = {
  conversationId?: string | null;
  question: string;
  period?: AnalyticsPeriod;
  benchmark?: AnalyticsBenchmark;
  analysisMode?: 'fast_chat' | 'deep_analysis' | 'long_report';
};

export type AiIntentResult = {
  type: AiIntentType;
  confidence: number;
  reason: string;
};

export type AiToolCall = {
  tool: AiToolType;
  status: 'completed' | 'skipped' | 'failed';
  executionTimeMs: number;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
};

export type AiProviderRoute = {
  provider: AiProviderType;
  model: string;
  reason: string;
  fallbackProvider: AiProviderType;
};

export type AiStructuredResponse = {
  summary: string;
  key_observations: string[];
  risk_flags: string[];
  considerations: string[];
  confidence: AiConfidence;
  source_contexts: string[];
  tool_calls: AiToolCall[];
};

export type AiOrchestrationResult = {
  conversationId: string;
  question: string;
  intent: AiIntentResult;
  provider: AiProviderRoute;
  context: {
    scope: AiContextScope;
    freshness: string;
    hash: string;
    missingData: string[];
  };
  memory: {
    injected: boolean;
    blocks: Array<{ id: string; memoryType: string; summary: string; importanceScore: number; createdAt: Date }>;
    summary: string;
  };
  prompt: {
    system: string;
    user: string;
    safetyRules: string[];
    estimatedTokens: number;
  };
  response: AiStructuredResponse;
  reasoningTrace: string[];
  responseTimeMs: number;
};

type MemoryBlockRow = {
  id: string;
  memoryType: string;
  summary: string;
  importanceScore: number;
  createdAt: Date;
};

type OrchestrationLogRow = {
  id: string;
  conversationId: string | null;
  intentType: string;
  provider: string;
  model: string;
  confidence: string;
  toolCallsJson: string;
  sourceContextsJson: string;
  responseTimeMs: number;
  status: string;
  metadataJson: string;
  createdAt: Date;
};

type ToolExecutionLogRow = {
  id: string;
  toolName: string;
  executionStatus: string;
  executionTimeMs: number;
  inputJson: string;
  outputJson: string;
  metadataJson: string;
  createdAt: Date;
};

export async function orchestrateAiQuestion(userId: string, request: AiOrchestratorRequest): Promise<AiOrchestrationResult> {
  assertQuestion(request.question);

  const started = Date.now();
  const period = request.period ?? 'MAX';
  const benchmark = request.benchmark ?? 'SPY';
  const intent = detectIntent(request.question);
  const scope = contextScopeForIntent(intent.type);
  const context = await buildAiPortfolioContext(userId, { period, benchmark });
  const scopedContext = selectAiContextScope(context, scope);
  const conversationId = request.conversationId ?? (await createOrchestrationConversation(userId, request.question, period, benchmark));
  const memoryBlocks = await readMemoryBlocks(userId, conversationId);
  const toolCalls = await executeTools(userId, intent.type, context);
  const provider = routeProvider(intent.type, request.analysisMode ?? modeForIntent(intent.type));
  const prompt = await assemblePrompt(userId, request.question, context, scopedContext, intent, toolCalls, memoryBlocks, provider);
  const llmResponse = await executeProvider(provider, prompt);
  const structured = validateResponse(
    parseProviderResponse(llmResponse.content, context, intent.type, toolCalls),
    context,
    toolCalls
  );
  const safeResponse = guardrailStructuredResponse(structured, context);
  const responseTimeMs = Date.now() - started;
  const reasoningTrace = buildReasoningTrace(intent, scope, toolCalls, provider, safeResponse);

  await saveConversationTurn(userId, conversationId, request.question, safeResponse, context, provider, intent, period, benchmark);
  await writeMemoryBlock(userId, conversationId, intent.type, safeResponse, context);
  await writeOrchestrationLog(userId, conversationId, intent, provider, safeResponse, toolCalls, responseTimeMs, {
    period,
    benchmark,
    scope,
    contextHash: context.metadata.contextHash,
    version: AI_ORCHESTRATION_VERSION
  });

  return {
    conversationId,
    question: request.question,
    intent,
    provider,
    context: {
      scope,
      freshness: context.metadata.generatedAt,
      hash: context.metadata.contextHash,
      missingData: context.promptHints.missingData
    },
    memory: {
      injected: memoryBlocks.length > 0,
      blocks: memoryBlocks,
      summary: summarizeMemory(memoryBlocks, context)
    },
    prompt,
    response: safeResponse,
    reasoningTrace,
    responseTimeMs
  };
}

export function listAiIntents() {
  return AI_INTENT_TYPES.map((type) => ({
    type,
    contextScope: contextScopeForIntent(type),
    tools: toolsForIntent(type),
    promptType: promptTypeForIntent(type)
  }));
}

export function listAiTools() {
  return [
    { type: 'portfolio_tool', name: 'PortfolioTool', description: 'Portfolio value, holdings, PnL, and allocation.' },
    { type: 'risk_analysis_tool', name: 'RiskAnalysisTool', description: 'Volatility, drawdown, concentration, and risk score.' },
    { type: 'allocation_tool', name: 'AllocationTool', description: 'Sector, country, currency, cash, and diversification context.' },
    { type: 'benchmark_tool', name: 'BenchmarkTool', description: 'Benchmark comparison, alpha, beta, and return spread.' },
    { type: 'holdings_tool', name: 'HoldingsTool', description: 'Largest positions, top gainers, and laggards.' },
    { type: 'snapshot_tool', name: 'SnapshotTool', description: 'Latest context hash, snapshot date, and data freshness.' }
  ];
}

export function listAiProviders() {
  const openAiEnabled = env.AI_PROVIDER_OPENAI_ENABLED !== 'false' && Boolean(env.OPENAI_API_KEY);
  return [
    {
      provider: 'local',
      model: 'portfolio-rules-engine',
      active: true,
      priority: 10,
      supportedFeatures: ['fast_chat', 'tool_calling', 'structured_response', 'offline_fallback']
    },
    {
      provider: 'openai',
      model: env.AI_MODEL ?? 'gpt-4o-mini',
      active: openAiEnabled,
      priority: 20,
      supportedFeatures: ['fast_chat', 'deep_analysis', 'structured_response']
    },
    {
      provider: 'claude',
      model: env.AI_CLAUDE_MODEL ?? 'claude-provider-ready',
      active: env.AI_PROVIDER_CLAUDE_ENABLED === 'true',
      priority: 30,
      supportedFeatures: ['deep_analysis', 'long_report']
    },
    {
      provider: 'gemini',
      model: env.AI_GEMINI_MODEL ?? 'gemini-provider-ready',
      active: env.AI_PROVIDER_GEMINI_ENABLED === 'true',
      priority: 40,
      supportedFeatures: ['long_report', 'large_context']
    },
    {
      provider: 'ollama',
      model: env.AI_OLLAMA_MODEL ?? 'local-provider-ready',
      active: env.AI_PROVIDER_OLLAMA_ENABLED === 'true',
      priority: 50,
      supportedFeatures: ['local_privacy_mode', 'offline_fallback']
    }
  ];
}

export async function getAiOrchestrationOverview(userId: string) {
  const [logs, toolLogs, memoryBlocks] = await Promise.all([
    listAiOrchestrationLogs(userId, 8),
    listAiToolExecutionLogs(userId, 8),
    readMemoryBlocks(userId, null, 8)
  ]);

  return {
    intents: listAiIntents(),
    providers: listAiProviders(),
    tools: listAiTools(),
    logs,
    toolLogs,
    memoryBlocks,
    enabled: env.AI_ORCHESTRATION_ENABLED !== 'false'
  };
}

export async function listAiOrchestrationLogs(userId: string, limit = 20) {
  try {
    const rows = await prisma.$queryRaw<OrchestrationLogRow[]>(
      Prisma.sql`
        SELECT id, conversation_id AS conversationId, intent_type AS intentType, provider, model, confidence,
          tool_calls_json AS toolCallsJson, source_contexts_json AS sourceContextsJson,
          response_time_ms AS responseTimeMs, status, metadata AS metadataJson, created_at AS createdAt
        FROM ai_orchestration_logs
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    );

    return rows.map((row) => ({
      ...row,
      toolCalls: parseJson(row.toolCallsJson, []),
      sourceContexts: parseJson(row.sourceContextsJson, []),
      metadata: parseJson(row.metadataJson, {})
    }));
  } catch {
    return [];
  }
}

export async function listAiToolExecutionLogs(userId: string, limit = 20) {
  try {
    const rows = await prisma.$queryRaw<ToolExecutionLogRow[]>(
      Prisma.sql`
        SELECT id, tool_name AS toolName, execution_status AS executionStatus,
          execution_time_ms AS executionTimeMs, input_json AS inputJson, output_json AS outputJson,
          metadata AS metadataJson, created_at AS createdAt
        FROM ai_tool_execution_logs
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    );

    return rows.map((row) => ({
      ...row,
      input: parseJson(row.inputJson, {}),
      output: parseJson(row.outputJson, {}),
      metadata: parseJson(row.metadataJson, {})
    }));
  } catch {
    return [];
  }
}

export async function rebuildAiOrchestrationMemory(userId: string) {
  const context = await buildAiPortfolioContext(userId);
  const response = buildLocalStructuredResponse(context, 'portfolio_health_question', [], 'Rebuild AI orchestration memory.');
  const id = await writeMemoryBlock(userId, null, 'portfolio_health_question', response, context);
  return { id, summary: response.summary };
}

export async function refreshAiProviderRoutes() {
  return { routes: listAiProviders(), refreshedAt: new Date().toISOString() };
}

export function parseOrchestratorPeriod(value: string | null) {
  return parseAiPeriod(value);
}

export function parseOrchestratorBenchmark(value: string | null) {
  return parseAiBenchmark(value);
}

function detectIntent(question: string): AiIntentResult {
  const normalized = question.toLowerCase();
  const rules: Array<{ type: AiIntentType; terms: string[]; reason: string }> = [
    {
      type: 'risk_question',
      terms: ['risk', 'risky', 'drawdown', 'volatility', 'concentration', 'downside', 'exposure risk'],
      reason: 'Question references portfolio risk, volatility, drawdown, or concentration.'
    },
    {
      type: 'allocation_question',
      terms: ['allocation', 'allocate', 'exposure', 'sector', 'country', 'currency', 'cash', 'diversification', 'rebalance'],
      reason: 'Question asks about weights, exposure, cash, or diversification.'
    },
    {
      type: 'benchmark_question',
      terms: ['benchmark', 'spy', 'qqq', 'voo', 'compare', 'alpha', 'beta', 'market index'],
      reason: 'Question asks for benchmark-relative comparison.'
    },
    {
      type: 'performance_question',
      terms: ['performance', 'return', 'p/l', 'pnl', 'profit', 'loss', 'gainer', 'loser', 'attribution'],
      reason: 'Question asks about return, PnL, contributors, or attribution.'
    },
    {
      type: 'market_commentary_question',
      terms: ['market', 'quote', 'price', 'today', 'live', 'commentary', 'state'],
      reason: 'Question asks about market context or quote freshness.'
    },
    {
      type: 'portfolio_health_question',
      terms: ['health', 'healthy', 'overall', 'summary', 'check', 'review', 'explain my portfolio'],
      reason: 'Question asks for an overall portfolio review.'
    }
  ];

  for (const rule of rules) {
    const matches = rule.terms.filter((term) => normalized.includes(term));
    if (matches.length > 0) {
      return {
        type: rule.type,
        confidence: Math.min(0.95, 0.62 + matches.length * 0.12),
        reason: rule.reason
      };
    }
  }

  return {
    type: 'general_question',
    confidence: 0.52,
    reason: 'No specific portfolio intent keyword dominated the question.'
  };
}

function contextScopeForIntent(intent: AiIntentType): AiContextScope {
  if (intent === 'risk_question') return 'risk';
  if (intent === 'allocation_question') return 'allocation';
  if (intent === 'performance_question') return 'performance';
  if (intent === 'benchmark_question') return 'benchmark';
  return 'full';
}

function toolsForIntent(intent: AiIntentType): AiToolType[] {
  if (env.AI_ENABLE_TOOL_CALLING === 'false') return [];
  if (intent === 'risk_question') return ['risk_analysis_tool', 'holdings_tool', 'snapshot_tool'];
  if (intent === 'allocation_question') return ['allocation_tool', 'portfolio_tool', 'holdings_tool'];
  if (intent === 'performance_question') return ['portfolio_tool', 'holdings_tool', 'snapshot_tool'];
  if (intent === 'benchmark_question') return ['benchmark_tool', 'snapshot_tool'];
  if (intent === 'market_commentary_question') return ['snapshot_tool', 'holdings_tool'];
  return ['portfolio_tool', 'snapshot_tool'];
}

function isToolType(value: string): value is AiToolType {
  return AI_TOOL_TYPES.includes(value as AiToolType);
}

async function executeTools(userId: string, intent: AiIntentType, context: AiPortfolioContext): Promise<AiToolCall[]> {
  const calls: AiToolCall[] = [];
  for (const tool of toolsForIntent(intent)) {
    const started = Date.now();
    const input = {
      intent,
      period: context.metadata.period,
      benchmark: context.metadata.benchmark,
      contextHash: context.metadata.contextHash
    };
    let output: Record<string, unknown> = {};
    let status: AiToolCall['status'] = 'completed';

    try {
      output = runTool(tool, context);
    } catch (error) {
      status = 'failed';
      output = { error: error instanceof Error ? error.message : String(error) };
    }

    const call = { tool, status, executionTimeMs: Date.now() - started, input, output };
    calls.push(call);
    await writeToolExecutionLog(userId, call);
  }
  return calls;
}

function runTool(tool: AiToolType, context: AiPortfolioContext): Record<string, unknown> {
  if (tool === 'portfolio_tool') {
    return {
      totalValue: context.portfolio.value,
      investedValue: context.portfolio.investedValue,
      cashBalance: context.portfolio.cashBalance,
      cashRatio: context.portfolio.cashRatio,
      holdingsCount: context.portfolio.holdingsCount,
      allocation: context.allocation.bySymbol.slice(0, 8),
      unrealizedPnl: context.performance.unrealizedPnl
    };
  }

  if (tool === 'risk_analysis_tool') {
    return {
      volatilityPct: context.risk.volatilityPct,
      maxDrawdownPct: context.risk.maxDrawdownPct,
      concentrationRiskPct: context.risk.concentrationRiskPct,
      riskScore: context.risk.healthScore,
      riskLabel: context.risk.healthLabel,
      flags: context.risk.flags
    };
  }

  if (tool === 'allocation_tool') {
    return {
      bySymbol: context.allocation.bySymbol.slice(0, 10),
      byAssetType: context.allocation.byAssetType,
      byCurrency: context.allocation.byCurrency,
      cashRatio: context.portfolio.cashRatio,
      drift: context.allocation.drift.slice(0, 8)
    };
  }

  if (tool === 'benchmark_tool') {
    return {
      benchmark: context.metadata.benchmark,
      portfolioReturnPct: context.benchmark.portfolioReturnPct,
      benchmarkReturnPct: context.benchmark.benchmarkReturnPct,
      alphaPct: context.benchmark.alphaPct,
      beta: 'provided when benchmark metrics table has enough history',
      status: context.benchmark.status
    };
  }

  if (tool === 'holdings_tool') {
    const holdingsBySize = [...context.portfolio.holdings].sort((left, right) => Math.abs(right.marketValue) - Math.abs(left.marketValue));
    return {
      topHoldings: holdingsBySize.slice(0, 5),
      gainers: context.topContributors.gainers.slice(0, 3),
      losers: context.topContributors.losers.slice(0, 3),
      largestHoldingSymbol: context.risk.largestHoldingSymbol
    };
  }

  return {
    contextHash: context.metadata.contextHash,
    generatedAt: context.metadata.generatedAt,
    latestSnapshotDate: context.metadata.latestSnapshotDate,
    snapshotCount: context.metadata.snapshotCount,
    dataSource: context.metadata.dataSource,
    marketDataStatus: context.marketData.status
  };
}

function routeProvider(intent: AiIntentType, mode: string): AiProviderRoute {
  const providers = listAiProviders();
  const local = providers.find((provider) => provider.provider === 'local');
  const openai = providers.find((provider) => provider.provider === 'openai' && provider.active);
  const claude = providers.find((provider) => provider.provider === 'claude' && provider.active);
  const gemini = providers.find((provider) => provider.provider === 'gemini' && provider.active);
  const ollama = providers.find((provider) => provider.provider === 'ollama' && provider.active);

  if (env.AI_ENABLE_PROVIDER_ROUTING === 'false') {
    return { provider: 'local', model: local?.model ?? 'portfolio-rules-engine', reason: 'Provider routing disabled.', fallbackProvider: 'local' };
  }

  // Force single provider when AI_PROVIDER is explicitly set
  const forcedProvider = env.AI_PROVIDER;
  if (forcedProvider === 'gemini' && gemini) {
    return { provider: 'gemini', model: gemini.model, reason: 'Gemini selected as active provider.', fallbackProvider: 'local' };
  }
  if (forcedProvider === 'claude' && claude) {
    return { provider: 'claude', model: claude.model, reason: 'Claude selected as active provider.', fallbackProvider: 'local' };
  }
  if (forcedProvider === 'openai' && openai) {
    return { provider: 'openai', model: openai.model, reason: 'OpenAI selected as active provider.', fallbackProvider: 'local' };
  }

  if (mode === 'deep_analysis' && claude) {
    return { provider: 'claude', model: claude.model, reason: 'Deep analysis route selected for analytical intent.', fallbackProvider: 'local' };
  }

  if (mode === 'deep_analysis' && ollama) {
    return { provider: 'ollama', model: ollama.model, reason: 'Deep analysis route via local Ollama.', fallbackProvider: 'local' };
  }

  if (mode === 'long_report' && gemini) {
    return { provider: 'gemini', model: gemini.model, reason: 'Long report route selected.', fallbackProvider: 'local' };
  }

  if (openai) {
    return { provider: 'openai', model: openai.model, reason: `${intent} can use fast structured chat.`, fallbackProvider: 'local' };
  }

  return { provider: 'local', model: local?.model ?? 'portfolio-rules-engine', reason: 'Local rules engine is the active fallback provider.', fallbackProvider: 'local' };
}

function modeForIntent(intent: AiIntentType) {
  if (intent === 'risk_question' || intent === 'benchmark_question' || intent === 'performance_question') return 'deep_analysis';
  return 'fast_chat';
}

async function assemblePrompt(
  userId: string,
  question: string,
  context: AiPortfolioContext,
  scopedContext: unknown,
  intent: AiIntentResult,
  toolCalls: AiToolCall[],
  memoryBlocks: MemoryBlockRow[],
  provider: AiProviderRoute
) {
  const safetyRules = [
    'Portfolio mode awareness: answer from the supplied portfolio context only.',
    'No trade execution: never place, schedule, or imply execution of trades.',
    'Risk disclaimer: explain uncertainty and avoid guaranteed outcomes.',
    'Context freshness warning: use generatedAt as the freshness boundary.',
    'Uncertainty handling: name missing data instead of inventing holdings or prices.'
  ];
  const promptType = promptTypeForIntent(intent.type);
  const generatedPrompt = await generatePrompt(userId, {
    promptType,
    provider: provider.provider === 'openai' ? 'openai' : 'ollama',
    model: provider.model,
    question,
    period: context.metadata.period,
    benchmark: context.metadata.benchmark
  }).catch(() => buildAiPromptPayload(context));

  const baseSystem =
    'messages' in generatedPrompt
      ? generatedPrompt.messages.system
      : 'system' in generatedPrompt
        ? generatedPrompt.system
        : 'You are Portfolio AI Copilot orchestration engine.';

  const userBlock =
    'messages' in generatedPrompt
      ? generatedPrompt.messages.user
      : `Portfolio context JSON:\n${JSON.stringify(scopedContext, null, 2)}\n\nUser question:\n${question}`;

  const user = [
    userBlock,
    `Intent: ${intent.type} (${Math.round(intent.confidence * 100)}%)`,
    `Injected memory:\n${memoryBlocks.map((block) => `- ${block.summary}`).join('\n') || '- No prior memory block.'}`,
    `Tool outputs:\n${JSON.stringify(toolCalls.map((call) => ({ tool: call.tool, status: call.status, output: call.output })), null, 2)}`,
    'Return JSON with keys: summary, key_observations, risk_flags, considerations, confidence, source_contexts, tool_calls.'
  ].join('\n\n');

  const system = [baseSystem, ...safetyRules].join('\n');

  return {
    system,
    user,
    safetyRules,
    estimatedTokens: estimateTokens(system + user)
  };
}

function promptTypeForIntent(intent: AiIntentType): PromptType {
  if (intent === 'risk_question') return 'risk_analysis';
  if (intent === 'allocation_question') return 'allocation_review';
  if (intent === 'benchmark_question') return 'benchmark_summary';
  if (intent === 'performance_question') return 'performance_summary';
  if (intent === 'market_commentary_question') return 'market_commentary';
  return 'portfolio_health';
}

async function executeProvider(provider: AiProviderRoute, prompt: { system: string; user: string }) {
  if (provider.provider === 'openai' && env.OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${env.OPENAI_API_KEY}`,
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user }
          ],
          temperature: Number(env.AI_TEMPERATURE ?? 0.2),
          response_format: { type: 'json_object' },
          max_tokens: Number(env.AI_MAX_TOKENS ?? 1200)
        })
      });

      if (!response.ok) throw new Error(`OpenAI provider failed with ${response.status}.`);
      const payload = await response.json();
      return { content: payload.choices?.[0]?.message?.content ?? '{}' };
    } catch {
      return { content: '{}' };
    }
  }

  if (provider.provider === 'gemini' && env.GEMINI_API_KEY) {
    const model = provider.model === 'gemini-provider-ready' ? 'gemini-2.0-flash' : provider.model;
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: prompt.system }] },
          contents: [{ role: 'user', parts: [{ text: prompt.user }] }],
          generationConfig: {
            temperature: Number(env.AI_TEMPERATURE ?? 0.2),
            maxOutputTokens: Number(env.AI_MAX_TOKENS ?? 1200),
            responseMimeType: 'application/json'
          }
        })
      });

      if (!response.ok) throw new Error(`Gemini provider failed with ${response.status}.`);
      const payload = await response.json();
      return { content: payload.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}' };
    } catch {
      return { content: '{}' };
    }
  }

  if (provider.provider === 'ollama') {
    const ollamaUrl = env.AI_OLLAMA_URL ?? 'http://localhost:11434';
    try {
      const response = await fetch(`${ollamaUrl}/api/chat`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model: provider.model,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user }
          ],
          stream: false,
          format: 'json',
          options: { temperature: Number(env.AI_TEMPERATURE ?? 0.2) }
        })
      });

      if (!response.ok) throw new Error(`Ollama provider failed with ${response.status}.`);
      const payload = await response.json();
      return { content: payload.message?.content ?? '{}' };
    } catch {
      return { content: '{}' };
    }
  }

  return { content: '{}' };
}

function parseProviderResponse(content: string, context: AiPortfolioContext, intent: AiIntentType, toolCalls: AiToolCall[]) {
  const parsed = parseJson<Partial<AiStructuredResponse>>(content, {});
  if (parsed.summary) return parsed;
  return buildLocalStructuredResponse(context, intent, toolCalls, '');
}

function buildLocalStructuredResponse(
  context: AiPortfolioContext,
  intent: AiIntentType,
  toolCalls: AiToolCall[],
  question: string
): AiStructuredResponse {
  const topHolding = [...context.portfolio.holdings].sort((left, right) => Math.abs(right.marketValue) - Math.abs(left.marketValue))[0];
  const observations = [
    `Portfolio value is ${moneyish(context.portfolio.value)} with ${context.portfolio.holdingsCount} holdings.`,
    topHolding
      ? `${topHolding.symbol} is the largest visible holding at ${topHolding.allocationPct.toFixed(2)}% allocation.`
      : 'No holding-level allocation is available yet.',
    `Selected-period return is ${context.performance.totalReturnPct.toFixed(2)}% versus ${context.metadata.benchmark} alpha of ${context.benchmark.alphaPct.toFixed(2)}%.`,
    `Risk health is ${context.risk.healthLabel} with score ${context.risk.healthScore}/100.`
  ];
  const riskFlags = context.risk.flags.map((flag) => flag.detail);
  const considerations = [
    'Review whether the largest exposures still match your intended allocation.',
    'Use the result as a decision checklist, not as an instruction to trade.',
    context.promptHints.missingData[0] ?? `Context was generated at ${context.metadata.generatedAt}; live market conditions may differ.`
  ];

  if (intent === 'risk_question') {
    observations.unshift(`Concentration risk is ${context.risk.concentrationRiskPct.toFixed(2)}% and max drawdown is ${context.risk.maxDrawdownPct.toFixed(2)}%.`);
  }
  if (intent === 'allocation_question') {
    observations.unshift(`Cash ratio is ${context.portfolio.cashRatio.toFixed(2)}%; top allocation slices were checked by AllocationTool.`);
  }
  if (intent === 'benchmark_question') {
    observations.unshift(`Benchmark comparison: portfolio ${context.benchmark.portfolioReturnPct.toFixed(2)}%, ${context.metadata.benchmark} ${context.benchmark.benchmarkReturnPct.toFixed(2)}%.`);
  }
  if (question.toLowerCase().includes('simple')) {
    considerations.unshift('In simple terms: check whether one holding or theme has become too important to the whole portfolio.');
  }

  return {
    summary: `The ${intent.replaceAll('_', ' ')} route found ${riskFlags.length} risk flag(s), ${toolCalls.length} tool call(s), and ${context.promptHints.missingData.length} missing-data warning(s).`,
    key_observations: observations.slice(0, 5),
    risk_flags: riskFlags.length ? riskFlags.slice(0, 4) : ['No major generated risk flag is present from the available context.'],
    considerations: considerations.slice(0, 4),
    confidence: scoreConfidence(context, toolCalls),
    source_contexts: sourceContexts(context, toolCalls),
    tool_calls: toolCalls
  };
}

function validateResponse(response: Partial<AiStructuredResponse>, context: AiPortfolioContext, toolCalls: AiToolCall[]): AiStructuredResponse {
  return {
    summary: String(response.summary || 'AI orchestration completed with available portfolio context.'),
    key_observations: toStringList(response.key_observations).slice(0, 6),
    risk_flags: toStringList(response.risk_flags).slice(0, 5),
    considerations: toStringList(response.considerations).slice(0, 5),
    confidence: isConfidence(response.confidence) ? response.confidence : scoreConfidence(context, toolCalls),
    source_contexts: toStringList(response.source_contexts).length ? toStringList(response.source_contexts) : sourceContexts(context, toolCalls),
    tool_calls: Array.isArray(response.tool_calls) && response.tool_calls.length ? response.tool_calls : toolCalls
  };
}

function guardrailStructuredResponse(response: AiStructuredResponse, context: AiPortfolioContext): AiStructuredResponse {
  const sanitize = (value: string) =>
    value
      .replace(/\bbuy this now\b/gi, 'review this carefully')
      .replace(/\bsell this now\b/gi, 'review this carefully')
      .replace(/\bguaranteed profit\b/gi, 'uncertain outcome')
      .replace(/\bguaranteed return\b/gi, 'uncertain outcome')
      .replace(/\bexecute the trade\b/gi, 'review the idea');

  const freshness = `Context freshness boundary: ${context.metadata.generatedAt}.`;
  const considerations = response.considerations.some((item) => item.includes('Context freshness boundary'))
    ? response.considerations
    : [...response.considerations, freshness];

  return {
    ...response,
    summary: sanitize(response.summary),
    key_observations: response.key_observations.map(sanitize),
    risk_flags: response.risk_flags.map(sanitize),
    considerations: considerations.map(sanitize)
  };
}

function scoreConfidence(context: AiPortfolioContext, toolCalls: AiToolCall[]): AiConfidence {
  const missingPenalty = context.promptHints.missingData.length;
  const toolFailures = toolCalls.filter((call) => call.status !== 'completed').length;
  if (context.metadata.snapshotCount >= 3 && missingPenalty === 0 && toolFailures === 0) return 'high';
  if (context.metadata.snapshotCount >= 1 && missingPenalty <= 2 && toolFailures <= 1) return 'medium';
  return 'low';
}

function sourceContexts(context: AiPortfolioContext, toolCalls: AiToolCall[]) {
  return [
    `portfolio:${context.metadata.contextHash}`,
    `period:${context.metadata.period}`,
    `benchmark:${context.metadata.benchmark}`,
    `market-data:${context.marketData.status}`,
    ...toolCalls.map((call) => `tool:${call.tool}`)
  ];
}

function buildReasoningTrace(
  intent: AiIntentResult,
  scope: AiContextScope,
  toolCalls: AiToolCall[],
  provider: AiProviderRoute,
  response: AiStructuredResponse
) {
  return [
    `Question classified as ${intent.type}: ${intent.reason}`,
    `Context resolver selected ${scope} context.`,
    `${toolCalls.length} internal tool(s) executed: ${toolCalls.map((call) => call.tool).join(', ') || 'none'}.`,
    `Provider router selected ${provider.provider}/${provider.model}: ${provider.reason}`,
    `Response validator returned ${response.confidence} confidence with ${response.key_observations.length} observation(s).`,
    'Guardrails applied: no trade execution, no guaranteed returns, no hallucinated holdings.'
  ];
}

async function createOrchestrationConversation(userId: string, question: string, period: AnalyticsPeriod, benchmark: AnalyticsBenchmark) {
  const id = randomUUID();
  const now = new Date();
  const title = question.trim().replace(/\s+/g, ' ').slice(0, 58) || 'AI Orchestrator Chat';
  await prisma.$executeRaw`
    INSERT INTO ai_conversations (id, userId, title, status, metadataJson, createdAt, updatedAt)
    VALUES (${id}, ${userId}, ${title}, 'active', ${JSON.stringify({ period, benchmark, version: AI_ORCHESTRATION_VERSION })}, ${now}, ${now})
  `;
  return id;
}

async function saveConversationTurn(
  userId: string,
  conversationId: string,
  question: string,
  response: AiStructuredResponse,
  context: AiPortfolioContext,
  provider: AiProviderRoute,
  intent: AiIntentResult,
  period: AnalyticsPeriod,
  benchmark: AnalyticsBenchmark
) {
  const now = new Date();
  await prisma.$executeRaw`
    INSERT INTO ai_messages (id, aiConversationId, userId, role, content, contextSnapshotId, metadataJson, createdAt, updatedAt)
    VALUES (${randomUUID()}, ${conversationId}, ${userId}, 'user', ${question}, ${context.metadata.contextHash}, ${JSON.stringify({ period, benchmark, intent: intent.type })}, ${now}, ${now})
  `;
  await prisma.$executeRaw`
    INSERT INTO ai_messages (id, aiConversationId, userId, role, content, contextSnapshotId, metadataJson, createdAt, updatedAt)
    VALUES (${randomUUID()}, ${conversationId}, ${userId}, 'assistant', ${JSON.stringify(response)}, ${context.metadata.contextHash}, ${JSON.stringify({ provider: provider.provider, model: provider.model, intent: intent.type })}, ${now}, ${now})
  `;
  await prisma.$executeRaw`
    UPDATE ai_conversations SET updatedAt = ${now} WHERE id = ${conversationId} AND userId = ${userId}
  `;
}

async function readMemoryBlocks(userId: string, conversationId: string | null, limit = 4): Promise<MemoryBlockRow[]> {
  if (env.AI_ENABLE_MEMORY === 'false') return [];
  try {
    if (conversationId) {
      return prisma.$queryRaw<MemoryBlockRow[]>(
        Prisma.sql`
          SELECT id, memory_type AS memoryType, summary, importance_score AS importanceScore, created_at AS createdAt
          FROM ai_memory_blocks
          WHERE user_id = ${userId}
            AND (conversation_id = ${conversationId} OR conversation_id IS NULL)
          ORDER BY importance_score DESC, created_at DESC
          LIMIT ${limit}
        `
      );
    }

    return prisma.$queryRaw<MemoryBlockRow[]>(
      Prisma.sql`
        SELECT id, memory_type AS memoryType, summary, importance_score AS importanceScore, created_at AS createdAt
        FROM ai_memory_blocks
        WHERE user_id = ${userId}
        ORDER BY importance_score DESC, created_at DESC
        LIMIT ${limit}
      `
    );
  } catch {
    return [];
  }
}

async function writeMemoryBlock(
  userId: string,
  conversationId: string | null,
  intent: AiIntentType,
  response: AiStructuredResponse,
  context: AiPortfolioContext
) {
  if (env.AI_ENABLE_MEMORY === 'false') return null;
  const id = randomUUID();
  const now = new Date();
  const summary = [
    intent.replaceAll('_', ' '),
    response.summary.slice(0, 180),
    `confidence ${response.confidence}`,
    `context ${context.metadata.contextHash}`
  ].join(' | ');

  await prisma.$executeRaw`
    INSERT INTO ai_memory_blocks (
      id, user_id, conversation_id, memory_type, summary, importance_score, metadata, created_at, updated_at
    )
    VALUES (
      ${id}, ${userId}, ${conversationId}, ${intent}, ${summary}, ${importanceForConfidence(response.confidence)},
      ${JSON.stringify({ contextHash: context.metadata.contextHash, sourceContexts: response.source_contexts })}, ${now}, ${now}
    )
  `;
  return id;
}

async function writeToolExecutionLog(userId: string, call: AiToolCall) {
  try {
    const now = new Date();
    await prisma.$executeRaw`
      INSERT INTO ai_tool_execution_logs (
        id, user_id, tool_name, execution_status, execution_time_ms, input_json, output_json, metadata, created_at, updated_at
      )
      VALUES (
        ${randomUUID()}, ${userId}, ${call.tool}, ${call.status}, ${call.executionTimeMs},
        ${JSON.stringify(call.input)}, ${JSON.stringify(call.output)}, ${JSON.stringify({ version: AI_ORCHESTRATION_VERSION })}, ${now}, ${now}
      )
    `;
  } catch {
    // Tool logs are diagnostic; the orchestration answer can still complete without them.
  }
}

async function writeOrchestrationLog(
  userId: string,
  conversationId: string,
  intent: AiIntentResult,
  provider: AiProviderRoute,
  response: AiStructuredResponse,
  toolCalls: AiToolCall[],
  responseTimeMs: number,
  metadata: Record<string, unknown>
) {
  const now = new Date();
  await prisma.$executeRaw`
    INSERT INTO ai_orchestration_logs (
      id, user_id, conversation_id, intent_type, provider, model, confidence, tool_calls_json,
      source_contexts_json, response_time_ms, status, metadata, created_at, updated_at
    )
    VALUES (
      ${randomUUID()}, ${userId}, ${conversationId}, ${intent.type}, ${provider.provider}, ${provider.model},
      ${response.confidence}, ${JSON.stringify(toolCalls)}, ${JSON.stringify(response.source_contexts)},
      ${responseTimeMs}, 'completed', ${JSON.stringify(metadata)}, ${now}, ${now}
    )
  `;
}

function summarizeMemory(blocks: MemoryBlockRow[], context: AiPortfolioContext) {
  if (blocks.length === 0) {
    return `No prior orchestration memory. Current context ${context.metadata.contextHash} starts the memory chain.`;
  }
  return blocks.map((block) => block.summary).join(' ');
}

function importanceForConfidence(confidence: AiConfidence) {
  if (confidence === 'high') return 0.9;
  if (confidence === 'medium') return 0.65;
  return 0.4;
}

function assertQuestion(question: string) {
  if (question.trim().length < 3) throw new Error('Ask a portfolio question first.');
  if (question.length > 800) throw new Error('Keep the question under 800 characters.');
}

function estimateTokens(value: string) {
  return Math.ceil(value.length / 4);
}

function moneyish(value: number) {
  return `${Math.round(value * 100) / 100}`;
}

function toStringList(value: unknown) {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function isConfidence(value: unknown): value is AiConfidence {
  return value === 'low' || value === 'medium' || value === 'high';
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
