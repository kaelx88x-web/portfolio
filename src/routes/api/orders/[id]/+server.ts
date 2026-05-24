import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { getBrokerOrder } from '$lib/services/order-tracking.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const user = await getDemoUser();
  const order = await getBrokerOrder(user.id, params.id);
  if (!order) return json({ status: 'not_found', message: 'Order not found.' }, { status: 404 });
  return json({ status: 'ready', order });
};
