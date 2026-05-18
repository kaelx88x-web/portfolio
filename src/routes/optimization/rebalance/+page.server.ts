import { fail, type Actions } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  getOptimizationDashboard,
  parseOptimizationBenchmark,
  parseOptimizationPeriod
} from '$lib/services/optimization-engine.service';
import {
  getRebalanceProjection,
  parseSimulationPortfolioMode,
  simulateRebalance
} from '$lib/services/scenario-simulation.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const user = await getDemoUser();
  const period = parseOptimizationPeriod(url.searchParams.get('period'));
  const benchmark = parseOptimizationBenchmark(url.searchParams.get('benchmark'));
  const portfolioMode = parseSimulationPortfolioMode(url.searchParams.get('portfolioMode'));
  const [dashboard, rebalanceProjection] = await Promise.all([
    getOptimizationDashboard(user.id, { period, benchmark }),
    getRebalanceProjection(user.id, { period, benchmark, portfolioMode })
  ]);
  return { ...dashboard, portfolioMode, rebalanceProjection };
};

export const actions: Actions = {
  simulate: async ({ request, url }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    try {
      await simulateRebalance(user.id, {
        period: parseOptimizationPeriod(url.searchParams.get('period')),
        benchmark: parseOptimizationBenchmark(url.searchParams.get('benchmark')),
        portfolioMode: parseSimulationPortfolioMode(form.get('portfolioMode') ?? url.searchParams.get('portfolioMode'))
      });
      return { status: 'completed', message: 'Rebalance projection simulated.' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Rebalance simulation failed.' });
    }
  }
};
