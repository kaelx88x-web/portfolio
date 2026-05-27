import { json } from '@sveltejs/kit';
import {
  getAllocationSuggestions,
  parseSmartAllocationBenchmark,
  parseSmartAllocationPeriod
} from '$lib/services/smart-allocation.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user!;
  return json({
    status: 'ready',
    suggestions: await getAllocationSuggestions(user.id, {
      period: parseSmartAllocationPeriod(url.searchParams.get('period')),
      benchmark: parseSmartAllocationBenchmark(url.searchParams.get('benchmark')),
      forceRefresh: url.searchParams.get('refresh') === 'true'
    })
  });
};
