import { json } from '@sveltejs/kit';
import { getOptionExpiry } from '$lib/services/broker.service';
import { expiryDte } from '$lib/services/stock-detail.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params, locals }) => {
  void locals.user!;
  const symbol = decodeURIComponent(params.symbol).toUpperCase();
  try {
    const r = await getOptionExpiry(symbol);
    return json({ status: 'ready', expiries: r.expiry_dates.map((d) => ({ date: d, dte: expiryDte(d) })) });
  } catch {
    return json({ status: 'unavailable', expiries: [] });
  }
};
