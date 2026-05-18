import { getDemoUser } from '$lib/server/demo-user';
import { PORTFOLIO_MODES } from '$lib/services/optimization-engine.service';
import {
  getStressTest,
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
  return {
    period,
    benchmark,
    portfolioMode,
    portfolioModes: PORTFOLIO_MODES,
    stressTest: await getStressTest(user.id, { period, benchmark, portfolioMode })
  };
};
