// src/routes/stocks/+page.server.ts
import { fail } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { fetchPrices } from '$lib/server/price-source';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
  const user = locals.user!;

  const [assets, transactions, watchlistItems] = await Promise.all([
    prisma.asset.findMany({
      orderBy: [{ country: 'asc' }, { symbol: 'asc' }],
    }),
    prisma.transaction.findMany({
      where: { userId: user.id, type: { in: ['BUY', 'SELL'] } },
      select: { assetId: true, type: true, quantity: true, price: true },
    }),
    prisma.watchlistItem.findMany({
      where: { watchlist: { userId: user.id } },
      select: { assetId: true },
    }),
  ]);

  // Compute owned qty + avg cost per assetId
  const ownedMap: Record<string, { qty: number; avgCost: number }> = {};
  for (const tx of transactions) {
    if (!tx.assetId) continue;
    const existing = ownedMap[tx.assetId] ?? { qty: 0, avgCost: 0 };
    if (tx.type === 'BUY') {
      const totalCost = existing.avgCost * existing.qty + tx.price * tx.quantity;
      const totalQty  = existing.qty + tx.quantity;
      ownedMap[tx.assetId] = { qty: totalQty, avgCost: totalQty > 0 ? totalCost / totalQty : 0 };
    } else {
      ownedMap[tx.assetId] = {
        qty:     Math.max(0, existing.qty - tx.quantity),
        avgCost: existing.avgCost,
      };
    }
  }

  const watchlistSet = watchlistItems.map(w => w.assetId);

  // Fetch real prices — falls back gracefully if all sources fail
  const priceMap = await fetchPrices(assets);

  return {
    assets,
    ownedMap,
    watchlistSet,
    priceMap: Object.fromEntries(priceMap),
  };
};

export const actions: Actions = {
  add: async ({ request, locals }) => {
    const user = locals.user!;
    const data = await request.formData();

    const assetId  = data.get('assetId') as string | null;
    const symbol   = data.get('symbol')  as string | null;
    const type     = (data.get('type')   as string | null)?.toUpperCase();
    const qtyRaw   = data.get('quantity') as string | null;
    const priceRaw = data.get('price')    as string | null;
    const dateRaw  = data.get('tradeDate') as string | null;
    const feeRaw   = data.get('fee')       as string | null;

    if (!assetId)            return fail(400, { error: 'Asset is required' });
    if (!type || !['BUY','SELL'].includes(type)) return fail(400, { error: 'Type must be BUY or SELL' });
    const qty = parseFloat(qtyRaw ?? '');
    const px  = parseFloat(priceRaw ?? '');
    if (!qtyRaw || isNaN(qty) || qty <= 0)   return fail(400, { error: 'Quantity must be a positive number' });
    if (!priceRaw || isNaN(px) || px <= 0)   return fail(400, { error: 'Price must be a positive number' });
    if (!dateRaw)            return fail(400, { error: 'Trade date is required' });

    const account = await prisma.account.findFirst({ where: { userId: user.id } });
    if (!account) return fail(400, { error: 'No portfolio account found. Create one first.' });

    await prisma.transaction.create({
      data: {
        userId:    user.id,
        accountId: account.id,
        assetId,
        type:      type.toLowerCase(),
        quantity:  qty,
        price:     px,
        tradeDate: new Date(dateRaw),
        fee:       feeRaw ? (parseFloat(feeRaw) || 0) : 0,
        currency:  'USD',
      },
    });

    return { added: true, symbol: symbol ?? '' };
  },

  toggleWatchlist: async ({ request, locals }) => {
    const user = locals.user!;
    const data = await request.formData();
    const assetId = data.get('assetId') as string | null;
    if (!assetId) return fail(400, { error: 'assetId required' });

    // Ensure watchlist exists
    let wl = await prisma.watchlist.findFirst({ where: { userId: user.id } });
    if (!wl) {
      wl = await prisma.watchlist.create({
        data: { userId: user.id, name: 'Watchlist' },
      });
    }

    const existing = await prisma.watchlistItem.findFirst({
      where: { watchlistId: wl.id, assetId },
    });

    if (existing) {
      await prisma.watchlistItem.delete({ where: { id: existing.id } });
      return { watchlisted: false };
    } else {
      await prisma.watchlistItem.create({ data: { watchlistId: wl.id, assetId } });
      return { watchlisted: true };
    }
  },
};
