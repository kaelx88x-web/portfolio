import { getDemoUser } from '$lib/server/demo-user';
import {
  getPortfolioProjection,
  getRebalanceProjection,
  parseSimulationBenchmark,
  parseSimulationPeriod,
  parseSimulationPortfolioMode
} from '$lib/services/scenario-simulation.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const user = await getDemoUser();
  const period = parseSimulationPeriod(url.searchParams.get('period'));
  const benchmark = parseSimulationBenchmark(url.searchParams.get('benchmark'));
  const portfolioMode = parseSimulationPortfolioMode(url.searchParams.get('portfolioMode'));
  const [projection, rebalanceProjection] = await Promise.all([
    getPortfolioProjection(user.id, { period, benchmark, portfolioMode }),
    getRebalanceProjection(user.id, { period, benchmark, portfolioMode })
  ]);
  return { period, benchmark, portfolioMode, projection, rebalanceProjection };
};
