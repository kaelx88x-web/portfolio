import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import { getCashBalance, getHoldings } from '$lib/services/portfolio.service';
import { takeSnapshotFromHoldings } from '$lib/services/snapshot.service';
import {
  ANALYTICS_PERIODS,
  BENCHMARKS,
  getAnalyticsDashboard,
  type AnalyticsBenchmark,
  type AnalyticsPeriod
} from '$lib/services/analytics.service';

export async function loadAnalyticsFromUrl(url: URL) {
  const user = await getDemoUser();
  const period = parsePeriod(url.searchParams.get('period'));
  const benchmark = parseBenchmark(url.searchParams.get('benchmark'));
  const analytics = await getAnalyticsDashboard(user.id, period, benchmark);

  return { user, analytics, period, benchmark };
}

export async function recalculateAnalyticsSnapshot() {
  const user = await getDemoUser();
  const [holdings, cashBalance] = await Promise.all([getHoldings(user.id), getCashBalance(user.id)]);
  if (holdings.length === 0 && cashBalance <= 0) {
    throw new Error('No manual transaction holdings found. Sync Moomoo first; analytics will use the latest broker snapshot.');
  }

  await takeSnapshotFromHoldings(user.id, holdings, cashBalance);

  return {
    user,
    analytics: await getAnalyticsDashboard(user.id, 'MAX', 'SPY')
  };
}

export function analyticsJson(data: unknown) {
  return json(data, {
    headers: {
      'cache-control': 'no-store'
    }
  });
}

function parsePeriod(value: string | null): AnalyticsPeriod {
  return ANALYTICS_PERIODS.includes(value as AnalyticsPeriod) ? (value as AnalyticsPeriod) : 'MAX';
}

function parseBenchmark(value: string | null): AnalyticsBenchmark {
  return BENCHMARKS.includes(value as AnalyticsBenchmark) ? (value as AnalyticsBenchmark) : 'SPY';
}
