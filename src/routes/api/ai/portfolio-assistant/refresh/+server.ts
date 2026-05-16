import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  parsePortfolioAssistantBenchmark,
  parsePortfolioAssistantPeriod,
  refreshPortfolioAssistant
} from '$lib/services/ai-portfolio-assistant.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const user = await getDemoUser();
  const body = await request.json().catch(() => ({}));
  const refreshed = await refreshPortfolioAssistant(user.id, {
    period: parsePortfolioAssistantPeriod(body.period ?? null),
    benchmark: parsePortfolioAssistantBenchmark(body.benchmark ?? null)
  });

  return json({ status: 'refreshed', ...refreshed });
};
