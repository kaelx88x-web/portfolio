import { json } from '@sveltejs/kit';
import { cancelMoomooExecution } from '$lib/services/moomoo-execution.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params, locals }) => {
  const user = locals.user!;
  try {
    const execution = await cancelMoomooExecution(user.id, params.id);
    return json({ status: execution.status, execution });
  } catch (error) {
    return json({ status: 'error', message: error instanceof Error ? error.message : 'Execution cancel failed.' }, { status: 400 });
  }
};
