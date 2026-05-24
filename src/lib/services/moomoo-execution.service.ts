import { randomUUID } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { prisma } from '$lib/server/db';
import { getMarketStates, getMoomooStatus, syncMoomoo } from '$lib/services/broker.service';
import {
  getTradeTicket,
  validateTradeTicket,
  type TradeTicket,
  type TradeTicketValidation
} from '$lib/services/trade-layer.service';

export const MOOMOO_EXECUTION_VERSION = 'phase-6F';

export const EXECUTION_MODES = ['dry_run', 'paper', 'live'] as const;
export const EXECUTION_STATUSES = ['previewed', 'blocked', 'submitted', 'failed', 'cancelled'] as const;
export const SAFETY_STATUSES = ['pass', 'warning', 'block'] as const;

export type ExecutionMode = (typeof EXECUTION_MODES)[number];
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];
export type SafetyStatus = (typeof SAFETY_STATUSES)[number];

export type ExecutionSafetyCheck = {
  id?: string;
  executionRequestId?: string;
  checkType: string;
  checkStatus: SafetyStatus;
  message: string;
  detail: Record<string, unknown>;
  createdAt?: string;
};

export type BrokerExecutionRequest = {
  id: string;
  tradeTicketId: string;
  broker: 'moomoo';
  executionMode: ExecutionMode;
  status: ExecutionStatus;
  symbol: string;
  brokerSymbol: string;
  side: string;
  orderType: string;
  quantity: number;
  limitPrice: number | null;
  estimatedValue: number;
  confirmationRequired: boolean;
  confirmedAt: string | null;
  safety: {
    passed: boolean;
    blocked: boolean;
    warnings: number;
    summary: string;
    checks: ExecutionSafetyCheck[];
  };
  request: Record<string, unknown>;
  response: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  submissions?: BrokerOrderSubmission[];
  safetyChecks?: ExecutionSafetyCheck[];
  createdAt: string;
  updatedAt: string;
};

export type BrokerOrderSubmission = {
  id: string;
  executionRequestId: string;
  broker: 'moomoo';
  brokerOrderId: string | null;
  brokerStatus: string;
  submissionStatus: 'dry_run' | 'submitted' | 'failed' | 'cancelled';
  submitMode: ExecutionMode;
  request: Record<string, unknown>;
  response: Record<string, unknown>;
  errorMessage: string | null;
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type PreviewInput = {
  tradeTicketId: string;
  mode?: ExecutionMode;
  overrideGuardrails?: boolean;
};

type SubmitInput = {
  confirm?: boolean;
  overrideGuardrails?: boolean;
};

type ExecutionRequestRow = {
  id: string;
  tradeTicketId: string;
  broker: string;
  executionMode: string;
  status: string;
  symbol: string;
  brokerSymbol: string;
  side: string;
  orderType: string;
  quantity: number;
  limitPrice: number | null;
  estimatedValue: number;
  confirmationRequired: boolean | number;
  confirmedAt: Date | null;
  safetyJson: string;
  requestJson: string;
  responseJson: string | null;
  metadataJson: string;
  createdAt: Date;
  updatedAt: Date;
};

type SubmissionRow = {
  id: string;
  executionRequestId: string;
  broker: string;
  brokerOrderId: string | null;
  brokerStatus: string;
  submissionStatus: string;
  submitMode: string;
  requestJson: string;
  responseJson: string;
  errorMessage: string | null;
  submittedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SafetyCheckRow = {
  id: string;
  executionRequestId: string;
  checkType: string;
  checkStatus: string;
  message: string;
  detailJson: string;
  createdAt: Date;
};

function bridgeBase(): string {
  return env.MOOMOO_SERVICE_URL ?? 'http://127.0.0.1:8001';
}

export async function getMoomooExecutionDashboard(userId: string) {
  const [requests, submissions] = await Promise.all([
    listMoomooExecutionRequests(userId, { limit: 20 }),
    listBrokerOrderSubmissions(userId, 10)
  ]);
  const blocked = requests.filter((item) => item.status === 'blocked').length;
  const submitted = requests.filter((item) => item.status === 'submitted').length;
  return {
    version: MOOMOO_EXECUTION_VERSION,
    executionEnabled: env.TRADE_EXECUTION_ENABLED === 'true',
    liveExecutionEnabled: env.MOOMOO_LIVE_EXECUTION_ENABLED === 'true',
    dryRunEnabled: env.MOOMOO_DRY_RUN_EXECUTION !== 'false',
    safetyMessage: 'Phase 6F submits only explicitly confirmed, approved tickets. Dry-run is the default path.',
    widgets: [
      { label: 'Execution Requests', value: String(requests.length), status: requests.length ? 'medium' : 'low' },
      { label: 'Submitted', value: String(submitted), status: submitted ? 'medium' : 'low' },
      { label: 'Blocked', value: String(blocked), status: blocked ? 'high' : 'low' },
      { label: 'Live Mode', value: env.MOOMOO_LIVE_EXECUTION_ENABLED === 'true' ? 'Enabled' : 'Disabled', status: env.MOOMOO_LIVE_EXECUTION_ENABLED === 'true' ? 'high' : 'low' }
    ],
    requests,
    submissions
  };
}

export async function previewMoomooExecution(userId: string, input: PreviewInput) {
  const mode = parseExecutionMode(input.mode ?? 'dry_run');
  const ticket = await getTradeTicket(userId, input.tradeTicketId);
  if (!ticket) throw new Error('Trade ticket not found.');

  const { orderRequest, safety } = await buildExecutionPreview(userId, ticket, mode, {
    overrideGuardrails: Boolean(input.overrideGuardrails)
  });
  const id = randomUUID();
  const status: ExecutionStatus = safety.blocked ? 'blocked' : 'previewed';
  const metadata = {
    version: MOOMOO_EXECUTION_VERSION,
    tradeLayerTicket: ticket.id,
    broker: 'moomoo',
    mode,
    noAutoSubmit: true,
    liveRequiresExplicitEnvFlag: true
  };

  await prisma.$executeRaw`
    INSERT INTO broker_execution_requests
      (id, user_id, trade_ticket_id, broker, execution_mode, status, symbol, broker_symbol, side, order_type, quantity, limit_price, estimated_value, confirmation_required, confirmed_at, safety_json, request_json, response_json, metadata, created_at, updated_at)
    VALUES
      (${id}, ${userId}, ${ticket.id}, 'moomoo', ${mode}, ${status}, ${ticket.symbol}, ${String(orderRequest.symbol)}, ${ticket.side}, ${ticket.orderType}, ${ticket.quantity}, ${ticket.limitPrice}, ${ticket.estimatedValue}, ${true}, ${null}, ${JSON.stringify(safety)}, ${JSON.stringify(orderRequest)}, ${null}, ${JSON.stringify(metadata)}, NOW(), NOW())
  `;

  for (const check of safety.checks) {
    await insertSafetyCheck(userId, id, check);
  }

  const request = await getMoomooExecutionRequest(userId, id);
  if (!request) throw new Error('Execution preview was created but could not be loaded.');
  return request;
}

export async function submitMoomooExecution(userId: string, executionRequestId: string, input: SubmitInput = {}) {
  const request = await requireExecutionRequest(userId, executionRequestId);
  const ticket = await getTradeTicket(userId, request.tradeTicketId);
  if (!ticket) throw new Error('Linked trade ticket not found.');
  if (!input.confirm) throw new Error('Explicit confirmation is required before submission.');
  if (request.status === 'cancelled') throw new Error('Cancelled execution requests cannot be submitted.');
  if (request.status === 'submitted') throw new Error('Execution request has already been submitted.');

  const { orderRequest, safety } = await buildExecutionPreview(userId, ticket, request.executionMode, {
    overrideGuardrails: Boolean(input.overrideGuardrails)
  });
  if (safety.blocked) {
    await updateExecutionRequest(userId, request.id, 'blocked', safety, orderRequest, { blockedAtSubmit: true });
    throw new Error(safety.summary);
  }

  const dryRun = request.executionMode === 'dry_run' || env.MOOMOO_DRY_RUN_EXECUTION !== 'false';
  const submissionId = randomUUID();
  const submittedAt = new Date();

  if (dryRun) {
    const response = {
      dryRun: true,
      brokerOrderId: `DRYRUN-${submissionId.slice(0, 8)}`,
      message: 'Dry-run execution simulated. No order was sent to Moomoo.',
      request: orderRequest
    };
    await insertSubmission(userId, request.id, {
      id: submissionId,
      status: 'dry_run',
      mode: request.executionMode,
      request: orderRequest,
      response,
      brokerOrderId: response.brokerOrderId,
      brokerStatus: 'dry_run',
      errorMessage: null,
      submittedAt
    });
    await updateExecutionRequest(userId, request.id, 'submitted', safety, orderRequest, response, submittedAt);
    return requireExecutionRequest(userId, request.id);
  }

  try {
    const response = await submitOrderToBridge(orderRequest, request.executionMode);
    await insertSubmission(userId, request.id, {
      id: submissionId,
      status: 'submitted',
      mode: request.executionMode,
      request: orderRequest,
      response,
      brokerOrderId: String(response.broker_order_id ?? response.order_id ?? ''),
      brokerStatus: String(response.status ?? 'submitted'),
      errorMessage: null,
      submittedAt
    });
    await updateExecutionRequest(userId, request.id, 'submitted', safety, orderRequest, response, submittedAt);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Moomoo submission failed.';
    await insertSubmission(userId, request.id, {
      id: submissionId,
      status: 'failed',
      mode: request.executionMode,
      request: orderRequest,
      response: { error: message },
      brokerOrderId: null,
      brokerStatus: 'failed',
      errorMessage: message,
      submittedAt
    });
    await updateExecutionRequest(userId, request.id, 'failed', safety, orderRequest, { error: message }, submittedAt);
    throw new Error(message);
  }

  return requireExecutionRequest(userId, request.id);
}

export async function cancelMoomooExecution(userId: string, executionRequestId: string) {
  const request = await requireExecutionRequest(userId, executionRequestId);
  if (request.status === 'cancelled') return request;
  const latestSubmission = request.submissions?.[0];
  let response: Record<string, unknown> = {
    cancelled: true,
    message: 'Execution request cancelled internally.'
  };

  if (latestSubmission?.brokerOrderId && latestSubmission.submitMode !== 'dry_run') {
    response = await cancelOrderOnBridge(latestSubmission.brokerOrderId, request.executionMode);
  }

  await prisma.$executeRaw`
    UPDATE broker_execution_requests
    SET status = 'cancelled', response_json = ${JSON.stringify(response)}, updated_at = NOW()
    WHERE user_id = ${userId} AND id = ${executionRequestId}
  `;

  if (latestSubmission) {
    await prisma.$executeRaw`
      UPDATE broker_order_submissions
      SET submission_status = 'cancelled', broker_status = 'cancelled', response_json = ${JSON.stringify(response)}, updated_at = NOW()
      WHERE user_id = ${userId} AND id = ${latestSubmission.id}
    `;
  }

  return requireExecutionRequest(userId, executionRequestId);
}

export async function getMoomooExecutionRequest(userId: string, id: string) {
  const rows = await prisma.$queryRaw<ExecutionRequestRow[]>`
    SELECT
      id,
      trade_ticket_id AS tradeTicketId,
      broker,
      execution_mode AS executionMode,
      status,
      symbol,
      broker_symbol AS brokerSymbol,
      side,
      order_type AS orderType,
      quantity,
      limit_price AS limitPrice,
      estimated_value AS estimatedValue,
      confirmation_required AS confirmationRequired,
      confirmed_at AS confirmedAt,
      safety_json AS safetyJson,
      request_json AS requestJson,
      response_json AS responseJson,
      metadata AS metadataJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM broker_execution_requests
    WHERE user_id = ${userId} AND id = ${id}
    LIMIT 1
  `;
  const request = rows[0] ? mapExecutionRequestRow(rows[0]) : null;
  if (!request) return null;
  const [submissions, safetyChecks] = await Promise.all([
    listBrokerOrderSubmissions(userId, 20, id),
    listExecutionSafetyChecks(userId, id)
  ]);
  return { ...request, submissions, safetyChecks };
}

export async function listMoomooExecutionRequests(userId: string, options: { limit?: number } = {}) {
  const rows = await prisma.$queryRaw<ExecutionRequestRow[]>`
    SELECT
      id,
      trade_ticket_id AS tradeTicketId,
      broker,
      execution_mode AS executionMode,
      status,
      symbol,
      broker_symbol AS brokerSymbol,
      side,
      order_type AS orderType,
      quantity,
      limit_price AS limitPrice,
      estimated_value AS estimatedValue,
      confirmation_required AS confirmationRequired,
      confirmed_at AS confirmedAt,
      safety_json AS safetyJson,
      request_json AS requestJson,
      response_json AS responseJson,
      metadata AS metadataJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM broker_execution_requests
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${clampInt(options.limit ?? 30, 1, 100)}
  `;
  return rows.map(mapExecutionRequestRow);
}

export async function listBrokerOrderSubmissions(userId: string, limit = 30, executionRequestId?: string) {
  const rows = executionRequestId
    ? await prisma.$queryRaw<SubmissionRow[]>`
        SELECT
          id,
          execution_request_id AS executionRequestId,
          broker,
          broker_order_id AS brokerOrderId,
          broker_status AS brokerStatus,
          submission_status AS submissionStatus,
          submit_mode AS submitMode,
          request_json AS requestJson,
          response_json AS responseJson,
          error_message AS errorMessage,
          submitted_at AS submittedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM broker_order_submissions
        WHERE user_id = ${userId} AND execution_request_id = ${executionRequestId}
        ORDER BY created_at DESC
        LIMIT ${clampInt(limit, 1, 100)}
      `
    : await prisma.$queryRaw<SubmissionRow[]>`
        SELECT
          id,
          execution_request_id AS executionRequestId,
          broker,
          broker_order_id AS brokerOrderId,
          broker_status AS brokerStatus,
          submission_status AS submissionStatus,
          submit_mode AS submitMode,
          request_json AS requestJson,
          response_json AS responseJson,
          error_message AS errorMessage,
          submitted_at AS submittedAt,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM broker_order_submissions
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${clampInt(limit, 1, 100)}
      `;
  return rows.map(mapSubmissionRow);
}

export function parseExecutionMode(value: FormDataEntryValue | string | null): ExecutionMode {
  return EXECUTION_MODES.includes(value as ExecutionMode) ? (value as ExecutionMode) : 'dry_run';
}

async function buildExecutionPreview(
  userId: string,
  ticket: TradeTicket,
  mode: ExecutionMode,
  options: { overrideGuardrails: boolean }
) {
  const orderRequest = ticketToMoomooOrder(ticket, mode);
  const checks = await buildSafetyChecks(userId, ticket, mode, orderRequest, options);
  const blocked = checks.some((check) => check.checkStatus === 'block');
  const warnings = checks.filter((check) => check.checkStatus === 'warning').length;
  return {
    orderRequest,
    safety: {
      passed: !blocked,
      blocked,
      warnings,
      summary: blocked
        ? `${checks.filter((check) => check.checkStatus === 'block').length} execution safety check${checks.filter((check) => check.checkStatus === 'block').length > 1 ? 's' : ''} blocked submission.`
        : warnings
          ? `${warnings} execution warning${warnings > 1 ? 's' : ''}. Explicit confirmation is still required.`
          : 'Execution preview passed safety checks. Explicit confirmation is still required.',
      checks
    }
  };
}

async function buildSafetyChecks(
  userId: string,
  ticket: TradeTicket,
  mode: ExecutionMode,
  orderRequest: Record<string, unknown>,
  options: { overrideGuardrails: boolean }
): Promise<ExecutionSafetyCheck[]> {
  const checks: ExecutionSafetyCheck[] = [];
  checks.push(check('ticket_status', ticket.status === 'approved' ? 'pass' : 'block', `Ticket status is ${ticket.status}.`, { required: 'approved' }));
  checks.push(check('trade_execution_flag', env.TRADE_EXECUTION_ENABLED === 'true' || mode === 'dry_run' ? 'pass' : 'block', env.TRADE_EXECUTION_ENABLED === 'true' ? 'Trade execution flag is enabled.' : 'TRADE_EXECUTION_ENABLED is false. Only dry-run previews are allowed.', { TRADE_EXECUTION_ENABLED: env.TRADE_EXECUTION_ENABLED ?? 'false' }));
  checks.push(check('live_execution_flag', mode !== 'live' || env.MOOMOO_LIVE_EXECUTION_ENABLED === 'true' ? 'pass' : 'block', mode === 'live' ? 'Live mode requires MOOMOO_LIVE_EXECUTION_ENABLED=true.' : 'Live mode is not requested.', { MOOMOO_LIVE_EXECUTION_ENABLED: env.MOOMOO_LIVE_EXECUTION_ENABLED ?? 'false' }));
  checks.push(check('dry_run_default', env.MOOMOO_DRY_RUN_EXECUTION === 'false' ? 'warning' : 'pass', env.MOOMOO_DRY_RUN_EXECUTION === 'false' ? 'Dry-run default is disabled.' : 'Dry-run protection is enabled.', { MOOMOO_DRY_RUN_EXECUTION: env.MOOMOO_DRY_RUN_EXECUTION ?? 'true' }));

  const validation: TradeTicketValidation = await validateTradeTicket(userId, ticket);
  checks.push(check('guardrail_validation', validation.passed || options.overrideGuardrails ? (validation.passed ? 'pass' : 'warning') : 'block', validation.summary, { overrideGuardrails: options.overrideGuardrails, violations: validation.violations }));
  checks.push(check('symbol_validation', isTradableSymbol(ticket.symbol) ? 'pass' : 'block', isTradableSymbol(ticket.symbol) ? `Symbol ${ticket.symbol} can be mapped to ${orderRequest.symbol}.` : 'Ticket symbol is not a tradable Moomoo symbol.', { symbol: ticket.symbol, brokerSymbol: orderRequest.symbol }));
  checks.push(check('quantity_validation', ticket.quantity > 0 ? 'pass' : 'block', ticket.quantity > 0 ? 'Quantity is positive.' : 'Quantity must be greater than zero.', { quantity: ticket.quantity }));
  checks.push(check('order_type_validation', ticket.orderType !== 'limit' || Number(ticket.limitPrice ?? 0) > 0 ? 'pass' : 'block', ticket.orderType === 'limit' ? 'Limit price is required for limit orders.' : 'Market order requested.', { orderType: ticket.orderType, limitPrice: ticket.limitPrice }));

  await addMoomooConnectivityChecks(checks, mode, orderRequest);
  await addBuyingPowerCheck(checks, mode, ticket);

  return checks;
}

async function addMoomooConnectivityChecks(checks: ExecutionSafetyCheck[], mode: ExecutionMode, orderRequest: Record<string, unknown>) {
  if (mode === 'dry_run') {
    checks.push(check('moomoo_connection', 'pass', 'Dry-run does not require an active Moomoo trading session.', { mode }));
    return;
  }

  try {
    const status = await getMoomooStatus();
    checks.push(check('moomoo_connection', status.connected && status.trade_logged_in ? 'pass' : 'block', status.message ?? 'Moomoo status checked.', status as unknown as Record<string, unknown>));
  } catch (error) {
    checks.push(check('moomoo_connection', 'block', error instanceof Error ? error.message : 'Moomoo status unavailable.', { mode }));
  }

  try {
    const states = await getMarketStates([String(orderRequest.symbol)]);
    const state = states[0];
    const raw = String(state?.market_state ?? '').toLowerCase();
    const marketOpen = raw.includes('open') || raw.includes('morning') || raw.includes('afternoon');
    checks.push(check('market_state', marketOpen ? 'pass' : 'warning', state?.market_state ? `Market state: ${state.market_state}` : 'Market state unavailable.', { state }));
  } catch (error) {
    checks.push(check('market_state', 'warning', error instanceof Error ? error.message : 'Market state unavailable.', { symbol: orderRequest.symbol }));
  }
}

async function addBuyingPowerCheck(checks: ExecutionSafetyCheck[], mode: ExecutionMode, ticket: TradeTicket) {
  if (mode === 'dry_run' || ticket.side === 'sell' || ticket.side === 'close') {
    checks.push(check('buying_power', 'pass', 'Buying power check is not required for dry-run or sell/close tickets.', { mode, side: ticket.side }));
    return;
  }

  try {
    const sync = await syncMoomoo(mode === 'live');
    const power = Number(sync.account_info?.power ?? sync.account_info?.cash ?? 0);
    checks.push(check('buying_power', power >= ticket.estimatedValue ? 'pass' : 'block', power >= ticket.estimatedValue ? 'Buying power appears sufficient.' : 'Buying power is below estimated ticket value.', { power, estimatedValue: ticket.estimatedValue }));
  } catch (error) {
    checks.push(check('buying_power', 'warning', error instanceof Error ? error.message : 'Buying power unavailable.', { estimatedValue: ticket.estimatedValue }));
  }
}

function ticketToMoomooOrder(ticket: TradeTicket, mode: ExecutionMode) {
  const sym = toMoomooSymbol(ticket.symbol);
  const isUS = sym.startsWith('US.');
  return {
    symbol: sym,
    side: ticket.side,
    order_type: ticket.orderType,
    quantity: ticket.quantity,
    price: ticket.limitPrice,
    trade_env: mode === 'live' ? 'REAL' : 'SIMULATE',
    // US paper trading requires acc_id 4652657 (STOCK_AND_OPTION SIMULATE)
    ...(isUS && mode !== 'live' ? { acc_id: 4652657 } : {}),
    source_ticket_id: ticket.id,
    client_order_id: `PF6F-${ticket.id.slice(0, 8)}-${Date.now()}`,
    phase: MOOMOO_EXECUTION_VERSION
  };
}

async function submitOrderToBridge(orderRequest: Record<string, unknown>, mode: ExecutionMode) {
  const res = await fetch(`${bridgeBase()}/execution/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...orderRequest, mode }),
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`${res.status} ${await readBridgeError(res, 'Moomoo order submission failed')}`);
  return res.json();
}

async function cancelOrderOnBridge(brokerOrderId: string, mode: ExecutionMode) {
  const res = await fetch(`${bridgeBase()}/execution/orders/${encodeURIComponent(brokerOrderId)}/cancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode }),
    signal: AbortSignal.timeout(30000)
  });
  if (!res.ok) throw new Error(`${res.status} ${await readBridgeError(res, 'Moomoo cancel failed')}`);
  return res.json();
}

async function requireExecutionRequest(userId: string, id: string) {
  const request = await getMoomooExecutionRequest(userId, id);
  if (!request) throw new Error('Execution request not found.');
  return request;
}

async function updateExecutionRequest(
  userId: string,
  id: string,
  status: ExecutionStatus,
  safety: BrokerExecutionRequest['safety'],
  request: Record<string, unknown>,
  response: Record<string, unknown> | null,
  confirmedAt?: Date
) {
  await prisma.$executeRaw`
    UPDATE broker_execution_requests
    SET status = ${status}, confirmed_at = ${confirmedAt ?? null}, safety_json = ${JSON.stringify(safety)}, request_json = ${JSON.stringify(request)}, response_json = ${response ? JSON.stringify(response) : null}, updated_at = NOW()
    WHERE user_id = ${userId} AND id = ${id}
  `;
}

async function insertSubmission(
  userId: string,
  executionRequestId: string,
  input: {
    id: string;
    status: BrokerOrderSubmission['submissionStatus'];
    mode: ExecutionMode;
    request: Record<string, unknown>;
    response: Record<string, unknown>;
    brokerOrderId: string | null;
    brokerStatus: string;
    errorMessage: string | null;
    submittedAt: Date;
  }
) {
  await prisma.$executeRaw`
    INSERT INTO broker_order_submissions
      (id, execution_request_id, user_id, broker, broker_order_id, broker_status, submission_status, submit_mode, request_json, response_json, error_message, submitted_at, created_at, updated_at)
    VALUES
      (${input.id}, ${executionRequestId}, ${userId}, 'moomoo', ${input.brokerOrderId || null}, ${input.brokerStatus}, ${input.status}, ${input.mode}, ${JSON.stringify(input.request)}, ${JSON.stringify(input.response)}, ${input.errorMessage}, ${input.submittedAt}, NOW(), NOW())
  `;
}

async function insertSafetyCheck(userId: string, executionRequestId: string, input: ExecutionSafetyCheck) {
  await prisma.$executeRaw`
    INSERT INTO execution_safety_checks
      (id, execution_request_id, user_id, check_type, check_status, message, detail_json, created_at)
    VALUES
      (${randomUUID()}, ${executionRequestId}, ${userId}, ${input.checkType}, ${input.checkStatus}, ${input.message}, ${JSON.stringify(input.detail)}, NOW())
  `;
}

async function listExecutionSafetyChecks(userId: string, executionRequestId: string) {
  const rows = await prisma.$queryRaw<SafetyCheckRow[]>`
    SELECT
      id,
      execution_request_id AS executionRequestId,
      check_type AS checkType,
      check_status AS checkStatus,
      message,
      detail_json AS detailJson,
      created_at AS createdAt
    FROM execution_safety_checks
    WHERE user_id = ${userId} AND execution_request_id = ${executionRequestId}
    ORDER BY FIELD(check_status, 'block', 'warning', 'pass'), created_at ASC
  `;
  return rows.map(mapSafetyCheckRow);
}

function mapExecutionRequestRow(row: ExecutionRequestRow): BrokerExecutionRequest {
  return {
    id: row.id,
    tradeTicketId: row.tradeTicketId,
    broker: 'moomoo',
    executionMode: parseExecutionMode(row.executionMode),
    status: parseExecutionStatus(row.status),
    symbol: row.symbol,
    brokerSymbol: row.brokerSymbol,
    side: row.side,
    orderType: row.orderType,
    quantity: Number(row.quantity),
    limitPrice: row.limitPrice === null ? null : Number(row.limitPrice),
    estimatedValue: Number(row.estimatedValue),
    confirmationRequired: Boolean(row.confirmationRequired),
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    safety: parseJson<BrokerExecutionRequest['safety']>(row.safetyJson, { passed: false, blocked: true, warnings: 0, summary: 'Safety unavailable.', checks: [] }),
    request: parseJson<Record<string, unknown>>(row.requestJson, {}),
    response: row.responseJson ? parseJson<Record<string, unknown>>(row.responseJson, {}) : null,
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapSubmissionRow(row: SubmissionRow): BrokerOrderSubmission {
  return {
    id: row.id,
    executionRequestId: row.executionRequestId,
    broker: 'moomoo',
    brokerOrderId: row.brokerOrderId,
    brokerStatus: row.brokerStatus,
    submissionStatus: parseSubmissionStatus(row.submissionStatus),
    submitMode: parseExecutionMode(row.submitMode),
    request: parseJson<Record<string, unknown>>(row.requestJson, {}),
    response: parseJson<Record<string, unknown>>(row.responseJson, {}),
    errorMessage: row.errorMessage,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapSafetyCheckRow(row: SafetyCheckRow): ExecutionSafetyCheck {
  return {
    id: row.id,
    executionRequestId: row.executionRequestId,
    checkType: row.checkType,
    checkStatus: parseSafetyStatus(row.checkStatus),
    message: row.message,
    detail: parseJson<Record<string, unknown>>(row.detailJson, {}),
    createdAt: row.createdAt.toISOString()
  };
}

function check(checkType: string, checkStatus: SafetyStatus, message: string, detail: Record<string, unknown>): ExecutionSafetyCheck {
  return { checkType, checkStatus, message, detail };
}

function parseExecutionStatus(value: string | null): ExecutionStatus {
  return EXECUTION_STATUSES.includes(value as ExecutionStatus) ? (value as ExecutionStatus) : 'blocked';
}

function parseSafetyStatus(value: string | null): SafetyStatus {
  return SAFETY_STATUSES.includes(value as SafetyStatus) ? (value as SafetyStatus) : 'block';
}

function parseSubmissionStatus(value: string | null): BrokerOrderSubmission['submissionStatus'] {
  return value === 'submitted' || value === 'failed' || value === 'cancelled' || value === 'dry_run' ? value : 'failed';
}

function isTradableSymbol(symbol: string) {
  return /^[A-Z]{1,6}([.\-_][A-Z0-9]+)?$/.test(symbol) && !['PORTFOLIO', 'OPTIONS', 'CASH'].includes(symbol);
}

function toMoomooSymbol(symbol: string) {
  const normalized = symbol.trim().toUpperCase();
  if (normalized.includes('.')) return normalized;
  return `US.${normalized}`;
}

async function readBridgeError(res: Response, fallback: string) {
  const body = await res.json().catch(() => null);
  return body?.message ?? body?.detail ?? res.statusText ?? fallback;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function clampInt(value: number, min: number, max: number) {
  const rounded = Math.round(Number.isFinite(value) ? value : min);
  return Math.min(max, Math.max(min, rounded));
}
