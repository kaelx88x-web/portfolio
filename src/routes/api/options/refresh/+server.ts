import { json } from '@sveltejs/kit';
import {
  parseOptionsBenchmark,
  parseOptionsPeriod,
  refreshOptionsIntelligence
} from '$lib/services/options-intelligence.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ url, locals }) => {
  const user = locals.user!;
  return json({
    status: 'refreshed',
    result: await refreshOptionsIntelligence(user.id, {
      period: parseOptionsPeriod(url.searchParams.get('period')),
      benchmark: parseOptionsBenchmark(url.searchParams.get('benchmark'))
    })
  });
};
