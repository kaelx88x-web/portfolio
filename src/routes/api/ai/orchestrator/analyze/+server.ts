import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  orchestrateAiQuestion,
  parseOrchestratorBenchmark,
  parseOrchestratorPeriod
} from '$lib/services/ai-orchestration.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const user = await getDemoUser();
  const body = await request.json().catch(() => ({}));
  const result = await orchestrateAiQuestion(user.id, {
    question: String(body.question ?? 'Analyze my portfolio orchestration context.'),
    period: parseOrchestratorPeriod(body.period ?? null),
    benchmark: parseOrchestratorBenchmark(body.benchmark ?? null),
    analysisMode: body.analysisMode ?? 'deep_analysis'
  });

  return json({ status: 'analyzed', ...result });
};
