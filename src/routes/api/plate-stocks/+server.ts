import { json, error } from '@sveltejs/kit';
import { getPlateStocks } from '$lib/services/broker.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const plateCode = url.searchParams.get('code');
  if (!plateCode) throw error(400, 'code is required');
  const stocks = await getPlateStocks(plateCode);
  return json({ stocks });
};
