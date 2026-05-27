import { getTradeApprovals } from '$lib/services/trade-layer.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;
  return { approvals: await getTradeApprovals(user.id, 50) };
};
