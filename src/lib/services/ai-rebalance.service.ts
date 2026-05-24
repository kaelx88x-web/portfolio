import { env } from '$env/dynamic/private';
import {
  buildAiPortfolioContext,
  type AiPortfolioContext
} from '$lib/services/ai-context.service';
import {
  getOptimizationConstraints,
  getOptimizationScenarios,
  getRebalanceSuggestionsByMode,
  type OptimizationAllocation,
  type PortfolioMode,
  type RebalanceSuggestion
} from '$lib/services/optimization-engine.service';

const MODE_LABEL: Record<PortfolioMode, string> = {
  stock: 'Stocks Only',
  hybrid: 'Hybrid (stocks + selective covered calls)',
  options: 'Active Options (covered calls + cash-secured puts)'
};

export async function getAiRebalanceSuggestions(
  userId: string,
  portfolioMode: PortfolioMode
): Promise<{ suggestions: RebalanceSuggestion[]; aiUsed: boolean }> {
  const [context, constraints, scenarios] = await Promise.all([
    buildAiPortfolioContext(userId),
    getOptimizationConstraints(userId),
    getOptimizationScenarios(userId)
  ]);

  const target = scenarios.find((s) => s.scenarioName.toLowerCase().includes('balanced')) ?? scenarios[0];
  const targetAllocation: OptimizationAllocation[] = target?.allocation ?? [];
  const currentAllocation = context.allocation.bySymbol.map((s) => ({ label: s.label, percentage: s.percentage }));

  const aiResult = await callAiForSuggestions(context, portfolioMode, constraints);

  if (!aiResult) {
    const fallback = await getRebalanceSuggestionsByMode(userId, portfolioMode);
    return { suggestions: fallback, aiUsed: false };
  }

  const suggestions: RebalanceSuggestion[] = aiResult.map((item) => ({
    title: item.title,
    summary: item.summary,
    currentAllocation,
    targetAllocation,
    riskImpact: item.risk_impact,
    volatilityImpact: item.volatility_impact,
    status: 'suggested',
    metadata: { source: 'ai-rebalance', mode: portfolioMode, priority: item.priority, guardrail: 'AI-generated suggestion. Review only. No trade is executed.' }
  }));

  return { suggestions, aiUsed: true };
}

async function callAiForSuggestions(
  context: AiPortfolioContext,
  portfolioMode: PortfolioMode,
  constraints: Awaited<ReturnType<typeof getOptimizationConstraints>>
): Promise<AiSuggestionItem[] | null> {
  if (env.GEMINI_API_KEY && env.AI_PROVIDER_GEMINI_ENABLED === 'true') {
    try { return await callGemini(context, portfolioMode, constraints); } catch { return null; }
  }
  if (env.ANTHROPIC_API_KEY && env.AI_PROVIDER_CLAUDE_ENABLED === 'true') {
    return callClaude(context, portfolioMode, constraints);
  }
  if (env.OPENAI_API_KEY && env.AI_PROVIDER_OPENAI_ENABLED !== 'false') {
    return callOpenAI(context, portfolioMode, constraints);
  }
  return null;
}

async function callGemini(
  context: AiPortfolioContext,
  portfolioMode: PortfolioMode,
  constraints: Awaited<ReturnType<typeof getOptimizationConstraints>>
): Promise<AiSuggestionItem[] | null> {
  const model = env.AI_GEMINI_MODEL ?? 'gemini-2.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`;
  const { system, user } = buildPrompt(context, portfolioMode, constraints);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { temperature: 1, maxOutputTokens: 4096, thinkingConfig: { thinkingBudget: 0 } }
    })
  });
  if (!response.ok) throw new Error(`Gemini HTTP ${response.status}`);
  const payload = await response.json();
  const raw = payload.candidates?.[0]?.content?.parts?.[0]?.text ?? '{}';
  const cleaned = raw.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(cleaned) as { suggestions?: AiSuggestionItem[] };
  if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) return null;
  return parsed.suggestions;
}

async function callClaude(
  context: AiPortfolioContext,
  portfolioMode: PortfolioMode,
  constraints: Awaited<ReturnType<typeof getOptimizationConstraints>>
): Promise<AiSuggestionItem[] | null> {
  const apiKey = env.ANTHROPIC_API_KEY;
  const model = env.AI_MODEL ?? 'claude-haiku-4-5-20251001';
  if (!apiKey) return null;
  const { system, user } = buildPrompt(context, portfolioMode, constraints);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 1200, temperature: 0.3, system, messages: [{ role: 'user', content: user }] })
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const content = payload.content?.[0]?.text ?? '{}';
    const parsed = JSON.parse(content) as { suggestions?: AiSuggestionItem[] };
    if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) return null;
    return parsed.suggestions;
  } catch { return null; }
}

async function callOpenAI(
  context: AiPortfolioContext,
  portfolioMode: PortfolioMode,
  constraints: Awaited<ReturnType<typeof getOptimizationConstraints>>
): Promise<AiSuggestionItem[] | null> {
  const apiKey = env.OPENAI_API_KEY;
  const model = env.AI_OPENAI_MODEL ?? 'gpt-4o-mini';
  if (!apiKey) return null;
  const { system, user } = buildPrompt(context, portfolioMode, constraints);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({ model, messages: [{ role: 'system', content: system }, { role: 'user', content: user }], temperature: 0.3, response_format: { type: 'json_object' }, max_tokens: 1200 })
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content ?? '{}';
    const parsed = JSON.parse(content) as { suggestions?: AiSuggestionItem[] };
    if (!Array.isArray(parsed.suggestions) || parsed.suggestions.length === 0) return null;
    return parsed.suggestions;
  } catch { return null; }
}

function buildPrompt(
  context: AiPortfolioContext,
  portfolioMode: PortfolioMode,
  constraints: Awaited<ReturnType<typeof getOptimizationConstraints>>
): { system: string; user: string } {
  const stockHoldings = context.portfolio.holdings
    .filter((h) => h.assetType.toLowerCase() !== 'option' && h.marketValue > 0)
    .sort((a, b) => b.marketValue - a.marketValue)
    .slice(0, 10);

  const optionHoldings = context.portfolio.holdings.filter(
    (h) => h.assetType.toLowerCase() === 'option'
  );

  const holdingSummary = stockHoldings
    .map((h) => `${h.symbol.replace(/^US\./, '')} qty=${Math.floor(h.quantity)} value=$${Math.round(h.marketValue).toLocaleString()} alloc=${h.allocationPct.toFixed(1)}%`)
    .join('\n');

  const optionSummary = optionHoldings.length
    ? optionHoldings.slice(0, 5).map((h) => h.symbol.replace(/^US\./, '')).join(', ')
    : 'none';

  const system = `You are a professional portfolio rebalance advisor.
Given a portfolio snapshot and the user's selected portfolio mode, return exactly 4–5 specific, actionable rebalance suggestions in JSON.

Rules:
- Be specific about symbols, quantities, and percentages.
- Each suggestion must be realistic given the current holdings.
- Do NOT recommend selling for tax-loss harvesting or suggest specific strike prices.
- All suggestions are advisory only — no trades are executed.
- Return valid JSON only, no markdown, no prose outside the JSON.

Response format:
{
  "suggestions": [
    {
      "title": "Short action title (max 10 words)",
      "summary": "2-3 sentences explaining the issue and what to do.",
      "risk_impact": "One sentence on how this affects portfolio risk.",
      "volatility_impact": "One sentence on how this affects volatility.",
      "priority": "high" | "medium" | "low"
    }
  ]
}`;

  const user = `Portfolio mode: ${MODE_LABEL[portfolioMode]}

Portfolio overview:
- Total value: $${Math.round(context.portfolio.value).toLocaleString()}
- Cash ratio: ${context.portfolio.cashRatio.toFixed(1)}%
- Holdings count: ${context.portfolio.holdingsCount}
- Volatility: ${context.risk.volatilityPct.toFixed(1)}%
- Max drawdown: ${context.risk.maxDrawdownPct.toFixed(1)}%

Stock holdings:
${holdingSummary}

Active options: ${optionSummary}

Constraints:
- Single stock max: ${constraints.singleStockMaxPct}%
- Options max: ${constraints.optionsMaxPct}%
- Cash min: ${constraints.cashMinPct}%
- Collateral reserve: ${constraints.collateralReservePct}%

Generate ${portfolioMode === 'options' ? 'options-focused' : portfolioMode === 'hybrid' ? 'hybrid stock+options' : 'stock-focused'} rebalance suggestions.`;

  return { system, user };
}

type AiSuggestionItem = {
  title: string;
  summary: string;
  risk_impact: string;
  volatility_impact: string;
  priority: 'high' | 'medium' | 'low';
};
