import { error } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { getMoomooExecutionRequest } from '$lib/services/moomoo-execution.service';
import type { PageServerLoad } from './$types';

export { actions } from '../../+page.server';

export const load: PageServerLoad = async ({ params }) => {
  const user = await getDemoUser();
  const execution = await getMoomooExecutionRequest(user.id, params.id);
  if (!execution) throw error(404, 'Execution request not found.');
  return { execution };
};
