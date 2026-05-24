import { json } from '@sveltejs/kit';
import { getPeers } from '$lib/server/finnhub';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const symbol = (url.searchParams.get('symbol') ?? '').trim().toUpperCase();
  if (!symbol) return json({ error: 'symbol required' }, { status: 400 });
  const result = await getPeers(symbol);
  return json(result);
};
