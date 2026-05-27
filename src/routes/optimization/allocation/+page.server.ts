import { fail, type Actions } from '@sveltejs/kit';
import {
  getSmartAllocationDashboard,
  parseSmartAllocationBenchmark,
  parseSmartAllocationPeriod,
  refreshSmartAllocation
} from '$lib/services/smart-allocation.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
  const user = locals.user!;
  const period = parseSmartAllocationPeriod(url.searchParams.get('period'));
  const benchmark = parseSmartAllocationBenchmark(url.searchParams.get('benchmark'));
  return await getSmartAllocationDashboard(user.id, { period, benchmark });
};

export const actions: Actions = {
  refresh: async ({ url, locals }) => {
    const user = locals.user!;
    try {
      return {
        message: 'Smart allocation refreshed.',
        result: await refreshSmartAllocation(user.id, {
          period: parseSmartAllocationPeriod(url.searchParams.get('period')),
          benchmark: parseSmartAllocationBenchmark(url.searchParams.get('benchmark'))
        })
      };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Smart allocation refresh failed.' });
    }
  }
};
