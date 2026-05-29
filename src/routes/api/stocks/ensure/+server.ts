import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { prisma } from '$lib/server/db';

function inferCurrency(symbol: string): string {
  if (symbol.endsWith('.KL')) return 'MYR';
  if (symbol.endsWith('.HK')) return 'HKD';
  return 'USD';
}

function inferCountry(symbol: string): string {
  if (symbol.endsWith('.KL')) return 'MY';
  if (symbol.endsWith('.HK')) return 'HK';
  return 'US';
}

export const POST: RequestHandler = async ({ request, locals }) => {
  if (!locals.user) throw error(401, 'Unauthorized');
  const body = await request.json();
  const { symbol, name, exchange, type } = body as {
    symbol: string; name: string; exchange: string; type: string;
  };
  if (!symbol || !name) throw error(400, 'symbol and name are required');

  const assetType = ['etf', 'mutualfund'].includes(type) ? 'etf' : 'stock';
  const asset = await prisma.asset.upsert({
    where: { symbol },
    create: {
      symbol,
      name,
      assetType,
      exchange,
      currency: inferCurrency(symbol),
      country:  inferCountry(symbol),
    },
    update: {},
  });
  return json({ assetId: asset.id, symbol: asset.symbol });
};
