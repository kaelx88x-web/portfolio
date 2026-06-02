/**
 * Trading Audit — Section 17 (Regression / snapshots)
 *
 * Dependency-free snapshots of the safety-critical DATA CONTRACTS behind the
 * trade UI. If a required guardrail/warning or a safety flag silently
 * disappears (the §17 failure condition — "required warning disappears"), the
 * snapshot diff fails the build. We snapshot a normalised subset so the tests
 * track *meaning* (which rules fired, risk tier, execution flags), not volatile
 * prose.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('$lib/server/db', () => ({ prisma: {} }));
vi.mock('$lib/services/optimization-engine.service', () => ({ getUserPortfolioMode: vi.fn() }));
vi.mock('$lib/services/guardrail.service', () => ({ validatePortfolioGuardrails: vi.fn() }));
vi.mock('$lib/services/strategy-orchestrator.service', () => ({ getStrategyRecommendations: vi.fn() }));

import { validateTradeTicket, recommendationToTicketInput, type TradeTicketInput } from '$lib/services/trade-layer.service';
import { getUserPortfolioMode } from '$lib/services/optimization-engine.service';
import { validatePortfolioGuardrails } from '$lib/services/guardrail.service';
import type { StrategyRecommendation } from '$lib/services/strategy-orchestrator.service';

const mockMode = getUserPortfolioMode as ReturnType<typeof vi.fn>;
const mockGuardrail = validatePortfolioGuardrails as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  mockMode.mockResolvedValue('hybrid');
  mockGuardrail.mockResolvedValue({ passed: true, violations: [], summary: 'ok' });
});

/** Stable, meaning-only projection of a validation result. */
function shape(v: Awaited<ReturnType<typeof validateTradeTicket>>) {
  return {
    passed: v.passed,
    riskLevel: v.riskLevel,
    executionEnabled: v.executionEnabled,
    noBrokerOrderSubmitted: v.noBrokerOrderSubmitted,
    rules: v.violations.map((x) => ({ rule: x.rule, severity: x.severity })).sort((a, b) => a.rule.localeCompare(b.rule))
  };
}

const BUY: TradeTicketInput = { ticketType: 'buy', symbol: 'AAPL', side: 'buy', quantity: 10, orderType: 'limit', limitPrice: 150 };

describe('[SECTION 17] validation contract snapshots', () => {
  it('clean limit buy', async () => {
    expect(shape(await validateTradeTicket('u', BUY))).toMatchSnapshot();
  });

  it('zero quantity breach', async () => {
    expect(shape(await validateTradeTicket('u', { ...BUY, quantity: 0 }))).toMatchSnapshot();
  });

  it('limit order missing price breach', async () => {
    expect(shape(await validateTradeTicket('u', { ...BUY, limitPrice: null }))).toMatchSnapshot();
  });

  it('options ticket in stock mode warning', async () => {
    mockMode.mockResolvedValue('stock');
    expect(shape(await validateTradeTicket('u', { ...BUY, ticketType: 'covered_call', side: 'open' }))).toMatchSnapshot();
  });

  it('large notional warning', async () => {
    expect(shape(await validateTradeTicket('u', { ...BUY, quantity: 1000, limitPrice: 60 }))).toMatchSnapshot();
  });
});

describe('[SECTION 17] recommendation→ticket contract snapshots', () => {
  const base: StrategyRecommendation = {
    id: 'rec-1', strategyMode: 'income', title: 'Generate options premium',
    summary: 'Premium available.', priority: 'high', riskLevel: 'moderate',
    recommendation: { objective: 'x', actions: [], tradeoffs: [], expectedImpact: 'x', noAutoTrading: true },
    metadata: {}
  } as StrategyRecommendation;

  it('structured intent maps verbatim', () => {
    const r = {
      ...base,
      recommendation: {
        ...base.recommendation,
        tradeIntent: {
          symbol: 'NIO', side: 'open' as const, ticketType: 'covered_call' as const,
          quantity: 1, orderType: 'limit' as const, limitPrice: 0.55,
          reason: 'Owns 100 shares.', confidence: 'medium' as const, accountMode: 'paper' as const,
          supportingData: { shares: 100, strike: 5.5, dte: 3 }
        }
      }
    };
    const input = recommendationToTicketInput(r);
    expect({
      symbol: input.symbol, ticketType: input.ticketType, side: input.side,
      quantity: input.quantity, orderType: input.orderType, limitPrice: input.limitPrice,
      inferred: (input.metadata as Record<string, unknown>).inferred,
      confidence: (input.metadata as Record<string, unknown>).confidence,
      accountMode: (input.metadata as Record<string, unknown>).accountMode
    }).toMatchSnapshot();
  });

  it('inferred fallback never fabricates a price', () => {
    const input = recommendationToTicketInput(base);
    expect({
      orderType: input.orderType, limitPrice: input.limitPrice,
      inferred: (input.metadata as Record<string, unknown>).inferred,
      requiresUserInput: (input.metadata as Record<string, unknown>).requiresUserInput,
      confidence: (input.metadata as Record<string, unknown>).confidence
    }).toMatchSnapshot();
  });
});
