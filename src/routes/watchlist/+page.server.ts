import { fail } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { findOrCreateAsset } from '$lib/services/asset.service';
import { addWatchlistItem, createWatchlist, listWatchlists, removeWatchlistItem } from '$lib/services/watchlist.service';

export async function load() {
  const user = await getDemoUser();
  const watchlists = await listWatchlists(user.id);

  const items = watchlists.flatMap((wl) =>
    wl.items.map((item) => ({
      id: item.id,
      symbol: item.asset.symbol,
      name: item.asset.name,
      notes: item.notes ?? undefined,
      watchlistName: wl.name,
    }))
  );

  return { watchlists, items };
}

export const actions = {
  add: async ({ request }) => {
    const user = await getDemoUser();
    const fd = await request.formData();
    const symbol = (fd.get('symbol') as string ?? '').trim().toUpperCase();
    const notes  = (fd.get('notes')  as string ?? '').trim() || null;

    if (!symbol) return fail(400, { error: 'Symbol is required' });

    // Get or create default watchlist
    let watchlists = await listWatchlists(user.id);
    let wl = watchlists[0];
    if (!wl) {
      wl = await createWatchlist(user.id, 'My Watchlist') as typeof watchlists[0];
    }

    const asset = await findOrCreateAsset(symbol);
    await addWatchlistItem(wl.id, asset.id, notes);
    return { success: true };
  },

  remove: async ({ request }) => {
    const fd = await request.formData();
    const itemId = fd.get('itemId') as string;
    if (!itemId) return fail(400, { error: 'Missing itemId' });

    await removeWatchlistItem(itemId);
    return { success: true };
  },
};
