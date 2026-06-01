import { json } from '@sveltejs/kit';
import {
  getPortfolioMetricsDashboard,
  PORTFOLIO_METRIC_PERIODS,
  refreshPortfolioMetrics,
  type PortfolioMetricPeriod
} from '$lib/services/portfolio-metrics.service';

export async function loadPortfolioMetricsFromUrl(userId: string, url: URL) {
  const period = parsePortfolioMetricPeriod(url.searchParams.get('period'));
  const metrics = await getPortfolioMetricsDashboard(userId, null, period);

  return { period, metrics };
}

export async function refreshPortfolioMetricsFromUrl(userId: string, url: URL) {
  const period = parsePortfolioMetricPeriod(url.searchParams.get('period'));
  const metrics = await refreshPortfolioMetrics(userId, null, period);

  return { period, metrics };
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
