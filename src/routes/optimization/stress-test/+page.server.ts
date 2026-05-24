import { getDemoUser } from '$lib/server/demo-user';
import {
  getStressTest,
  parseSimulationBenchmark,
  parseSimulationPeriod,
} from '$lib/services/scenario-simulation.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
  const user      = await getDemoUser();
  const period    = parseSimulationPeriod(url.searchParams.get('period'));
  const benchmark = parseSimulationBenchmark(url.searchParams.get('benchmark'));

  const portfolioMode = locals.recommendedStrategy?.portfolioMode ?? 'hybrid';

  return {
    period,
    benchmark,
    portfolioMode,
    stressTest: await getStressTest(user.id, { period, benchmark, portfolioMode }),
  };
};
