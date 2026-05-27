import { json } from '@sveltejs/kit';
import {
  getPortfolioAssistantOverview,
  parsePortfolioAssistantBenchmark,
  parsePortfolioAssistantPeriod
} from '$lib/services/ai-portfolio-assistant.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user!;
  const overview = await getPortfolioAssistantOverview(user.id, {
    period: parsePortfolioAssistantPeriod(url.searchParams.get('period')),
    benchmark: parsePortfolioAssistantBenchmark(url.searchParams.get('benchmark')),
    forceRefresh: url.searchParams.get('refresh') === 'true'
  });

  return json({ status: 'ready', response: overview.holdings, holdings: overview.holdingsTable });
};
