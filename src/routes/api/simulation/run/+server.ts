import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  parseScenarioType,
  parseSimulationBenchmark,
  parseSimulationPeriod,
  parseSimulationPortfolioMode,
  runScenarioSimulation
} from '$lib/services/scenario-simulation.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url }) => {
  const user = await getDemoUser();
  const body = await request.json().catch(() => ({}));
  const result = await runScenarioSimulation(user.id, {
    scenarioType: parseScenarioType(body.scenarioType),
    portfolioMode: parseSimulationPortfolioMode(body.portfolioMode),
    period: parseSimulationPeriod(body.period ?? url.searchParams.get('period')),
    benchmark: parseSimulationBenchmark(body.benchmark ?? url.searchParams.get('benchmark'))
  });
  return json({ status: 'completed', ...result });
};
