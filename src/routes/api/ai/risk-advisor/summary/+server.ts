import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  getRiskAdvisorSection,
  parseRiskAdvisorBenchmark,
  parseRiskAdvisorPeriod
} from '$lib/services/ai-risk-advisor.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url }) => {
  const user = await getDemoUser();
  const response = await getRiskAdvisorSection(user.id, 'risk', {
    period: parseRiskAdvisorPeriod(url.searchParams.get('period')),
    benchmark: parseRiskAdvisorBenchmark(url.searchParams.get('benchmark')),
    forceRefresh: url.searchParams.get('refresh') === 'true'
  });
  return json({ status: 'ready', response });
};
