import { getInsiderTransactions } from '$lib/server/finnhub';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const symbol = (url.searchParams.get('symbol') ?? '').trim().toUpperCase();
  if (!symbol) return { symbol: '', transactions: [], error: null };
  const result = await getInsiderTransactions(symbol);
  return {
    symbol: result.symbol,
    transactions: result.transactions,
    error: result.error ?? null,
  };
};
