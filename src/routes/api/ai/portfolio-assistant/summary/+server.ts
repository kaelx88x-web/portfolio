import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  getPortfolioAssistantSection,
  parsePortfolioAssistantBenchmark,
  parsePortfolioAssistantPeriod
} from '$lib/services/ai-portfolio-assistant.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const user = await getDemoUser();
  const response = await getPortfolioAssistantSection(user.id, 'portfolio', {
    period: parsePortfolioAssistantPeriod(url.searchParams.get('period')),
    benchmark: parsePortfolioAssistantBenchmark(url.searchParams.get('benchmark')),
    forceRefresh: url.searchParams.get('refresh') === 'true'
  });

  return json({ status: 'ready', response });
};
