import { randomUUID } from 'node:crypto';
import { prisma } from '$lib/server/db';
import {
  getMoomooDeals,
  getMoomooOrders,
  type MoomooDealItem,
  type MoomooOrderItem
} from '$lib/services/broker.service';
import {
  listBrokerOrderSubmissions,
  type BrokerOrderSubmission
} from '$lib/services/moomoo-execution.service';

export const ORDER_TRACKING_VERSION = 'phase-6G';

export type BrokerOrderStatus =
  | 'new'
  | 'submitted'
  | 'partially_filled'
  | 'filled'
  | 'cancelled'
  | 'rejected'
  | 'failed'
  | 'dry_run'
  | 'unknown';

export type BrokerOrder = {
  id: string;
  executionRequestId: string | null;
  broker: 'moomoo';
  brokerOrderId: string;
  brokerAccountId: string | null;
  symbol: string;
  side: string;
  orderType: string;
  status: BrokerOrderStatus;
  quantity: number;
  filledQuantity: number;
  limitPrice: number | null;
  averageFillPrice: number | null;
  currency: string;
  submittedAt: string | null;
  lastBrokerUpdateAt: string | null;
  metadata: Record<string, unknown>;
  events?: BrokerOrderEvent[];
  fills?: BrokerOrderFill[];
  reconciliations?: OrderReconciliationLog[];
  createdAt: string;
  updatedAt: string;
};

export type BrokerOrderEvent = {
  id: string;
  brokerOrderRowId: string;
  eventType: string;
  previousStatus: string | null;
  newStatus: string | null;
  message: string;
  brokerPayload: Record<string, unknown>;
  metadata: Record<string, unknown>;
  occurredAt: string;
  createdAt: string;
};

export type BrokerOrderFill = {
  id: string;
  brokerOrderRowId: string;
  brokerFillId: string;
  quantity: number;
  price: number;
  fee: number;
  currency: string;
  executedAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export type OrderReconciliationLog = {
  id: string;
  brokerOrderRowId: string | null;
  reconciliationType: string;
  reconciliationStatus: 'matched' | 'mismatch' | 'pending';
  mismatch: Record<string, unknown>;
  actionRequired: boolean;
  message: string;
  metadata: Record<string, unknown>;
  createdAt: string;
};

type OrderRow = {
  id: string;
  executionRequestId: string | null;
  broker: string;
  brokerOrderId: string;
  brokerAccountId: string | null;
  symbol: string;
  side: string;
  orderType: string;
  status: string;
  quantity: number;
  filledQuantity: number;
  limitPrice: number | null;
  averageFillPrice: number | null;
  currency: string;
  submittedAt: Date | null;
  lastBrokerUpdateAt: Date | null;
  metadataJson: string;
  createdAt: Date;
  updatedAt: Date;
};

type EventRow = {
  id: string;
  brokerOrderRowId: string;
  eventType: string;
  previousStatus: string | null;
  newStatus: string | null;
  message: string;
  brokerPayloadJson: string;
  metadataJson: string;
  occurredAt: Date;
  createdAt: Date;
};

type FillRow = {
  id: string;
  brokerOrderRowId: string;
  brokerFillId: string;
  quantity: number;
  price: number;
  fee: number;
  currency: string;
  executedAt: Date | null;
  metadataJson: string;
  createdAt: Date;
};

type ReconciliationRow = {
  id: string;
  brokerOrderRowId: string | null;
  reconciliationType: string;
  reconciliationStatus: string;
  mismatchJson: string;
  actionRequired: boolean | number;
  message: string;
  metadataJson: string;
  createdAt: Date;
};

export async function getOrderTrackingDashboard(userId: string) {
  const [orders, activity, reconciliations] = await Promise.all([
    listBrokerOrders(userId, { limit: 30 }),
    listBrokerOrderEvents(userId, { limit: 12 }),
    listReconciliationLogs(userId, { limit: 12 })
  ]);
  const open = orders.filter((order) => ['new', 'submitted', 'partially_filled', 'unknown'].includes(order.status)).length;
  const mismatches = reconciliations.filter((log) => log.reconciliationStatus === 'mismatch').length;
  return {
    version: ORDER_TRACKING_VERSION,
    safetyMessage: 'Order tracking is append-only. Reconciliation logs mismatches without rewriting portfolio history.',
    widgets: [
      { label: 'Tracked Orders', value: String(orders.length), status: orders.length ? 'medium' : 'low' },
      { label: 'Open Orders', value: String(open), status: open ? 'medium' : 'low' },
      { label: 'Mismatch Logs', value: String(mismatches), status: mismatches ? 'high' : 'low' },
      { label: 'Audit Events', value: String(activity.length), status: activity.length ? 'medium' : 'low' }
    ],
    orders,
    activity,
    reconciliations
  };
}

export async function syncOrderTracking(userId: string, options: { preferReal?: boolean } = {}) {
  const preferReal = options.preferReal ?? false;
  const submissions = await listBrokerOrderSubmissions(userId, 100);
  const localOrders: BrokerOrder[] = [];

  for (const submission of submissions) {
    if (!submission.brokerOrderId) continue;
    localOrders.push(await upsertOrderFromSubmission(userId, submission));
  }

  const [brokerOrders, brokerDeals] = await Promise.all([
    getMoomooOrders(preferReal, true),
    getMoomooDeals(preferReal, true)
  ]);

  for (const order of brokerOrders) {
    localOrders.push(await upsertOrderFromBroker(userId, order));
  }

  const orderByBrokerId = new Map((await listBrokerOrders(userId, { limit: 300 })).map((order) => [order.brokerOrderId, order]));
  let fillsSynced = 0;
  for (const deal of brokerDeals) {
    const order = orderByBrokerId.get(deal.broker_order_id);
    if (!order) {
      await addReconciliationLog(userId, null, {
        reconciliationType: 'unmatched_broker_fill',
        reconciliationStatus: 'mismatch',
        actionRequired: true,
        message: `Broker fill ${deal.broker_deal_id} has no matching local order.`,
        mismatch: { deal },
        metadata: { version: ORDER_TRACKING_VERSION, source: 'broker_deals_sync' }
      });
      continue;
    }
    const inserted = await insertFillIfNew(userId, order.id, deal);
    if (inserted) fillsSynced += 1;
  }

  const ordersSynced = [...new Set(localOrders.map((order) => order.id))].length;
  await addReconciliationLog(userId, null, {
    reconciliationType: 'order_sync',
    reconciliationStatus: brokerOrders.length || submissions.length ? 'matched' : 'pending',
    actionRequired: false,
    message: `Order sync completed. ${ordersSynced} orders touched and ${fillsSynced} new fills recorded.`,
    mismatch: {},
    metadata: {
      version: ORDER_TRACKING_VERSION,
      submissions: submissions.length,
      brokerOrders: brokerOrders.length,
      brokerDeals: brokerDeals.length,
      preferReal
    }
  });

  return {
    syncedAt: new Date().toISOString(),
    ordersSynced,
    fillsSynced,
    submissions: submissions.length,
    brokerOrders: brokerOrders.length,
    brokerDeals: brokerDeals.length
  };
}

export async function reconcileBrokerOrder(userId: string, id: string) {
  const order = await getBrokerOrder(userId, id);
  if (!order) throw new Error('Order not found.');
  const fillTotal = round((order.fills ?? []).reduce((sum, fill) => sum + fill.quantity, 0), 4);
  const mismatches: Record<string, unknown> = {};

  if (Math.abs(fillTotal - order.filledQuantity) > 0.0001) {
    mismatches.filledQuantity = {
      local: order.filledQuantity,
      fillTotal
    };
  }
  if (order.status === 'filled' && order.filledQuantity < order.quantity) {
    mismatches.status = 'Order is marked filled but filled quantity is below requested quantity.';
  }
  if (order.status === 'dry_run' && order.brokerOrderId.startsWith('DRYRUN-')) {
    // Dry-run is intentionally local-only.
  } else if (!order.lastBrokerUpdateAt && ['submitted', 'partially_filled', 'filled'].includes(order.status)) {
    mismatches.brokerUpdate = 'Submitted order has no broker update timestamp yet.';
  }

  const hasMismatch = Object.keys(mismatches).length > 0;
  const log = await addReconciliationLog(userId, order.id, {
    reconciliationType: 'single_order_reconcile',
    reconciliationStatus: hasMismatch ? 'mismatch' : 'matched',
    actionRequired: hasMismatch,
    message: hasMismatch
      ? 'Order reconciliation found visible mismatches. Portfolio history was not changed.'
      : 'Order reconciliation matched local tracking data.',
    mismatch: mismatches,
    metadata: { version: ORDER_TRACKING_VERSION, orderId: order.id, brokerOrderId: order.brokerOrderId }
  });
  return log;
}

export async function listBrokerOrders(userId: string, options: { status?: BrokerOrderStatus | null; limit?: number } = {}) {
  const limit = clampInt(options.limit ?? 50, 1, 300);
  const status = options.status ? parseBrokerOrderStatus(options.status) : null;
  const rows = status
    ? await prisma.$queryRaw<OrderRow[]>`
        SELECT
          id,
          execution_request_id AS executionRequestId,
          broker,
          broker_order_id AS brokerOrderId,
          broker_account_id AS brokerAccountId,
          symbol,
          side,
          order_type AS orderType,
          status,
          quantity,
          filled_quantity AS filledQuantity,
          limit_price AS limitPrice,
          average_fill_price AS averageFillPrice,
          currency,
          submitted_at AS submittedAt,
          last_broker_update_at AS lastBrokerUpdateAt,
          metadata AS metadataJson,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM broker_orders
        WHERE user_id = ${userId} AND status = ${status}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await prisma.$queryRaw<OrderRow[]>`
        SELECT
          id,
          execution_request_id AS executionRequestId,
          broker,
          broker_order_id AS brokerOrderId,
          broker_account_id AS brokerAccountId,
          symbol,
          side,
          order_type AS orderType,
          status,
          quantity,
          filled_quantity AS filledQuantity,
          limit_price AS limitPrice,
          average_fill_price AS averageFillPrice,
          currency,
          submitted_at AS submittedAt,
          last_broker_update_at AS lastBrokerUpdateAt,
          metadata AS metadataJson,
          created_at AS createdAt,
          updated_at AS updatedAt
        FROM broker_orders
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
  return rows.map(mapOrderRow);
}

export async function getBrokerOrder(userId: string, id: string) {
  const rows = await prisma.$queryRaw<OrderRow[]>`
    SELECT
      id,
      execution_request_id AS executionRequestId,
      broker,
      broker_order_id AS brokerOrderId,
      broker_account_id AS brokerAccountId,
      symbol,
      side,
      order_type AS orderType,
      status,
      quantity,
      filled_quantity AS filledQuantity,
      limit_price AS limitPrice,
      average_fill_price AS averageFillPrice,
      currency,
      submitted_at AS submittedAt,
      last_broker_update_at AS lastBrokerUpdateAt,
      metadata AS metadataJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM broker_orders
    WHERE user_id = ${userId} AND id = ${id}
    LIMIT 1
  `;
  const order = rows[0] ? mapOrderRow(rows[0]) : null;
  if (!order) return null;
  const [events, fills, reconciliations] = await Promise.all([
    listBrokerOrderEvents(userId, { brokerOrderRowId: id, limit: 100 }),
    listBrokerOrderFills(userId, id),
    listReconciliationLogs(userId, { brokerOrderRowId: id, limit: 50 })
  ]);
  return { ...order, events, fills, reconciliations };
}

export async function listBrokerOrderEvents(
  userId: string,
  options: { brokerOrderRowId?: string; limit?: number } = {}
) {
  const limit = clampInt(options.limit ?? 50, 1, 300);
  const rows = options.brokerOrderRowId
    ? await prisma.$queryRaw<EventRow[]>`
        SELECT
          id,
          broker_order_row_id AS brokerOrderRowId,
          event_type AS eventType,
          previous_status AS previousStatus,
          new_status AS newStatus,
          message,
          broker_payload_json AS brokerPayloadJson,
          metadata AS metadataJson,
          occurred_at AS occurredAt,
          created_at AS createdAt
        FROM broker_order_events
        WHERE user_id = ${userId} AND broker_order_row_id = ${options.brokerOrderRowId}
        ORDER BY occurred_at DESC
        LIMIT ${limit}
      `
    : await prisma.$queryRaw<EventRow[]>`
        SELECT
          id,
          broker_order_row_id AS brokerOrderRowId,
          event_type AS eventType,
          previous_status AS previousStatus,
          new_status AS newStatus,
          message,
          broker_payload_json AS brokerPayloadJson,
          metadata AS metadataJson,
          occurred_at AS occurredAt,
          created_at AS createdAt
        FROM broker_order_events
        WHERE user_id = ${userId}
        ORDER BY occurred_at DESC
        LIMIT ${limit}
      `;
  return rows.map(mapEventRow);
}

export async function listReconciliationLogs(
  userId: string,
  options: { brokerOrderRowId?: string | null; limit?: number } = {}
) {
  const limit = clampInt(options.limit ?? 50, 1, 300);
  const rows = options.brokerOrderRowId
    ? await prisma.$queryRaw<ReconciliationRow[]>`
        SELECT
          id,
          broker_order_row_id AS brokerOrderRowId,
          reconciliation_type AS reconciliationType,
          reconciliation_status AS reconciliationStatus,
          mismatch_json AS mismatchJson,
          action_required AS actionRequired,
          message,
          metadata AS metadataJson,
          created_at AS createdAt
        FROM order_reconciliation_logs
        WHERE user_id = ${userId} AND broker_order_row_id = ${options.brokerOrderRowId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `
    : await prisma.$queryRaw<ReconciliationRow[]>`
        SELECT
          id,
          broker_order_row_id AS brokerOrderRowId,
          reconciliation_type AS reconciliationType,
          reconciliation_status AS reconciliationStatus,
          mismatch_json AS mismatchJson,
          action_required AS actionRequired,
          message,
          metadata AS metadataJson,
          created_at AS createdAt
        FROM order_reconciliation_logs
        WHERE user_id = ${userId}
        ORDER BY created_at DESC
        LIMIT ${limit}
      `;
  return rows.map(mapReconciliationRow);
}

async function listBrokerOrderFills(userId: string, brokerOrderRowId: string) {
  const rows = await prisma.$queryRaw<FillRow[]>`
    SELECT
      id,
      broker_order_row_id AS brokerOrderRowId,
      broker_fill_id AS brokerFillId,
      quantity,
      price,
      fee,
      currency,
      executed_at AS executedAt,
      metadata AS metadataJson,
      created_at AS createdAt
    FROM broker_order_fills
    WHERE user_id = ${userId} AND broker_order_row_id = ${brokerOrderRowId}
    ORDER BY executed_at DESC, created_at DESC
  `;
  return rows.map(mapFillRow);
}

async function upsertOrderFromSubmission(userId: string, submission: BrokerOrderSubmission) {
  const request = submission.request;
  const response = submission.response;
  const brokerOrderId = submission.brokerOrderId ?? `LOCAL-${submission.id}`;
  const status = normalizeSubmissionStatus(submission);
  const symbol = String(request.symbol ?? response.symbol ?? 'UNKNOWN');
  const existing = await findOrderByBrokerId(userId, brokerOrderId);
  const payload = { submission, request, response };

  if (!existing) {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO broker_orders
        (id, user_id, execution_request_id, broker, broker_order_id, broker_account_id, symbol, side, order_type, status, quantity, filled_quantity, limit_price, average_fill_price, currency, submitted_at, last_broker_update_at, metadata, created_at, updated_at)
      VALUES
        (${id}, ${userId}, ${submission.executionRequestId}, 'moomoo', ${brokerOrderId}, ${null}, ${symbol}, ${String(request.side ?? '')}, ${String(request.order_type ?? '')}, ${status}, ${Number(request.quantity ?? 0)}, ${0}, ${nullableNumber(request.price)}, ${null}, 'USD', ${submission.submittedAt ? new Date(submission.submittedAt) : null}, ${submission.updatedAt ? new Date(submission.updatedAt) : null}, ${JSON.stringify({ version: ORDER_TRACKING_VERSION, source: 'broker_order_submission', submitMode: submission.submitMode })}, NOW(), NOW())
    `;
    await addOrderEvent(userId, id, {
      eventType: 'order_created',
      previousStatus: null,
      newStatus: status,
      message: `Order tracking record created from ${submission.submitMode} submission.`,
      brokerPayload: payload,
      metadata: { version: ORDER_TRACKING_VERSION }
    });
    return (await getBrokerOrder(userId, id))!;
  }

  await updateOrderIfChanged(userId, existing, {
    status,
    filledQuantity: existing.filledQuantity,
    averageFillPrice: existing.averageFillPrice,
    brokerAccountId: existing.brokerAccountId,
    lastBrokerUpdateAt: submission.updatedAt,
    metadata: { ...existing.metadata, lastSubmissionId: submission.id, source: 'broker_order_submission' }
  }, payload);
  return (await getBrokerOrder(userId, existing.id)) ?? existing;
}

async function upsertOrderFromBroker(userId: string, brokerOrder: MoomooOrderItem) {
  const brokerOrderId = brokerOrder.broker_order_id;
  const status = normalizeBrokerStatus(brokerOrder.status, brokerOrder.quantity, brokerOrder.filled_quantity);
  const existing = await findOrderByBrokerId(userId, brokerOrderId);
  if (!existing) {
    const id = randomUUID();
    await prisma.$executeRaw`
      INSERT INTO broker_orders
        (id, user_id, execution_request_id, broker, broker_order_id, broker_account_id, symbol, side, order_type, status, quantity, filled_quantity, limit_price, average_fill_price, currency, submitted_at, last_broker_update_at, metadata, created_at, updated_at)
      VALUES
        (${id}, ${userId}, ${null}, 'moomoo', ${brokerOrderId}, ${null}, ${brokerOrder.symbol}, ${brokerOrder.side}, ${brokerOrder.order_type}, ${status}, ${Number(brokerOrder.quantity ?? 0)}, ${Number(brokerOrder.filled_quantity ?? 0)}, ${nullableNumber(brokerOrder.price)}, ${nullableNumber(brokerOrder.average_filled_price)}, ${brokerOrder.currency || 'USD'}, ${parseDate(brokerOrder.submitted_at)}, ${parseDate(brokerOrder.updated_broker_at)}, ${JSON.stringify({ version: ORDER_TRACKING_VERSION, source: 'broker_order_sync', brokerPayload: brokerOrder.metadata ?? {} })}, NOW(), NOW())
    `;
    await addOrderEvent(userId, id, {
      eventType: 'broker_order_imported',
      previousStatus: null,
      newStatus: status,
      message: 'Broker order imported from Moomoo order sync.',
      brokerPayload: brokerOrder as unknown as Record<string, unknown>,
      metadata: { version: ORDER_TRACKING_VERSION }
    });
    return (await getBrokerOrder(userId, id))!;
  }

  await updateOrderIfChanged(userId, existing, {
    status,
    filledQuantity: Number(brokerOrder.filled_quantity ?? 0),
    averageFillPrice: nullableNumber(brokerOrder.average_filled_price),
    brokerAccountId: existing.brokerAccountId,
    lastBrokerUpdateAt: brokerOrder.updated_broker_at,
    metadata: { ...existing.metadata, source: 'broker_order_sync', brokerPayload: brokerOrder.metadata ?? {} }
  }, brokerOrder as unknown as Record<string, unknown>);
  return (await getBrokerOrder(userId, existing.id)) ?? existing;
}

async function updateOrderIfChanged(
  userId: string,
  existing: BrokerOrder,
  next: {
    status: BrokerOrderStatus;
    filledQuantity: number;
    averageFillPrice: number | null;
    brokerAccountId: string | null;
    lastBrokerUpdateAt?: string | null;
    metadata: Record<string, unknown>;
  },
  brokerPayload: Record<string, unknown>
) {
  const statusChanged = existing.status !== next.status;
  const fillChanged = Math.abs(existing.filledQuantity - next.filledQuantity) > 0.0001;
  await prisma.$executeRaw`
    UPDATE broker_orders
    SET status = ${next.status}, filled_quantity = ${next.filledQuantity}, average_fill_price = ${next.averageFillPrice}, broker_account_id = ${next.brokerAccountId}, last_broker_update_at = ${parseDate(next.lastBrokerUpdateAt ?? null)}, metadata = ${JSON.stringify(next.metadata)}, updated_at = NOW()
    WHERE user_id = ${userId} AND id = ${existing.id}
  `;
  if (statusChanged) {
    await addOrderEvent(userId, existing.id, {
      eventType: 'status_changed',
      previousStatus: existing.status,
      newStatus: next.status,
      message: `Order status changed from ${existing.status} to ${next.status}.`,
      brokerPayload,
      metadata: { version: ORDER_TRACKING_VERSION }
    });
  } else if (fillChanged) {
    await addOrderEvent(userId, existing.id, {
      eventType: 'fill_quantity_updated',
      previousStatus: existing.status,
      newStatus: next.status,
      message: `Filled quantity updated to ${next.filledQuantity}.`,
      brokerPayload,
      metadata: { version: ORDER_TRACKING_VERSION }
    });
  }
}

async function insertFillIfNew(userId: string, brokerOrderRowId: string, deal: MoomooDealItem) {
  const count = await prisma.$executeRaw`
    INSERT IGNORE INTO broker_order_fills
      (id, broker_order_row_id, user_id, broker_fill_id, quantity, price, fee, currency, executed_at, metadata, created_at)
    VALUES
      (${randomUUID()}, ${brokerOrderRowId}, ${userId}, ${deal.broker_deal_id}, ${Number(deal.quantity ?? 0)}, ${Number(deal.price ?? 0)}, ${Number(deal.fee ?? 0)}, ${deal.currency || 'USD'}, ${parseDate(deal.executed_at)}, ${JSON.stringify({ version: ORDER_TRACKING_VERSION, deal })}, NOW())
  `;
  if (Number(count) > 0) {
    await addOrderEvent(userId, brokerOrderRowId, {
      eventType: 'fill_received',
      previousStatus: null,
      newStatus: null,
      message: `Fill received for ${deal.quantity} @ ${deal.price}.`,
      brokerPayload: deal as unknown as Record<string, unknown>,
      metadata: { version: ORDER_TRACKING_VERSION }
    });
    return true;
  }
  return false;
}

async function addOrderEvent(
  userId: string,
  brokerOrderRowId: string,
  input: {
    eventType: string;
    previousStatus: string | null;
    newStatus: string | null;
    message: string;
    brokerPayload: Record<string, unknown>;
    metadata: Record<string, unknown>;
    occurredAt?: Date;
  }
) {
  await prisma.$executeRaw`
    INSERT INTO broker_order_events
      (id, broker_order_row_id, user_id, event_type, previous_status, new_status, message, broker_payload_json, metadata, occurred_at, created_at)
    VALUES
      (${randomUUID()}, ${brokerOrderRowId}, ${userId}, ${input.eventType}, ${input.previousStatus}, ${input.newStatus}, ${input.message}, ${JSON.stringify(input.brokerPayload)}, ${JSON.stringify(input.metadata)}, ${input.occurredAt ?? new Date()}, NOW())
  `;
}

async function addReconciliationLog(
  userId: string,
  brokerOrderRowId: string | null,
  input: {
    reconciliationType: string;
    reconciliationStatus: 'matched' | 'mismatch' | 'pending';
    mismatch: Record<string, unknown>;
    actionRequired: boolean;
    message: string;
    metadata: Record<string, unknown>;
  }
) {
  const id = randomUUID();
  await prisma.$executeRaw`
    INSERT INTO order_reconciliation_logs
      (id, broker_order_row_id, user_id, reconciliation_type, reconciliation_status, mismatch_json, action_required, message, metadata, created_at)
    VALUES
      (${id}, ${brokerOrderRowId}, ${userId}, ${input.reconciliationType}, ${input.reconciliationStatus}, ${JSON.stringify(input.mismatch)}, ${input.actionRequired}, ${input.message}, ${JSON.stringify(input.metadata)}, NOW())
  `;
  const rows = await prisma.$queryRaw<ReconciliationRow[]>`
    SELECT
      id,
      broker_order_row_id AS brokerOrderRowId,
      reconciliation_type AS reconciliationType,
      reconciliation_status AS reconciliationStatus,
      mismatch_json AS mismatchJson,
      action_required AS actionRequired,
      message,
      metadata AS metadataJson,
      created_at AS createdAt
    FROM order_reconciliation_logs
    WHERE id = ${id}
    LIMIT 1
  `;
  return mapReconciliationRow(rows[0]);
}

async function findOrderByBrokerId(userId: string, brokerOrderId: string) {
  const rows = await prisma.$queryRaw<OrderRow[]>`
    SELECT
      id,
      execution_request_id AS executionRequestId,
      broker,
      broker_order_id AS brokerOrderId,
      broker_account_id AS brokerAccountId,
      symbol,
      side,
      order_type AS orderType,
      status,
      quantity,
      filled_quantity AS filledQuantity,
      limit_price AS limitPrice,
      average_fill_price AS averageFillPrice,
      currency,
      submitted_at AS submittedAt,
      last_broker_update_at AS lastBrokerUpdateAt,
      metadata AS metadataJson,
      created_at AS createdAt,
      updated_at AS updatedAt
    FROM broker_orders
    WHERE user_id = ${userId} AND broker = 'moomoo' AND broker_order_id = ${brokerOrderId}
    LIMIT 1
  `;
  return rows[0] ? mapOrderRow(rows[0]) : null;
}

export function parseBrokerOrderStatus(value: FormDataEntryValue | string | null): BrokerOrderStatus {
  const normalized = String(value ?? '').toLowerCase();
  return ['new', 'submitted', 'partially_filled', 'filled', 'cancelled', 'rejected', 'failed', 'dry_run', 'unknown'].includes(normalized)
    ? (normalized as BrokerOrderStatus)
    : 'unknown';
}

function normalizeSubmissionStatus(submission: BrokerOrderSubmission): BrokerOrderStatus {
  if (submission.submissionStatus === 'dry_run') return 'dry_run';
  if (submission.submissionStatus === 'cancelled') return 'cancelled';
  if (submission.submissionStatus === 'failed') return 'failed';
  return normalizeBrokerStatus(submission.brokerStatus, Number(submission.request.quantity ?? 0), 0);
}

function normalizeBrokerStatus(status: string, quantity: number, filledQuantity: number): BrokerOrderStatus {
  const raw = String(status ?? '').toLowerCase();
  if (raw.includes('cancel')) return 'cancelled';
  if (raw.includes('reject')) return 'rejected';
  if (raw.includes('fail')) return 'failed';
  if (raw.includes('fill') || raw.includes('dealt')) {
    return filledQuantity >= quantity && quantity > 0 ? 'filled' : 'partially_filled';
  }
  if (raw.includes('submit') || raw.includes('waiting') || raw.includes('queued') || raw.includes('dry_run')) {
    return raw.includes('dry') ? 'dry_run' : 'submitted';
  }
  return filledQuantity > 0 ? 'partially_filled' : 'unknown';
}

function mapOrderRow(row: OrderRow): BrokerOrder {
  return {
    id: row.id,
    executionRequestId: row.executionRequestId,
    broker: 'moomoo',
    brokerOrderId: row.brokerOrderId,
    brokerAccountId: row.brokerAccountId,
    symbol: row.symbol,
    side: row.side,
    orderType: row.orderType,
    status: parseBrokerOrderStatus(row.status),
    quantity: Number(row.quantity),
    filledQuantity: Number(row.filledQuantity),
    limitPrice: row.limitPrice === null ? null : Number(row.limitPrice),
    averageFillPrice: row.averageFillPrice === null ? null : Number(row.averageFillPrice),
    currency: row.currency,
    submittedAt: row.submittedAt?.toISOString() ?? null,
    lastBrokerUpdateAt: row.lastBrokerUpdateAt?.toISOString() ?? null,
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString()
  };
}

function mapEventRow(row: EventRow): BrokerOrderEvent {
  return {
    id: row.id,
    brokerOrderRowId: row.brokerOrderRowId,
    eventType: row.eventType,
    previousStatus: row.previousStatus,
    newStatus: row.newStatus,
    message: row.message,
    brokerPayload: parseJson<Record<string, unknown>>(row.brokerPayloadJson, {}),
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
    occurredAt: row.occurredAt.toISOString(),
    createdAt: row.createdAt.toISOString()
  };
}

function mapFillRow(row: FillRow): BrokerOrderFill {
  return {
    id: row.id,
    brokerOrderRowId: row.brokerOrderRowId,
    brokerFillId: row.brokerFillId,
    quantity: Number(row.quantity),
    price: Number(row.price),
    fee: Number(row.fee),
    currency: row.currency,
    executedAt: row.executedAt?.toISOString() ?? null,
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
    createdAt: row.createdAt.toISOString()
  };
}

function mapReconciliationRow(row: ReconciliationRow): OrderReconciliationLog {
  return {
    id: row.id,
    brokerOrderRowId: row.brokerOrderRowId,
    reconciliationType: row.reconciliationType,
    reconciliationStatus: row.reconciliationStatus === 'mismatch' ? 'mismatch' : row.reconciliationStatus === 'matched' ? 'matched' : 'pending',
    mismatch: parseJson<Record<string, unknown>>(row.mismatchJson, {}),
    actionRequired: Boolean(row.actionRequired),
    message: row.message,
    metadata: parseJson<Record<string, unknown>>(row.metadataJson, {}),
    createdAt: row.createdAt.toISOString()
  };
}

function nullableNumber(value: unknown) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round((Number.isFinite(value) ? value : 0) * factor) / factor;
}

function clampInt(value: number, min: number, max: number) {
  const rounded = Math.round(Number.isFinite(value) ? value : min);
  return Math.min(max, Math.max(min, rounded));
}
