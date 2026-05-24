import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { approveTradeTicket } from '$lib/services/trade-layer.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
  const user = await getDemoUser();
  const body = await request.json().catch(() => ({}));
  try {
    const ticket = await approveTradeTicket(user.id, params.id, String(body.note ?? 'Approved for future execution review.'));
    return json({ status: 'approved', ticket });
  } catch (error) {
    return json({ status: 'error', message: error instanceof Error ? error.message : 'Ticket approval failed.' }, { status: 400 });
  }
};
