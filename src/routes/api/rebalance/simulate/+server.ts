import { json } from '@sveltejs/kit';
import {
  parseSimulationBenchmark,
  parseSimulationPeriod,
  parseSimulationPortfolioMode,
  simulateRebalance
} from '$lib/services/scenario-simulation.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url, locals }) => {
  const user = locals.user!;
  const body = await request.json().catch(() => ({}));
  const result = await simulateRebalance(user.id, {
    period: parseSimulationPeriod(body.period ?? url.searchParams.get('period')),
    benchmark: parseSimulationBenchmark(body.benchmark ?? url.searchParams.get('benchmark')),
    portfolioMode: parseSimulationPortfolioMode(body.portfolioMode ?? url.searchParams.get('portfolioMode'))
  });
  return json(result);
};
