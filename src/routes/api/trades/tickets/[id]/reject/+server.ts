import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { rejectTradeTicket } from '$lib/services/trade-layer.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, request }) => {
  const user = await getDemoUser();
  const body = await request.json().catch(() => ({}));
  try {
    const ticket = await rejectTradeTicket(user.id, params.id, String(body.note ?? 'Rejected after review.'));
    return json({ status: 'rejected', ticket });
  } catch (error) {
    return json({ status: 'error', message: error instanceof Error ? error.message : 'Ticket rejection failed.' }, { status: 400 });
  }
};
