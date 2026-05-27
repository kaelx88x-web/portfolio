import { json } from '@sveltejs/kit';
import {
  orchestrateAiQuestion,
  parseOrchestratorBenchmark,
  parseOrchestratorPeriod
} from '$lib/services/ai-orchestration.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user!;
  const body = await request.json().catch(() => ({}));
  const result = await orchestrateAiQuestion(user.id, {
    conversationId: body.conversationId ?? null,
    question: String(body.question ?? ''),
    period: parseOrchestratorPeriod(body.period ?? null),
    benchmark: parseOrchestratorBenchmark(body.benchmark ?? null),
    analysisMode: body.analysisMode ?? 'fast_chat'
  });

  return json({ status: 'answered', ...result });
};
