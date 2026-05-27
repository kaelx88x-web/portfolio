import { json, error } from '@sveltejs/kit';
import { getOptionExpiry } from '$lib/services/broker.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');
  const symbol = url.searchParams.get('symbol');
  if (!symbol) throw error(400, 'symbol is required');
  try {
    const result = await getOptionExpiry(symbol);
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Bridge offline' }, { status: 500 });
  }
};
