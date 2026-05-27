import { fail, type Actions } from '@sveltejs/kit';
import {
  getOrderTrackingDashboard,
  reconcileBrokerOrder,
  syncOrderTracking
} from '$lib/services/order-tracking.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;
  return getOrderTrackingDashboard(user.id);
};

export const actions: Actions = {
  sync: async ({ request, locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    try {
      const result = await syncOrderTracking(user.id, { preferReal: form.get('preferReal') === 'on' });
      return { status: 'synced', message: `Order sync completed. ${result.ordersSynced} orders touched.` };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Order sync failed.' });
    }
  },
  reconcile: async ({ request, locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    try {
      await reconcileBrokerOrder(user.id, String(form.get('orderId') ?? ''));
      return { status: 'reconciled', message: 'Order reconciliation logged.' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Order reconciliation failed.' });
    }
  }
};
