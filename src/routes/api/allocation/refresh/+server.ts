import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  parseSmartAllocationBenchmark,
  parseSmartAllocationPeriod,
  refreshSmartAllocation
} from '$lib/services/smart-allocation.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ url }) => {
  const user = await getDemoUser();
  return json({
    status: 'refreshed',
    result: await refreshSmartAllocation(user.id, {
      period: parseSmartAllocationPeriod(url.searchParams.get('period')),
      benchmark: parseSmartAllocationBenchmark(url.searchParams.get('benchmark'))
    })
  });
};
