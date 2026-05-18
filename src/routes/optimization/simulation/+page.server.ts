import { fail, type Actions } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  getScenarioSimulationDashboard,
  parseScenarioType,
  parseSimulationBenchmark,
  parseSimulationPeriod,
  parseSimulationPortfolioMode,
  runScenarioSimulation
} from '$lib/services/scenario-simulation.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const user = await getDemoUser();
  const period = parseSimulationPeriod(url.searchParams.get('period'));
  const benchmark = parseSimulationBenchmark(url.searchParams.get('benchmark'));
  const portfolioMode = parseSimulationPortfolioMode(url.searchParams.get('portfolioMode'));
  return getScenarioSimulationDashboard(user.id, { period, benchmark, portfolioMode });
};

export const actions: Actions = {
  run: async ({ request, url }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    try {
      await runScenarioSimulation(user.id, {
        scenarioType: parseScenarioType(form.get('scenarioType')),
        portfolioMode: parseSimulationPortfolioMode(form.get('portfolioMode')),
        period: parseSimulationPeriod(url.searchParams.get('period')),
        benchmark: parseSimulationBenchmark(url.searchParams.get('benchmark'))
      });
      return { status: 'completed', message: 'Scenario simulation completed.' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Scenario simulation failed.' });
    }
  }
};
