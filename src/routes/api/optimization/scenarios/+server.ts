import { json } from '@sveltejs/kit';
import { getOptimizationScenarios } from '$lib/services/optimization-engine.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user!;
  return json({ status: 'ready', scenarios: await getOptimizationScenarios(user.id) });
};
