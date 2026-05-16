import { json } from '@sveltejs/kit';
import { getDemoUser } from '$lib/server/demo-user';
import {
  getRiskExposureDashboard,
  parseRiskExposurePeriod,
  refreshRiskExposure
} from '$lib/services/risk-exposure.service';

export async function loadRiskExposureFromUrl(url: URL) {
  const user = await getDemoUser();
  const period = parseRiskExposurePeriod(url.searchParams.get('period'));
  const riskExposure = await getRiskExposureDashboard(user.id, period);

  return { user, period, riskExposure };
}

export async function refreshRiskExposureFromUrl(url: URL) {
  const user = await getDemoUser();
  const period = parseRiskExposurePeriod(url.searchParams.get('period'));
  const riskExposure = await refreshRiskExposure(user.id, period);

  return { user, period, riskExposure };
}

export function riskExposureJson(data: unknown) {
  return json(data, {
    headers: {
      'cache-control': 'no-store'
    }
  });
}
