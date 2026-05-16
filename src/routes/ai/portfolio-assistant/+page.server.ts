import { fail, type Actions } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  explainPortfolioAssistantQuestion,
  getPortfolioAssistantOverview,
  parsePortfolioAssistantBenchmark,
  parsePortfolioAssistantPeriod,
  parsePortfolioExplanationType,
  refreshPortfolioAssistant
} from '$lib/services/ai-portfolio-assistant.service';
import { BENCHMARKS, ANALYTICS_PERIODS } from '$lib/services/analytics.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const user = await getDemoUser();
  const period = parsePortfolioAssistantPeriod(url.searchParams.get('period'));
  const benchmark = parsePortfolioAssistantBenchmark(url.searchParams.get('benchmark'));

  return {
    period,
    benchmark,
    periods: ANALYTICS_PERIODS,
    benchmarks: BENCHMARKS,
    ...(await getPortfolioAssistantOverview(user.id, { period, benchmark }))
  };
};

export const actions: Actions = {
  ask: async ({ request, url }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    try {
      return {
        answer: await explainPortfolioAssistantQuestion(user.id, {
          question: String(form.get('question') ?? ''),
          type: parsePortfolioExplanationType(form.get('type')),
          period: parsePortfolioAssistantPeriod(url.searchParams.get('period')),
          benchmark: parsePortfolioAssistantBenchmark(url.searchParams.get('benchmark'))
        })
      };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Portfolio assistant failed.' });
    }
  },
  refresh: async ({ url }) => {
    const user = await getDemoUser();
    await refreshPortfolioAssistant(user.id, {
      period: parsePortfolioAssistantPeriod(url.searchParams.get('period')),
      benchmark: parsePortfolioAssistantBenchmark(url.searchParams.get('benchmark'))
    });
    return { status: 'refreshed' };
  }
};
