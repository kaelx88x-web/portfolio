import { json } from '@sveltejs/kit';
import { getCashBalance, getHoldings } from '$lib/services/portfolio.service';
import { takeSnapshotFromHoldings } from '$lib/services/snapshot.service';
import {
  ANALYTICS_PERIODS,
  BENCHMARKS,
  getAnalyticsDashboard,
  type AnalyticsBenchmark,
  type AnalyticsPeriod
} from '$lib/services/analytics.service';

export async function loadAnalyticsFromUrl(userId: string, url: URL) {
  const period = parsePeriod(url.searchParams.get('period'));
  const benchmark = parseBenchmark(url.searchParams.get('benchmark'));
  const analytics = await getAnalyticsDashboard(userId, period, benchmark);

  return { analytics, period, benchmark };
}

export async function recalculateAnalyticsSnapshot(userId: string) {
  const [holdings, cashBalance] = await Promise.all([getHoldings(userId), getCashBalance(userId)]);
  if (holdings.length === 0 && cashBalance <= 0) {
    throw new Error('No manual transaction holdings found. Sync Moomoo first; analytics will use the latest broker snapshot.');
  }

  await takeSnapshotFromHoldings(userId, holdings, cashBalance);

  return {
    analytics: await getAnalyticsDashboard(userId, 'MAX', 'SPY')
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
