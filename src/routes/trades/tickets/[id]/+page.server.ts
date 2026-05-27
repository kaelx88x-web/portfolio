import { error } from '@sveltejs/kit';
import { getTradeTicket } from '$lib/services/trade-layer.service';
import type { PageServerLoad } from './$types';

export { actions } from '../../+page.server';

export const load: PageServerLoad = async ({ params, locals }) => {
  const user = locals.user!;
  const ticket = await getTradeTicket(user.id, params.id);
  if (!ticket) throw error(404, 'Trade ticket not found.');
  return { ticket };
};
