/**
 * moomoo-execution.service tests — Trading Audit Section 4 (LIVE SAFETY)
 *
 * This is the execution layer (Phase 6F). The single most important safety
 * invariant in the whole system lives here:
 *
 *     "AI can recommend. User must confirm. Backend must validate."
 *
 * submitMoomooExecution() MUST refuse to do anything unless the caller passes
 * an explicit { confirm: true }. These tests assert that gate plus the
 * idempotency guards (already submitted / cancelled) and the parser default.
 *
 * prisma's tagged-template helpers ($queryRaw / $executeRaw) are replaced with
 * plain mocks; the linked trade ticket + broker.service calls are mocked so the
 * throw-paths can be exercised deterministically without a DB or OpenD.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

const queryRaw = vi.fn();
const executeRaw = vi.fn();

vi.mock('$lib/server/db', () => ({
  prisma: {
    $queryRaw: (...args: unknown[]) => queryRaw(...args),
    $executeRaw: (...args: unknown[]) => executeRaw(...args)
  }
}));

vi.mock('$lib/services/trade-layer.service', () => ({
  getTradeTicket: vi.fn(),
  validateTradeTicket: vi.fn()
}));
vi.mock('$lib/services/broker.service', () => ({
  getMoomooStatus: vi.fn(),
  getMarketStates: vi.fn(),
  syncMoomoo: vi.fn()
}));

import {
  submitMoomooExecution,
  parseExecutionMode,
  MOOMOO_EXECUTION_VERSION
} from './moomoo-execution.service';
import { getTradeTicket, validateTradeTicket } from '$lib/services/trade-layer.service';

const mockGetTicket = getTradeTicket as ReturnType<typeof vi.fn>;
const mockValidate = validateTradeTicket as ReturnType<typeof vi.fn>;

const USER = 'user-1';
const EXEC_ID = 'exec-1';
const TICKET_ID = 'ticket-1';

/** Build a broker_execution_requests row in the raw DB shape the mapper expects. */
function execRow(overrides: Record<string, unknown> = {}) {
  return {
    id: EXEC_ID,
    tradeTicketId: TICKET_ID,
    broker: 'moomoo',
    executionMode: 'dry_run',
    status: 'previewed',
    symbol: 'AAPL',
    brokerSymbol: 'US.AAPL',
    side: 'buy',
    orderType: 'limit',
    quantity: 10,
    limitPrice: 150,
    estimatedValue: 1500,
    confirmationRequired: 1,
    confirmedAt: null,
    safetyJson: JSON.stringify({ passed: true, blocked: false, warnings: 0, summary: 'ok', checks: [] }),
    requestJson: JSON.stringify({ symbol: 'US.AAPL' }),
    responseJson: null,
    metadataJson: JSON.stringify({ version: MOOMOO_EXECUTION_VERSION }),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  };
}

const APPROVED_TICKET = {
  id: TICKET_ID,
  symbol: 'AAPL',
  side: 'buy',
  quantity: 10,
  orderType: 'limit',
  limitPrice: 150,
  estimatedValue: 1500,
  status: 'approved'
};

beforeEach(() => {
  vi.clearAllMocks();
  // requireExecutionRequest → getMoomooExecutionRequest issues 1 request query
  // then 2 child queries (submissions, safety checks). Return the row first,
  // empty arrays after.
  queryRaw.mockResolvedValue([]);
  queryRaw.mockResolvedValueOnce([execRow()]);
  executeRaw.mockResolvedValue(undefined);
  mockGetTicket.mockResolvedValue(APPROVED_TICKET);
  mockValidate.mockResolvedValue({
    passed: true, violations: [], summary: 'ok',
    riskLevel: 'low', estimatedValue: 1500,
    executionEnabled: false, noBrokerOrderSubmitted: true
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 4 — the confirmation gate
// ═══════════════════════════════════════════════════════════════════════════

describe('[CRITICAL] submitMoomooExecution requires explicit confirmation', () => {
  it('throws when confirm is omitted', async () => {
    await expect(submitMoomooExecution(USER, EXEC_ID)).rejects.toThrow(
      'Explicit confirmation is required before submission.'
    );
  });

  it('throws when confirm is explicitly false', async () => {
    await expect(submitMoomooExecution(USER, EXEC_ID, { confirm: false })).rejects.toThrow(
      'Explicit confirmation is required before submission.'
    );
  });

  it('does NOT write any order submission when confirmation is missing', async () => {
    await submitMoomooExecution(USER, EXEC_ID, { confirm: false }).catch(() => {});
    // Only read queries should have run — no INSERT into broker_order_submissions.
    expect(executeRaw).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SECTION 13 — idempotency / duplicate-order protection
// ═══════════════════════════════════════════════════════════════════════════

describe('[SECTION 13] duplicate / terminal-state protection', () => {
  it('refuses to re-submit an already-submitted request', async () => {
    queryRaw.mockReset();
    queryRaw.mockResolvedValue([]);
    queryRaw.mockResolvedValueOnce([execRow({ status: 'submitted' })]);
    await expect(submitMoomooExecution(USER, EXEC_ID, { confirm: true })).rejects.toThrow(
      'already been submitted'
    );
  });

  it('refuses to submit a cancelled request', async () => {
    queryRaw.mockReset();
    queryRaw.mockResolvedValue([]);
    queryRaw.mockResolvedValueOnce([execRow({ status: 'cancelled' })]);
    await expect(submitMoomooExecution(USER, EXEC_ID, { confirm: true })).rejects.toThrow(
      'Cancelled execution requests cannot be submitted.'
    );
  });

  it('throws a clear error when the execution request does not exist', async () => {
    queryRaw.mockReset();
    queryRaw.mockResolvedValue([]); // no rows at all
    await expect(submitMoomooExecution(USER, EXEC_ID, { confirm: true })).rejects.toThrow(
      'Execution request not found.'
    );
  });

  it('throws when the linked trade ticket is missing', async () => {
    mockGetTicket.mockResolvedValue(null);
    await expect(submitMoomooExecution(USER, EXEC_ID, { confirm: true })).rejects.toThrow(
      'Linked trade ticket not found.'
    );
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// parser default — unknown modes degrade to the safest mode (dry_run)
// ═══════════════════════════════════════════════════════════════════════════

describe('[SAFETY] parseExecutionMode defaults to dry_run', () => {
  it('unknown values become dry_run, not live', () => {
    expect(parseExecutionMode('nonsense' as never)).toBe('dry_run');
    expect(parseExecutionMode(null)).toBe('dry_run');
    expect(parseExecutionMode('')).toBe('dry_run');
  });

  it('valid modes pass through', () => {
    expect(parseExecutionMode('paper')).toBe('paper');
    expect(parseExecutionMode('live')).toBe('live');
    expect(parseExecutionMode('dry_run')).toBe('dry_run');
  });

  it('is pinned to the audited execution phase', () => {
    expect(MOOMOO_EXECUTION_VERSION).toBe('phase-6F');
  });
});
