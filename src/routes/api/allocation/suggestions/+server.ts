import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  getAllocationSuggestions,
  parseSmartAllocationBenchmark,
  parseSmartAllocationPeriod
} from '$lib/services/smart-allocation.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const user = await getDemoUser();
  return json({
    status: 'ready',
    suggestions: await getAllocationSuggestions(user.id, {
      period: parseSmartAllocationPeriod(url.searchParams.get('period')),
      benchmark: parseSmartAllocationBenchmark(url.searchParams.get('benchmark')),
      forceRefresh: url.searchParams.get('refresh') === 'true'
    })
  });
};
