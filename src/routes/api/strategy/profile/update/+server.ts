import { json } from '@sveltejs/kit';
import {
  parseStrategyBenchmark,
  parseStrategyMode,
  parseStrategyPeriod,
  updateStrategyProfile
} from '$lib/services/strategy-orchestrator.service';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request, url, locals }) => {
  const user = locals.user!;
  const body = await request.json().catch(() => ({}));
  const profile = await updateStrategyProfile(user.id, {
    profileType: parseStrategyMode(body.profileType),
    riskTolerance: Number(body.riskTolerance ?? 50),
    incomeTarget: Number(body.incomeTarget ?? 5),
    growthTarget: Number(body.growthTarget ?? 10),
    cashTarget: Number(body.cashTarget ?? 8),
    optionsTarget: Number(body.optionsTarget ?? 10)
  }, {
    period: parseStrategyPeriod(body.period ?? url.searchParams.get('period')),
    benchmark: parseStrategyBenchmark(body.benchmark ?? url.searchParams.get('benchmark'))
  });
  return json({ status: 'saved', profile });
};
