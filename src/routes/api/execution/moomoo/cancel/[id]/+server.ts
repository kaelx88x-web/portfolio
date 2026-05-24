import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { cancelMoomooExecution } from '$lib/services/moomoo-execution.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ params }) => {
  const user = await getDemoUser();
  try {
    const execution = await cancelMoomooExecution(user.id, params.id);
    return json({ status: execution.status, execution });
  } catch (error) {
    return json({ status: 'error', message: error instanceof Error ? error.message : 'Execution cancel failed.' }, { status: 400 });
  }
};
