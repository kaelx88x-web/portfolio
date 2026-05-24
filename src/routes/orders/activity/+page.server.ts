import { getDemoUser } from '$lib/server/demo-user';
import { listBrokerOrderEvents, listReconciliationLogs } from '$lib/services/order-tracking.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const user = await getDemoUser();
  const [events, reconciliations] = await Promise.all([
    listBrokerOrderEvents(user.id, { limit: 100 }),
    listReconciliationLogs(user.id, { limit: 100 })
  ]);
  return { events, reconciliations };
};
