import { json } from '@sveltejs/kit';
import {
  parseStrategyBenchmark,
  parseStrategyPeriod,
  refreshStrategyOrchestrator
} from '$lib/services/strategy-orchestrator.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url, locals }) => {
  const user = locals.user!;
  const body = await request.json().catch(() => ({}));
  const result = await refreshStrategyOrchestrator(user.id, {
    period: parseStrategyPeriod(body.period ?? url.searchParams.get('period')),
    benchmark: parseStrategyBenchmark(body.benchmark ?? url.searchParams.get('benchmark'))
  });
  return json({ status: 'completed', ...result });
};
