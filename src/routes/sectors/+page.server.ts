import { getPlateList } from '$lib/services/broker.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const plates = await getPlateList('US', 'INDUSTRY').catch(() => []);
  return { plates };
};
