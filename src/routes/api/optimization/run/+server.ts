import { json } from '@sveltejs/kit';
import {
  parseOptimizationBenchmark,
  parseOptimizationGoal,
  parseOptimizationPeriod,
  parsePortfolioMode,
  parseRiskProfile,
  runOptimization
} from '$lib/services/optimization-engine.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url, locals }) => {
  const user = locals.user!;
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
