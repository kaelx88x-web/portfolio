import { json } from '@sveltejs/kit';
import {
  getOptimizationConstraints,
  saveOptimizationConstraints,
  type OptimizationConstraintSet
} from '$lib/services/optimization-engine.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user!;
  return json({ status: 'ready', constraints: await getOptimizationConstraints(user.id) });
};

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user!;
  const body = (await request.json().catch(() => ({}))) as Partial<OptimizationConstraintSet>;
  return json({ status: 'saved', constraints: await saveOptimizationConstraints(user.id, body) });
};
