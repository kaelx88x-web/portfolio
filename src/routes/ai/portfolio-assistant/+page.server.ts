import { fail, type Actions } from '@sveltejs/kit';
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

export const load: PageServerLoad = async ({ url, locals }) => {
  const period = parsePortfolioAssistantPeriod(url.searchParams.get('period'));
  const benchmark = parsePortfolioAssistantBenchmark(url.searchParams.get('benchmark'));

  try {
    const user = locals.user!;
    return {
      period,
      benchmark,
      periods: ANALYTICS_PERIODS,
      benchmarks: BENCHMARKS,
      ...(await getPortfolioAssistantOverview(user.id, { period, benchmark }))
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('[portfolio-assistant] load error:', message);
    return {
      period,
      benchmark,
      periods: ANALYTICS_PERIODS,
      benchmarks: BENCHMARKS,
      loadError: message,
      narrative: null,
      summary: null,
      allocation: null,
      diversification: null,
      performance: null,
      holdings: null,
      holdingsTable: [],
      storyTimeline: [],
      suggestedQuestions: [],
      recentExplanations: []
    };
  }
};

export const actions: Actions = {
  ask: async ({ request, url, locals }) => {
    const user = locals.user!;
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
  refresh: async ({ url, locals }) => {
    const user = locals.user!;
    await refreshPortfolioAssistant(user.id, {
      period: parsePortfolioAssistantPeriod(url.searchParams.get('period')),
      benchmark: parsePortfolioAssistantBenchmark(url.searchParams.get('benchmark'))
    });
    return { status: 'refreshed' };
  }
};
