import { json } from '@sveltejs/kit';
import {
  parseCopilotBenchmark,
  parseCopilotPeriod,
  sendAiCopilotMessage
} from '$lib/services/ai-copilot.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user!;
  const body = await request.json().catch(() => ({}));
  const result = await sendAiCopilotMessage(user.id, {
    conversationId: body.conversationId ?? null,
    question: String(body.question ?? ''),
    period: parseCopilotPeriod(body.period ?? null),
    benchmark: parseCopilotBenchmark(body.benchmark ?? null)
  });

  return json({ status: 'answered', ...result });
};
