import { getPeers } from '$lib/server/finnhub';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const symbol = (url.searchParams.get('symbol') ?? '').trim().toUpperCase();
  if (!symbol) return { symbol: '', peers: [], error: null };
  const result = await getPeers(symbol);
  return {
    symbol: result.symbol,
    peers: result.peers,
    error: result.error ?? null,
  };
};
