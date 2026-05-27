import { json } from '@sveltejs/kit';
import {
  getPutExposureAnalysis,
  parseOptionsBenchmark,
  parseOptionsPeriod
} from '$lib/services/options-intelligence.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user!;
  return json({
    status: 'ready',
    puts: await getPutExposureAnalysis(user.id, {
      period: parseOptionsPeriod(url.searchParams.get('period')),
      benchmark: parseOptionsBenchmark(url.searchParams.get('benchmark'))
    })
  });
};
