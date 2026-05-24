import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  parseOptimizationBenchmark,
  parseOptimizationGoal,
  parseOptimizationPeriod,
  parsePortfolioMode,
  parseRiskProfile,
  runOptimization
} from '$lib/services/optimization-engine.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url }) => {
  const user = await getDemoUser();
  const body = await request.json().catch(() => ({}));
  const result = await runOptimization(user.id, {
    portfolioMode: parsePortfolioMode(body.portfolioMode),
    optimizationGoal: parseOptimizationGoal(body.optimizationGoal),
    riskProfile: parseRiskProfile(body.riskProfile),
    period: parseOptimizationPeriod(body.period ?? url.searchParams.get('period')),
    benchmark: parseOptimizationBenchmark(body.benchmark ?? url.searchParams.get('benchmark'))
  });
  return json({ status: 'completed', ...result });
};
