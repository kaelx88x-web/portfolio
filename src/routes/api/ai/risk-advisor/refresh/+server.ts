import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  parseRiskAdvisorBenchmark,
  parseRiskAdvisorPeriod,
  refreshRiskAdvisor
} from '$lib/services/ai-risk-advisor.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
  const user = await getDemoUser();
  const body = await request.json().catch(() => ({}));
  const refreshed = await refreshRiskAdvisor(user.id, {
    period: parseRiskAdvisorPeriod(body.period ?? null),
    benchmark: parseRiskAdvisorBenchmark(body.benchmark ?? null)
  });
  return json({ status: 'refreshed', ...refreshed });
};
