import type { Holding } from '$lib/types/portfolio';

export function calculateTotalGainLoss(holdings: Holding[]) {
  return holdings.reduce((sum, holding) => sum + holding.unrealizedPnl, 0);
}

export function calculateTotalCostBasis(holdings: Holding[]) {
  return holdings.reduce((sum, holding) => sum + holding.costBasis, 0);
}

export function calculateTodayChange(holdings: Holding[]) {
  return holdings.reduce((sum, holding) => sum + holding.marketValue * 0.0025, 0);
}
