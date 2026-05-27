import { json } from '@sveltejs/kit';
import {
  parseSmartAllocationBenchmark,
  parseSmartAllocationPeriod,
  refreshSmartAllocation
} from '$lib/services/smart-allocation.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ url, locals }) => {
  const user = locals.user!;
  return json({
    status: 'refreshed',
    result: await refreshSmartAllocation(user.id, {
      period: parseSmartAllocationPeriod(url.searchParams.get('period')),
      benchmark: parseSmartAllocationBenchmark(url.searchParams.get('benchmark'))
    })
  });
};
