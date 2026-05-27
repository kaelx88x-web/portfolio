import { json } from '@sveltejs/kit';
import {
  generateAiInsight,
  parseCopilotBenchmark,
  parseCopilotPeriod,
  parseInsightType
} from '$lib/services/ai-copilot.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user!;
  const body = await request.json().catch(() => ({}));
  const insight = await generateAiInsight(
    user.id,
    parseInsightType(body.insightType ?? body.type ?? null),
    parseCopilotPeriod(body.period ?? null),
    parseCopilotBenchmark(body.benchmark ?? null)
  );

  return json({ status: 'generated', insight }, { status: 201 });
};
