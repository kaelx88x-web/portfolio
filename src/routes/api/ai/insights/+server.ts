import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { listAiInsights } from '$lib/services/ai-copilot.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const user = await getDemoUser();
  return json({ status: 'ready', insights: await listAiInsights(user.id) });
};
