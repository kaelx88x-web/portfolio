import {
  AI_MEMORY_TYPES,
  getAiMemoryOverview,
  parseAiMemoryBenchmark,
  parseAiMemoryPeriod,
  parseAiMemoryType,
  refreshAiMemorySnapshot
} from '$lib/services/ai-memory.service';
import { BENCHMARKS, ANALYTICS_PERIODS } from '$lib/services/analytics.service';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ url, locals }) => {
  const user = locals.user!;
  const period = parseAiMemoryPeriod(url.searchParams.get('period'));
  const benchmark = parseAiMemoryBenchmark(url.searchParams.get('benchmark'));
  const snapshotType = parseAiMemoryType(url.searchParams.get('type'));

  return {
    period,
    benchmark,
    snapshotType,
    periods: ANALYTICS_PERIODS,
    benchmarks: BENCHMARKS,
    ...(await getAiMemoryOverview(user.id, { period, benchmark, snapshotType }))
  };
};

export const actions: Actions = {
  refresh: async ({ url, locals }) => {
    const user = locals.user!;
    await refreshAiMemorySnapshot(user.id, {
      period: parseAiMemoryPeriod(url.searchParams.get('period')),
      benchmark: parseAiMemoryBenchmark(url.searchParams.get('benchmark')),
      snapshotType: parseAiMemoryType(url.searchParams.get('type'))
    });
    return { status: 'refreshed' };
  }
};
