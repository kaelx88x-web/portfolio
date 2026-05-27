import { json } from '@sveltejs/kit';
import {
  getRebalanceProjection,
  parseSimulationBenchmark,
  parseSimulationPeriod,
  parseSimulationPortfolioMode
} from '$lib/services/scenario-simulation.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user!;
  const projection = await getRebalanceProjection(user.id, {
    period: parseSimulationPeriod(url.searchParams.get('period')),
    benchmark: parseSimulationBenchmark(url.searchParams.get('benchmark')),
    portfolioMode: parseSimulationPortfolioMode(url.searchParams.get('portfolioMode'))
  });
  return json({ status: 'ready', projection });
};
