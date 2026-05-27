import { json } from '@sveltejs/kit';
import { syncOrderTracking } from '$lib/services/order-tracking.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user!;
  const body = await request.json().catch(() => ({}));
  try {
    const result = await syncOrderTracking(user.id, { preferReal: Boolean(body.preferReal) });
    return json({ status: 'synced', result });
  } catch (error) {
    return json({ status: 'error', message: error instanceof Error ? error.message : 'Order sync failed.' }, { status: 400 });
  }
};
