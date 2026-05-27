import { json } from '@sveltejs/kit';
import { reconcileBrokerOrder } from '$lib/services/order-tracking.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
  const user = locals.user!;
  try {
    const reconciliation = await reconcileBrokerOrder(user.id, params.id);
    return json({ status: reconciliation.reconciliationStatus, reconciliation });
  } catch (error) {
    return json({ status: 'error', message: error instanceof Error ? error.message : 'Order reconciliation failed.' }, { status: 400 });
  }
};
