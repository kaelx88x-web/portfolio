import { error } from '@sveltejs/kit';
import { getCapitalFlow, getCapitalDistribution, getStockBasicInfo, getQuoteSnapshots } from '$lib/services/broker.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ params }) => {
  const raw = params.symbol.toUpperCase();
  const symbol = raw.includes('.') ? raw : `US.${raw}`;

  const [flows, dists, basics, snapshots] = await Promise.all([
    getCapitalFlow([symbol]),
    getCapitalDistribution([symbol]),
    getStockBasicInfo([symbol]),
    getQuoteSnapshots([symbol]).catch(() => []),
  ]);

  const flow = flows[0] ?? null;
  if (!flow) throw error(404, `No data for ${symbol}`);

  const distribution = dists[0] ?? null;
  const basicInfo = basics[0]?.error ? null : (basics[0] ?? null);
  const snapshot = snapshots[0] ?? null;

  return { symbol, flow, distribution, basicInfo, snapshot };
};
