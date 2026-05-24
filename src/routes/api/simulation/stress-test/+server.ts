import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  getStressTest,
  parseSimulationBenchmark,
  parseSimulationPeriod,
  parseSimulationPortfolioMode
} from '$lib/services/scenario-simulation.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const user = await getDemoUser();
  const stressTest = await getStressTest(user.id, {
    period: parseSimulationPeriod(url.searchParams.get('period')),
    benchmark: parseSimulationBenchmark(url.searchParams.get('benchmark')),
    portfolioMode: parseSimulationPortfolioMode(url.searchParams.get('portfolioMode'))
  });
  return json({ status: 'ready', stressTest });
};
