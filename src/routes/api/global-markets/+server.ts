import { json } from '@sveltejs/kit';
import { getGlobalMarkets } from '$lib/services/broker.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async () => {
  const data = await getGlobalMarkets().catch(() => ({ fetched_at: '', markets: [] }));
  return json(data);
};
