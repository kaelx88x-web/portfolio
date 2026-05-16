import { json } from '@sveltejs/kit';
import { listAiIntents } from '$lib/services/ai-orchestration.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  return json({ status: 'ready', intents: listAiIntents() });
};
