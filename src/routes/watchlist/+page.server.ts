import { fail } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { optionalString, requiredString } from '$lib/server/form';
import { findOrCreateAsset, listAssets } from '$lib/services/asset.service';
import {
  addWatchlistItem,
  createWatchlist,
  deleteWatchlist,
  listWatchlists,
  removeWatchlistItem
} from '$lib/services/watchlist.service';

export async function load() {
  const user = await getDemoUser();
  const [watchlists, assets] = await Promise.all([listWatchlists(user.id), listAssets()]);

  return { watchlists, assets };
}

export const actions = {
  createList: async ({ request }) => {
    const user = await getDemoUser();
    const formData = await request.formData();
    try {
      await createWatchlist(user.id, requiredString(formData, 'name'));
      return { message: 'Watchlist created' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Unable to create watchlist' });
    }
  },
  deleteList: async ({ request }) => {
    const user = await getDemoUser();
    const formData = await request.formData();
    try {
      await deleteWatchlist(user.id, requiredString(formData, 'watchlistId'));
      return { message: 'Watchlist deleted' };
    } catch {
      return fail(400, { message: 'Unable to delete watchlist' });
    }
  },
  addItem: async ({ request }) => {
    const formData = await request.formData();
    try {
      const typedSymbol = optionalString(formData, 'symbol');
      const existingAssetId = optionalString(formData, 'assetId');
      const asset = typedSymbol ? await findOrCreateAsset(typedSymbol) : null;
      const assetId = asset?.id ?? existingAssetId;
      if (!assetId) throw new Error('Select or enter a symbol');

      await addWatchlistItem(requiredString(formData, 'watchlistId'), assetId, optionalString(formData, 'notes'));
      return { message: 'Watchlist item saved' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Unable to add watchlist item' });
    }
  },
  removeItem: async ({ request }) => {
    const formData = await request.formData();
    try {
      await removeWatchlistItem(requiredString(formData, 'itemId'));
      return { message: 'Watchlist item removed' };
    } catch {
      return fail(400, { message: 'Unable to remove watchlist item' });
    }
  }
};
