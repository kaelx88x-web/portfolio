import { fail, type Actions } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  getOrderTrackingDashboard,
  reconcileBrokerOrder,
  syncOrderTracking
} from '$lib/services/order-tracking.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  const user = await getDemoUser();
  return getOrderTrackingDashboard(user.id);
};

export const actions: Actions = {
  sync: async ({ request }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    try {
      const result = await syncOrderTracking(user.id, { preferReal: form.get('preferReal') === 'on' });
      return { status: 'synced', message: `Order sync completed. ${result.ordersSynced} orders touched.` };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Order sync failed.' });
    }
  },
  reconcile: async ({ request }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    try {
      await reconcileBrokerOrder(user.id, String(form.get('orderId') ?? ''));
      return { status: 'reconciled', message: 'Order reconciliation logged.' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Order reconciliation failed.' });
    }
  }
};
