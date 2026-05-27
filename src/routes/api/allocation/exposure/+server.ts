import { json } from '@sveltejs/kit';
import {
  getAllocationExposure,
  parseSmartAllocationBenchmark,
  parseSmartAllocationPeriod
} from '$lib/services/smart-allocation.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user!;
  return json({
    status: 'ready',
    exposure: await getAllocationExposure(user.id, {
      period: parseSmartAllocationPeriod(url.searchParams.get('period')),
      benchmark: parseSmartAllocationBenchmark(url.searchParams.get('benchmark'))
    })
  });
};
