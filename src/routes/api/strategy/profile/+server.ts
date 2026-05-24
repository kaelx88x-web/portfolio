import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  getStrategyProfile,
  parseStrategyBenchmark,
  parseStrategyPeriod
} from '$lib/services/strategy-orchestrator.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const user = await getDemoUser();
  const profile = await getStrategyProfile(user.id, {
    period: parseStrategyPeriod(url.searchParams.get('period')),
    benchmark: parseStrategyBenchmark(url.searchParams.get('benchmark'))
  });
  return json({ status: 'ready', profile });
};
