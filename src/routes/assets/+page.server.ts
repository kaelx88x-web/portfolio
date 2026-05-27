import { fail } from '@sveltejs/kit';
import { numberFromForm, optionalString, requiredString } from '$lib/server/form';
import { createAsset, deleteAsset, listAssets, updateAsset } from '$lib/services/asset.service';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const search = url.searchParams.get('q');
  const assets = await listAssets(search);

  return { assets, search };
}

export const actions: Actions = {
  create: async ({ request }) => {
    const formData = await request.formData();
    try {
      await createAsset({
        symbol: requiredString(formData, 'symbol'),
        name: requiredString(formData, 'name'),
        assetType: requiredString(formData, 'assetType'),
        exchange: optionalString(formData, 'exchange'),
        currency: requiredString(formData, 'currency').toUpperCase(),
        sector: optionalString(formData, 'sector'),
        country: optionalString(formData, 'country'),
        latestPrice: numberFromForm(formData, 'latestPrice')
      });
      return { message: 'Asset created' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Unable to create asset' });
    }
  },
  update: async ({ request }) => {
    const formData = await request.formData();
    try {
      await updateAsset(requiredString(formData, 'assetId'), {
        symbol: requiredString(formData, 'symbol'),
        name: requiredString(formData, 'name'),
        assetType: requiredString(formData, 'assetType'),
        exchange: optionalString(formData, 'exchange'),
        currency: requiredString(formData, 'currency').toUpperCase(),
        sector: optionalString(formData, 'sector'),
        country: optionalString(formData, 'country'),
        latestPrice: numberFromForm(formData, 'latestPrice')
      });
      return { message: 'Asset updated' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Unable to update asset' });
    }
  },
  delete: async ({ request }) => {
    const formData = await request.formData();
    try {
      await deleteAsset(requiredString(formData, 'assetId'));
      return { message: 'Asset deleted' };
    } catch {
      return fail(400, { message: 'Asset cannot be deleted while it is used by transactions or watchlists' });
    }
  }
};
