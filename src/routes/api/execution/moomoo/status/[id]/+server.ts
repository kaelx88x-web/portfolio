import { json } from '@sveltejs/kit';
import { getMoomooExecutionRequest } from '$lib/services/moomoo-execution.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  const user = locals.user!;
  const execution = await getMoomooExecutionRequest(user.id, params.id);
  if (!execution) return json({ status: 'not_found', message: 'Execution request not found.' }, { status: 404 });
  return json({ status: execution.status, execution });
};
