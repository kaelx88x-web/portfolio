import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  getOptimizationConstraints,
  saveOptimizationConstraints,
  type OptimizationConstraintSet
} from '$lib/services/optimization-engine.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const user = await getDemoUser();
  return json({ status: 'ready', constraints: await getOptimizationConstraints(user.id) });
};

export const POST: RequestHandler = async ({ request }) => {
  const user = await getDemoUser();
  const body = (await request.json().catch(() => ({}))) as Partial<OptimizationConstraintSet>;
  return json({ status: 'saved', constraints: await saveOptimizationConstraints(user.id, body) });
};
