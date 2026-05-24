import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { getTradeTicket } from '$lib/services/trade-layer.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const user = await getDemoUser();
  const ticket = await getTradeTicket(user.id, params.id);
  if (!ticket) return json({ status: 'not_found', message: 'Trade ticket not found.' }, { status: 404 });
  return json({ status: 'ready', ticket });
};
