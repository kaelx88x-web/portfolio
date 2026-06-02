import { error, fail } from '@sveltejs/kit';
import { prisma } from '$lib/server/db';
import { buildStockDetail, withTimeout } from '$lib/services/stock-detail.service';
import { getGlobalMarkets } from '$lib/services/broker.service';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ params, locals }) => {
  const user = locals.user!;
  const vm = await buildStockDetail(user.id, params.symbol);
  if (!vm) throw error(404, `No data for ${params.symbol}`);
  // Timezone is nice-to-have — bound it so a slow bridge can't delay the page.
  const tz = await withTimeout(getGlobalMarkets(), 3000)
    .then((g) => g.markets.find((m) => m.key?.toUpperCase() === (vm.asset.market ?? 'US').toUpperCase())?.timezone ?? null)
    .catch(() => null);
  return { detail: vm, timezone: tz };
};

export const actions: Actions = {
  toggleWatchlist: async ({ request, locals }) => {
    const user = locals.user!;
    const assetId = String((await request.formData()).get('assetId') ?? '');
    if (!assetId) return fail(400, { error: 'assetId required' });
    let wl = await prisma.watchlist.findFirst({ where: { userId: user.id } });
    if (!wl) wl = await prisma.watchlist.create({ data: { userId: user.id, name: 'Watchlist' } });
    const existing = await prisma.watchlistItem.findFirst({ where: { watchlistId: wl.id, assetId } });
    if (existing) { await prisma.watchlistItem.delete({ where: { id: existing.id } }); return { watchlisted: false }; }
    await prisma.watchlistItem.create({ data: { watchlistId: wl.id, assetId } });
    return { watchlisted: true };
  }
};
