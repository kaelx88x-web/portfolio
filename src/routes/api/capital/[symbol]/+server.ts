import { json } from '@sveltejs/kit';
import { getCapitalFlow, getCapitalDistribution, getQuoteSnapshots } from '$lib/services/broker.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ params }) => {
  const raw = params.symbol.toUpperCase();
  const symbol = raw.includes('.') ? raw : `US.${raw}`;

  const [flows, dists, snapshots] = await Promise.all([
    getCapitalFlow([symbol]),
    getCapitalDistribution([symbol]),
    getQuoteSnapshots([symbol]).catch(() => []),
  ]);

  return json({
    flow: flows[0] ?? null,
    distribution: dists[0] ?? null,
    snapshot: snapshots[0] ?? null,
    fetchedAt: new Date().toISOString(),
  });
};
