import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  explainRiskAdvisorQuestion,
  parseRiskAdvisorBenchmark,
  parseRiskAdvisorPeriod,
  parseRiskExplanationType
} from '$lib/services/ai-risk-advisor.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const user = await getDemoUser();
  const body = await request.json().catch(() => ({}));
  const response = await explainRiskAdvisorQuestion(user.id, {
    question: String(body.question ?? ''),
    type: body.type ? parseRiskExplanationType(body.type) : undefined,
    period: parseRiskAdvisorPeriod(body.period ?? null),
    benchmark: parseRiskAdvisorBenchmark(body.benchmark ?? null)
  });
  return json({ status: 'answered', response });
};
