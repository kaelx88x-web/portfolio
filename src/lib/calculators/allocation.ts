import type { AllocationSlice, Holding } from '$lib/types/portfolio';

export function calculateAllocationBySymbol(holdings: Holding[]): AllocationSlice[] {
  const totalValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0);
  const grouped = new Map<string, number>();

  for (const holding of holdings) {
    grouped.set(holding.symbol, (grouped.get(holding.symbol) ?? 0) + holding.marketValue);
  }

  return [...grouped.entries()]
    .map(([label, value]) => ({
      label,
      value,
      percentage: totalValue > 0 ? (value / totalValue) * 100 : 0
    }))
    .sort((a, b) => b.value - a.value);
}

export function calculateAllocationByAssetType(holdings: Holding[]): AllocationSlice[] {
  const totalValue = holdings.reduce((sum, holding) => sum + holding.marketValue, 0);
  const grouped = new Map<string, number>();

  for (const holding of holdings) {
    grouped.set(holding.assetType, (grouped.get(holding.assetType) ?? 0) + holding.marketValue);
  }

  return [...grouped.entries()]
    .map(([label, value]) => ({
      label,
      value,
      percentage: totalValue > 0 ? (value / totalValue) * 100 : 0
    }))
    .sort((a, b) => b.value - a.value);
}
