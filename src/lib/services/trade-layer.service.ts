import { randomUUID } from 'node:crypto';
import { prisma } from '$lib/server/db';
import { validatePortfolioGuardrails, type GuardrailReport, type GuardrailViolation } from '$lib/services/guardrail.service';
import { getUserPortfolioMode } from '$lib/services/optimization-engine.service';
import { getStrategyRecommendations, type StrategyRecommendation, type TradeIntent } from '$lib/services/strategy-orchestrator.service';

export const TRADE_LAYER_VERSION = 'phase-6E';

export const TRADE_TICKET_TYPES = ['buy', 'sell', 'covered_call', 'cash_secured_put'] as const;
export const TRADE_TICKET_STATUSES = ['draft', 'pending_approval', 'approved', 'rejected', 'cancelled', 'expired'] as const;
export const TRADE_ORDER_TYPES = ['market', 'limit'] as const;

export type TradeTicketType = (typeof TRADE_TICKET_TYPES)[number];
export type TradeTicketStatus = (typeof TRADE_TICKET_STATUSES)[number];
export type TradeOrderType = (typeof TRADE_ORDER_TYPES)[number];
export type TradeSide = 'buy' | 'sell' | 'open' | 'close';
export type TradeRiskLevel = 'low' | 'moderate' | 'high';

export type TradeTicketInput = {
  sourceType?: string;
  sourceId?: string | null;
  ticketType: TradeTicketType;
  symbol: string;
  side?: TradeSide;
  quantity: number;
  orderType?: TradeOrderType;
  limitPrice?: number | null;
  thesis?: string;
  metadata?: Record<string, unknown>;
};

export type TradeTicketValidation = GuardrailReport & {
  riskLevel: TradeRiskLevel;
  estimatedValue: number;
  executionEnabled: false;
  noBrokerOrderSubmitted: true;
};

export type TradeTicket = {
  id: string;
  sourceType: string;
  sourceId: string | null;
  ticketType: TradeTicketType;
  symbol: string;
  side: TradeSide;
  quantity: number;
  orderType: TradeOrderType;
  limitPrice: number | null;
  estimatedValue: number;
  riskLevel: TradeRiskLevel;
  status: TradeTicketStatus;
  thesis: string;
  guardrail: TradeTicketValidation;
  approval: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  auditLogs?: TradeTicketAuditLog[];
  approvals?: TradeApproval[];
  createdAt: string;
  updatedAt: string;
};

export type TradeTicketAuditLog = {
  id: string;
  tradeTicketId: string;
  eventType: string;
  previousStatus: TradeTicketStatus | null;
  newStatus: TradeTicketStatus | null;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type TradeApproval = {
  id: string;
  tradeTicketId: string;
  approvalStatus: 'approved' | 'rejected';
  approvedBy: string;
  decisionNote: string;
  guardrail: TradeTicketValidation;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type TradeTicketRow = {
  id: string;
  sourceType: string;
  sourceId: string | null;
  ticketType: string;
  symbol: string;
  side: string;
  quantity: number;
  orderType: string;
  limitPrice: number | null;
  estimatedValue: number;
  riskLevel: string;
  status: string;
  thesis: string;
  guardrailJson: string;
  approvalJson: string | null;
  metadataJson: string;
  createdAt: Date;
  updatedAt: Date;
};

type TradeAuditRow = {
  id: string;
  tradeTicketId: string;
  eventType: string;
  previousStatus: string | null;
  newStatus: string | null;
  message: string;
  metadataJson: string;
  createdAt: Date;
};

type TradeApprovalRow = {
  id: string;
  tradeTicketId: string;
  approvalStatus: string;
  approvedBy: string;
  decisionNote: string;
  guardrailJson: string;
  metadataJson: string;
  createdAt: Date;
  updatedAt: Date;
};

export async function getTradeLayerDashboard(userId: string) {
  const [tickets, approvals, suggestedDrafts] = await Promise.all([
    listTradeTickets(userId, { limit: 20 }),
    getTradeApprovals(userId, 8),
    getSuggestedTradeTicketDrafts(userId)
  ]);
  const openTickets = tickets.filter((ticket) => ticket.status === 'draft' || ticket.status === 'pending_approval');
  const approvedTickets = tickets.filter((ticket) => ticket.status === 'approved');
  const highRiskTickets = tickets.filter((ticket) => ticket.riskLevel === 'high');
  return {
    version: TRADE_LAYER_VERSION,
    executionEnabled: false,
    safetyMessage: 'Phase 6E creates internal trade tickets only. No broker order is submitted.',
    widgets: [
      { label: 'Open Tickets', value: String(openTickets.length), status: openTickets.length ? 'medium' : 'low' },
      { label: 'Approved Internal Tickets', value: String(approvedTickets.length), status: approvedTickets.length ? 'medium' : 'low' },
      { label: 'High Risk Tickets', value: String(highRiskTickets.length), status: highRiskTickets.length ? 'high' : 'low' },
      { label: 'Execution', value: 'Disabled', status: 'low' }
    ],
    tickets,
    approvals,
    suggestedDrafts
  };
}

export async function listTradeTickets(
  userId: string,
  options: { status?: TradeTicketStatus | null; limit?: number } = {}
) {
  const limit = clampInt(options.limit ?? 30, 1, 100);
  const status = options.status ? parseTradeTicketStatus(options.status) : null;
  const rows = status
    ? await prisma.$queryRaw<TradeTicketRow[]>`
        SELECT
          id,
          source_type AS sourceType,
          source_id AS sourceId,
          ticket_type AS ticketType,
          symbol,
          side,
          quantity,
          order_type AS orderType,
          limit_price AS limitPrice,
          estimated_value AS estimatedValue,
          risk_level AS riskLevel,
          status,
          thesis,
          guardrail_json AS guardrailJson,
          approval_json AS approvalJson,
          metadata AS metadataJson,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM trade_tickets
        WHERE user_id = ${userId} AND status = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await prisma.$queryRaw<TradeTicketRow[]>`
        SELECT
          id,
          source_type AS sourceType,
          source_id AS sourceId,
          ticket_type AS ticketType,
          symbol,
          side,
          quantity,
          order_type AS orderType,
          limit_price AS limitPrice,
          estimated_value AS estimatedValue,
          risk_level AS riskLevel,
          status,
          thesis,
          guardrail_json AS guardrailJson,
          approval_json AS approvalJson,
          metadata AS metadataJson,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM trade_tickets
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
  return rows.map(mapTicketRow);
}

export async function getTradeTicket(userId: string, id: string) {
  const rows = await prisma.$queryRaw<TradeTicketRow[]>`
    SELECT
      id,
      source_type AS sourceType,
      source_id AS sourceId,
      ticket_type AS ticketType,
      symbol,
      side,
      quantity,
      order_type AS orderType,
      limit_price AS limitPrice,
      estimated_value AS estimatedValue,
      risk_level AS riskLevel,
      status,
      thesis,
      guardrail_json AS guardrailJson,
      approval_json AS approvalJson,
      metadata AS metadataJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM trade_tickets
    WHERE user_id = ${userId} AND id = ${id}
    LIMIT 1
  `;
  const ticket = rows[0] ? mapTicketRow(rows[0]) : null;
  if (!ticket) return null;
  const [auditLogs, approvals] = await Promise.all([
    getTradeTicketAuditLogs(userId, id),
    getTradeTicketApprovals(userId, id)
  ]);
  return { ...ticket, auditLogs, approvals };
}

export async function createTradeTicket(userId: string, input: TradeTicketInput) {
  if (process.env.TRADE_LAYER_ENABLED === 'false') {
    throw new Error('Trade layer is disabled by TRADE_LAYER_ENABLED=false.');
  }
  await enforceDailyTicketLimit(userId);
  const normalized = normalizeTicketInput(input);
  const validation = await validateTradeTicket(userId, normalized);
  const id = randomUUID();
  const metadata = {
    ...normalized.metadata,
    version: TRADE_LAYER_VERSION,
    sourceType: normalized.sourceType ?? 'manual',
    noBrokerOrderSubmitted: true,
    executionGuardrail: 'Phase 6E records an internal approval ticket only.'
  };
  await prisma.$executeRaw`
    INSERT INTO trade_tickets
      (id, user_id, source_type, source_id, ticket_type, symbol, side, quantity, order_type, limit_price, estimated_value, risk_level, status, thesis, guardrail_json, approval_json, metadata, created_at, updated_at)
    VALUES
      (${id}, ${userId}, ${normalized.sourceType ?? 'manual'}, ${normalized.sourceId ?? null}, ${normalized.ticketType}, ${normalized.symbol}, ${normalized.side}, ${normalized.quantity}, ${normalized.orderType}, ${normalized.limitPrice ?? null}, ${validation.estimatedValue}, ${validation.riskLevel}, 'draft', ${normalized.thesis ?? defaultThesis(normalized)}, ${JSON.stringify(validation)}, ${null}, ${JSON.stringify(metadata)}, NOW(), NOW())
  `;
  await addAuditLog(userId, id, {
    eventType: 'created',
    previousStatus: null,
    newStatus: 'draft',
    message: 'Internal trade ticket created. No broker order submitted.',
    metadata
  });
  const ticket = await getTradeTicket(userId, id);
  if (!ticket) throw new Error('Trade ticket was created but could not be loaded.');
  return ticket;
}

export async function createTradeTicketFromRecommendation(userId: string, recommendationId: string) {
  const recommendations = await getStrategyRecommendations(userId, { limit: 20 });
  const recommendation = recommendations.find((item) => item.id === recommendationId);
  if (!recommendation) throw new Error('Strategy recommendation not found.');
  return createTradeTicket(userId, recommendationToTicketInput(recommendation));
}

export async function validateTradeTicket(userId: string, input: TradeTicketInput | TradeTicket): Promise<TradeTicketValidation> {
  const normalized = normalizeTicketInput(input);
  const [mode, guardrail] = await Promise.all([
    getUserPortfolioMode(userId),
    getUserPortfolioMode(userId)
      .then((portfolioMode) => validatePortfolioGuardrails(userId, portfolioMode))
      .catch(() => ({ passed: true, violations: [], summary: 'Portfolio guardrail validation unavailable.' }))
  ]);
  const localViolations = buildTradeViolations(normalized, mode);
  const violations = [...guardrail.violations, ...localViolations];
  const breaches = violations.filter((violation) => violation.severity === 'breach');
  const warnings = violations.filter((violation) => violation.severity === 'warning');
  const estimatedValue = estimateTicketValue(normalized);
  const riskLevel = inferTicketRisk(normalized, estimatedValue, violations);
  return {
    passed: breaches.length === 0,
    violations,
    summary: breaches.length
      ? `${breaches.length} trade or portfolio guardrail breach${breaches.length > 1 ? 'es' : ''} detected.`
      : warnings.length
        ? `${warnings.length} trade or portfolio warning${warnings.length > 1 ? 's' : ''}. Approval can continue after review.`
        : guardrail.summary,
    riskLevel,
    estimatedValue,
    executionEnabled: false,
    noBrokerOrderSubmitted: true
  };
}

export async function approveTradeTicket(userId: string, id: string, note = 'Approved for future execution review.') {
  const ticket = await requireTradeTicket(userId, id);
  if (!['draft', 'pending_approval'].includes(ticket.status)) {
    throw new Error(`Only draft or pending approval tickets can be approved. Current status: ${ticket.status}.`);
  }
  const validation = await validateTradeTicket(userId, ticket);
  if (!validation.passed) {
    throw new Error(`Ticket cannot be approved: ${validation.summary}`);
  }
  const approval = buildApprovalPayload('approved', note, validation);
  await prisma.$executeRaw`
    UPDATE trade_tickets
    SET status = 'approved', risk_level = ${validation.riskLevel}, guardrail_json = ${JSON.stringify(validation)}, approval_json = ${JSON.stringify(approval)}, updated_at = NOW()
    WHERE user_id = ${userId} AND id = ${id}
  `;
  await addApproval(userId, id, 'approved', note, validation);
  await addAuditLog(userId, id, {
    eventType: 'approved',
    previousStatus: ticket.status,
    newStatus: 'approved',
    message: 'Ticket approved internally. Broker execution remains disabled in Phase 6E.',
    metadata: approval
  });
  return requireTradeTicket(userId, id);
}

export async function rejectTradeTicket(userId: string, id: string, note = 'Rejected after review.') {
  const ticket = await requireTradeTicket(userId, id);
  if (['approved', 'cancelled', 'expired'].includes(ticket.status)) {
    throw new Error(`Ticket cannot be rejected from status: ${ticket.status}.`);
  }
  const validation = await validateTradeTicket(userId, ticket);
  const approval = buildApprovalPayload('rejected', note, validation);
  await prisma.$executeRaw`
    UPDATE trade_tickets
    SET status = 'rejected', guardrail_json = ${JSON.stringify(validation)}, approval_json = ${JSON.stringify(approval)}, updated_at = NOW()
    WHERE user_id = ${userId} AND id = ${id}
  `;
  await addApproval(userId, id, 'rejected', note, validation);
  await addAuditLog(userId, id, {
    eventType: 'rejected',
    previousStatus: ticket.status,
    newStatus: 'rejected',
    message: 'Ticket rejected internally.',
    metadata: approval
  });
  return requireTradeTicket(userId, id);
}

export async function cancelTradeTicket(userId: string, id: string, note = 'Cancelled by user.') {
  const ticket = await requireTradeTicket(userId, id);
  if (ticket.status === 'approved') {
    throw new Error('Approved tickets should be rejected by a supervisor workflow or allowed to expire in a future execution layer.');
  }
  if (['cancelled', 'expired'].includes(ticket.status)) {
    throw new Error(`Ticket is already ${ticket.status}.`);
  }
  const metadata = { note, version: TRADE_LAYER_VERSION, noBrokerOrderSubmitted: true };
  await prisma.$executeRaw`
    UPDATE trade_tickets
    SET status = 'cancelled', approval_json = ${JSON.stringify(metadata)}, updated_at = NOW()
    WHERE user_id = ${userId} AND id = ${id}
  `;
  await addAuditLog(userId, id, {
    eventType: 'cancelled',
    previousStatus: ticket.status,
    newStatus: 'cancelled',
    message: note,
    metadata
  });
  return requireTradeTicket(userId, id);
}

export async function getTradeApprovals(userId: string, limit = 30) {
  const rows = await prisma.$queryRaw<TradeApprovalRow[]>`
    SELECT
      id,
      trade_ticket_id AS tradeTicketId,
      approval_status AS approvalStatus,
      approved_by AS approvedBy,
      decision_note AS decisionNote,
      guardrail_json AS guardrailJson,
      metadata AS metadataJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM trade_approvals
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${clampInt(limit, 1, 100)}
  `;
  return rows.map(mapApprovalRow);
}

export async function getSuggestedTradeTicketDrafts(userId: string) {
  const recommendations = await getStrategyRecommendations(userId, { limit: 6 }).catch(() => []);
  return recommendations.slice(0, 4).map((recommendation) => {
    const input = recommendationToTicketInput(recommendation);
    return {
      sourceRecommendation: recommendation,
      draft: {
        ...input,
        estimatedValue: estimateTicketValue(input),
        noBrokerOrderSubmitted: true
      }
    };
  });
}

export function parseTradeTicketType(value: FormDataEntryValue | string | null): TradeTicketType {
  return TRADE_TICKET_TYPES.includes(value as TradeTicketType) ? (value as TradeTicketType) : 'buy';
}

export function parseTradeTicketStatus(value: FormDataEntryValue | string | null): TradeTicketStatus {
  return TRADE_TICKET_STATUSES.includes(value as TradeTicketStatus) ? (value as TradeTicketStatus) : 'draft';
}

export function parseTradeOrderType(value: FormDataEntryValue | string | null): TradeOrderType {
  return TRADE_ORDER_TYPES.includes(value as TradeOrderType) ? (value as TradeOrderType) : 'limit';
}

function normalizeTicketInput(input: TradeTicketInput | TradeTicket): TradeTicketInput & { side: TradeSide; orderType: TradeOrderType } {
  const ticketType = parseTradeTicketType(input.ticketType);
  const side = parseTradeSide(input.side, ticketType);
  const orderType = parseTradeOrderType(input.orderType ?? 'limit');
  const limitPrice = input.limitPrice === null || input.limitPrice === undefined ? null : round(Number(input.limitPrice));
  return {
    sourceType: input.sourceType ?? 'manual',
    sourceId: input.sourceId ?? null,
    ticketType,
    symbol: normalizeSymbol(input.symbol),
    side,
    quantity: round(Number(input.quantity), 4),
    orderType,
    limitPrice,
    thesis: input.thesis?.trim() || undefined,
    metadata: input.metadata ?? {}
  };
}

function buildTradeViolations(input: TradeTicketInput & { side: TradeSide; orderType: TradeOrderType }, mode: string): GuardrailViolation[] {
  const violations: GuardrailViolation[] = [];
  if (!input.symbol) {
    violations.push(violation('symbol_required', 'breach', 0, 1, 'A trade ticket requires a symbol.'));
  }
  if (!Number.isFinite(input.quantity) || input.quantity <= 0) {
    violations.push(violation('quantity_required', 'breach', Number(input.quantity) || 0, 1, 'Quantity must be greater than zero.'));
  }
  if (input.orderType === 'limit' && (!Number.isFinite(input.limitPrice ?? NaN) || Number(input.limitPrice) <= 0)) {
    violations.push(violation('limit_price_required', 'breach', Number(input.limitPrice) || 0, 0.01, 'Limit orders require a positive limit price.'));
  }
  if ((input.ticketType === 'covered_call' || input.ticketType === 'cash_secured_put') && mode === 'stock') {
    violations.push(violation('options_mode_warning', 'warning', 0, 1, 'Options-style tickets should be reviewed in hybrid or options portfolio mode.'));
  }
  if (estimateTicketValue(input) >= 50000) {
    violations.push(violation('large_ticket_review', 'warning', estimateTicketValue(input), 50000, 'Large notional tickets should receive extra review before approval.'));
  }
  return violations;
}

export function recommendationToTicketInput(recommendation: StrategyRecommendation): TradeTicketInput {
  const baseMeta = {
    strategyMode: recommendation.strategyMode,
    priority: recommendation.priority,
    riskLevel: recommendation.riskLevel,
    recommendationTitle: recommendation.title,
    noBrokerOrderSubmitted: true
  };

  // Preferred path: a structured, sourced trade intent. Use its exact values —
  // never re-derive the symbol/quantity/price from prose (audit §6/§7).
  const intent: TradeIntent | undefined = recommendation.recommendation?.tradeIntent;
  if (intent && String(intent.symbol).trim()) {
    const orderType = intent.orderType === 'market' ? 'market' : 'limit';
    return {
      sourceType: 'strategy_recommendation',
      sourceId: recommendation.id,
      ticketType: parseTradeTicketType(intent.ticketType),
      symbol: intent.symbol,
      side: intent.side,
      quantity: Number(intent.quantity) > 0 ? Number(intent.quantity) : 1,
      orderType,
      limitPrice: orderType === 'market' ? null : (intent.limitPrice ?? null),
      thesis: intent.reason?.trim() || recommendation.summary,
      metadata: {
        ...baseMeta,
        inferred: false,
        confidence: intent.confidence,
        accountMode: intent.accountMode ?? 'paper',
        supportingData: intent.supportingData ?? {}
      }
    };
  }

  // Fallback: the recommendation has no structured intent. We must NOT fabricate
  // a price. Emit a market-order draft (no invented limit price) explicitly
  // flagged as inferred + requires-user-input so it can never be silently
  // approved/executed on guessed numbers. The execution layer additionally
  // blocks non-tradable placeholder symbols.
  const text = `${recommendation.title} ${recommendation.summary}`.toLowerCase();
  const ticketType = text.includes('options') || text.includes('premium') ? 'covered_call' : text.includes('cash') || text.includes('reduce') ? 'sell' : 'buy';
  const symbol = inferSymbolFromRecommendation(recommendation);
  return {
    sourceType: 'strategy_recommendation',
    sourceId: recommendation.id,
    ticketType,
    symbol,
    side: ticketType === 'sell' ? 'sell' : ticketType === 'buy' ? 'buy' : 'open',
    quantity: 1,
    orderType: 'market',
    limitPrice: null,
    thesis: recommendation.summary,
    metadata: {
      ...baseMeta,
      inferred: true,
      requiresUserInput: true,
      confidence: 'low',
      accountMode: 'paper'
    }
  };
}

async function requireTradeTicket(userId: string, id: string) {
  const ticket = await getTradeTicket(userId, id);
  if (!ticket) throw new Error('Trade ticket not found.');
  return ticket;
}

async function getTradeTicketAuditLogs(userId: string, ticketId: string) {
  const rows = await prisma.$queryRaw<TradeAuditRow[]>`
    SELECT
      id,
      trade_ticket_id AS tradeTicketId,
      event_type AS eventType,
      previous_status AS previousStatus,
      new_status AS newStatus,
      message,
      metadata AS metadataJson,
      created_at AS createdAt
    FROM trade_ticket_audit_logs
    WHERE user_id = ${userId} AND trade_ticket_id = ${ticketId}
    ORDER BY created_at DESC
  `;
  return rows.map(mapAuditRow);
}

async function getTradeTicketApprovals(userId: string, ticketId: string) {
  const rows = await prisma.$queryRaw<TradeApprovalRow[]>`
    SELECT
      id,
      trade_ticket_id AS tradeTicketId,
      approval_status AS approvalStatus,
      approved_by AS approvedBy,
      decision_note AS decisionNote,
      guardrail_json AS guardrailJson,
      metadata AS metadataJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM trade_approvals
    WHERE user_id = ${userId} AND trade_ticket_id = ${ticketId}
    ORDER BY created_at DESC
  `;
  return rows.map(mapApprovalRow);
}

async function addAuditLog(
  userId: string,
  ticketId: string,
  input: {
    eventType: string;
    previousStatus: TradeTicketStatus | null;
    newStatus: TradeTicketStatus | null;
    message: string;
    metadata?: Record<string, unknown>;
  }
) {
  await prisma.$executeRaw`
    INSERT INTO trade_ticket_audit_logs
      (id, trade_ticket_id, user_id, event_type, previous_status, new_status, message, metadata, created_at)
    VALUES
      (${randomUUID()}, ${ticketId}, ${userId}, ${input.eventType}, ${input.previousStatus}, ${input.newStatus}, ${input.message}, ${JSON.stringify(input.metadata ?? {})}, NOW())
  `;
}

async function addApproval(
  userId: string,
  ticketId: string,
  approvalStatus: 'approved' | 'rejected',
  decisionNote: string,
  guardrail: TradeTicketValidation
) {
  await prisma.$executeRaw`
    INSERT INTO trade_approvals
      (id, trade_ticket_id, user_id, approval_status, approved_by, decision_note, guardrail_json, metadata, created_at, updated_at)
    VALUES
      (${randomUUID()}, ${ticketId}, ${userId}, ${approvalStatus}, 'demo-user', ${decisionNote}, ${JSON.stringify(guardrail)}, ${JSON.stringify({ version: TRADE_LAYER_VERSION, noBrokerOrderSubmitted: true })}, NOW(), NOW())
  `;
}

async function enforceDailyTicketLimit(userId: string) {
  const maxTickets = Number(process.env.MAX_TRADE_TICKETS_PER_DAY ?? 20);
  if (!Number.isFinite(maxTickets) || maxTickets <= 0) return;
  const [row] = await prisma.$queryRaw<Array<{ count: bigint }>>`
    SELECT COUNT(*) AS count
    FROM trade_tickets
    WHERE user_id = ${userId} AND created_at >= CURRENT_DATE()
  `;
  if (Number(row?.count ?? 0) >= maxTickets) {
    throw new Error(`Daily trade ticket limit reached (${maxTickets}).`);
  }
}

function buildApprovalPayload(status: 'approved' | 'rejected', note: string, guardrail: TradeTicketValidation) {
  return {
    status,
    note,
    guardrailSummary: guardrail.summary,
    version: TRADE_LAYER_VERSION,
    decidedAt: new Date().toISOString(),
    noBrokerOrderSubmitted: true
  };
}

function estimateTicketValue(input: Pick<TradeTicketInput, 'quantity' | 'limitPrice' | 'orderType'>) {
  const quantity = Math.max(0, Number(input.quantity) || 0);
  const price = input.orderType === 'market' ? 1 : Math.max(0, Number(input.limitPrice) || 0);
  return round(quantity * price);
}

function inferTicketRisk(
  input: Pick<TradeTicketInput, 'ticketType'>,
  estimatedValue: number,
  violations: GuardrailViolation[]
): TradeRiskLevel {
  if (violations.some((violation) => violation.severity === 'breach')) return 'high';
  if (input.ticketType === 'covered_call' || input.ticketType === 'cash_secured_put') return 'moderate';
  if (estimatedValue >= 50000 || violations.some((violation) => violation.severity === 'warning')) return 'moderate';
  return 'low';
}

function mapTicketRow(row: TradeTicketRow): TradeTicket {
  return {
    id: row.id,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    ticketType: parseTradeTicketType(row.ticketType),
    symbol: row.symbol,
    side: parseTradeSide(row.side, parseTradeTicketType(row.ticketType)),
    quantity: Number(row.quantity),
    orderType: parseTradeOrderType(row.orderType),
    limitPrice: row.limitPrice === null ? null : Number(row.limitPrice),
    estimatedValue: Number(row.estimatedValue),
    riskLevel: parseRiskLevel(row.riskLevel),
    status: parseTradeTicketStatus(row.status),
    thesis: row.thesis,
    guardrail: parseJson<TradeTicketValidation>(row.guardrailJson, fallbackValidation()),
    approval: row.approvalJson ? parseJson<Record<string, unknown>>(row.approvalJson, {}) : null,
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapAuditRow(row: TradeAuditRow): TradeTicketAuditLog {
  return {
    id: row.id,
    tradeTicketId: row.tradeTicketId,
    eventType: row.eventType,
    previousStatus: row.previousStatus ? parseTradeTicketStatus(row.previousStatus) : null,
    newStatus: row.newStatus ? parseTradeTicketStatus(row.newStatus) : null,
    message: row.message,
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
    createdAt: row.createdAt.toISOString()
  };
}

function mapApprovalRow(row: TradeApprovalRow): TradeApproval {
  return {
    id: row.id,
    tradeTicketId: row.tradeTicketId,
    approvalStatus: row.approvalStatus === 'approved' ? 'approved' : 'rejected',
    approvedBy: row.approvedBy,
    decisionNote: row.decisionNote,
    guardrail: parseJson<TradeTicketValidation>(row.guardrailJson, fallbackValidation()),
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function parseTradeSide(value: FormDataEntryValue | string | null | undefined, ticketType: TradeTicketType): TradeSide {
  if (value === 'buy' || value === 'sell' || value === 'open' || value === 'close') return value;
  if (ticketType === 'sell') return 'sell';
  if (ticketType === 'covered_call' || ticketType === 'cash_secured_put') return 'open';
  return 'buy';
}

function parseRiskLevel(value: string | null): TradeRiskLevel {
  return value === 'high' || value === 'moderate' || value === 'low' ? value : 'moderate';
}

function defaultThesis(input: Pick<TradeTicketInput, 'ticketType' | 'symbol'>) {
  return `${label(input.ticketType)} ticket for ${input.symbol || 'portfolio review'} created for internal approval only.`;
}

function inferSymbolFromRecommendation(recommendation: StrategyRecommendation) {
  const combined = `${recommendation.title} ${recommendation.summary}`;
  const match = combined.match(/\b[A-Z]{1,5}\b/);
  if (match && !['AI', 'ETF', 'USD'].includes(match[0])) return match[0];
  return recommendation.metadata?.source === 'options_intelligence' ? 'OPTIONS' : 'PORTFOLIO';
}

function normalizeSymbol(value: string) {
  return String(value ?? '').trim().toUpperCase().replace(/[^A-Z0-9.\-_]/g, '').slice(0, 80);
}

function violation(rule: string, severity: GuardrailViolation['severity'], current: number, limit: number, message: string): GuardrailViolation {
  return { rule, severity, current: round(current), limit: round(limit), message };
}

function fallbackValidation(): TradeTicketValidation {
  return {
    passed: true,
    violations: [],
    summary: 'Validation unavailable.',
    riskLevel: 'moderate',
    estimatedValue: 0,
    executionEnabled: false,
    noBrokerOrderSubmitted: true
  };
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function label(value: string) {
  return value.split('_').map((part) => part[0].toUpperCase() + part.slice(1)).join(' ');
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
}

function clampInt(value: number, min: number, max: number) {
  const rounded = Math.round(Number.isFinite(value) ? value : min);
  return Math.min(max, Math.max(min, rounded));
}
