import { error, json } from '@sveltejs/kit';
import { getAiInsight } from '$lib/services/ai-copilot.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  const user = locals.user!;
  const insight = await getAiInsight(user.id, params.id);
  if (!insight) throw error(404, 'AI insight not found.');

  return json({ status: 'ready', insight });
};
