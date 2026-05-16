import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  explainPortfolioAssistantQuestion,
  parsePortfolioAssistantBenchmark,
  parsePortfolioAssistantPeriod,
  parsePortfolioExplanationType
} from '$lib/services/ai-portfolio-assistant.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const user = await getDemoUser();
  const body = await request.json().catch(() => ({}));
  const response = await explainPortfolioAssistantQuestion(user.id, {
    question: String(body.question ?? ''),
    type: body.type ? parsePortfolioExplanationType(body.type) : undefined,
    period: parsePortfolioAssistantPeriod(body.period ?? null),
    benchmark: parsePortfolioAssistantBenchmark(body.benchmark ?? null)
  });

  return json({ status: 'answered', response });
};
