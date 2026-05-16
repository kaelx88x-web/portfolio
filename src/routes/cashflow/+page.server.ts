import { getAccountCashFlow } from '$lib/services/broker.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const items = await getAccountCashFlow(60).catch(() => []);
  return { items };
};
