import { json } from '@sveltejs/kit';
import { getPlateList } from '$lib/services/broker.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const market     = url.searchParams.get('market')      ?? 'US';
  const plateClass = url.searchParams.get('plate_class') ?? 'INDUSTRY';
  const plates = await getPlateList(market, plateClass);
  return json({ plates });
};
