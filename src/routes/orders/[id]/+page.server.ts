import { error } from '@sveltejs/kit';
import { getBrokerOrder } from '$lib/services/order-tracking.service';
import type { PageServerLoad } from './$types';

export { actions } from '../+page.server';

export const load: PageServerLoad = async ({ params, locals }) => {
  const user = locals.user!;
  const order = await getBrokerOrder(user.id, params.id);
  if (!order) throw error(404, 'Order not found.');
  return { order };
};
