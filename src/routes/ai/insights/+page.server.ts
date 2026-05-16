import { redirect, type Actions } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  generateAiInsight,
  getAiCopilotOverview,
  parseCopilotBenchmark,
  parseCopilotPeriod,
  parseInsightType
} from '$lib/services/ai-copilot.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const user = await getDemoUser();
  const period = parseCopilotPeriod(url.searchParams.get('period'));
  const benchmark = parseCopilotBenchmark(url.searchParams.get('benchmark'));
  return { user, period, benchmark, ...(await getAiCopilotOverview(user.id, period, benchmark)) };
};

export const actions: Actions = {
  generate: async ({ request, url }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    const period = parseCopilotPeriod(url.searchParams.get('period'));
    const benchmark = parseCopilotBenchmark(url.searchParams.get('benchmark'));
    await generateAiInsight(user.id, parseInsightType(form.get('insightType')), period, benchmark);
    throw redirect(303, `/ai/insights?period=${period}&benchmark=${benchmark}`);
  }
};
