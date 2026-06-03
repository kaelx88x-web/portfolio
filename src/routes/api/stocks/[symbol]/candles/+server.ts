import { json, error } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { getHistoricalCandles } from '$lib/services/broker.service';
import { toMoomooCode, decodeSymbolParam } from '$lib/services/stock-detail.service';
import type { RequestHandler } from './$types';

const RANGE_DAYS: Record<string, number> = { '1D': 1, '1W': 7, '1M': 30, '3M': 90, '1Y': 365 };

export const GET: RequestHandler = async ({ params, url, locals }) => {
  void locals.user!; // auth enforced by hooks
  const symbol = decodeSymbolParam(params.symbol);
  const asset = await prisma.asset.findUnique({ where: { symbol } });
  if (!asset) throw error(404, 'Unknown symbol');

  const range = url.searchParams.get('range') ?? '3M';
  const force = url.searchParams.get('force') === 'true';
  const days = RANGE_DAYS[range] ?? 90;
  const start = new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

  const code = toMoomooCode(asset.symbol, asset.country);
  const candles = (await getHistoricalCandles(code, start, null, force))
    .map((k) => ({ t: k.time_key, o: k.open, h: k.high, l: k.low, c: k.close, v: k.volume ?? 0 }));
  return json({ status: 'ready', range, candles });
};
