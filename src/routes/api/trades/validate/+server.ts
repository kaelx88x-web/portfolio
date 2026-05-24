import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  parseTradeOrderType,
  parseTradeTicketType,
  validateTradeTicket
} from '$lib/services/trade-layer.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const user = await getDemoUser();
  const body = await request.json().catch(() => ({}));
  const validation = await validateTradeTicket(user.id, {
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
  return json({ status: 'validated', validation });
};
