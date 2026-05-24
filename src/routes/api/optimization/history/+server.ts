import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { getOptimizationHistory } from '$lib/services/optimization-engine.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const user = await getDemoUser();
  return json({ status: 'ready', history: await getOptimizationHistory(user.id) });
};
