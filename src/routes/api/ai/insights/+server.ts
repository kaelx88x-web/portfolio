import { json } from '@sveltejs/kit';
import { listAiInsights } from '$lib/services/ai-copilot.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals }) => {
  const user = locals.user!;
  return json({ status: 'ready', insights: await listAiInsights(user.id) });
};
