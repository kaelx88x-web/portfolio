import { fail, type Actions } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { explainRiskAdvisorQuestion, getRiskAdvisorOverview, parseRiskAdvisorBenchmark, parseRiskAdvisorPeriod, parseRiskExplanationType } from '$lib/services/ai-risk-advisor.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const user = await getDemoUser();
  const period = parseRiskAdvisorPeriod(url.searchParams.get('period'));
  const benchmark = parseRiskAdvisorBenchmark(url.searchParams.get('benchmark'));
  return { period, benchmark, ...(await getRiskAdvisorOverview(user.id, { period, benchmark })) };
};

export const actions: Actions = {
  ask: async ({ request, url }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    try {
      return { answer: await explainRiskAdvisorQuestion(user.id, { question: String(form.get('question') ?? ''), type: parseRiskExplanationType(form.get('type')), period: parseRiskAdvisorPeriod(url.searchParams.get('period')), benchmark: parseRiskAdvisorBenchmark(url.searchParams.get('benchmark')) }) };
    } catch (error) {
      return fail(400, { message: error instanceof Error ? error.message : 'Risk Advisor failed.' });
    }
  }
};
