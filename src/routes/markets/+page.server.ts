import { getGlobalMarkets } from '$lib/services/broker.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const data = await getGlobalMarkets().catch(() => ({ fetched_at: '', markets: [] }));
  return data;
};
