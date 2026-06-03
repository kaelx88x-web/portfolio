// src/routes/api/stocks/[symbol]/candles/+server.ts
import { json } from '@sveltejs/kit';
import { decodeSymbolParam } from '$lib/services/stock-detail.service';
import { getProvider } from '$lib/server/market-data';
import { cached } from '$lib/server/quote-cache';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, url, locals }) => {
  void locals.user!; // auth enforced by hooks
  const symbol = decodeSymbolParam(params.symbol); // 404s on malformed %-escape
  const range = url.searchParams.get('range') ?? '3M';
  const candles = await cached(`candles:${symbol}:${range}`, 60_000, () => getProvider().getCandles(symbol, range));
  return json({ status: 'ready', range, candles });
};
