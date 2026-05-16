import { analyticsJson } from '$lib/server/analytics-api';
import { getDemoUser } from '$lib/server/demo-user';
import {
  getCachedAiContextPayload,
  parseAiBenchmark,
  parseAiPeriod,
  parseAiScope,
  type AiContextScope
} from '$lib/services/ai-context.service';

export async function loadAiContextFromUrl(url: URL, defaultScope: AiContextScope = 'full', forceRefresh = false) {
  const user = await getDemoUser();
  const period = parseAiPeriod(url.searchParams.get('period'));
  const benchmark = parseAiBenchmark(url.searchParams.get('benchmark'));
  const scope = url.searchParams.has('scope') ? parseAiScope(url.searchParams.get('scope')) : defaultScope;

  return getCachedAiContextPayload(user.id, {
    period,
    benchmark,
    scope,
    forceRefresh: forceRefresh || url.searchParams.get('refresh') === 'true'
  });
}

export async function aiContextJson(url: URL, scope: AiContextScope = 'full', forceRefresh = false) {
  return analyticsJson(await loadAiContextFromUrl(url, scope, forceRefresh));
}
