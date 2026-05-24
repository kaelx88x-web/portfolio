import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { listBrokerOrders, parseBrokerOrderStatus } from '$lib/services/order-tracking.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const user = await getDemoUser();
  const statusParam = url.searchParams.get('status');
  const orders = await listBrokerOrders(user.id, {
    status: statusParam ? parseBrokerOrderStatus(statusParam) : null,
    limit: Number(url.searchParams.get('limit') ?? 50)
  });
  return json({ status: 'ready', orders });
};
