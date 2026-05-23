import { json, error } from '@sveltejs/kit';
import { getOptionExpiry } from '$lib/services/broker.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const symbol = url.searchParams.get('symbol');
  if (!symbol) throw error(400, 'symbol is required');
  try {
    const result = await getOptionExpiry(symbol);
    return json(result);
  } catch (e) {
    throw error(502, e instanceof Error ? e.message : 'Failed to fetch option expiry');
  }
};
