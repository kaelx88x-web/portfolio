import { fail, type Actions } from '@sveltejs/kit';
import {
  getStrategyDashboard,
  parseStrategyBenchmark,
  parseStrategyMode,
  parseStrategyPeriod,
  refreshStrategyOrchestrator,
  updateStrategyProfile
} from '$lib/services/strategy-orchestrator.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
  const user = locals.user!;
  const period = parseStrategyPeriod(url.searchParams.get('period'));
  const benchmark = parseStrategyBenchmark(url.searchParams.get('benchmark'));
  return getStrategyDashboard(user.id, { period, benchmark });
};

export const actions: Actions = {
  refresh: async ({ url, locals }) => {
    const user = locals.user!;
    try {
      await refreshStrategyOrchestrator(user.id, {
        period: parseStrategyPeriod(url.searchParams.get('period')),
        benchmark: parseStrategyBenchmark(url.searchParams.get('benchmark'))
      });
      return { status: 'completed', message: 'Strategy orchestrator refreshed.' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Strategy refresh failed.' });
    }
  },
  updateProfile: async ({ request, url, locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    try {
      await updateStrategyProfile(user.id, {
        profileType: parseStrategyMode(form.get('profileType')),
        riskTolerance: Number(form.get('riskTolerance') ?? 50),
        incomeTarget: Number(form.get('incomeTarget') ?? 5),
        growthTarget: Number(form.get('growthTarget') ?? 10),
        cashTarget: Number(form.get('cashTarget') ?? 8),
        optionsTarget: Number(form.get('optionsTarget') ?? 10)
      }, {
        period: parseStrategyPeriod(url.searchParams.get('period')),
        benchmark: parseStrategyBenchmark(url.searchParams.get('benchmark'))
      });
      return { status: 'saved', message: 'Strategy objectives saved.' };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Strategy profile update failed.' });
    }
  }
};
