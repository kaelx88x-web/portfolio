import { json } from '@sveltejs/kit';
import {
  parsePortfolioAssistantBenchmark,
  parsePortfolioAssistantPeriod,
  refreshPortfolioAssistant
} from '$lib/services/ai-portfolio-assistant.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, locals }) => {
  const user = locals.user!;
  const body = await request.json().catch(() => ({}));
  const refreshed = await refreshPortfolioAssistant(user.id, {
    period: parsePortfolioAssistantPeriod(body.period ?? null),
    benchmark: parsePortfolioAssistantBenchmark(body.benchmark ?? null)
  });

  return json({ status: 'refreshed', ...refreshed });
};
