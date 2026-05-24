import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { cancelTradeTicket } from '$lib/services/trade-layer.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
  const user = await getDemoUser();
  const body = await request.json().catch(() => ({}));
  try {
    const ticket = await cancelTradeTicket(user.id, params.id, String(body.note ?? 'Cancelled by user.'));
    return json({ status: 'cancelled', ticket });
  } catch (error) {
    return json({ status: 'error', message: error instanceof Error ? error.message : 'Ticket cancellation failed.' }, { status: 400 });
  }
};
