import { json } from '@sveltejs/kit';
import {
  getStrategyConflicts,
  parseStrategyBenchmark,
  parseStrategyPeriod
} from '$lib/services/strategy-orchestrator.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user!;
  const conflicts = await getStrategyConflicts(user.id, {
    period: parseStrategyPeriod(url.searchParams.get('period')),
    benchmark: parseStrategyBenchmark(url.searchParams.get('benchmark'))
  });
  return json({ status: 'ready', conflicts });
};
