import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { getSimulationResults } from '$lib/services/scenario-simulation.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const user = await getDemoUser();
  return json({
    status: 'ready',
    results: await getSimulationResults(user.id, { runId: url.searchParams.get('runId') ?? undefined })
  });
};
