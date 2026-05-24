import { error } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { getTradeTicket } from '$lib/services/trade-layer.service';
import type { PageServerLoad } from './$types';

export { actions } from '../../+page.server';

export const load: PageServerLoad = async ({ params }) => {
  const user = await getDemoUser();
  const ticket = await getTradeTicket(user.id, params.id);
  if (!ticket) throw error(404, 'Trade ticket not found.');
  return { ticket };
};
