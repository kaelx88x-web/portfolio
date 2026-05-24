import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { listBrokerOrderEvents } from '$lib/services/order-tracking.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const user = await getDemoUser();
  const events = await listBrokerOrderEvents(user.id, { brokerOrderRowId: params.id, limit: 100 });
  return json({ status: 'ready', events });
};
