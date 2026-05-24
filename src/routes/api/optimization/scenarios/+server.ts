import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { getOptimizationScenarios } from '$lib/services/optimization-engine.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const user = await getDemoUser();
  return json({ status: 'ready', scenarios: await getOptimizationScenarios(user.id) });
};
