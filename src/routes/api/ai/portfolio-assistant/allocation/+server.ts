import { json } from '@sveltejs/kit';
import {
  getPortfolioAssistantSection,
  parsePortfolioAssistantBenchmark,
  parsePortfolioAssistantPeriod
} from '$lib/services/ai-portfolio-assistant.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user!;
  const response = await getPortfolioAssistantSection(user.id, 'allocation', {
    period: parsePortfolioAssistantPeriod(url.searchParams.get('period')),
    benchmark: parsePortfolioAssistantBenchmark(url.searchParams.get('benchmark')),
    forceRefresh: url.searchParams.get('refresh') === 'true'
  });

  return json({ status: 'ready', response });
};
