import { fail, redirect, type Actions } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  BENCHMARKS,
  ANALYTICS_PERIODS,
  type AnalyticsBenchmark,
  type AnalyticsPeriod
} from '$lib/services/analytics.service';
import {
  buildAiPortfolioContext,
  buildAiPromptPayload,
  listAiMemories,
  parseAiBenchmark,
  parseAiPeriod,
  refreshAiMemory
} from '$lib/services/ai-context.service';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url }) => {
  const user = await getDemoUser();
  const period = parseAiPeriod(url.searchParams.get('period'));
  const benchmark = parseAiBenchmark(url.searchParams.get('benchmark'));
  const [context, memories] = await Promise.all([
    buildAiPortfolioContext(user.id, { period, benchmark }),
    listAiMemories(user.id)
  ]);

  return {
    context,
    prompt: buildAiPromptPayload(context),
    memories,
    period,
    benchmark,
    periods: ANALYTICS_PERIODS,
    benchmarks: BENCHMARKS,
    contextJson: JSON.stringify(context, null, 2)
  };
};

export const actions: Actions = {
  refreshMemory: async ({ url }) => {
    const user = await getDemoUser();
    try {
      const period = parsePeriod(url.searchParams.get('period'));
      const benchmark = parseBenchmark(url.searchParams.get('benchmark'));
      await refreshAiMemory(user.id, { period, benchmark });
      throw redirect(303, `/ai-context?period=${period}&benchmark=${benchmark}`);
    } catch (error) {
      if (isRedirect(error)) throw error;
      return fail(400, { message: error instanceof Error ? error.message : 'Unable to refresh AI memory.' });
    }
  }
};

function parsePeriod(value: string | null): AnalyticsPeriod {
  return parseAiPeriod(value);
}

function parseBenchmark(value: string | null): AnalyticsBenchmark {
  return parseAiBenchmark(value);
}

function isRedirect(error: unknown): error is { status: number; location: string } {
  return typeof error === 'object' && error !== null && 'status' in error && 'location' in error;
}
