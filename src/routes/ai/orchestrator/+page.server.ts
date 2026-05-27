import { fail, type Actions } from '@sveltejs/kit';
import {
  getAiOrchestrationOverview,
  orchestrateAiQuestion,
  parseOrchestratorBenchmark,
  parseOrchestratorPeriod
} from '$lib/services/ai-orchestration.service';
import { BENCHMARKS, ANALYTICS_PERIODS } from '$lib/services/analytics.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
  const user = locals.user!;
  const period = parseOrchestratorPeriod(url.searchParams.get('period'));
  const benchmark = parseOrchestratorBenchmark(url.searchParams.get('benchmark'));

  return {
    user,
    period,
    benchmark,
    periods: ANALYTICS_PERIODS,
    benchmarks: BENCHMARKS,
    ...(await getAiOrchestrationOverview(user.id))
  };
};

export const actions: Actions = {
  ask: async ({ request, url, locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    const question = String(form.get('question') ?? '');
    const period = parseOrchestratorPeriod(url.searchParams.get('period'));
    const benchmark = parseOrchestratorBenchmark(url.searchParams.get('benchmark'));

    try {
      return {
        result: await orchestrateAiQuestion(user.id, {
          question,
          period,
          benchmark,
          analysisMode: String(form.get('analysisMode') ?? 'fast_chat') as 'fast_chat'
        })
      };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'AI orchestration failed.' });
    }
  }
};
