import { json } from '@sveltejs/kit';
import { getBrokerOrder } from '$lib/services/order-tracking.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  const user = locals.user!;
  const order = await getBrokerOrder(user.id, params.id);
  if (!order) return json({ status: 'not_found', message: 'Order not found.' }, { status: 404 });
  return json({ status: 'ready', order });
};
