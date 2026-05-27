import { json } from '@sveltejs/kit';
import {
  sendAiCopilotMessage,
  parseCopilotPeriod,
  parseCopilotBenchmark,
} from '$lib/services/ai-copilot.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  try {
    const user = locals.user!;
    const body = await request.json();
    const period    = parseCopilotPeriod(body.period ?? null);
    const benchmark = parseCopilotBenchmark(body.benchmark ?? null);

    const result = await sendAiCopilotMessage(user.id, {
      conversationId: body.conversationId ?? null,
      question:       String(body.question ?? '').trim(),
      period,
      benchmark,
    });

    return json({
      conversationId: result.conversation?.id ?? null,
      answer:         result.rawAnswer,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'AI request failed.';
    return json({ error: message }, { status: 400 });
  }
};
