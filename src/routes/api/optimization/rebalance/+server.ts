import { json } from '@sveltejs/kit';
import { getRebalanceSuggestions } from '$lib/services/optimization-engine.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user!;
  return json({ status: 'ready', suggestions: await getRebalanceSuggestions(user.id) });
};
