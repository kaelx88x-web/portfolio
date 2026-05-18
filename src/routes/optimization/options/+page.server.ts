import { fail, type Actions } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  getOptionsIntelligenceDashboard,
  parseOptionsBenchmark,
  parseOptionsPeriod,
  refreshOptionsIntelligence
} from '$lib/services/options-intelligence.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const user = await getDemoUser();
  const period = parseOptionsPeriod(url.searchParams.get('period'));
  const benchmark = parseOptionsBenchmark(url.searchParams.get('benchmark'));
  return await getOptionsIntelligenceDashboard(user.id, { period, benchmark });
};

export const actions: Actions = {
  refresh: async ({ url }) => {
    const user = await getDemoUser();
    try {
      return {
        message: 'Options intelligence refreshed.',
        result: await refreshOptionsIntelligence(user.id, {
          period: parseOptionsPeriod(url.searchParams.get('period')),
          benchmark: parseOptionsBenchmark(url.searchParams.get('benchmark'))
        })
      };
    } catch (e) {
      return fail(400, { message: e instanceof Error ? e.message : 'Options intelligence refresh failed.' });
    }
  }
};
