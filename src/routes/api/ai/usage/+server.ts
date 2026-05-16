import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { listAiUsage } from '$lib/services/ai-copilot.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const user = await getDemoUser();
  return json({ status: 'ready', usage: await listAiUsage(user.id) });
};
