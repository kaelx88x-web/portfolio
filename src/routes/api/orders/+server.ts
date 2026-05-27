import { json } from '@sveltejs/kit';
import { listBrokerOrders, parseBrokerOrderStatus } from '$lib/services/order-tracking.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user!;
  const statusParam = url.searchParams.get('status');
  const orders = await listBrokerOrders(user.id, {
    status: statusParam ? parseBrokerOrderStatus(statusParam) : null,
    limit: Number(url.searchParams.get('limit') ?? 50)
  });
  return json({ status: 'ready', orders });
};
