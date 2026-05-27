import { redirect, type Actions } from '@sveltejs/kit';
import {
  getAiCopilotOverview,
  parseCopilotBenchmark,
  parseCopilotPeriod,
  parseInsightType,
  generateAiInsight,
  sendAiCopilotMessage
} from '$lib/services/ai-copilot.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
  const user = locals.user!;
  const period = parseCopilotPeriod(url.searchParams.get('period'));
  const benchmark = parseCopilotBenchmark(url.searchParams.get('benchmark'));
  const overview = await getAiCopilotOverview(user.id, period, benchmark);

  return { user, period, benchmark, ...overview };
};

export const actions: Actions = {
  generateInsight: async ({ request, url, locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    const period = parseCopilotPeriod(url.searchParams.get('period'));
    const benchmark = parseCopilotBenchmark(url.searchParams.get('benchmark'));
    await generateAiInsight(user.id, parseInsightType(form.get('insightType')), period, benchmark);
    throw redirect(303, `/ai?period=${period}&benchmark=${benchmark}`);
  },
  ask: async ({ request, url, locals }) => {
    const user = locals.user!;
    const form = await request.formData();
    const period = parseCopilotPeriod(url.searchParams.get('period'));
    const benchmark = parseCopilotBenchmark(url.searchParams.get('benchmark'));
    const result = await sendAiCopilotMessage(user.id, {
      question: String(form.get('question') ?? ''),
      period,
      benchmark
    });
    throw redirect(303, `/ai/copilot?period=${period}&benchmark=${benchmark}&conversation=${result.conversation?.id}`);
  }
};
