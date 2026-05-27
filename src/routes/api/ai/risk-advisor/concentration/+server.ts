import { json } from '@sveltejs/kit';
import {
  getRiskAdvisorOverview,
  parseRiskAdvisorBenchmark,
  parseRiskAdvisorPeriod
} from '$lib/services/ai-risk-advisor.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user!;
  const overview = await getRiskAdvisorOverview(user.id, {
    period: parseRiskAdvisorPeriod(url.searchParams.get('period')),
    benchmark: parseRiskAdvisorBenchmark(url.searchParams.get('benchmark')),
    forceRefresh: url.searchParams.get('refresh') === 'true'
  });
  return json({ status: 'ready', response: overview.concentration, concentration: overview.concentrationTable });
};
