import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { env } from '$env/dynamic/private';
import { prisma } from '$lib/server/db';
import {
  buildAiPortfolioContext,
  parseAiBenchmark,
  parseAiPeriod,
  type AiPortfolioContext
} from '$lib/services/ai-context.service';
import { generatePrompt, type PromptType } from '$lib/services/prompt-builder.service';
import type { AnalyticsBenchmark, AnalyticsPeriod } from '$lib/services/analytics.service';

export const AI_COPILOT_VERSION = 'phase-5.0';

export const AI_INSIGHT_TYPES = [
  'portfolio_health',
  'risk_analysis',
  'allocation_review',
  'performance_summary',
  'market_commentary'
] as const;

export type AiInsightType = (typeof AI_INSIGHT_TYPES)[number];
export type AiRiskLevel = 'low' | 'moderate' | 'high';
export type AiMessageRole = 'user' | 'assistant' | 'system' | 'tool';

export type AiChatRequest = {
  conversationId?: string | null;
  question: string;
  period?: AnalyticsPeriod;
  benchmark?: AnalyticsBenchmark;
};

export type AiCopilotAnswer = {
  summary: string;
  dataShows: string[];
  risks: string[];
  considerations: string[];
  uncertainty: string;
};

type ChatMessage = {
  role: AiMessageRole;
  content: string;
};

type LlmUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

type LlmResponse = {
  provider: string;
  model: string;
  content: string;
  usage: LlmUsage;
};

type LlmProvider = {
  chat(messages: ChatMessage[], options?: Record<string, unknown>): Promise<LlmResponse>;
};

type ConversationRow = {
  id: string;
  title: string;
  status: string;
  metadataJson: string;
  createdAt: Date;
  updatedAt: Date;
  messageCount: bigint | number;
  lastMessageAt: Date | null;
};

type MessageRow = {
  id: string;
  aiConversationId: string;
  role: AiMessageRole;
  content: string;
  contextSnapshotId: string | null;
  metadataJson: string;
  createdAt: Date;
};

type InsightRow = {
  id: string;
  insightType: AiInsightType;
  title: string;
  summary: string;
  riskLevel: AiRiskLevel;
  contentJson: string;
  expiresAt: Date | null;
  metadataJson: string;
  createdAt: Date;
};

type UsageRow = {
  id: string;
  provider: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  costEstimate: number;
  requestType: string;
  metadataJson: string;
  createdAt: Date;
};

type RateBucket = {
  count: number;
  resetAt: number;
};

const rateBuckets = new Map<string, RateBucket>();

const PROMPT_TEMPLATES: Record<AiInsightType, { name: string; system: string; user: string }> = {
  portfolio_health: {
    name: 'Portfolio Health',
    system: 'Explain overall portfolio health with a balanced, advisory-only tone.',
    user: 'Review health score, performance, cash, concentration, and missing data.'
  },
  risk_analysis: {
    name: 'Risk Analysis',
    system: 'Explain portfolio risk without fear-based pressure or trade execution.',
    user: 'Focus on concentration, drawdown, volatility, sector/symbol exposure, and uncertainty.'
  },
  allocation_review: {
    name: 'Allocation Review',
    system: 'Explain allocation balance and drift using only the supplied context.',
    user: 'Review asset, symbol, and currency allocation. Mention overweight areas as areas to review.'
  },
  performance_summary: {
    name: 'Performance Summary',
    system: 'Explain performance in plain language without predicting future returns.',
    user: 'Summarize return, benchmark comparison, P/L, and contributors.'
  },
  market_commentary: {
    name: 'Market Commentary',
    system: 'Explain simple market context tied to holdings, and mention when live market data is unavailable.',
    user: 'Summarize market state, quotes, benchmark candles, and data limitations.'
  }
};

export async function getAiCopilotOverview(userId: string, period: AnalyticsPeriod = 'MAX', benchmark: AnalyticsBenchmark = 'SPY') {
  const [context, conversations, insights, usage] = await Promise.all([
    buildAiPortfolioContext(userId, { period, benchmark }),
    listAiConversations(userId, 5),
    listAiInsights(userId, 5),
    listAiUsage(userId, 5)
  ]);

  return {
    context,
    conversations,
    insights,
    usage,
    suggestions: suggestedQuestions(context),
    enabled: process.env.AI_COPILOT_ENABLED !== 'false'
  };
}

export async function listAiConversations(userId: string, limit = 20) {
  const rows = await prisma.$queryRaw<ConversationRow[]>(
    Prisma.sql`
      SELECT c.id, c.title, c.status, c.metadataJson, c.createdAt, c.updatedAt,
        COUNT(m.id) AS messageCount,
        MAX(m.createdAt) AS lastMessageAt
      FROM ai_conversations c
      LEFT JOIN ai_messages m ON m.aiConversationId = c.id
      WHERE c.userId = ${userId}
      GROUP BY c.id, c.title, c.status, c.metadataJson, c.createdAt, c.updatedAt
      ORDER BY c.updatedAt DESC
      LIMIT ${limit}
    `
  );

  return rows.map((row) => ({
    ...row,
    metadata: parseJson(row.metadataJson, {}),
    messageCount: Number(row.messageCount)
  }));
}

export async function createAiConversation(userId: string, title = 'Portfolio Copilot Chat', metadata: Record<string, unknown> = {}) {
  const id = randomUUID();
  const now = new Date();
  await prisma.$executeRaw`
    INSERT INTO ai_conversations (id, userId, title, status, metadataJson, createdAt, updatedAt)
    VALUES (${id}, ${userId}, ${title}, 'active', ${JSON.stringify(metadata)}, ${now}, ${now})
  `;

  return getAiConversation(userId, id);
}

export async function getAiConversation(userId: string, conversationId: string) {
  const [conversation] = await prisma.$queryRaw<ConversationRow[]>`
    SELECT c.id, c.title, c.status, c.metadataJson, c.createdAt, c.updatedAt,
      COUNT(m.id) AS messageCount,
      MAX(m.createdAt) AS lastMessageAt
    FROM ai_conversations c
    LEFT JOIN ai_messages m ON m.aiConversationId = c.id
    WHERE c.userId = ${userId} AND c.id = ${conversationId}
    GROUP BY c.id, c.title, c.status, c.metadataJson, c.createdAt, c.updatedAt
    LIMIT 1
  `;

  if (!conversation) return null;

  const messages = await prisma.$queryRaw<MessageRow[]>`
    SELECT id, aiConversationId, role, content, contextSnapshotId, metadataJson, createdAt
    FROM ai_messages
    WHERE userId = ${userId} AND aiConversationId = ${conversationId}
    ORDER BY createdAt ASC
  `;

  return {
    ...conversation,
    metadata: parseJson(conversation.metadataJson, {}),
    messageCount: Number(conversation.messageCount),
    messages: messages.map((message) => ({
      ...message,
      metadata: parseJson(message.metadataJson, {})
    }))
  };
}

export async function sendAiCopilotMessage(userId: string, request: AiChatRequest) {
  assertQuestion(request.question);
  assertRateLimit(userId);

  const period = request.period ?? 'MAX';
  const benchmark = request.benchmark ?? 'SPY';
  const context = await buildAiPortfolioContext(userId, { period, benchmark });
  const conversation =
    request.conversationId ? await getAiConversation(userId, request.conversationId) : null;
  const activeConversation =
    conversation ??
    (await createAiConversation(userId, buildConversationTitle(request.question), {
      period,
      benchmark,
      version: AI_COPILOT_VERSION
    }));

  if (!activeConversation) throw new Error('Unable to create AI conversation.');

  const contextSnapshotId = context.metadata.contextHash;
  await saveAiMessage(userId, activeConversation.id, 'user', request.question, contextSnapshotId, {
    period,
    benchmark
  });

  const promptMessages = await buildCopilotMessages(userId, context, request.question);
  const provider = createLlmProvider();
  const llmResponse = await provider.chat(promptMessages, { context, requestType: 'chat' });
  const safeContent = guardrailResponse(llmResponse.content, context);

  await saveAiMessage(userId, activeConversation.id, 'assistant', safeContent, contextSnapshotId, {
    provider: llmResponse.provider,
    model: llmResponse.model,
    period,
    benchmark
  });
  await updateConversation(activeConversation.id, userId);
  await logAiUsage(userId, llmResponse, 'chat', { conversationId: activeConversation.id, contextSnapshotId });

  return {
    conversation: await getAiConversation(userId, activeConversation.id),
    answer: parseCopilotAnswer(safeContent),
    rawAnswer: safeContent,
    context
  };
}

export async function listAiInsights(userId: string, limit = 20) {
  const rows = await prisma.$queryRaw<InsightRow[]>(
    Prisma.sql`
      SELECT id, insightType, title, summary, riskLevel, contentJson, expiresAt, metadataJson, createdAt
      FROM ai_insights
      WHERE userId = ${userId}
      ORDER BY createdAt DESC
      LIMIT ${limit}
    `
  );

  return rows.map((row) => ({
    ...row,
    content: parseJson(row.contentJson, {}),
    metadata: parseJson(row.metadataJson, {})
  }));
}

export async function getAiInsight(userId: string, insightId: string) {
  const [row] = await prisma.$queryRaw<InsightRow[]>`
    SELECT id, insightType, title, summary, riskLevel, contentJson, expiresAt, metadataJson, createdAt
    FROM ai_insights
    WHERE userId = ${userId} AND id = ${insightId}
    LIMIT 1
  `;

  if (!row) return null;
  return {
    ...row,
    content: parseJson(row.contentJson, {}),
    metadata: parseJson(row.metadataJson, {})
  };
}

export async function generateAiInsight(
  userId: string,
  insightType: AiInsightType,
  period: AnalyticsPeriod = 'MAX',
  benchmark: AnalyticsBenchmark = 'SPY'
) {
  assertInsightType(insightType);
  assertRateLimit(`${userId}:insight`);

  const context = await buildAiPortfolioContext(userId, { period, benchmark });
  const content = buildInsightContent(insightType, context);
  const id = randomUUID();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60_000);

  await prisma.$executeRaw`
    INSERT INTO ai_insights (
      id, userId, insightType, title, summary, riskLevel, contentJson, expiresAt, metadataJson, createdAt, updatedAt
    )
    VALUES (
      ${id}, ${userId}, ${insightType}, ${content.title}, ${content.summary}, ${content.riskLevel},
      ${JSON.stringify(content)}, ${expiresAt}, ${JSON.stringify({ period, benchmark, version: AI_COPILOT_VERSION, contextHash: context.metadata.contextHash })},
      ${now}, ${now}
    )
  `;

  await logAiUsage(
    userId,
    {
      provider: 'local',
      model: 'portfolio-rules-engine',
      content: JSON.stringify(content),
      usage: estimateUsage(JSON.stringify(content), JSON.stringify(context))
    },
    'insight',
    { insightType, contextHash: context.metadata.contextHash }
  );

  return getAiInsight(userId, id);
}

export async function listAiUsage(userId: string, limit = 20) {
  const rows = await prisma.$queryRaw<UsageRow[]>(
    Prisma.sql`
      SELECT id, provider, model, promptTokens, completionTokens, totalTokens, costEstimate, requestType, metadataJson, createdAt
      FROM ai_usage_logs
      WHERE userId = ${userId}
      ORDER BY createdAt DESC
      LIMIT ${limit}
    `
  );

  return rows.map((row) => ({ ...row, metadata: parseJson(row.metadataJson, {}) }));
}

export function parseCopilotPeriod(value: string | null) {
  return parseAiPeriod(value);
}

export function parseCopilotBenchmark(value: string | null) {
  return parseAiBenchmark(value);
}

export function parseInsightType(value: FormDataEntryValue | string | null): AiInsightType {
  return AI_INSIGHT_TYPES.includes(value as AiInsightType) ? (value as AiInsightType) : 'portfolio_health';
}

async function buildCopilotMessages(userId: string, context: AiPortfolioContext, question: string): Promise<ChatMessage[]> {
  const prompt = await generatePrompt(userId, {
    promptType: promptTypeFromQuestion(question),
    provider: 'openai',
    model: process.env.AI_MODEL ?? 'copilot-provider-ready',
    question,
    period: context.metadata.period,
    benchmark: context.metadata.benchmark
  });

  const FORMAT_INSTRUCTION = `
IMPORTANT: Your entire response MUST use exactly this structure. Use these exact headings on their own lines with no # symbols:

Short summary
[One to two sentence summary of the situation]

What the data shows
- [observation]
- [observation]
- [observation]

Main risks
- [risk]
- [risk]

Possible actions to consider
- [action]
- [action]

Uncertainty note
[One sentence disclaimer about data limitations]

Do not use markdown headers (#, ##). Do not add any section outside these five. Use plain text with bullet points (- ) only.`.trim();

  if ('messages' in prompt) {
    return [
      {
        role: 'system',
        content: [prompt.messages.system, FORMAT_INSTRUCTION].join('\n\n')
      },
      { role: 'user', content: prompt.messages.user }
    ];
  }

  return [
    {
      role: 'system',
      content: `You are Portfolio AI Copilot. Analyze only the supplied portfolio context.\n\n${FORMAT_INSTRUCTION}`
    },
    {
      role: 'user',
      content: `Portfolio context JSON:\n${JSON.stringify(context, null, 2)}\n\nUser question:\n${question}`
    }
  ];
}

function promptTypeFromQuestion(question: string): PromptType {
  const lower = question.toLowerCase();
  if (lower.includes('risk') || lower.includes('drawdown') || lower.includes('concentration')) return 'risk_analysis';
  if (lower.includes('allocation') || lower.includes('exposure') || lower.includes('rebalance')) return 'allocation_review';
  if (lower.includes('benchmark') || lower.includes('spy') || lower.includes('compare')) return 'benchmark_summary';
  if (lower.includes('performance') || lower.includes('return') || lower.includes('p/l')) return 'performance_summary';
  if (lower.includes('market') || lower.includes('quote')) return 'market_commentary';
  return 'portfolio_health';
}

function createLlmProvider(): LlmProvider {
  if (env.GEMINI_API_KEY && env.AI_PROVIDER_GEMINI_ENABLED === 'true') return new GeminiProvider();
  if (env.ANTHROPIC_API_KEY && env.AI_PROVIDER_CLAUDE_ENABLED === 'true') return new ClaudeWithFallbackProvider();
  if (env.OPENAI_API_KEY && env.AI_PROVIDER_OPENAI_ENABLED !== 'false') return new OpenAiProvider();
  if (env.AI_PROVIDER_OLLAMA_ENABLED === 'true') return new OllamaProvider();
  return new LocalPortfolioProvider();
}

class GeminiProvider {
  async chat(messages: ChatMessage[], options: Record<string, unknown> = {}): Promise<LlmResponse> {
    try {
      return await this.callGemini(messages);
    } catch (err) {
      console.warn('[AI] GeminiProvider failed, trying Ollama:', String(err));
      try {
        if (env.AI_PROVIDER_OLLAMA_ENABLED === 'true') {
          return await new OllamaProvider().callOllama(messages);
        }
      } catch (ollamaErr) {
        console.warn('[AI] OllamaProvider fallback failed:', String(ollamaErr));
      }
      return new LocalPortfolioProvider().chat(messages, options);
    }
  }

  private async callGemini(messages: ChatMessage[]): Promise<LlmResponse> {
    const model = env.AI_GEMINI_MODEL ?? 'gemini-2.0-flash';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;

    const systemMsg = messages.find((m) => m.role === 'system');
    const userMessages = messages.filter((m) => m.role !== 'system');

    const body: Record<string, unknown> = {
      contents: userMessages.map((m) => ({
        role: m.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: m.content }]
      })),
      generationConfig: {
        temperature: 1,
        maxOutputTokens: Number(env.AI_MAX_TOKENS ?? 2048),
        thinkingConfig: { thinkingBudget: 0 }
      }
    };

    if (systemMsg) {
      body.systemInstruction = { parts: [{ text: systemMsg.content }] };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      throw new Error(`Gemini provider failed with ${response.status}.`);
    }

    const payload = await response.json();
    const content = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No AI response returned.';
    const promptTokens = payload.usageMetadata?.promptTokenCount ?? 0;
    const completionTokens = payload.usageMetadata?.candidatesTokenCount ?? 0;

    return {
      provider: 'gemini',
      model,
      content,
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens
      }
    };
  }
}

class OllamaProvider {
  async chat(messages: ChatMessage[], options: Record<string, unknown> = {}): Promise<LlmResponse> {
    try {
      return await this.callOllama(messages);
    } catch (err) {
      console.warn('[AI] OllamaProvider fallback to local:', String(err));
      return new LocalPortfolioProvider().chat(messages, options);
    }
  }

  async callOllama(messages: ChatMessage[]): Promise<LlmResponse> {
    const model = env.AI_OLLAMA_MODEL ?? 'llama3.2:3b';
    const url = `${env.AI_OLLAMA_URL ?? 'http://localhost:11434'}/api/chat`;

    const body = {
      model,
      messages: messages.map((m) => ({ role: m.role === 'assistant' ? 'assistant' : m.role, content: m.content })),
      stream: false,
      options: { temperature: Number(env.AI_TEMPERATURE ?? 0.2), num_predict: Number(env.AI_MAX_TOKENS ?? 1200) }
    };

    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), 25_000);

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal: abort.signal
    });
    clearTimeout(timer);

    if (!response.ok) throw new Error(`Ollama failed with ${response.status}`);

    const payload = await response.json();
    const content = payload.message?.content ?? 'No AI response returned.';

    return {
      provider: 'ollama',
      model,
      content,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: payload.eval_count ?? 0 }
    };
  }
}

class LocalPortfolioProvider {
  async chat(messages: ChatMessage[], options: Record<string, unknown> = {}): Promise<LlmResponse> {
    const question = messages.at(-1)?.content ?? '';
    const context = options.context as AiPortfolioContext;
    const answer = buildLocalAnswer(context, question);
    return {
      provider: 'local',
      model: 'portfolio-rules-engine',
      content: formatCopilotAnswer(answer),
      usage: estimateUsage(messages.map((message) => message.content).join('\n'), formatCopilotAnswer(answer))
    };
  }
}

class OpenAiProvider {
  async chat(messages: ChatMessage[]): Promise<LlmResponse> {
    const model = process.env.AI_MODEL ?? 'gpt-4o-mini';
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: Number(process.env.AI_TEMPERATURE ?? 0.2),
        max_tokens: Number(process.env.AI_MAX_TOKENS ?? 1200)
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI provider failed with ${response.status}.`);
    }

    const payload = await response.json();
    return {
      provider: 'openai',
      model,
      content: payload.choices?.[0]?.message?.content ?? 'No AI response returned.',
      usage: {
        promptTokens: payload.usage?.prompt_tokens ?? 0,
        completionTokens: payload.usage?.completion_tokens ?? 0,
        totalTokens: payload.usage?.total_tokens ?? 0
      }
    };
  }
}

class ClaudeWithFallbackProvider {
  async chat(messages: ChatMessage[], options: Record<string, unknown> = {}): Promise<LlmResponse> {
    try {
      return await this.callClaude(messages);
    } catch {
      return new LocalPortfolioProvider().chat(messages, options);
    }
  }

  private async callClaude(messages: ChatMessage[]): Promise<LlmResponse> {
    const model = process.env.AI_MODEL ?? 'claude-haiku-4-5-20251001';
    const system = messages.find((m) => m.role === 'system')?.content ?? '';
    const userMessages = messages.filter((m) => m.role !== 'system');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY!,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model,
        max_tokens: Number(process.env.AI_MAX_TOKENS ?? 1200),
        system,
        messages: userMessages.map((m) => ({ role: m.role, content: m.content }))
      })
    });

    if (!response.ok) throw new Error(`Claude ${response.status}`);

    const payload = await response.json();
    return {
      provider: 'claude',
      model,
      content: payload.content?.[0]?.text ?? 'No response from Claude.',
      usage: {
        promptTokens: payload.usage?.input_tokens ?? 0,
        completionTokens: payload.usage?.output_tokens ?? 0,
        totalTokens: (payload.usage?.input_tokens ?? 0) + (payload.usage?.output_tokens ?? 0)
      }
    };
  }
}

function buildLocalAnswer(context: AiPortfolioContext, rawQuestion: string): AiCopilotAnswer {
  const question = rawQuestion.toLowerCase();
  const topHolding = context.portfolio.holdings[0];
  const riskFlags = context.risk.flags.map((flag) => flag.detail);
  const missing = context.promptHints.missingData;
  const riskLevel = context.risk.healthLabel === 'stable' ? 'manageable' : context.risk.healthLabel === 'watch' ? 'worth watching' : 'elevated';
  const summary = `Your portfolio looks ${riskLevel} based on a ${context.risk.healthScore}/100 health score, ${context.portfolio.holdingsCount} holdings, and ${context.portfolio.cashRatio.toFixed(2)}% cash.`;
  const allocationLine = topHolding
    ? `${topHolding.symbol} is the largest visible holding at ${topHolding.allocationPct.toFixed(2)}% of allocation.`
    : 'No holding-level allocation is available yet.';
  const performanceLine = `Selected-period return is ${context.performance.totalReturnPct.toFixed(2)}%, with ${context.benchmark.alphaPct.toFixed(2)}% alpha versus ${context.metadata.benchmark}.`;

  const dataShows = [allocationLine, performanceLine, `Market data status is ${context.marketData.status}.`];
  const risks = riskFlags.length > 0 ? riskFlags.slice(0, 3) : ['No major generated risk flag is present, but this depends on available snapshot history.'];
  const considerations = [
    'Review whether the largest exposures still match your target allocation.',
    'Compare risk flags against your time horizon and cash needs.',
    'Use this as a review checklist, not as an instruction to trade.'
  ];

  if (question.includes('performance') || question.includes('compare') || question.includes('spy')) {
    dataShows.unshift(`Benchmark comparison versus ${context.metadata.benchmark}: portfolio ${context.benchmark.portfolioReturnPct.toFixed(2)}%, benchmark ${context.benchmark.benchmarkReturnPct.toFixed(2)}%.`);
  }
  if (question.includes('risk') || question.includes('concentration')) {
    dataShows.unshift(`Concentration risk is ${context.risk.concentrationRiskPct.toFixed(2)}%; largest holding is ${context.risk.largestHoldingSymbol || 'not available'}.`);
  }
  if (question.includes('simple')) {
    considerations.unshift('In simple words: check whether one area has become too important to the whole portfolio.');
  }

  return {
    summary,
    dataShows: dataShows.slice(0, 4),
    risks,
    considerations,
    uncertainty:
      missing[0] ??
      `This explanation uses context generated at ${new Date(context.metadata.generatedAt).toLocaleString()} and cannot guarantee future returns.`
  };
}

function buildInsightContent(insightType: AiInsightType, context: AiPortfolioContext) {
  const answer = buildLocalAnswer(context, insightType.replace('_', ' '));
  const riskLevel = inferRiskLevel(context);
  const title = PROMPT_TEMPLATES[insightType].name;
  return {
    type: insightType,
    title,
    summary: answer.summary,
    riskLevel,
    observations: answer.dataShows,
    risks: answer.risks,
    considerations: answer.considerations,
    uncertainty: answer.uncertainty,
    contextHash: context.metadata.contextHash,
    generatedAt: new Date().toISOString()
  };
}

function formatCopilotAnswer(answer: AiCopilotAnswer) {
  return [
    `Short summary\n${answer.summary}`,
    `What the data shows\n${answer.dataShows.map((item) => `- ${item}`).join('\n')}`,
    `Main risks\n${answer.risks.map((item) => `- ${item}`).join('\n')}`,
    `Possible actions to consider\n${answer.considerations.map((item) => `- ${item}`).join('\n')}`,
    `Uncertainty note\n${answer.uncertainty}`
  ].join('\n\n');
}

function parseCopilotAnswer(content: string): AiCopilotAnswer {
  const section = (name: string) => {
    const match = content.match(new RegExp(`${name}\\n([\\s\\S]*?)(\\n\\n[A-Z]|$)`));
    return (match?.[1] ?? '').trim().replace(/\n[A-Z]$/, '');
  };
  const list = (value: string) =>
    value
      .split('\n')
      .map((line) => line.replace(/^-\s*/, '').trim())
      .filter(Boolean);

  return {
    summary: section('Short summary'),
    dataShows: list(section('What the data shows')),
    risks: list(section('Main risks')),
    considerations: list(section('Possible actions to consider')),
    uncertainty: section('Uncertainty note')
  };
}

function guardrailResponse(content: string, context: AiPortfolioContext) {
  const blocked = [
    /\bbuy this now\b/gi,
    /\bsell this now\b/gi,
    /\bguaranteed profit\b/gi,
    /\bguaranteed return\b/gi,
    /\bI will place\b/gi,
    /\bexecute the trade\b/gi
  ];
  let safe = content;
  for (const pattern of blocked) safe = safe.replace(pattern, 'review this carefully');

  if (!safe.toLowerCase().includes('uncertainty note')) {
    safe += `\n\nUncertainty note\nThis is advisory-only and uses context generated at ${context.metadata.generatedAt}. It cannot guarantee returns or execute trades.`;
  }

  return safe;
}

function suggestedQuestions(context: AiPortfolioContext) {
  const largest = context.risk.largestHoldingSymbol || 'my largest holding';
  return [
    'Why is my portfolio risky?',
    `What is my biggest exposure in ${largest}?`,
    'How can I reduce concentration risk?',
    'Which holdings affect my performance most?',
    `How does my portfolio compare to ${context.metadata.benchmark}?`,
    'Explain my portfolio in simple words.'
  ];
}

async function saveAiMessage(
  userId: string,
  conversationId: string,
  role: AiMessageRole,
  content: string,
  contextSnapshotId: string | null,
  metadata: Record<string, unknown>
) {
  const id = randomUUID();
  const now = new Date();
  await prisma.$executeRaw`
    INSERT INTO ai_messages (
      id, aiConversationId, userId, role, content, contextSnapshotId, metadataJson, createdAt, updatedAt
    )
    VALUES (
      ${id}, ${conversationId}, ${userId}, ${role}, ${content}, ${contextSnapshotId},
      ${JSON.stringify(metadata)}, ${now}, ${now}
    )
  `;
}

async function updateConversation(conversationId: string, userId: string) {
  await prisma.$executeRaw`
    UPDATE ai_conversations
    SET updatedAt = ${new Date()}
    WHERE id = ${conversationId} AND userId = ${userId}
  `;
}

async function logAiUsage(userId: string, response: LlmResponse, requestType: string, metadata: Record<string, unknown>) {
  const id = randomUUID();
  const now = new Date();
  await prisma.$executeRaw`
    INSERT INTO ai_usage_logs (
      id, userId, provider, model, promptTokens, completionTokens, totalTokens, costEstimate, requestType, metadataJson, createdAt, updatedAt
    )
    VALUES (
      ${id}, ${userId}, ${response.provider}, ${response.model}, ${response.usage.promptTokens},
      ${response.usage.completionTokens}, ${response.usage.totalTokens}, 0, ${requestType},
      ${JSON.stringify(metadata)}, ${now}, ${now}
    )
  `;
}

function assertRateLimit(key: string) {
  const limit = Number(process.env.AI_CHAT_RATE_LIMIT_PER_MINUTE ?? 10);
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateBuckets.set(key, { count: 1, resetAt: now + 60_000 });
    return;
  }
  if (bucket.count >= limit) {
    throw new Error(`AI rate limit reached. Try again after ${Math.ceil((bucket.resetAt - now) / 1000)} seconds.`);
  }
  bucket.count += 1;
}

function assertQuestion(question: string) {
  if (question.trim().length < 3) throw new Error('Ask a portfolio question first.');
  if (question.length > 800) throw new Error('Keep the question under 800 characters.');
}

function assertInsightType(value: string): asserts value is AiInsightType {
  if (!AI_INSIGHT_TYPES.includes(value as AiInsightType)) throw new Error('Unsupported AI insight type.');
}

function buildConversationTitle(question: string) {
  const title = question.trim().replace(/\s+/g, ' ').slice(0, 58);
  return title.length >= 58 ? `${title}...` : title || 'Portfolio Copilot Chat';
}

function inferRiskLevel(context: AiPortfolioContext): AiRiskLevel {
  if (context.risk.healthLabel === 'elevated_risk') return 'high';
  if (context.risk.healthLabel === 'watch') return 'moderate';
  return 'low';
}

function estimateUsage(prompt: string, completion: string): LlmUsage {
  const promptTokens = Math.ceil(prompt.length / 4);
  const completionTokens = Math.ceil(completion.length / 4);
  return {
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens
  };
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
