import { getDemoUser } from '$lib/server/demo-user';
import { listWatchlists } from '$lib/services/watchlist.service';

export async function load() {
  const user = await getDemoUser();
  const watchlists = await listWatchlists(user.id);

  // Flatten all items from all watchlists into a single list for display
  const items = watchlists.flatMap((wl) =>
    wl.items.map((item) => ({
      id: item.id,
      symbol: item.asset.symbol,
      name: item.asset.name,
      notes: item.notes ?? undefined,
      watchlistName: wl.name
    }))
  );

  return { watchlists, items };
}
