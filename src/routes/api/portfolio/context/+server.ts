import { analyticsJson } from '$lib/server/analytics-api';
import {
  buildAiPortfolioContext,
  parseAiBenchmark,
  parseAiPeriod,
  parseAiScope,
  selectAiContextScope
} from '$lib/services/ai-context.service';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ url, locals }) => {
  const user = locals.user!;
  const context = await buildAiPortfolioContext(user.id, {
    period: parseAiPeriod(url.searchParams.get('period')),
    benchmark: parseAiBenchmark(url.searchParams.get('benchmark'))
  });
  const scope = parseAiScope(url.searchParams.get('scope'));

  return analyticsJson({
    status: 'ready',
    scope,
    context: selectAiContextScope(context, scope)
  });
};
