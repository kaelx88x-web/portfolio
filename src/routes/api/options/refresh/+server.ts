import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  parseOptionsBenchmark,
  parseOptionsPeriod,
  refreshOptionsIntelligence
} from '$lib/services/options-intelligence.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ url }) => {
  const user = await getDemoUser();
  return json({
    status: 'refreshed',
    result: await refreshOptionsIntelligence(user.id, {
      period: parseOptionsPeriod(url.searchParams.get('period')),
      benchmark: parseOptionsBenchmark(url.searchParams.get('benchmark'))
    })
  });
};
