import { json } from '@sveltejs/kit';
import { refreshAiProviderRoutes } from '$lib/services/ai-orchestration.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async () => {
  return json({ status: 'refreshed', ...(await refreshAiProviderRoutes()) });
};
