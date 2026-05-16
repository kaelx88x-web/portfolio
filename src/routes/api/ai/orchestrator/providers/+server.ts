import { json } from '@sveltejs/kit';
import { listAiProviders } from '$lib/services/ai-orchestration.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  return json({ status: 'ready', providers: listAiProviders() });
};
