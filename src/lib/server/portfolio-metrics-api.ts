import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  getPortfolioMetricsDashboard,
  PORTFOLIO_METRIC_PERIODS,
  refreshPortfolioMetrics,
  type PortfolioMetricPeriod
} from '$lib/services/portfolio-metrics.service';

export async function loadPortfolioMetricsFromUrl(url: URL) {
  const user = await getDemoUser();
  const period = parsePortfolioMetricPeriod(url.searchParams.get('period'));
  const metrics = await getPortfolioMetricsDashboard(user.id, period);

  return { user, period, metrics };
}

export async function refreshPortfolioMetricsFromUrl(url: URL) {
  const user = await getDemoUser();
  const period = parsePortfolioMetricPeriod(url.searchParams.get('period'));
  const metrics = await refreshPortfolioMetrics(user.id, period);

  return { user, period, metrics };
}

export function portfolioMetricsJson(data: unknown) {
  return json(data, {
    headers: {
      'cache-control': 'no-store'
    }
  });
}

function parsePortfolioMetricPeriod(value: string | null): PortfolioMetricPeriod {
  return PORTFOLIO_METRIC_PERIODS.includes(value as PortfolioMetricPeriod)
    ? (value as PortfolioMetricPeriod)
    : 'MAX';
}
