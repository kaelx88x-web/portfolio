import { json } from '@sveltejs/kit';
import {
  getRiskExposureDashboard,
  parseRiskExposurePeriod,
  refreshRiskExposure
} from '$lib/services/risk-exposure.service';

export async function loadRiskExposureFromUrl(userId: string, url: URL) {
  const period = parseRiskExposurePeriod(url.searchParams.get('period'));
  const riskExposure = await getRiskExposureDashboard(userId, null, period);

  return { period, riskExposure };
}

export async function refreshRiskExposureFromUrl(userId: string, url: URL) {
  const period = parseRiskExposurePeriod(url.searchParams.get('period'));
  const riskExposure = await refreshRiskExposure(userId, null, period);

  return { period, riskExposure };
}

export function riskExposureJson(data: unknown) {
  return json(data, {
    headers: {
      'cache-control': 'no-store'
    }
  });
}
