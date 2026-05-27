import { json } from '@sveltejs/kit';
import {
  getPortfolioStyle,
  parseSmartAllocationBenchmark,
  parseSmartAllocationPeriod
} from '$lib/services/smart-allocation.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user!;
  return json({
    status: 'ready',
    style: await getPortfolioStyle(user.id, {
      period: parseSmartAllocationPeriod(url.searchParams.get('period')),
      benchmark: parseSmartAllocationBenchmark(url.searchParams.get('benchmark'))
    })
  });
};
