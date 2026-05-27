import { listBrokerOrderEvents, listReconciliationLogs } from '$lib/services/order-tracking.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;
  const [events, reconciliations] = await Promise.all([
    listBrokerOrderEvents(user.id, { limit: 100 }),
    listReconciliationLogs(user.id, { limit: 100 })
  ]);
  return { events, reconciliations };
};
