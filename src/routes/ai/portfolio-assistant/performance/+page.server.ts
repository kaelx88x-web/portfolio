import { fail, type Actions } from '@sveltejs/kit';
import {
  explainPortfolioAssistantQuestion,
  getPortfolioAssistantOverview,
  parsePortfolioAssistantBenchmark,
  parsePortfolioAssistantPeriod,
  parsePortfolioExplanationType
} from '$lib/services/ai-portfolio-assistant.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
  const user = locals.user!;
  const period = parsePortfolioAssistantPeriod(url.searchParams.get('period'));
  const benchmark = parsePortfolioAssistantBenchmark(url.searchParams.get('benchmark'));
  return { period, benchmark, ...(await getPortfolioAssistantOverview(user.id, { period, benchmark })) };
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
  }
};
