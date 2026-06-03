import { json } from '@sveltejs/kit';
import { getProvider } from '$lib/server/market-data';
import { cached } from '$lib/server/quote-cache';
import type { RequestHandler } from './$types';

const TTL_MS = 8_000;

export const GET: RequestHandler = async ({ url, locals }) => {
  void locals.user!; // auth enforced by hooks
  const codes = [...new Set(
    (url.searchParams.get('codes') ?? '').split(',').map((c) => c.trim().toUpperCase()).filter(Boolean)
  )].sort();
  if (codes.length === 0) return json({ quotes: [] });

  const quotes = await cached(`live:${codes.join(',')}`, TTL_MS, () => getProvider().getQuotes(codes));
  return json({ quotes });
};
