import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

interface SearchResult {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
}

const cache = new Map<string, { results: SearchResult[]; expiresAt: number }>();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes
const MAX_CACHE_SIZE = 500;

export const GET: RequestHandler = async ({ url, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');
  const q = url.searchParams.get('q')?.trim() ?? '';
  if (q.length < 2) return json({ results: [] });

  const cached = cache.get(q);
  if (cached) {
    if (cached.expiresAt > Date.now()) return json({ results: cached.results });
    cache.delete(q); // Clean up expired entry
  }

  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=8&newsCount=0`,
      { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortfolioAI/1.0)' } }
    );
    if (!res.ok) return json({ results: [] });
    const data = await res.json();
    const results: SearchResult[] = (data.quotes ?? [])
      .filter((item: any) => item.symbol && (item.longname || item.shortname))
      .slice(0, 8)
      .map((item: any) => ({
        symbol:   item.symbol,
        name:     item.longname ?? item.shortname ?? item.symbol,
        exchange: item.exchange ?? '',
        type:     (item.quoteType ?? 'EQUITY').toLowerCase(),
      }));
    // Evict all if cache is too large (simple protection against unbounded growth)
    if (cache.size >= MAX_CACHE_SIZE) cache.clear();
    cache.set(q, { results, expiresAt: Date.now() + CACHE_TTL });
    return json({ results });
  } catch {
    return json({ results: [] });
  }
};
