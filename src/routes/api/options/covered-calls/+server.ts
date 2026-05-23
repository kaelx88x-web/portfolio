import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  getCoveredCallAnalysis,
  parseOptionsBenchmark,
  parseOptionsPeriod
} from '$lib/services/options-intelligence.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const user = await getDemoUser();
  return json({
    status: 'ready',
    covered_calls: await getCoveredCallAnalysis(user.id, {
      period: parseOptionsPeriod(url.searchParams.get('period')),
      benchmark: parseOptionsBenchmark(url.searchParams.get('benchmark'))
    })
  });
};
