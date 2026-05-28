import { json, error } from '@sveltejs/kit';
import { getOptionChain } from '$lib/services/broker.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');
  const symbol = url.searchParams.get('symbol');
  const expiry = url.searchParams.get('expiry');
  if (!symbol) throw error(400, 'symbol is required');
  if (!expiry) throw error(400, 'expiry is required');
  const optionType = (url.searchParams.get('option_type') ?? 'call') as 'call' | 'put' | 'all';
  try {
    const result = await getOptionChain(symbol, expiry, optionType);
    return json(result);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'Bridge offline' }, { status: 500 });
  }
};
