import { getDemoUser } from '$lib/server/demo-user';
import {
  getStressTest,
  parseSimulationBenchmark,
  parseSimulationPeriod,
} from '$lib/services/scenario-simulation.service';
import { getRecommendedStrategy } from '$lib/services/behavioral-profile.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const user      = await getDemoUser();
  const period    = parseSimulationPeriod(url.searchParams.get('period'));
  const benchmark = parseSimulationBenchmark(url.searchParams.get('benchmark'));

  const strategy      = await getRecommendedStrategy(user.id).catch(() => null);
  const portfolioMode = strategy?.portfolioMode ?? 'hybrid';

  return {
    period,
    benchmark,
    portfolioMode,
    stressTest: await getStressTest(user.id, { period, benchmark, portfolioMode }),
  };
};
