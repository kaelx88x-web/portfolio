import { json } from '@sveltejs/kit';
import {
  createTradeTicket,
  listTradeTickets,
  parseTradeTicketStatus,
  parseTradeTicketType,
  parseTradeOrderType
} from '$lib/services/trade-layer.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user!;
  const statusParam = url.searchParams.get('status');
  const status = statusParam ? parseTradeTicketStatus(statusParam) : null;
  const tickets = await listTradeTickets(user.id, {
    status,
    limit: Number(url.searchParams.get('limit') ?? 30)
  });
  return json({ status: 'ready', tickets });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user!;
  const body = await request.json().catch(() => ({}));
  try {
    const ticket = await createTradeTicket(user.id, {
      sourceType: String(body.sourceType ?? 'manual'),
      sourceId: body.sourceId ? String(body.sourceId) : null,
      ticketType: parseTradeTicketType(body.ticketType),
      symbol: String(body.symbol ?? ''),
      side: body.side,
      quantity: Number(body.quantity ?? 0),
      orderType: parseTradeOrderType(body.orderType),
      limitPrice: body.limitPrice === null || body.limitPrice === undefined ? null : Number(body.limitPrice),
      thesis: body.thesis ? String(body.thesis) : undefined,
      metadata: typeof body.metadata === 'object' && body.metadata ? body.metadata : {}
    });
    return json({ status: 'created', ticket }, { status: 201 });
  } catch (error) {
    return json({ status: 'error', message: error instanceof Error ? error.message : 'Trade ticket creation failed.' }, { status: 400 });
  }
};
