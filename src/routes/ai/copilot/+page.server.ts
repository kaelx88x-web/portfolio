import { fail, redirect, type Actions } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  getAiConversation,
  getAiCopilotOverview,
  parseCopilotBenchmark,
  parseCopilotPeriod,
  sendAiCopilotMessage
} from '$lib/services/ai-copilot.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const user = await getDemoUser();
  const period = parseCopilotPeriod(url.searchParams.get('period'));
  const benchmark = parseCopilotBenchmark(url.searchParams.get('benchmark'));
  const conversationId = url.searchParams.get('conversation');
  const overview = await getAiCopilotOverview(user.id, period, benchmark);
  const activeConversation =
    conversationId ? await getAiConversation(user.id, conversationId) : overview.conversations[0] ? await getAiConversation(user.id, overview.conversations[0].id) : null;

  return { user, period, benchmark, activeConversation, ...overview };
};

export const actions: Actions = {
  ask: async ({ request, url }) => {
    const user = await getDemoUser();
    const form = await request.formData();
    const period = parseCopilotPeriod(url.searchParams.get('period'));
    const benchmark = parseCopilotBenchmark(url.searchParams.get('benchmark'));

    try {
      const result = await sendAiCopilotMessage(user.id, {
        conversationId: String(form.get('conversationId') ?? '') || null,
        question: String(form.get('question') ?? ''),
        period,
        benchmark
      });
      throw redirect(303, `/ai/copilot?period=${period}&benchmark=${benchmark}&conversation=${result.conversation?.id}`);
    } catch (error) {
      if (isRedirect(error)) throw error;
      return fail(400, { message: error instanceof Error ? error.message : 'Unable to send AI message.' });
    }
  }
};

function isRedirect(error: unknown): error is { status: number; location: string } {
  return typeof error === 'object' && error !== null && 'status' in error && 'location' in error;
}
