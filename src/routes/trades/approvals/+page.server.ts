import { getDemoUser } from '$lib/server/demo-user';
import { getTradeApprovals } from '$lib/services/trade-layer.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const user = await getDemoUser();
  return { approvals: await getTradeApprovals(user.id, 50) };
};
