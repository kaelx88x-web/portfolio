import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  parseStrategyBenchmark,
  parseStrategyPeriod,
  refreshStrategyOrchestrator
} from '$lib/services/strategy-orchestrator.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url }) => {
  const user = await getDemoUser();
  const body = await request.json().catch(() => ({}));
  const result = await refreshStrategyOrchestrator(user.id, {
    period: parseStrategyPeriod(body.period ?? url.searchParams.get('period')),
    benchmark: parseStrategyBenchmark(body.benchmark ?? url.searchParams.get('benchmark'))
  });
  return json({ status: 'completed', ...result });
};
