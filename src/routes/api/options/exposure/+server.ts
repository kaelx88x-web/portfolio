import { json } from '@sveltejs/kit';
import {
  getOptionsExposure,
  parseOptionsBenchmark,
  parseOptionsPeriod
} from '$lib/services/options-intelligence.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user!;
  return json({
    status: 'ready',
    exposure: await getOptionsExposure(user.id, {
      period: parseOptionsPeriod(url.searchParams.get('period')),
      benchmark: parseOptionsBenchmark(url.searchParams.get('benchmark')),
      forceRefresh: url.searchParams.get('refresh') === 'true'
    })
  });
};
