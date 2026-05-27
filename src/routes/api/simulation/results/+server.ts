import { json } from '@sveltejs/kit';
import { getSimulationResults } from '$lib/services/scenario-simulation.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user!;
  return json({
    status: 'ready',
    results: await getSimulationResults(user.id, { runId: url.searchParams.get('runId') ?? undefined })
  });
};
