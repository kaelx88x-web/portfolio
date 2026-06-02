/**
 * trade-layer.service tests — Trading Audit Sections 2, 3, 4, 8, 16
 *
 * The trade layer (Phase 6E) is the "AI suggests → user approves" gate. It
 * creates INTERNAL approval tickets only and must NEVER report that a broker
 * order was submitted. These tests lock that invariant plus the order-field
 * validation rules (quantity, limit price, symbol) and risk inference.
 *
 * BLACK BOX — public validateTradeTicket + parse* contracts.
 * WHITE BOX — individual guardrail violation branches in buildTradeViolations
 *             and risk tiers in inferTicketRisk (observed through the public
 *             validation result).
 *
 * DB-touching functions (create/approve/reject) are exercised through the
 * thin pure-validation surface; full persistence paths are covered by e2e.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Top-level module imports prisma — stub it so importing the service never
// opens a real DB connection. validateTradeTicket itself touches no prisma.
vi.mock('$lib/server/db', () => ({ prisma: {} }));

vi.mock('$lib/services/optimization-engine.service', () => ({
  getUserPortfolioMode: vi.fn()
}));
vi.mock('$lib/services/guardrail.service', () => ({
  validatePortfolioGuardrails: vi.fn()
}));
vi.mock('$lib/services/strategy-orchestrator.service', () => ({
  getStrategyRecommendations: vi.fn()
}));

import {
  validateTradeTicket,
  recommendationToTicketInput,
  parseTradeTicketType,
  parseTradeOrderType,
  parseTradeTicketStatus,
  TRADE_LAYER_VERSION,
  type TradeTicketInput
} from './trade-layer.service';
import type { StrategyRecommendation } from '$lib/services/strategy-orchestrator.service';
import { getUserPortfolioMode } from '$lib/services/optimization-engine.service';
import { validatePortfolioGuardrails } from '$lib/services/guardrail.service';

const mockMode = getUserPortfolioMode as ReturnType<typeof vi.fn>;
const mockGuardrail = validatePortfolioGuardrails as ReturnType<typeof vi.fn>;

const USER = 'user-1';

/** A clean, fully-valid limit buy ticket. */
const VALID_BUY: TradeTicketInput = {
  ticketType: 'buy',
  symbol: 'AAPL',
  side: 'buy',
  quantity: 10,
  orderType: 'limit',
  limitPrice: 150
};

beforeEach(() => {
  vi.clearAllMocks();
  mockMode.mockResolvedValue('hybrid');
  mockGuardrail.mockResolvedValue({ passed: true, violations: [], summary: 'Portfolio within guardrails.' });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — execution can NEVER be enabled from the trade layer
// ═══════════════════════════════════════════════════════════════════════════

describe('[SAFETY] trade layer never enables broker execution', () => {
  it('valid ticket validation carries executionEnabled:false + noBrokerOrderSubmitted:true', async () => {
    const v = await validateTradeTicket(USER, VALID_BUY);
    expect(v.executionEnabled).toBe(false);
    expect(v.noBrokerOrderSubmitted).toBe(true);
  });

  it('a failing ticket still reports execution disabled (no bypass on error path)', async () => {
    const v = await validateTradeTicket(USER, { ...VALID_BUY, quantity: 0 });
    expect(v.passed).toBe(false);
    expect(v.executionEnabled).toBe(false);
    expect(v.noBrokerOrderSubmitted).toBe(true);
  });

  it('the layer is pinned to the audited phase version', () => {
    expect(TRADE_LAYER_VERSION).toBe('phase-6E');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 3 — order field validation
// ═══════════════════════════════════════════════════════════════════════════

describe('[SECTION 3] order validation — quantity', () => {
  it('passes for a positive quantity', async () => {
    const v = await validateTradeTicket(USER, VALID_BUY);
    expect(v.passed).toBe(true);
  });

  it('breaches when quantity is zero', async () => {
    const v = await validateTradeTicket(USER, { ...VALID_BUY, quantity: 0 });
    expect(v.passed).toBe(false);
    expect(v.violations.some((x) => x.rule === 'quantity_required' && x.severity === 'breach')).toBe(true);
  });

  it('breaches when quantity is negative', async () => {
    const v = await validateTradeTicket(USER, { ...VALID_BUY, quantity: -5 });
    expect(v.violations.some((x) => x.rule === 'quantity_required' && x.severity === 'breach')).toBe(true);
  });

  it('breaches when quantity is NaN', async () => {
    const v = await validateTradeTicket(USER, { ...VALID_BUY, quantity: Number('abc') });
    expect(v.violations.some((x) => x.rule === 'quantity_required')).toBe(true);
  });
});

describe('[SECTION 3] order validation — limit price', () => {
  it('breaches a limit order with no price', async () => {
    const v = await validateTradeTicket(USER, { ...VALID_BUY, limitPrice: null });
    expect(v.passed).toBe(false);
    expect(v.violations.some((x) => x.rule === 'limit_price_required' && x.severity === 'breach')).toBe(true);
  });

  it('breaches a limit order with a zero/negative price', async () => {
    const v = await validateTradeTicket(USER, { ...VALID_BUY, limitPrice: 0 });
    expect(v.violations.some((x) => x.rule === 'limit_price_required')).toBe(true);
  });

  it('does NOT require a limit price for a market order', async () => {
    const v = await validateTradeTicket(USER, { ...VALID_BUY, orderType: 'market', limitPrice: null });
    expect(v.violations.some((x) => x.rule === 'limit_price_required')).toBe(false);
  });
});

describe('[SECTION 3] order validation — symbol', () => {
  it('breaches when symbol is empty', async () => {
    const v = await validateTradeTicket(USER, { ...VALID_BUY, symbol: '' });
    expect(v.passed).toBe(false);
    expect(v.violations.some((x) => x.rule === 'symbol_required' && x.severity === 'breach')).toBe(true);
  });

  it('breaches when symbol is only invalid characters', async () => {
    const v = await validateTradeTicket(USER, { ...VALID_BUY, symbol: '!!!' });
    expect(v.violations.some((x) => x.rule === 'symbol_required')).toBe(true);
  });
});

describe('[SECTION 3] estimated cost', () => {
  it('estimatedValue = quantity * limitPrice for a limit order', async () => {
    const v = await validateTradeTicket(USER, { ...VALID_BUY, quantity: 10, limitPrice: 150 });
    expect(v.estimatedValue).toBe(1500);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 8 — portfolio guardrails merge into the trade decision
// ═══════════════════════════════════════════════════════════════════════════

describe('[SECTION 8] portfolio guardrail breaches block approval', () => {
  it('a portfolio breach is surfaced and fails the ticket', async () => {
    mockGuardrail.mockResolvedValue({
      passed: false,
      violations: [{ rule: 'cash_buffer', severity: 'breach', current: 0, limit: 1000, message: 'Cash buffer below minimum.' }],
      summary: 'Cash buffer breached.'
    });
    const v = await validateTradeTicket(USER, VALID_BUY);
    expect(v.passed).toBe(false);
    expect(v.riskLevel).toBe('high');
    expect(v.violations.some((x) => x.rule === 'cash_buffer')).toBe(true);
  });

  it('survives guardrail-service failure without throwing (degrades to pass)', async () => {
    mockGuardrail.mockRejectedValue(new Error('guardrail offline'));
    const v = await validateTradeTicket(USER, VALID_BUY);
    expect(v.executionEnabled).toBe(false);
    expect(v).toHaveProperty('summary');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// WHITE BOX — risk tiers + warnings
// ═══════════════════════════════════════════════════════════════════════════

describe('[WHITE BOX] risk inference', () => {
  it('a clean small limit buy is low risk', async () => {
    const v = await validateTradeTicket(USER, VALID_BUY);
    expect(v.riskLevel).toBe('low');
  });

  it('an options-style ticket is at least moderate risk', async () => {
    const v = await validateTradeTicket(USER, { ...VALID_BUY, ticketType: 'covered_call', side: 'open' });
    expect(['moderate', 'high']).toContain(v.riskLevel);
  });

  it('warns when an options ticket is built in stock-only portfolio mode', async () => {
    mockMode.mockResolvedValue('stock');
    const v = await validateTradeTicket(USER, { ...VALID_BUY, ticketType: 'cash_secured_put', side: 'open' });
    expect(v.violations.some((x) => x.rule === 'options_mode_warning' && x.severity === 'warning')).toBe(true);
  });

  it('warns on a large notional ticket (>= $50k)', async () => {
    const v = await validateTradeTicket(USER, { ...VALID_BUY, quantity: 1000, limitPrice: 60 });
    expect(v.violations.some((x) => x.rule === 'large_ticket_review' && x.severity === 'warning')).toBe(true);
    expect(v.riskLevel).not.toBe('low');
  });

  it('any breach forces high risk', async () => {
    const v = await validateTradeTicket(USER, { ...VALID_BUY, quantity: 0 });
    expect(v.riskLevel).toBe('high');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// parsers — never throw, always land on a safe default
// ═══════════════════════════════════════════════════════════════════════════

describe('[BLACK BOX] parsers fall back to safe defaults', () => {
  it('parseTradeTicketType: unknown → buy', () => {
    expect(parseTradeTicketType('nonsense' as never)).toBe('buy');
    expect(parseTradeTicketType('covered_call')).toBe('covered_call');
  });

  it('parseTradeOrderType: unknown → limit (price-protected default)', () => {
    expect(parseTradeOrderType('nonsense' as never)).toBe('limit');
    expect(parseTradeOrderType('market')).toBe('market');
  });

  it('parseTradeTicketStatus: unknown → draft', () => {
    expect(parseTradeTicketStatus('nonsense' as never)).toBe('draft');
    expect(parseTradeTicketStatus('approved')).toBe('approved');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 6/7 — recommendation → ticket: structured intent vs. no fabrication
// ═══════════════════════════════════════════════════════════════════════════

function rec(overrides: Partial<StrategyRecommendation> = {}): StrategyRecommendation {
  return {
    id: 'rec-1',
    strategyMode: 'income',
    title: 'Generate options premium',
    summary: 'Premium available on a held name.',
    priority: 'high',
    riskLevel: 'moderate',
    recommendation: {
      objective: 'options premium generation',
      actions: [],
      tradeoffs: [],
      expectedImpact: 'x',
      noAutoTrading: true
    },
    metadata: {},
    ...overrides
  } as StrategyRecommendation;
}

describe('[SECTION 6/7] structured trade intent is used verbatim', () => {
  it('uses the intent symbol/quantity/price/side — no prose guessing', () => {
    const r = rec({
      recommendation: {
        objective: 'income', actions: [], tradeoffs: [], expectedImpact: 'x', noAutoTrading: true,
        tradeIntent: {
          symbol: 'NIO', side: 'open', ticketType: 'covered_call',
          quantity: 1, orderType: 'limit', limitPrice: 0.55,
          reason: 'Owns 100 shares; premium available.',
          confidence: 'medium', accountMode: 'paper',
          supportingData: { shares: 100, strike: 5.5, dte: 3 }
        }
      }
    });
    const input = recommendationToTicketInput(r);
    expect(input.symbol).toBe('NIO');
    expect(input.ticketType).toBe('covered_call');
    expect(input.quantity).toBe(1);
    expect(input.limitPrice).toBe(0.55);
    expect(input.thesis).toContain('100 shares');
    expect(input.metadata).toMatchObject({ inferred: false, confidence: 'medium', accountMode: 'paper' });
    expect((input.metadata as Record<string, unknown>).supportingData).toMatchObject({ shares: 100, strike: 5.5, dte: 3 });
  });

  it('a market intent carries no limit price', () => {
    const r = rec({
      recommendation: {
        objective: 'x', actions: [], tradeoffs: [], expectedImpact: 'x', noAutoTrading: true,
        tradeIntent: {
          symbol: 'AAPL', side: 'buy', ticketType: 'buy',
          quantity: 5, orderType: 'market', reason: 'Add exposure.',
          confidence: 'high', accountMode: 'paper'
        }
      }
    });
    const input = recommendationToTicketInput(r);
    expect(input.orderType).toBe('market');
    expect(input.limitPrice).toBeNull();
  });
});

describe('[SECTION 7] no structured intent → never fabricates a price', () => {
  it('emits a market draft (null limit price) flagged inferred + requiresUserInput', () => {
    const input = recommendationToTicketInput(rec());
    // The old code invented limitPrice:1 — that must be gone.
    expect(input.orderType).toBe('market');
    expect(input.limitPrice).toBeNull();
    expect(input.metadata).toMatchObject({ inferred: true, requiresUserInput: true, confidence: 'low' });
  });

  it('inferred draft is paper-mode by default (never silently live)', () => {
    const input = recommendationToTicketInput(rec());
    expect((input.metadata as Record<string, unknown>).accountMode).toBe('paper');
  });
});
