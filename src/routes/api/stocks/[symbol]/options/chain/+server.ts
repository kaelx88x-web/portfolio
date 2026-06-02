import { json } from '@sveltejs/kit';
import { getOptionChain } from '$lib/services/broker.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, locals }) => {
  void locals.user!;
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  const expiry = url.searchParams.get('expiry') ?? '';
  const type = (url.searchParams.get('type') ?? 'all') as 'call' | 'put' | 'all';
  if (!expiry) return json({ status: 'error', chain: [] }, { status: 400 });
  try {
    return json({ status: 'ready', ...(await getOptionChain(symbol, expiry, type)) });
  } catch {
    return json({ status: 'unavailable', chain: [] });
  }
};
